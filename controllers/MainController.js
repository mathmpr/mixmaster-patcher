let normalizeRoot = global.normalizeRoot;
const {BrowserWindow} = require('electron');
let ipcMain = require('electron').ipcMain;
const {DownloaderController} = global.require('controllers/Downloader');
const {PatcherController} = global.require('controllers/Patcher');
let fs = require('fs');
let request = require('request');
let progress = require('request-progress');
const decompress = require("decompress");
let cp = require('child_process');


class MainController {

    /**
     * @var BrowserWindow
     */
    mainWindow = null;
    authData = null;
    config = {
        integrityEndpoint: null,
        authEndpoint: null,
        gameName: null,
        baseUrl: null,
        gameIp: null,
        gamePort: null,
    };

    constructor(app) {

        this.app = app;

        this.config = JSON.parse(
            fs.readFileSync(process.mainModule.path.indexOf('app.asar') >= 0 ?
                normalizeRoot('resources/app.asar/config.json') :
                normalizeRoot('config.json')).toString());

        (async () => {
            await this.#logic();
        })();

        if (!this.#hasGameFiles()) {
            this.#createNewWindow(DownloaderController);
            this.changeWindow(DownloaderController);
        } else {
            this.#createNewWindow(PatcherController);
            this.changeWindow(PatcherController);
        }
    }

    checkConnection(callback) {
        require('dns').lookup('google.com', function (err) {
            if (err && err.code === "ENOTFOUND") {
                callback(false);
            } else {
                callback(true);
            }
        })
    }

