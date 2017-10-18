var checkForUpdates = true;
if (require('electron-squirrel-startup')) return;
const {app, BrowserWindow, ipcMain, autoUpdater, dialog} = require('electron');
if (handleSquirrelEvent()) {
  return;
}
const path = require('path');
const url = require ('url');
const appVersion = app.getVersion();
const os = require('os');
const updateFeedUrl = "http:\/\/shironomia.de:3000";
const fs = require('fs');

var checkingForUpdate = false;
var downloadingUpdate = false;
var promptedQuit = false;

let win;


autoUpdater.setFeedURL(updateFeedUrl);
autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName) => {
  if(!promptedQuit) {
    downloadingUpdate = false;
    let message = 'An update for WeebReact is now available. It will be installed the next time you restart the application.';
    dialog.showMessageBox({
      type: 'question',
      buttons: ['Install and Relaunch', 'Later'],
      defaultId: 0,
      message: 'A new version of WeebReact has been downloaded',
      detail: message
    }, response => {
      if (response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  } else {
    app.quit();
  }
});
autoUpdater.on('checking-for-update', (event, arg) => {
  if(!promptedQuit) {
    checkingForUpdate = true;
  } else {
    app.quit();
  }
});
autoUpdater.on('update-available', (event, arg) => {
  if(!promptedQuit) {
    checkingForUpdate = false;
    downloadingUpdate = true;
  } else {
    app.quit();
  }
});
autoUpdater.on('update-not-available', (event, arg) => {
  if(!promptedQuit) {
    checkingForUpdate = false;
  } else {
    app.quit();
  }
});
function createWindow() {
  win = new BrowserWindow({width: 1100, height: 730, frame: false, minWidth: 1010, minHeight: 500, title: "WeebReact", backgroundColor: "#1f1f1f", show: false, icon: __dirname + '/WeebReact.ico'});
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file',
  slashes: true}));
  win.webContents.on('will-navigate', function(event) {
    event.preventDefault();
  });
  win.on('closed', () => {
    win = null;
    if(checkingForUpdate || downloadingUpdate) {
      promptedQuit = true;
    } else {
      app.quit();
    }
  });
  ipcMain.on('reload', function() {
    win.reload();
  });
  win.on('ready-to-show', function() {
    win.show();
  });
  if(fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'Update.exe'))) {
    if(fs.existsSync(process.env.APPDATA + "\\WeebReact\\OpenDevTools")) {
      win.webContents.openDevTools();
    }
    if(checkForUpdates) {
      try {autoUpdater.checkForUpdates();} catch(err) {}
    }
  } else {
    win.webContents.openDevTools();
  }
}
app.on('ready', createWindow);
ipcMain.on('ondragstart', (event,filePath) => {
  event.sender.startDrag({
    file: filePath,
    icon: ''
  })
});
process.on('uncaughtException', function(error) {
  fs.writeFileSync(process.env.APPDATA + "\\WeebReact\\error.log", error);
});
function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
      spawnUpdate(['--createShortcut', exeName]);
      checkForUpdates = false;
    case '--squirrel-updated':
      spawnUpdate(['--createShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-uninstall':
      spawnUpdate(['--removeShortcut', exeName]);
      setTimeout(app.quit, 1000);
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
};
