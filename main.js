const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const url = require ('url');

let win

function createWindow() {
	win = new BrowserWindow({width: 1200, height: 700, frame: false, minWidth: 700, minHeight: 500, title: "WeebReact", transparent: true});
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file',
	slashes: true}));
	win.webContents.on('will-navigate', function(event) {
		event.preventDefault();
	});
	win.on('closed', () => {
		win = null
	});
	ipcMain.on('reload', function() {
		win.reload();
	});
	win.on('move', function() {
		console.log("test");
	});
	win.webContents.openDevTools();
}

app.on('ready', createWindow);
ipcMain.on('ondragstart', (event,filePath) => {
	event.sender.startDrag({
		file: filePath,
		icon: ''
	})
});