    async #getIntegrityMap() {
        let getIntegrity = () => {
            return new Promise((resolve, reject) => {
                request(this.config.baseUrl + this.config.integrityEndpoint + '&name=' + this.config.gameName, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'application/json'
                    },
                }, (error, response, body) => {
                    if (!error) {
                        resolve(JSON.parse(body.trim()));
                    }
                });
            });
        }
        return await getIntegrity();
    }

    async #checkIntegrity() {
        let filesThatIPossibleNoHave = await this.#getIntegrityMap();
        let filesThatIHave = this.#readGameFile();
        return this.#getFilesForDownload(filesThatIPossibleNoHave, filesThatIHave);
    }

    #downloadLogic() {
        ipcMain.on('start-download', () => {

            if (!fs.existsSync(normalizeRoot('game'))) {
                fs.mkdirSync(normalizeRoot('game'), {recursive: true});
            }

            let checkConnectionInterval = 0;

            function initDownload(self) {

                progress(request(self.config.baseUrl + self.config.gameName + '.zip'))
                    .on('progress', (state) => {
                        clearInterval(checkConnectionInterval);
                        checkConnectionInterval = setTimeout(() => {
                            self.checkConnection((status) => {
                                if (!status) self.mainWindow.send('no-internet');
                            });
                        }, 2500);
                        self.mainWindow.send('download-progress', state);
                    })
                    .on('error', (error) => {
                        let checking = setInterval(() => {
                            self.checkConnection((status) => {
                                if (status) {
                                    clearInterval(checking);
                                    initDownload(self);
                                }
                            });
                        }, 1000);
                        self.mainWindow.send('download-error', error);
                    })
                    .on('end', () => {
                        clearInterval(checkConnectionInterval);
                        self.mainWindow.send('download-end');
                        decompress(normalizeRoot(self.config.gameName + '.zip'), normalizeRoot('game')).then((files) => {
                            self.mainWindow.send('decompress-end');
                            fs.unlinkSync(normalizeRoot(self.config.gameName + '.zip'));
                        }).catch((error) => {
                            self.mainWindow.send('decompress-error');
                        });
                    })
                    .pipe(fs.createWriteStream(normalizeRoot(self.config.gameName + '.zip')));
            }

            initDownload(this);

        });

        ipcMain.on('open-patcher', () => {
            this.mainWindow.close();
            this.#createNewWindow(PatcherController);
            this.changeWindow(PatcherController, false);
        });
    }

    async #patcherLogic() {

        ipcMain.on('verify-integrity', async () => {

            let filesThatINeedToDownload = await this.#checkIntegrity();

            let total = filesThatINeedToDownload.length;

            function updateGameFiles(self, filesThatINeedToDownload, alreadyUpdate = 0) {

                if (filesThatINeedToDownload.length === 0) {
                    setTimeout(() => {
                        self.mainWindow.send('update-finish');
                    }, 3000);
                    return;
                }

                self.mainWindow.send('updating', {
                    total,
                    alreadyUpdate,
                });

                let current = filesThatINeedToDownload.shift();

                let pureFile = current.dirname.split(self.config.gameName);
                if (pureFile.length === 1) {
                    pureFile = '';
                } else {
                    pureFile = pureFile.pop();
                }

                let file = normalizeRoot('game' + pureFile + '/' + current.basename);

                let url = self.config.baseUrl + ('/' + self.config.gameName + pureFile + '/' + current.basename).split('//').join('/');

                let folder = normalizeRoot('game' + pureFile);

                if (!fs.existsSync(folder)) {
                    fs.mkdirSync(folder, {recursive: true});
                }

                progress(request(url))
                    .on('error', (error) => {
                        let checking = setInterval(() => {
                            self.checkConnection((status) => {
                                if (status) {
                                    clearInterval(checking);
                                    updateGameFiles(self, [current].concat(filesThatINeedToDownload), alreadyUpdate);
                                }
                            });
                        }, 1000);
                        self.mainWindow.send('download-error', error);
                    })
                    .on('end', () => {
                        alreadyUpdate++;
                        updateGameFiles(self, filesThatINeedToDownload, alreadyUpdate);
                    })
                    .pipe(fs.createWriteStream(file));
            }

            updateGameFiles(this, filesThatINeedToDownload);
        });

        ipcMain.on('auth', (event, args) => {
            request.post(this.config.baseUrl + this.config.authEndpoint, {
                form: {
                    username: args.username,
                    password: args.password
                }
            }, (error, response, body) => {
                let status = JSON.parse(body.trim());
                if (status.status) {
                    this.authData = {
                        username: args.username,
                        password: args.password,
                        fullscreen: args.fullscreen,
                    };
                }
                this.mainWindow.send('auth-status', status);
            })
        });

    }

    #getFilesForDownload(filesThatIPossibleNoHave, filesThatIHave) {
        let find = (file) => {
            for (let i in filesThatIHave) {
                let _file = filesThatIHave[i];
                if (file.basename === _file.basename) {
                    if (file.filesize === _file.filesize) {
                        return true;
                    }
                }
            }
            return false;
        };

        return filesThatIPossibleNoHave.filter((file) => {
            return !find(file);
        });
    }

    #readGameFile() {
        function getFiles(path) {
            let founded = [];
            let files = fs.readdirSync(path);
            files.forEach((file) => {
                let status = fs.lstatSync(path + file);
                if (status.isDirectory()) {
                    founded = founded.concat(getFiles(path + file + '/'));
                } else {
                    founded.push({
                        basename: file,
                        filesize: status.size
                    });
                }
            });
            return founded;
        }

        return getFiles('./game/');
    }

    async #logic() {

        /**
         * register events and communication between
         * main process and opened windows (downloader and patcher)
         */

        if (fs.existsSync(normalizeRoot(this.config.gameName + '.zip'))) {
            fs.unlinkSync(normalizeRoot(this.config.gameName + '.zip'));
        }

        this.#downloadLogic();

        await this.#patcherLogic();

        ipcMain.on('close-app', () => {
            this.app.quit();
        });

        ipcMain.on('try-open-game', () => {
            if (this.authData) {
                let version = fs.readFileSync('./game/mixmaster.cfg').toString().replace('ver', '').trim();
                let commands = [version, this.config.gameIp, this.config.gamePort, (this.authData.fullscreen ? '1' : '0'), this.authData.username, this.authData.password, "1", "AURORA_BR", "exit"];
                let bat = normalizeRoot('game/open.bat');
                fs.writeFileSync(bat, 'CD ' + normalizeRoot('game') + '\nstart MixMaster.exe ' + commands.join(' ').trim());

                cp.execSync(bat, {
                    detached: true,
                });

                fs.unlinkSync(bat);

                setTimeout(() => {
                    this.app.quit();
                }, 1500);
            }
        });

    }

    changeWindow(controllerClass, animate = true) {
        this.mainWindow.setSize(controllerClass.WIDTH, controllerClass.HEIGHT);
        this.mainWindow.center();
        if (animate) {
            this.#animateWindowOpacity();
        } else {
            this.mainWindow.setOpacity(1);
            this.mainWindow.show();
        }
        return this.mainWindow.loadFile(controllerClass.VIEW);
    }

    #hasGameFiles() {
        return fs.existsSync('./game');
    }

    #animateWindowOpacity() {
        this.mainWindow.show();
        let initial = 0;
        let interval = setInterval(() => {
            initial += 0.02;
            this.mainWindow.setOpacity(initial);
            if (initial >= 1) {
                clearInterval(interval);
            }
        }, 10);
    }

    #createNewWindow(controllerClass) {
        const window = new BrowserWindow({
            frame: false,
            resizable: false,
            opacity: 0,
            icon: normalizeRoot('assets/images/icon.png'),
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true,
                preload: controllerClass.PRELOAD
            },
        });

        window.hide();

        this.mainWindow = window;
        return window;
    }

}

module.exports = {
    MainController
}