const path = require("path");
let ipcRenderer = require('electron').ipcRenderer;

class Patcher {

    static WIDTH = 1000;
    static HEIGHT = 600;
    static VIEW = 'views/patcher.html';
    static PRELOAD = path.join(__filename);

    static logic() {

        document.querySelector('.controls .x').addEventListener('click', () => {
            ipcRenderer.send('close-app');
        });

        let form = document.querySelector('.form .inputs');

        function disableInputs() {
            form.querySelectorAll('.control').forEach((el) => {
                let input = el.querySelector('input');
                if (input) {
                    input.disabled = true;
                }
                el.disabled = true;
                el.classList.add('disabled');
            });
        }

        function enableInputs() {
            form.querySelectorAll('.control').forEach((el) => {
                let input = el.querySelector('input');
                if (input) {
                    input.disabled = false;
                }
                el.disabled = false;
                el.classList.remove('disabled');
            });
            checkInputPopulate();
        }

        disableInputs();

        setTimeout(() => {
            ipcRenderer.send('verify-integrity');
        }, 2000);

        let status = document.querySelector('header .status');
        let statusSpan = status.querySelector('span');

        ipcRenderer.on('updating', (event, args) => {
            statusSpan.innerHTML = args.total + '/' + args.alreadyUpdate + ' arquivos atualizados';
        });

        ipcRenderer.on('update-finish', () => {
            statusSpan.innerHTML = 'O client está totalmente atualizado';
            status.classList.add('ready');
            enableInputs();
            ipcRenderer.send('try-open-game');
        });

        let formButton = form.querySelector('button');
        let formError = form.querySelector('.error');

        function checkInputPopulate() {
            let inputs = form.querySelectorAll('input');
            let oks = 0;
            inputs.forEach((input) => {
                if (input.value.trim() !== '') oks++;
            });
            if (inputs.length === oks) {
                formButton.disabled = false;
                formButton.parentElement.classList.remove('disabled');
            } else {
                formButton.disabled = true;
                formButton.parentElement.classList.add('disabled');
            }
        }

        form.querySelectorAll('input').forEach((input) => {
            input.addEventListener('keyup', (event) => {
                if (event.keyCode === 13 || event.keyCode === 10) {
                    formButton.dispatchEvent(new Event('click'));
                }
                checkInputPopulate();
            });
        });

        form.querySelector('input[type="radio"] + label').addEventListener('click', (event) => {
            if (event.target.previousElementSibling.checked) {
                event.target.previousElementSibling.checked = false;
                event.stopPropagation();
                event.preventDefault();
            }
        });


        checkInputPopulate();

        ipcRenderer.on('auth-status', (event, auth) => {
            if (auth.status) {
                status.classList.remove('ready');
                statusSpan.innerHTML = 'Verificando o client novamente';
                setTimeout(() => {
                    ipcRenderer.send('verify-integrity');
                }, 2000);
            } else {
                enableInputs();
                formError.classList.remove('no-display');
            }
        });

        formButton.addEventListener('click', () => {
            formError.classList.add('no-display');
            if (!formButton.disabled) {
                disableInputs();
                ipcRenderer.send('auth', {
                    username: document.querySelector('#username').value,
                    password: document.querySelector('#password').value,
                    fullscreen: document.querySelector('#fullscreen').checked,
                });
            }
        });
    }
}


if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        Patcher.logic();
    });
}

module.exports = {
    PatcherController: Patcher
}