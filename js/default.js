(function () {
	var pictureid = 0;
	const sql = require('better-sqlite3');
	const fs = require('fs');
	var firstRun = true;
	if(fs.existsSync(process.env.APPDATA + "\\WeebReact\\data.sqlite")) {
		var firstRun = false;
	}
	var db = new sql(process.env.APPDATA + "\\WeebReact\\data.sqlite");
	const remote = require('electron').remote;
	const dialog = remote.require('electron').dialog;
	function init() {
		document.getElementById("minimize-btn").addEventListener("click", function (e) {
			const window = remote.getCurrentWindow();
			window.minimize(); 
		});
		document.getElementById("maximize-btn").addEventListener("click", function (e) {
			const window = remote.getCurrentWindow();
			if (!window.isMaximized()) {
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
			document.getElementById('setupcontentframe').innerHTML = "<div id=\"setupcontent\">Welcome!<br /><br />It looks like you are running WeebReact for the first time. Please select the folder that contains your Reaction Pictures.<br /><br /><br /><button id=\"browsefolder\" class=\"roundbutton\">Select Folder</button><br /><br /><br /><div id=\"filetype-hint\">Supported Filetypes: .jpg .jpeg .png .gif .webm .mp4</div></div>";
			document.getElementById('browsefolder').addEventListener("click", function() {
				dialog.showOpenDialog({properties:['openDirectory']}, checkPictures);
			});
			document.getElementById('overlay').style.display = 'block';
			document.getElementById('setup').style.display = 'block';
			db.pragma('journal_mode = WAL');
			var createpicturetable = db.prepare('CREATE TABLE pictures (id integer primary key autoincrement, filename text, path text, unique(filename, path));');
			createpicturetable.run()
			var createtagtable = db.prepare('CREATE TABLE tags (tag text, picture int, unique(tag, picture));');
			createtagtable.run();
		} else {
			document.getElementById("setup").parentNode.removeChild(document.getElementById("setup"));
		}
		setTimeout(function() {
			var mainHeight = document.getElementById("mainpagecontent").clientHeight;
			var mainWidth = document.getElementById("mainpagecontent").clientWidth;
			var picAmount = Math.round(((mainWidth/210)*(mainHeight/210))+(mainWidth/210));
			var pictures = db.prepare('SELECT * FROM pictures LIMIT ?').all(picAmount);
			for(var i = 0; i < picAmount; i++) {
				document.getElementById("mainpagecontent").innerHTML += "<div class=\"piccontainer\"><img draggable=\"true\" ondragstart=\"drag(event, \'" + pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\\\\" + pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2") + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>";//makeDrag(document.getElementById('pcontainer' + pictureid), pictures[i].path + "\\" + pictures[i].filename);
				pictureid++;
			}
			document.getElementById("mainpageoverlay").style.display = "none";
		}, 50);
	};
	function makeDrag(element, path) {
		console.log("test");
		element.ondragstart = (event) => {
			event.preventDefault();
			console.log("test2");
			ipcRenderer.send('ondragstart', path);
		}
	}
	function checkPictures(directory) {
		if(directory != undefined) {
			setTimeout(function() {
				document.getElementById('setupcontentframe').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div>";
				if(checkIfHasSubdirs(directory.toString())) {
					document.getElementById('setupcontentframe').innerHTML = "<div id=\"setupcontent\"><br /><br /><br />This directory contains subdirectories.<br /><br />Include pictures contained in subdirectories?<br /><br /><button id=\"subyes\" class=\"setupbutton\">Yes</button><button id=\"subno\" class=\"setupbutton\">No</button></div>"
					document.getElementById('subyes').addEventListener("click", function() {addPictures(directory.toString(), true);});
					document.getElementById('subno').addEventListener("click", function() {addPictures(directory.toString(), false);});
				} else {
					addPictures(directory.toString(), false);
				}
			}, 50);
		}
	}
	document.onreadystatechange = function () {
		if (document.readyState == "complete") {
			init();
		}
	};
	window.onbeforeunload = function() {
		db.close();
	}
	function checkIfHasSubdirs(dir) {
		var hasSubdirs = false;
		var files = fs.readdirSync(dir);
		for(var i in files) {
			if(!files.hasOwnProperty(i)) continue;
			var name = dir+'\\'+files[i];
			if(fs.statSync(name).isDirectory()) {
				hasSubdirs = true;
				break;
			}
		}
		return hasSubdirs;
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
			for (i in pictures) {
				path = pictures[i].substring(0, Math.max(pictures[i].lastIndexOf("/"), pictures[i].lastIndexOf("\\")));
				filename = pictures[i].split('\\').pop().split('/').pop();
				extension = filename.substr(filename.lastIndexOf('.') + 1);
				if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
					var addpic = db.prepare('INSERT INTO pictures (filename, path) VALUES (?,?);').run(filename, path);
					x++;
				}
			}
			document.getElementById('setupcontentframe').innerHTML = "<div id=\"setupcontent\"><br /><br /><br />Successfully added " + x + " pictures!<br /><br /><br /><button id=\"finishsetup\" class=\"roundbutton\">Continue</button></div>";
			document.getElementById('finishsetup').addEventListener("click", function() {
				document.getElementById('setup').innerHTML = "";
				document.getElementById('setup').style.display = 'none';
				document.getElementById('overlay').style.display = 'none';
			});
		}, 50);
	}
	function getFiles(dir){
		fileList = [];
		var files = fs.readdirSync(dir);
		for(var i in files){
			if (!files.hasOwnProperty(i)) continue;
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
		for(var i in files){
			if (!files.hasOwnProperty(i)) continue;
			var name = dir+'\\'+files[i];
			if (fs.statSync(name).isDirectory()){
				getFilesR(name, fileList);	
			} else {
				fileList.push(name);
			}
		}
		return fileList;
	}
})();