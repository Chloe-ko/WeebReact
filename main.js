const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const url = require ('url');

let win

var isMaximized;

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
	ipcMain.on('getPositionSize', function() {
		win.webContents.send('sendPositionSize', {pos: win.getPosition(), size: win.getSize()});
	});
	ipcMain.on('setPositionSize', function(event, data) {
		win.setSize(data.size[0], data.size[1]);
		win.setPosition(data.pos[0], data.pos[1]);
	});
	ipcMain.on('maximize', function () {
		isMaximized = true;
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
