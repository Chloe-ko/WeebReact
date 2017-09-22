const sql = require('better-sqlite3');
const fs = require('fs');
const ipcRenderer = require('electron').ipcRenderer;
const remote = require('electron').remote;
const dialog = remote.require('electron').dialog;
const xxh = require('xxhash');
const path = require('path');
var loadnew = true;
var pictureid = 0;
var firstRun = true;
var canLoadMore = true;
var dirList;
var xxhashsalt = 4152;
var sqlalreadysetup = false;
if(fs.existsSync(process.env.APPDATA + "\\WeebReact\\data.sqlite")) {
	firstRun = false;
}
var db = new sql(process.env.APPDATA + "\\WeebReact\\data.sqlite");
if(!firstRun) {
	var firstR = db.prepare("SELECT count(*) FROM directories").get()["count(*)"];
	if(firstR == 0) {
		firstRun = true;
		sqlalreadysetup = true;
	}
}
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
		if(!window.isMaximized()) {
			window.maximize();
		} else {
			window.unmaximize();
		}
	});
	document.getElementById("close-btn").addEventListener("click", function (e) {
		const window = remote.getCurrentWindow();
		db.close();
		window.close();
	});
	if(firstRun) {
		document.getElementById('mainpage').style.display = "none";
		document.getElementById('greyboxr').style.backgroundColor = "#282828";
		document.getElementById('greyboxl').style.backgroundColor = "#282828";
		document.getElementById('setupcontent').innerHTML = "Welcome!<br /><br />It looks like you don't have any folders set up yet. Please select the folder that contains your Reaction Pictures.<br /><br /><br /><button id=\"browsefolder\" class=\"roundbutton\">Select Folder</button><br /><br /><br /><div id=\"filetype-hint\">Supported Filetypes: .jpg .jpeg .png .gif .webm .mp4</div>";
		document.getElementById('browsefolder').addEventListener("click", function() {
			dialog.showOpenDialog({properties:['openDirectory']}, checkPictures);
		});
		document.getElementById('overlay').style.display = 'block';
		document.getElementById('setup').style.display = 'block';
		if(!sqlalreadysetup) {
			db.pragma('journal_mode = WAL');
			db.prepare('CREATE TABLE pictures (id integer primary key autoincrement, filename text, path text, hash text unique, excluded integer, unique(path, filename));').run();
			db.prepare('CREATE TABLE tags (tag text, id int, unique(tag, id));').run();
			db.prepare('CREATE TABLE directories (directory text, includeSubdirectories integer, watch integer);').run();
		}
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
	obj2 = document.getElementById("picturecontainer");
	if(obj2.scrollHeight - obj.clientHeight - obj.scrollTop < 80) {
		if(loadnew && canLoadMore) {
			loadnew = false;
			loadMorePictures();
			loadnew = true;
			checkIfAtBottom();
		}
	}
}
function loadMorePictures() {
	if(canLoadMore) {
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
			document.getElementById("picturecontainer").innerHTML += "<div class=\"piccontainer\"><img draggable=\"true\" ondragstart=\"drag(event, \'" + pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\\\\" + pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>";
			pictureid++;
		}
		document.getElementById("picturescrollcontainer").style.height = Math.ceil(piccount/Math.floor(mainWidth/210))*210 + "px";
		if(canLoadMore) {
			document.getElementById("picturecontainer").innerHTML += "<div id=\"picloader\"><div class=\"loader\"></div></div>";
		}
}
function checkPictures(directory) {
	if(directory != undefined) {
			document.getElementById('setupcontent').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div>";
			if(checkIfHasSubdirs(directory.toString())) {
				document.getElementById('setupcontent').innerHTML = "<br /><br /><br />This directory contains subfolders.<br /><br />Include pictures contained in subfolders?<br /><br /><button id=\"subyes\" class=\"setupbutton\">Yes</button><button id=\"subno\" class=\"setupbutton\">No</button>";
				document.getElementById('subyes').addEventListener("click", function() {askIfTagged(directory.toString());});
				document.getElementById('subno').addEventListener("click", function() {addFolder(directory.toString(), false, false);});
			} else {
				addFolder(directory.toString(), false, false);
			}
	}
}
function askIfTagged(dir) {
	document.getElementById('setupcontent').innerHTML = "<br /><br />Do you want pictures inside of subfolders to automatically get tagged depending on what folder they are in?<br /><br />e.g. Pictures in the folder \"happy\" will have the \"happy\" tag.<br /><br /><button id=\"tagyes\" class=\"setupbutton\">Yes</button><button id=\"tagno\" class=\"setupbutton\">No</button>"
	document.getElementById('tagyes').addEventListener("click", function() {
		addFolder(dir, true, true);
	});
	document.getElementById('tagno').addEventListener("click", function() {
		addFolder(dir, true, false);
	})
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
function getDirectories(dir, isSub, isSubOf) {
	var files = fs.readdirSync(dir);
	dirList = dirList || [];
	var i;
	for(i = 0; i < files.length; i += 1) {
		if(fs.lstatSync(dir + "\\" + files[i]).isDirectory()) {
			if(!isSub) {
				dirList.push(files[i]);
				getDirectories(dir + "\\" + files[i], true, files[i]);
			} else {
				dirList.push(isSubOf + "\\" + files[i])
				getDirectories(dir + "\\" + files[i], true, isSubOf + "\\" + files[i]);
			}
		}
	}
	return dirList;
}
function addFolder(directory, sub, tag) {
	document.getElementById('setupcontent').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div>";
	var subb;
	if(sub) {
		subb = 1;
	} else {
		subb = 0;
	}
	setTimeout(function() {
		db.prepare('INSERT INTO directories VALUES (?, ?, ?);').run(directory, subb, 1);
		var pictures;
		var x = 0;
		var i;
		var z;
		var o;
		var picpath;
		var filename;
		var extension;
		var tags;
		var id;
		var checkduplicate;
		pictures = getFiles(directory);
		for (i = 0; i < pictures.length; i += 1) {
			picpath = pictures[i].substring(0, pictures[i].lastIndexOf("\\"));
			filename = pictures[i].split('\\').pop();
			extension = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
			if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
				filehash = xxh.hash64(fs.readFileSync(pictures[i]), xxhashsalt, 'hex');
				checkduplicate = db.prepare('SELECT count(*) FROM pictures WHERE hash = ?;').get(filehash)["count(*)"];
				if(checkduplicate == 0) {
					db.prepare('INSERT INTO pictures (filename, path, hash, excluded) VALUES (?,?,?,?);').run(filename, picpath, filehash, 0);
					x++;
				}
			}
		}
		if(sub) {
			var directories = getDirectories(directory, false, "");
			for(z = 0; z < directories.length; z += 1) {
				pictures = getFiles(directory + "\\" + directories[z]);
				for(i = 0; i < pictures.length; i += 1) {
					picpath = pictures[i].substring(0, pictures[i].lastIndexOf("\\"));
					filename = pictures[i].split('\\').pop();
					extension = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
					if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
						filehash = xxh.hash64(fs.readFileSync(pictures[i]), xxhashsalt, 'hex');
						checkduplicate = db.prepare('SELECT count(*) FROM pictures WHERE hash = ?;').get(filehash)["count(*)"];
						if(checkduplicate == 0) {
							db.prepare('INSERT INTO pictures (filename, path, hash, excluded) VALUES (?,?,?,?);').run(filename, picpath, filehash, 0);
							x++;
							if(tag) {
								id = db.prepare('SELECT id FROM pictures WHERE hash = ?;').get(filehash);
								tags = directories[z].split("\\");
								for(o = 0; o < tags.length; o += 1) {
									db.prepare('INSERT INTO tags (id, tag) VALUES (?, ?);').run(id.id, tags[o]);
								}
							}
						}
					}
				}
			}
		}
		piccount = x;
		if(firstRun) {
			if(!tag) {
				document.getElementById('setupcontent').innerHTML = "<br /><br /><br />Successfully added " + x + " pictures!<br /><br /><br /><button id=\"finishsetup\" class=\"roundbutton\">Continue</button>";
			} else {
				document.getElementById('setupcontent').innerHTML = "<br /><br /><br />Successfully added and tagged " + x + " pictures!<br /><br /><br /><button id=\"finishsetup\" class=\"roundbutton\">Continue</button>";
			}
			document.getElementById('finishsetup').addEventListener("click", function() {
				removeElementById('setup');
				document.getElementById('overlay').style.display = 'none';
				document.getElementById('mainpage').style.display = "block";
				document.getElementById('greyboxl').style.backgroundColor = "#1f1f1f";
				document.getElementById('greyboxr').style.backgroundColor = "#1f1f1f";
				loadPictures();
			});
		}
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
