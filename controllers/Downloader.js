const path = require("path");
let ipcRenderer = require('electron').ipcRenderer;

class DownloaderController {

    static WIDTH = 325;
    static HEIGHT = 400;
    static VIEW = 'views/downloader.html';
    static PRELOAD = path.join(__filename)
    static logic() {

        setTimeout(() => {
            ipcRenderer.send('start-download');
        }, 3000);

        let download = document.querySelector('#download');
        let statusSpan = download.querySelector('.status span')

        ipcRenderer.on('download-progress', (event, state) => {
            download.querySelector('.progress div').style.width = Math.round(state.percent * 100).toFixed(0) + '%';
            statusSpan.classList.remove('error');
            statusSpan.innerHTML =
                'Baixados ' + Math.round(state.percent * 100).toFixed(0) + '% a ' + (state.speed / 1024 / 1024).toFixed(2) + 'Mbp/s';
        });

        ipcRenderer.on('no-internet', (event, error) => {
            statusSpan.classList.add('error');
            statusSpan.innerHTML = 'Sem conexão com a internet';
        });

        ipcRenderer.on('download-error', (event, error) => {
            statusSpan.classList.add('error');
            statusSpan.innerHTML = 'Sem conexão com a internet';
        });

        let unzipInterval = 0;
        let status = download.querySelector('.status');

        ipcRenderer.on('download-end', () => {
            download.removeChild(download.querySelector('.progress'));
            status.innerHTML = 'Descompactando';
            unzipInterval = setInterval(() => {
                status.innerText += '.';
                if (status.innerText.indexOf('....') >= 0) {
                    status.innerText = status.innerText.replace('...', '');
                }
            }, 500);
        });

        ipcRenderer.on('decompress-end', () => {
            status.innerHTML = 'Abrindo o patcher';
            setTimeout(() => {
                ipcRenderer.send('open-patcher')
            }, 2000);
        });

    }
}


if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        DownloaderController.logic();
    });
}

module.exports = {
    DownloaderController
}