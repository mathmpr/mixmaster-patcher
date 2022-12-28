## Getting start

### Requirements

 - NodeJS > 15

### Installing NodeJS

Try to install node via NVM. Enter this [link](https://github.com/coreybutler/nvm-windows/releases/tag/1.1.10). That link is the lasted NVM version. Scroll page and find nvm-setup.exe and download it. Install NVM, then open a new command line tool (Terminal, Command Line or PowerShell).

Execute `nvm install 19` and execute after, `nvm use 19`.

### Start

 - Open a terminal and navigate to directory root of this project, then execute on terminal `npm install`;
 - To open project, just execute `npm start`;
 - Project not have live reload modules, so if you make changes with the app opened with `npm start`, you have to kill first `npm start` and execute `npm start` again. In the future, we can put live reload system to app;

### Build

 - Just execute in the project root: `npm run build`;
 - Unpacked app and app installer are located in `./dist` folder;
