const {app} = require('electron');

global.root = process.mainModule.path.replace('\\resources\\app.asar', '').trim();
global.normalizeRoot = function (appends) {
    if (appends.indexOf('\\') === 0 || appends.indexOf('/') === 0) {
        appends = appends.substring(1);
    }
    return process.platform === "win32" ?
        (global.root + "\\" + appends).split('/').join('\\') :
        (global.root + "/" + appends).split('\\').join('/');
}

global.require = function (module) {
    return process.mainModule.path.indexOf('app.asar') >= 0 ?
        require(global.normalizeRoot('resources/app.asar/' + module)) :
        require(global.normalizeRoot(module))
}

const {MainController} = global.require('controllers/MainController');

app.whenReady().then(async () => {
    await new MainController(app);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
});