const sql = require('better-sqlite3');
const fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;
const dialog = remote.require('electron').dialog;
var loadnew = true;
var pictureid = 0;
var firstRun = true;
var canLoadMore = true;
if(fs.existsSync(process.env.APPDATA + "\\WeebReact\\data.sqlite")) {
	firstRun = false;
}
var db = new sql(process.env.APPDATA + "\\WeebReact\\data.sqlite");
var piccount;
if(!firstRun) {
	countPics();
}
function init() {
	document.getElementById("minimize-btn").addEventListener("click", function (e) {
		const window = remote.getCurrentWindow();
		window.minimize();
	});
	document.getElementById("maximize-btn").addEventListener("click", function (e) {
		const window = remote.getCurrentWindow();
		if (!window.isMaximized()) {
			window.maximize();
			checkIfAtBottom();
		} else {
			window.unmaximize();
			checkIfAtBottom();
		}
	});
	document.getElementById("close-btn").addEventListener("click", function (e) {
		const window = remote.getCurrentWindow();
		db.close();
		window.close();
	});
	if(firstRun) {
		document.getElementById('mainpage').style.display = "none";
		document.getElementById('setupcontentframe').innerHTML = "<div id=\"setupcontent\">Welcome!<br /><br />It looks like you are running WeebReact for the first time. Please select the folder that contains your Reaction Pictures.<br /><br /><br /><button id=\"browsefolder\" class=\"roundbutton\">Select Folder</button><br /><br /><br /><div id=\"filetype-hint\">Supported Filetypes: .jpg .jpeg .png .gif .webm .mp4</div></div>";
		document.getElementById('browsefolder').addEventListener("click", function() {
			dialog.showOpenDialog({properties:['openDirectory']}, checkPictures);
		});
		document.getElementById('overlay').style.display = 'block';
		document.getElementById('setup').style.display = 'block';
		db.pragma('journal_mode = WAL');
		var createpicturetable = db.prepare('CREATE TABLE pictures (id integer primary key autoincrement, filename text, path text, unique(filename, path));');
		createpicturetable.run();
		var createtagtable = db.prepare('CREATE TABLE tags (tag text, picture int, unique(tag, picture));');
		createtagtable.run();
	} else {
		removeElementById("setup");
		loadPictures();
	}
		document.getElementById("mainpagecontent").addEventListener("scroll", function() {
			checkIfAtBottom();
		});
		window.addEventListener("resize", function() {
			checkIfAtBottom();
		});
		document.getElementById("mainpageoverlay").style.display = "none";
}
function checkIfAtBottom() {
	obj = document.getElementById("mainpagecontent");
	if(obj.scrollHeight - obj.clientHeight - obj.scrollTop < 80) {
		if(loadnew && canLoadMore) {
			loadnew = false;
			loadMorePictures();
			loadnew = true;
		}
	}
}
function loadMorePictures() {
	var mainHeight = document.getElementById("mainpagecontent").clientHeight;
	var mainWidth = document.getElementById("mainpagecontent").clientWidth;
	var picAmount = (Math.floor(mainWidth/210)*Math.floor(mainHeight/210));
	if(pictureid + picAmount > piccount) {
		picAmount = piccount - pictureid;
		canLoadMore = false;
	}
	var pictures = db.prepare('SELECT * FROM pictures ORDER BY id ASC LIMIT ? OFFSET ?').all(picAmount, pictureid);
	var i;
	var htmlToAdd = "";
	for(i = 0; i < picAmount; i+=1) {
		htmlToAdd += "<div class=\"piccontainer\"><img draggable=\"true\" ondragstart=\"drag(event, \'" + pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\\\\" + pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>";
		pictureid++;
	}
	document.getElementById('picloader').insertAdjacentHTML('beforeBegin', htmlToAdd);
	if(!canLoadMore) {
		removeElementById('picloader');
	}
}
function loadPictures() {
	
		var mainHeight = document.getElementById("mainpagecontent").clientHeight;
		var mainWidth = document.getElementById("mainpagecontent").clientWidth;
		var picAmount = 3*(Math.floor(mainWidth/210)*Math.floor(mainHeight/210));
		if(piccount < picAmount) {
			picAmount = piccount;
			canLoadMore = false;
		}
		var pictures = db.prepare('SELECT * FROM pictures ORDER BY id ASC LIMIT ?').all(picAmount);
		var i;
		for(i = 0; i < picAmount; i+=1) {
			document.getElementById("mainpagecontent").innerHTML += "<div class=\"piccontainer\"><img draggable=\"true\" ondragstart=\"drag(event, \'" + pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\\\\" + pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>";
			pictureid++;
		}
		if(canLoadMore) {
			document.getElementById("mainpagecontent").innerHTML += "<div id=\"picloader\"><div class=\"loader\"></div></div>";
		}
}
function checkPictures(directory) {
	if(directory != undefined) {
			document.getElementById('setupcontentframe').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div>";
			if(checkIfHasSubdirs(directory.toString())) {
				document.getElementById('setupcontentframe').innerHTML = "<div id=\"setupcontent\"><br /><br /><br />This directory contains subdirectories.<br /><br />Include pictures contained in subdirectories?<br /><br /><button id=\"subyes\" class=\"setupbutton\">Yes</button><button id=\"subno\" class=\"setupbutton\">No</button></div>";
				document.getElementById('subyes').addEventListener("click", function() {addPictures(directory.toString(), true);});
				document.getElementById('subno').addEventListener("click", function() {addPictures(directory.toString(), false);});
			} else {
				addPictures(directory.toString(), false);
			}
	}
}
function countPics() {
	piccount = db.prepare('SELECT count(*) from pictures').get()["count(*)"];
}
function checkIfHasSubdirs(dir) {
	var hasSubdirs = false;
	var files = fs.readdirSync(dir);
	var i;
	var name;
	for(i = 0; i < files.length; i+=1) {
		if(!files.hasOwnProperty(i)) {
				break;
		}
		name = dir+'\\'+files[i];
		if(fs.statSync(name).isDirectory()) {
			hasSubdirs = true;
			break;
		}
	}
	return hasSubdirs;
}
function removeElementById(id) {
	document.getElementById(id).parentNode.removeChild(document.getElementById(id));
}
function addPictures(directory, sub) {
	document.getElementById('setupcontentframe').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div>";
	setTimeout(function() {
		var pictures;
		if(sub) {
			pictures = getFilesR(directory);
		} else {
			pictures = getFiles(directory);
		}
		var i;
		var path;
		var filename;
		var extension;
		var x = 0;
		var addpic;
		for (i = 0; i < pictures.length; i+=1) {
			path = pictures[i].substring(0, Math.max(pictures[i].lastIndexOf("/"), pictures[i].lastIndexOf("\\")));
			filename = pictures[i].split('\\').pop().split('/').pop();
			extension = filename.substr(filename.lastIndexOf('.') + 1);
			if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
				addpic = db.prepare('INSERT INTO pictures (filename, path) VALUES (?,?);').run(filename, path);
				x++;
			}
		}
		document.getElementById('setupcontentframe').innerHTML = "<div id=\"setupcontent\"><br /><br /><br />Successfully added " + x + " pictures!<br /><br /><br /><button id=\"finishsetup\" class=\"roundbutton\">Continue</button></div>";
		piccount = x;
		document.getElementById('finishsetup').addEventListener("click", function() {
			document.getElementById('setup').innerHTML = "";
			document.getElementById('setup').style.display = 'none';
			document.getElementById('overlay').style.display = 'none';
			document.getElementById('mainpage').style.display = "block";
			loadPictures();
		});
	}, 50);
}
function getFiles(dir){
	fileList = [];
	var files = fs.readdirSync(dir);
	var i;
	for(i = 0; i < files.length; i+=1){
		if (!files.hasOwnProperty(i)) {
			break;
			}
		var name = dir+'\\'+files[i];
		if (!fs.statSync(name).isDirectory()){
			fileList.push(name);
		}
	}
	return fileList;
}
function getFilesR(dir, fileList){
	fileList = fileList || [];
	var files = fs.readdirSync(dir);
	var i;
	for(i = 0; i < files.length; i+=1){
		if (!files.hasOwnProperty(i)) {
			break;
		}
		var name = dir+'\\'+files[i];
		if (fs.statSync(name).isDirectory()){
			getFilesR(name, fileList);
		} else {
			fileList.push(name);
		}
	}
	return fileList;
}
function drag(event, path) {
	event.preventDefault();
	ipcRenderer.send('ondragstart', path);
}
function reload() {
	ipcRenderer.send('reload');
}
document.onreadystatechange = function () {
	if (document.readyState == "complete") {
		init();
	}
};
window.onbeforeunload = function() {
	db.close();
};