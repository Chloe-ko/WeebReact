const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const url = require ('url');

let win

var isMaximized;

function createWindow() {
	win = new BrowserWindow({width: 1200, height: 700, frame: false, minWidth: 700, minHeight: 500, title: "WeebReact", backgroundColor: "#1f1f1f", show: false});
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
	win.on('ready-to-show', function() {
		win.show()
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
