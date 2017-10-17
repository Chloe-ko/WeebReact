const path = require('path');
module.paths.push(path.resolve(__dirname, '..', '..', '..', '..', 'resources', 'app.asar', 'node_modules'));
const sql = require('better-sqlite3');
const fs = require('fs');
const {remote, ipcRenderer, shell, clipboard} = require('electron');
const dialog = remote.require('electron').dialog;
const xxh = require('xxhash');
const outclick = require('outclick');
const moment = require('moment');
const chokidar = require('chokidar');
const naturalSort = require('node-natural-sort');
var contextmenuelement;
var piccount;
var menuFunc;
var dirList;
var tagsForAutocomplete;
var picPaths;
var pictureidarray;
var pictures;
var autoSearchHide;
var autoEditHide;
var expandAnim;
var sortingDropdownHide;
var orderDropdownHide;
var filterDropdownHide;
var zoomDropdownHide;
var canLoadMore;
var tagSettingChanged;
var nsfwSettingChanged;
var settingsExcludedFiletypes;
var settingsDirectories;
var linesHidden;
var linesShown;
var picsHiddenUpTo;
var picsShownUpTo;
var lastScrollTop;
var lastPicsPerLine;
var orderBy = "datetime(timeAdded)";
var sortingOrder = "DESC";
var zoomClass = "piczoom100";
var mainZoomClass = "mainzoom100";
var editTagsArray = [];
var editTagsAlreadyAssigned = [];
var searchArrayInc = [];
var searchArrayExc = [];
var excludedFiletypes = [];
var renamedmovedfiles = [];
var copiedFiles = [];
var selectedPictures = [];
var watcher = [];
var filetypes = ["jpg", "png", "gif", "webm", "mp4"];
var pictureid = 0;
var xxhashsalt = 4152;
var pictureScale = 1;
var pictureClientSize = 210;
var firstRun = true;
var tagListExpanded = false;
var sqlalreadysetup = false;
var clearTagButtonShown = false;
var sortingDropdownShown = false;
var orderDropdownShown = false;
var filterDropdownShown = false;
var zoomDropdownShown = false;
var aboutPageShown = false;
var fileDetailsOpen = false;
var settingsShown = false;
var multiSelectionActive = false;
var restartNeeded = false;
var appDataFolder = process.env.APPDATA + "\\WeebReact";
if(!fs.existsSync('package.json')) {
  var packagejson = fs.readFileSync("resources/app.asar/package.json");
} else {
  var packagejson = fs.readFileSync("package.json");
}
var jsonContent = JSON.parse(packagejson);
if(!fs.existsSync(appDataFolder)) {
  fs.mkdirSync(appDataFolder);
}
if(fs.existsSync(appDataFolder + "\\data.sqlite")) {
  firstRun = false;
}
var db = new sql(appDataFolder + "\\data.sqlite");
if(!firstRun) {
  var firstR = db.prepare("SELECT count(*) FROM directories").get()["count(*)"];
  if(firstR == 0) {
    firstRun = true;
    sqlalreadysetup = true;
  }
}
function reload() {
  ipcRenderer.send('reload');
}
function countPics() {
  piccount = pictures.length;
  setContainerheight();
}
function openURL(url) {
  shell.openExternal(url);
}
function setContainerheight () {
  document.getElementById("picturescrollcontainer").style.height = Math.ceil(piccount/Math.floor((document.getElementById("mainpagecontent").clientWidth)/(pictureClientSize)))*(pictureClientSize) + "px";
}
function init() {
  document.getElementById("aboutTitle").innerHTML = "WeebReact<br />v" + jsonContent.version;
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
    if(!sqlalreadysetup) {
      db.pragma("journal_mode = WAL");
      db.prepare("CREATE TABLE pictures (id integer primary key autoincrement, filename text, path text, filetype text, rating integer, hash text unique, excluded integer, available integer, timeAdded integer, unique(path, filename));").run();
      db.prepare("CREATE TABLE tags (tag text, id int, unique(tag, id));").run();
      db.prepare("CREATE TABLE directories (directory text, includeSubdirectories integer, watch integer, watchSub integer);").run();
      db.prepare("CREATE TABLE settings (name text pimary key, value integer);").run();
      db.prepare("INSERT INTO settings VALUES ('hidensfw', 1);").run();
      db.prepare("INSERT INTO settings VALUES ('excludejpg', 0);").run();
      db.prepare("INSERT INTO settings VALUES ('excludepng', 0);").run();
      db.prepare("INSERT INTO settings VALUES ('excludegif', 0);").run();
      db.prepare("INSERT INTO settings VALUES ('excludemp4', 0);").run();
      db.prepare("INSERT INTO settings VALUES ('excludewebm', 0);").run();
    }
    document.getElementById("mainpage").style.display = "none";
    document.getElementById("options").style.display = "none";
    document.getElementById("greyboxr").style.backgroundColor = "#282828";
    document.getElementById("greyboxl").style.backgroundColor = "#282828";
    document.getElementById("setupcontent").innerHTML = "Welcome!<br /><br />It looks like you don\'t have any folders set up yet. Please select the folder that contains your Reaction Pictures.<br /><br /><br /><button id=\"browsefolder\" class=\"roundbutton\">Select Folder</button><br /><br /><br /><div id=\"filetype-hint\">Supported Filetypes: .jpg .jpeg .webp .gif .webm .mp4</div>";
    document.getElementById("browsefolder").addEventListener("click", function() {
      dialog.showOpenDialog({properties:["openDirectory"]}, checkPictures);
    });
    document.getElementById("overlay").style.display = "block";
    document.getElementById("setup").style.display = "block";
  } else {
    try { db.prepare("SELECT DISTINCT watchSub FROM directories;").get(); }
    catch(err) {
      db.prepare("ALTER TABLE directories ADD COLUMN watchSub integer;").run();
      db.prepare("UPDATE directories SET watchSub = ?;").run(1);
    }
    removeElementById("setup");
    var settingsEFQuery = db.prepare('SELECT * FROM settings WHERE name LIKE ? AND value = ?;').all('exclude%', 1);
    var i;
    var filetype;
    for(i = 0; i < settingsEFQuery.length; i += 1) {
      filetype = settingsEFQuery[i].name.substring(7);
      excludedFiletypes.push(filetype);
      if(filetype == "jpg") {
        excludedFiletypes.push("jpeg");
      }
    }
    for(i = 0; i < excludedFiletypes.length; i += 1) {
      if(excludedFiletypes[i] != "jpeg") {
        document.getElementById('filetype' + excludedFiletypes[i]).classList.remove("includedFiletype");
        document.getElementById('filetype' + excludedFiletypes[i]).classList.add("excludedFiletype");
      }
    }
    var picDirectories = db.prepare('SELECT directory, includeSubdirectories, watchSub FROM directories WHERE watch = ?;').all(1);
    for(i = 0; i < picDirectories.length; i += 1) {
      if(fs.existsSync(picDirectories[i].directory)) {
        if(picDirectories[i].includeSubdirectories == 1 && picDirectories[i].watchSub == 1) {
          watcher.push(chokidar.watch(picDirectories[i].directory, {ignored: /(^|[\/\\])\../, ignoreInitial: true, disableGlobbing: true}).on('all', (event, path) => {
            fileChange(event, path);
          }));
        } else {
          watcher.push(chokidar.watch(picDirectories[i].directory, {ignored: /(^|[\/\\])\../, ignoreInitial: true, disableGlobbing: true, depth: 0}).on('all', (event, path) => {
            fileChange(event, path);
          }));
        }
      } else {
        db.prepare("DELETE FROM directories WHERE directory = ?;").run(picDirectories[i].directory);
      }
    }
    if(db.prepare('SELECT value FROM settings WHERE name = ?;').get("hidensfw").value == 1) {
      searchArrayExc.push("nsfw");
    }
    document.getElementById("mainpagecontent").addEventListener("scroll", function() {
      scrollFunctions();
    });
    enableDrop();
    window.addEventListener("resize", function() {
      scrollFunctions();
    });
    document.getElementById("mainpageoverlay").style.display = "none";
    startupScan();
  }
}
function setZoom(level) {
  pictureScale = level;
  zoomClass = "piczoom" + pictureScale*100;
  mainZoomClass = "mainzoom" + pictureScale*100;
  pictureClientSize = ((pictureScale*200)+10);
  document.getElementById('zoomDropdownText').innerHTML = "Zoom: " + (pictureScale*100) + "%";
  loadPictures();
}
function startupScan() {
  var knownFiles = db.prepare("SELECT id,filename,path,hash,available FROM pictures;").all();
  var knownFileHashes = [];
  var i;
  for(i = 0; i < knownFiles.length; i += 1) {
    knownFileHashes.push(knownFiles[i].hash);
  }
  var picDirectories = db.prepare("SELECT directory,includeSubdirectories FROM directories;").all();
  var newFiles = [];
  var files = [];
  var x;
  for(i = 0; i < picDirectories.length; i += 1) {
    if(picDirectories[i].includeSubdirectories == 1) {
      var subDirectories = getDirectories(picDirectories[i].directory);
      for(x = 0; x < subDirectories.length; x += 1) {
        files = files.concat(getFiles(picDirectories[i].directory + "\\" + subDirectories[x]));
      }
      dirList = [];
    }
    files = files.concat(getFiles(picDirectories[i].directory));
  }
  var fileHashes = [];
  var extension;
  for(i = files.length - 1; i >= 0; i -= 1) {
    extension = files[i].substr(files[i].lastIndexOf('.') + 1).toLowerCase();
    if(!(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4")) {
      files.splice(i, 1);
    }
  }
  var filehash;
  for(i = 0; i < files.length; i += 1) {
    filehash = xxh.hash64(fs.readFileSync(files[i]), xxhashsalt, 'hex');
    if(fileHashes.indexOf(filehash) == -1) {
      fileHashes.push(filehash);
    } else {
      files.splice(i, 1);
      i -= 1;
    }
  }
  var hashindex;
  var picpath;
  var filename;
  var tempfile;
  for(i = knownFileHashes.length - 1; i >= 0; i -= 1) {
    hashindex = fileHashes.indexOf(knownFileHashes[i]);
    if(hashindex != -1) {
      picpath = files[hashindex].substring(0, files[hashindex].lastIndexOf("\\"));
      filename = files[hashindex].split('\\').pop();
      if(filename != knownFiles[i].filename || picpath != knownFiles[i].path) {
        tempfile = db.prepare("SELECT * FROM pictures WHERE hash = ?;").get(knownFileHashes[i]);
        db.prepare("DELETE FROM pictures WHERE hash = ?;").run(knownFileHashes[i]);
        db.prepare('INSERT INTO pictures (id, filename, path, hash, excluded, timeAdded, rating, filetype, available) VALUES (?,?,?,?,?,?,?,?,?);').run(tempfile.id, filename, picpath, knownFileHashes[i], tempfile.excluded, tempfile.timeAdded, tempfile.rating, tempfile.filetype, tempfile.available);
      }
      if(knownFiles[i].available == 0) {
        db.prepare("UPDATE pictures SET available = ? WHERE hash = ?;").run(1, knownFileHashes[i]);
      }
      knownFiles.splice(i, 1);
      knownFileHashes.splice(i, 1);
      files.splice(hashindex, 1);
      fileHashes.splice(hashindex, 1);
    }
  }
  for(i = knownFiles.length - 1; i >= 0; i -= 1) {
    for(x = files.length - 1; x >= 0; x -= 1) {
      if(files[x] == knownFiles[i].path + "\\" + knownFiles[i].filename) {
        db.prepare("UPDATE pictures SET hash = ? WHERE path = ? AND filename = ?;").run(fileHashes[x], knownFiles[i].path, knownFiles[i].filename);
        files.splice(x, 1);
        fileHashes.splice(x, 1);
        knownFiles.splice(i, 1);
        knownFileHashes.splice(i, 1);
        break;
      }
    }
  }
  for(i = 0; i < knownFiles.length; i += 1) {
    db.prepare("UPDATE pictures SET available = ? WHERE id = ?;").run(0, knownFiles[i].id);
  }
  for(i = 0; i < files.length; i += 1) {
    picpath = files[i].substring(0, files[i].lastIndexOf("\\"));
    filename = files[i].split('\\').pop();
    addFile(picpath, filename, fileHashes[i]);
  }
  loadPictures();
  document.getElementById('overlay').style.display = "none";
  document.getElementById('startupScanScreen').style.display = "none";
}
function fileChange(event, file) {
  var picpath = file.substring(0, file.lastIndexOf("\\"));
  var filename = file.split('\\').pop();
  if(event == "add") {
    var filehash = xxh.hash64(fs.readFileSync(file), xxhashsalt, 'hex');
    var amountQuery = db.prepare('SELECT filename,path,count(*),available FROM pictures WHERE hash = ?;').get(filehash);
    if(amountQuery["count(*)"] > 0 && amountQuery.available == 1) {
      if(fs.existsSync(amountQuery.path + "\\" + amountQuery.filename)) {
        copiedFiles.push({filename: filename, path: picpath});
      } else {
        renamedmovedfiles.push({filename: filename, path: picpath, filehash: filehash});
      }
    } else if(amountQuery["count(*)"] > 0 && amountQuery.available == 0) {
      db.prepare("UPDATE pictures SET filename = ?, path = ?, available = ? WHERE hash = ?;").run(filename, picpath, 1, filehash);
      loadPictures();
    } else {
      addFile(picpath, filename, filehash);
    }
  } else if (event == "change") {
    var filehash = xxh.hash64(fs.readFileSync(file), xxhashsalt, 'hex');
    db.prepare("UPDATE pictures SET hash = ? WHERE path = ? AND filename = ?;").run(filehash, picpath, filename)
  } else if (event == "unlink") {
    var i;
    var moved = false;
    var renamed = false;
    var copied = false;
    var arrayindex;
    for(i = 0; i < renamedmovedfiles.length; i += 1) {
      if(filename == renamedmovedfiles[i].filename) {
        moved = true;
        arrayindex = i;
        break;
      } else if(picpath == renamedmovedfiles[i].path) {
        renamed = true;
        arrayindex = i;
        break;
      }
    }
    for(i = 0; i < copiedFiles.length; i += 1) {
      if(filename == copiedFiles[i].filename && picpath == copiedFiles[i].path) {
        copied = true;
        copiedFiles.splice(i, 1);
      }
    }
    if(moved && !copied) {
      db.prepare("UPDATE pictures SET path = ? WHERE filename = ? AND hash = ?;").run(renamedmovedfiles[arrayindex].path, filename, renamedmovedfiles[arrayindex].filehash);
      renamedmovedfiles.splice(arrayindex, 1);
    } else if (renamed && !copied) {
      db.prepare("UPDATE pictures SET filename = ? WHERE path = ? AND hash = ?;").run(renamedmovedfiles[arrayindex].filename, picpath, renamedmovedfiles[arrayindex].filehash);
      renamedmovedfiles.splice(arrayindex, 1);
    }
    if(!moved && !renamed && !copied) {
      db.prepare("UPDATE pictures SET available = ? WHERE path = ? and filename = ?;").run(0, picpath, filename);
    }
    loadPictures();
  }
}
function addFile (picpath, filename, filehash) {
  var insertquery = 'INSERT INTO pictures (filename, path, hash, excluded, timeAdded, rating, filetype, available) VALUES (?,?,?,?,?,?,?,?);';
  var extension = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
  if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
    db.prepare(insertquery).run(filename, picpath, filehash, 0, moment(fs.statSync(picpath + "\\" + filename).mtime).format("YYYY-MM-DD HH:mm:ss"), 4, extension, 1);
      loadPictures();
  }
}
function toggleSettingsExcludeFiletypes (filetype) {
  var element = document.getElementById('excludefiletype' + filetype);
  if(!tagSettingChanged) {
    tagSettingChanged = true;
  }
  if(element.classList.contains("excludedFiletype")) {
    element.classList.remove("excludedFiletype");
    element.classList.add("includedFiletype");
  } else {
    element.classList.add("excludedFiletype");
    element.classList.remove("includedFiletype");
  }
}
function toggleSettingsExcludeNSFW (exclude) {
  var yeselement = document.getElementById('excludeNsfwYes');
  var noelement = document.getElementById('excludeNsfwNo');
  if(!exclude) {
    if(noelement.classList.contains("selectedNo")) {
      if(!nsfwSettingChanged) {
        nsfwSettingChanged = true;
      }
      noelement.classList.remove("selectedNo");
      noelement.classList.add("selectedYes");
      yeselement.classList.add("selectedNo");
      yeselement.classList.remove("selectedYes");
    }
  } else {
    if(yeselement.classList.contains("selectedNo")) {
      if(!nsfwSettingChanged) {
        nsfwSettingChanged = true;
      }
      yeselement.classList.remove("selectedNo");
      yeselement.classList.add("selectedYes");
      noelement.classList.add("selectedNo");
      noelement.classList.remove("selectedYes");
    }
  }
}
function confirmSettings() {
  var i;
  var reloadNeeded = false;
  if(nsfwSettingChanged) {
    var settingsNsfwExcluded = db.prepare('SELECT value FROM settings WHERE name = ?;').get('hidensfw').value;
    if((settingsNsfwExcluded == 1 && document.getElementById('excludeNsfwNo').classList.contains("selectedYes")) ||
        settingsNsfwExcluded == 0 && document.getElementById('excludeNsfwYes').classList.contains('selectedYes')) {
      var setNsfwExcluded;
      var nsfwindex = searchArrayExc.indexOf("nsfw");
      if(document.getElementById('excludeNsfwNo').classList.contains("selectedYes")) {
        setNsfwExcluded = 0;
        if(nsfwindex != -1) {
          searchArrayExc.splice(nsfwindex, 1);
          reloadNeeded = true;
        }
      } else {
        setNsfwExcluded = 1;
        if(nsfwindex == -1 && searchArrayInc.indexOf("nsfw") == -1) {
          searchArrayExc.push("nsfw");
          reloadNeeded = true;
        }
      }
      db.prepare('UPDATE settings SET value = ? WHERE name = ?').run(setNsfwExcluded, 'hidensfw');
    }
  }
  if(tagSettingChanged) {
    reloadNeeded = true;
    var toBeExcluded;
    var elem;
    for(i = 0; i < filetypes.length; i += 1) {
      if(document.getElementById('excludefiletype' + filetypes[i]).classList.contains("includedFiletype")) {
        toBeExcluded = 0;
      } else {
        toBeExcluded = 1;
      }
      db.prepare('UPDATE settings SET value = ? WHERE name = ?;').run(toBeExcluded, 'exclude' + filetypes[i]);
      if(filetypes[i] == "jpg") {
        db.prepare('UPDATE settings SET value = ? WHERE name = ?;').run(toBeExcluded, 'excludejpeg');
      }
      elem = document.getElementById('filetype' + filetypes[i]);
      if(toBeExcluded == 1 && elem.classList.contains("includedFiletype")) {
        elem.classList.remove("includedFiletype");
        elem.classList.add("excludedFiletype");
        excludedFiletypes.push(filetypes[i]);
        if(filetypes[i] == "jpg") {
          excludedFiletypes.push("jpeg");
        }
      } else if(toBeExcluded == 0 && elem.classList.contains("excludedFiletype")) {
        elem.classList.remove("excludedFiletype");
        elem.classList.add("includedFiletype");
        excludedFiletypes.splice(excludedFiletypes.indexOf(filetypes[i]), 1);
        if(filetypes[i] == "jpg") {
          excludedFiletypes.splice(excludedFiletypes.indexOf("jpeg"), 1);
        }
      }
    }
  }
  if(reloadNeeded && !restartNeeded) {
    loadPictures();
  } else if(restartNeeded) {
    var x;
    var dbdirs = db.prepare('SELECT * FROM directories;').all();
    for(i = 0; i < settingsDirectories.length; i += 1) {
      for(x = 0; x < dbdirs.length; x += 1) {
        if(dbdirs[x].directory == settingsDirectories[i].directory) {
          db.prepare("UPDATE directories SET includeSubdirectories = ?, watch = ?, watchSub = ? WHERE directory = ?;").run(settingsDirectories[i].includeSubdirectories, settingsDirectories[i].watch, settingsDirectories[i].watchSub, settingsDirectories[i].directory);
          settingsDirectories.splice(i, 1);
          dbdirs.splice(x, 1);
        }
      }
    }
    for(i = 0; i < dbdirs.length; i += 1) {
      db.prepare("DELETE FROM directories WHERE directory = ?;").run(dbdirs[i].directory);
    }
    for(i = 0; i < settingsDirectories.length; i += 1) {
      db.prepare("INSERT INTO directories VALUES (?, ?, ?, ?);").run(settingsDirectories[i].directory.stripSlashes(), settingsDirectories[i].includeSubdirectories, settingsDirectories[i].watch, settingsDirectories[i].watchSub)
    }
    reload();
  }
  toggleSettingsWindow();
}
function toggleSettingsWindow () {
  if(!settingsShown) {
    nsfwSettingChanged = false;
    tagSettingChanged = false;
    restartNeeded = false;
    var settingsTagsExcluded = db.prepare('SELECT * FROM settings WHERE name LIKE ? AND value = ?;').all('exclude%', 1);
    var i;
    for(i = 0; i < filetypes.length; i += 1) {
      if(document.getElementById('excludefiletype' + filetypes[i]).classList.contains("excludedFiletype")) {
        document.getElementById('excludefiletype' + filetypes[i]).classList.remove("excludedFiletype");
        document.getElementById('excludefiletype' + filetypes[i]).classList.add("includedFiletype");
      }
    }
    for(i = 0; i < settingsTagsExcluded.length; i += 1) {
      var filetype = settingsTagsExcluded[i].name.substring(7);
      document.getElementById('excludefiletype' + filetype).classList.remove("includedFiletype");
      document.getElementById('excludefiletype' + filetype).classList.add("excludedFiletype");
    }
    if(document.getElementById('excludeNsfwYes').classList.contains("excludedFiletype")) {
      document.getElementById('excludeNsfwYes').classList.remove("excludedFiletype");
      document.getElementById('excludeNsfwYes').classList.add("includedFiletype");
    }
    if(document.getElementById('excludeNsfwNo').classList.contains("excludedFiletype")) {
      document.getElementById('excludeNsfwNo').classList.remove("excludedFiletype");
      document.getElementById('excludeNsfwNo').classList.add("includedFiletype");
    }
    var settingsNsfwExcluded = db.prepare('SELECT value FROM settings WHERE name = ?;').get('hidensfw');
    if(settingsNsfwExcluded.value == 1) {
      if(document.getElementById('excludeNsfwNo').classList.contains("selectedYes")) {
        document.getElementById('excludeNsfwNo').classList.remove("selectedYes");
        document.getElementById('excludeNsfwNo').classList.add("selectedNo");
        document.getElementById('excludeNsfwYes').classList.add("selectedYes");
        document.getElementById('excludeNsfwYes').classList.remove("selectedNo");
      }
    } else {
      if(document.getElementById('excludeNsfwYes').classList.contains("selectedYes")) {
        document.getElementById('excludeNsfwYes').classList.remove("selectedYes");
        document.getElementById('excludeNsfwYes').classList.add("selectedNo");
        document.getElementById('excludeNsfwNo').classList.add("selectedYes");
        document.getElementById('excludeNsfwNo').classList.remove("selectedNo");
      }
    }
    var directoryListing = "";
    settingsDirectories = db.prepare("SELECT * FROM directories;").all();
    var firstListing;
    var incSub;
    var watch;
    var watchSub;
    var directoryq;
    var directoryname;
    for(i = 0; i < settingsDirectories.length; i += 1) {
      directoryq = settingsDirectories[i].directory.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      console.log(directoryq);
      settingsDirectories[i].directory = settingsDirectories[i].directory.addSlashes();
      firstListing = "";
      if(i == 0) {
        firstListing = " firstDirectoryListing";
      }
      if(settingsDirectories[i].includeSubdirectories == 1) {
        incSub = "incSubYes";
      } else {
        incSub = "incSubNo";
      }
      if(settingsDirectories[i].watch == 1) {
        watch = "incSubYes";
      } else {
        watch = "incSubNo";
      }
      if(settingsDirectories[i].watchSub == 1) {
        watchSub = "incSubYes";
      } else {
        watchSub = "incSubNo";
      }
      directoryname = settingsDirectories[i].directory.stripSlashes().split('\\').pop();
      if(directoryname == "") {
        directoryname = settingsDirectories[i].directory;
      }
      directoryListing += "<div class=\"directoryListing" + firstListing + "\"><div class=\"directoryName inlineblock\" title=\"" + settingsDirectories[i].directory.stripSlashes() + "\">" + directoryname + "</div><div class=\"incSub inlineblock\"><div class=\"incSubPic " + incSub + "\" title=\"Include Subdirectories\" onclick=\"toggleIncludeSubdirectories('" + directoryq.addSlashes() + "', this);\"></div><div class=\"incSubPic " + watch + "\" title=\"Watch Directory\" onclick=\"toggleWatchDirectory('" + directoryq.addSlashes() + "', this);\"></div><div class=\"incSubPic " + watchSub + "\" title=\"Watch Subdirectories\nWarning: This can cause lags, freezes and heavy CPU usage if the directory contains huge amounts of subdirectories.\" onclick=\"toggleWatchSubdirectories('" + directoryq.addSlashes() + "', this);\"></div></div><div class=\"removeDir inlineblock\" onclick=\"removeDirectory('" + directoryq.addSlashes() + "', this);\">Remove</div></div>";
    }
    document.getElementById('directoryListingBox').innerHTML = directoryListing;
    showOverlay();
    var anim = setInterval(animateShowOverlay, 5);
    var opa = 0;
    document.getElementById('settingsArea').style.display = "block";
    function animateShowOverlay() {
      if(opa < 1) {
        opa += 0.05;
        document.getElementById('settingsArea').style.opacity = opa;
      } else {
        clearInterval(anim);
      }
    }
    settingsShown = true;
  } else {
    hideOverlay();
    var anim = setInterval(animateHideOverlay, 5);
    var opa = 1;
    function animateHideOverlay() {
      if(opa > 0) {
        opa -= 0.05;
        document.getElementById('settingsArea').style.opacity = opa;
      } else {
        clearInterval(anim);
        document.getElementById('settingsArea').style.display = "none";
      }
    }
    settingsShown = false;
  }
}
function toggleIncludeSubdirectories(directory, elm) {
  var toSet;
  if(elm.classList.contains("incSubYes")) {
    toSet = 0;
    elm.classList.remove("incSubYes");
    elm.classList.add("incSubNo");
  } else {
    toSet = 1;
    elm.classList.add("incSubYes");
    elm.classList.remove("incSubNo");
  }
  var i;
  for(i = 0; i < settingsDirectories.length; i += 1) {
    if(settingsDirectories[i].directory == directory.addSlashes()) {
      settingsDirectories[i].includeSubdirectories = toSet;
      break;
    }
  }
  restartNeeded = true;
}
function toggleWatchDirectory(directory, elm) {
  var toSet;
  if(elm.classList.contains("incSubYes")) {
    toSet = 0;
    elm.classList.remove("incSubYes");
    elm.classList.add("incSubNo");
  } else {
    toSet = 1;
    elm.classList.add("incSubYes");
    elm.classList.remove("incSubNo");
  }
  var i;
  for(i = 0; i < settingsDirectories.length; i += 1) {
    if(settingsDirectories[i].directory == directory.addSlashes()) {
      settingsDirectories[i].watch = toSet;
      break;
    }
  }
  restartNeeded = true;
}
function toggleWatchSubdirectories(directory, elm) {
  var toSet;
  if(elm.classList.contains("incSubYes")) {
    toSet = 0;
    elm.classList.remove("incSubYes");
    elm.classList.add("incSubNo");
  } else {
    toSet = 1;
    elm.classList.add("incSubYes");
    elm.classList.remove("incSubNo");
  }
  var i;
  for(i = 0; i < settingsDirectories.length; i += 1) {
    if(settingsDirectories[i].directory == directory.addSlashes()) {
      settingsDirectories[i].watchSub = toSet;
      break;
    }
  }
  restartNeeded = true;
}
function removeDirectory(directory, elm) {
  if(settingsDirectories.length == 1) {
    alert("You need at least one directory!\nIf you want to change it, please add the new one before removing the old one.");
  } else {
    var i;
    for(i = 0; i < settingsDirectories.length; i += 1) {
      if(directory.addSlashes() == settingsDirectories[i].directory) {
        settingsDirectories.splice(i, 1);
        if(elm.parentNode.classList.contains("firstDirectoryListing")) {
          elm.parentNode.parentNode.children[1].classList.add("firstDirectoryListing");
        }
        removeElement(elm.parentNode);
        break;
      }
    }
    restartNeeded = true;
  }
}
function openAddDirectoryDialog() {
  dialog.showOpenDialog({properties:["openDirectory"]}, settingsAddDirectory);
}
function settingsAddDirectory(directory) {
  if(directory != undefined) {
    directory = directory[0];
    var cont = true;
    if(directory.slice(-1) == "\\") {
      directory = directory.substr(0, directory.length-1);
    }
    var i;
    for(i = 0; i < settingsDirectories.length; i += 1) {
      if(settingsDirectories[i].directory == directory.addSlashes()) {
        cont = false;
      }
    }
    if(cont) {
      restartNeeded = true;
      directoryq = directory.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      directory = directory.addSlashes();
      settingsDirectories.push({directory: directory, includeSubdirectories: 1, watch: 1, watchSub: 1});
      document.getElementById("directoryListingBox").innerHTML += "<div class=\"directoryListing\"><div class=\"directoryName inlineblock\" title=\"" + directory.stripSlashes() + "\">" + directory.stripSlashes().split('\\').pop() + "</div><div class=\"incSub inlineblock\"><div class=\"incSubPic incSubYes\" title=\"Include Subdirectories\" onclick=\"toggleIncludeSubdirectories('" + directoryq.addSlashes() + "', this)\"></div><div class=\"incSubPic incSubYes\" title=\"Watch Directory\" onclick=\"toggleWatchDirectory('" + directoryq.addSlashes() + "', this);\"></div><div class=\"incSubPic incSubYes\" title=\"Watch Subdirectories\nWarning: This can cause lags, freezes and heavy CPU usage if the directory contains huge amounts of subdirectories.\" onclick=\"toggleWatchSubdirectories('" + directoryq.addSlashes() + "', this);\"></div></div><div class=\"removeDir inlineblock\" onclick=\"removeDirectory('" + directoryq + "', this)\">Remove</div></div>";
    }
  }
}
String.prototype.addSlashes = function() {
return this.replace(/\'/g,'\\\'').replace(/\"/g,'\\"');
}
String.prototype.stripSlashes = function() {
return this.replace(/\\'/g,'\'').replace(/\\"/g,'"');
}
String.prototype.stripIllegal = function() {
  return this.replace(/\\/g,'').replace(/\"/g,'');
}
function filterFiletype (filetype) {
  var i;
  var exclude = true;
  var elm = document.getElementById('filetype' + filetype);
  for(i = 0; i < excludedFiletypes.length; i += 1) {
    if(filetype == excludedFiletypes[i]) {
      exclude = false;
    }
  }
  if(exclude) {
    excludedFiletypes.push(filetype);
    if(filetype == "jpg") {
      excludedFiletypes.push("jpeg");
    }
    elm.classList.remove('includedFiletype');
    elm.classList.add('excludedFiletype');
  } else {
    excludedFiletypes.splice(excludedFiletypes.indexOf(filetype), 1);
    if(filetype == "jpg") {
      excludedFiletypes.splice(excludedFiletypes.indexOf("jpeg"), 1);
    }
    elm.classList.remove('excludedFiletype');
    elm.classList.add('includedFiletype');
  }
  loadPictures();
}
function scrollFunctions() {
  var obj = document.getElementById("mainpagecontent");
  var picsPerLine = Math.floor((obj.clientWidth)/(pictureClientSize));
  if(picsPerLine > lastPicsPerLine) {
    loadBottom(obj, picsPerLine);
    lastPicsPerLine = picsPerLine;
    lastScrollTop = obj.scrollTop;
  } else if(picsPerLine < lastPicsPerLine) {
    loadTop(obj, picsPerLine);
    lastPicsPerLine = picsPerLine;
    lastScrollTop = obj.scrollTop;
  }
  if(obj.scrollTop > lastScrollTop) {
    scrollingBottomside(obj, picsPerLine);
    scrollingTopside(obj, picsPerLine);
    lastScrollTop = obj.scrollTop;
  } else if(obj.scrollTop < lastScrollTop) {
    scrollingTopside(obj, picsPerLine);
    scrollingBottomside(obj, picsPerLine);
    lastScrollTop = obj.scrollTop;
  }
  if(document.getElementById('contextmenu').style.display == "block") {
    hideContextMenu(contextmenuelement);
  }
  setContainerheight();
}
function loadBottom(obj, picsPerLine) {
  var picPath;
  var picFileName;
  var extension;
  var addMulti;
  var linesShownNow = Math.ceil((obj.scrollTop+document.getElementById('mainpagecontent').clientHeight)/((pictureClientSize)+4));
  var linesHiddenNow = Math.floor(obj.scrollTop/((pictureClientSize)+4));
    while(picsShownUpTo < picsPerLine*(linesShownNow+2) && picsShownUpTo < piccount) {
      if(!multiSelectionActive) {
        addMulti = "";
      } else if(multiSelectionActive && selectedPictures.indexOf(pictures[picsShownUpTo].id) != -1) {
        addMulti = " selectedImage";
      } else if(multiSelectionActive) {
        addMulti = " notSelectedImage";
      }
      picPath = pictures[picsShownUpTo].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      picFileName = pictures[picsShownUpTo].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      extension = pictures[picsShownUpTo].filename.substr(pictures[picsShownUpTo].filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "webm" || extension == "mp4") {
        document.getElementById("pic" + picsShownUpTo + "container").innerHTML = "<video onclick=\"openDetails(" + pictures[picsShownUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsShownUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsShownUpTo + "\" loop muted autoplay><source src=\"" + pictures[picsShownUpTo].path + "\\" + pictures[picsShownUpTo].filename + "\" type=\"video/" + extension + "\"></video>";
      } else {
        document.getElementById("pic" + picsShownUpTo + "container").innerHTML = "<img onclick=\"openDetails(" + pictures[picsShownUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsShownUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[picsShownUpTo].path + "\\" + pictures[picsShownUpTo].filename + "\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsShownUpTo + "\" />";
      }
      picsShownUpTo += 1;
    }
      while(picsHiddenUpTo < picsPerLine*linesHiddenNow) {
        removeElementById("picture" + picsHiddenUpTo);
        picsHiddenUpTo += 1;
      }
      linesShown = linesShownNow;
      linesHidden = linesHiddenNow;
}
function loadTop(obj, picsPerLine) {
  var picPath;
  var picFileName;
  var extension;
  var addMulti;
  var linesShownNow = Math.ceil((obj.scrollTop+document.getElementById('mainpagecontent').clientHeight)/((pictureClientSize)+4));
  var linesHiddenNow = Math.floor(obj.scrollTop/((pictureClientSize)+4));
    while(picsShownUpTo > linesShownNow*picsPerLine) {
      picsShownUpTo -= 1;
      removeElementById("picture" + picsShownUpTo);
    }
      while(picsHiddenUpTo > picsPerLine*(linesHiddenNow-2) && picsHiddenUpTo > 0) {
        picsHiddenUpTo -= 1;
        if(!multiSelectionActive) {
          addMulti = "";
        } else if(multiSelectionActive && selectedPictures.indexOf(pictures[picsHiddenUpTo].id) != -1) {
          addMulti = " selectedImage";
        } else if(multiSelectionActive) {
          addMulti = " notSelectedImage";
        }
        picPath = pictures[picsHiddenUpTo].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
        picFileName = pictures[picsHiddenUpTo].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
        extension = pictures[picsHiddenUpTo].filename.substr(pictures[picsHiddenUpTo].filename.lastIndexOf('.') + 1).toLowerCase();
        if(extension == "webm" || extension == "mp4") {
          document.getElementById("pic" + picsHiddenUpTo + "container").innerHTML = "<video onclick=\"openDetails(" + pictures[picsHiddenUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsHiddenUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsHiddenUpTo + "\" loop muted autoplay><source src=\"" + pictures[picsHiddenUpTo].path + "\\" + pictures[picsHiddenUpTo].filename + "\" type=\"video/" + extension + "\"></video>";
        } else {
          document.getElementById("pic" + picsHiddenUpTo + "container").innerHTML = "<img onclick=\"openDetails(" + pictures[picsHiddenUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsHiddenUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[picsHiddenUpTo].path + "\\" + pictures[picsHiddenUpTo].filename + "\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsHiddenUpTo + "\" />";
        }
      }

  linesShown = linesShownNow;
  linesHidden = linesHiddenNow;
}
function scrollingBottomside(obj, picsPerLine) {
  var picPath;
  var picFileName;
  var extension;
  var addMulti;
  var linesShownNow = Math.ceil((obj.scrollTop+document.getElementById('mainpagecontent').clientHeight)/((pictureClientSize)+4));
  if(linesShownNow > linesShown) {
    while(picsShownUpTo < picsPerLine*(linesShownNow+2) && picsShownUpTo < piccount) {
      if(!multiSelectionActive) {
        addMulti = "";
      } else if(multiSelectionActive && selectedPictures.indexOf(pictures[picsShownUpTo].id) != -1) {
        addMulti = " selectedImage";
      } else if(multiSelectionActive) {
        addMulti = " notSelectedImage";
      }
      picPath = pictures[picsShownUpTo].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      picFileName = pictures[picsShownUpTo].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      extension = pictures[picsShownUpTo].filename.substr(pictures[picsShownUpTo].filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "webm" || extension == "mp4") {
        document.getElementById("pic" + picsShownUpTo + "container").innerHTML = "<video onclick=\"openDetails(" + pictures[picsShownUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsShownUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsShownUpTo + "\" loop muted autoplay><source src=\"" + pictures[picsShownUpTo].path + "\\" + pictures[picsShownUpTo].filename + "\" type=\"video/" + extension + "\"></video>";
      } else {
        document.getElementById("pic" + picsShownUpTo + "container").innerHTML = "<img onclick=\"openDetails(" + pictures[picsShownUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsShownUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[picsShownUpTo].path + "\\" + pictures[picsShownUpTo].filename + "\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsShownUpTo + "\" />";
      }
      picsShownUpTo += 1;
    }
  } else if(linesShownNow < linesShown) {
    while(picsShownUpTo > linesShownNow*picsPerLine) {
      picsShownUpTo -= 1;
      removeElementById("picture" + picsShownUpTo);
    }
  }
  linesShown = linesShownNow;
}
function scrollingTopside(obj, picsPerLine) {
  var picPath;
  var picFileName;
  var extension;
  var addMulti;
  var linesHiddenNow = Math.floor(obj.scrollTop/((pictureClientSize)+4));
  if(linesHiddenNow < linesHidden) {
    while(picsHiddenUpTo > picsPerLine*(linesHiddenNow-2) && picsHiddenUpTo > 0) {
      picsHiddenUpTo -= 1;
      if(!multiSelectionActive) {
        addMulti = "";
      } else if(multiSelectionActive && selectedPictures.indexOf(pictures[picsHiddenUpTo].id) != -1) {
        addMulti = " selectedImage";
      } else if(multiSelectionActive) {
        addMulti = " notSelectedImage";
      }
      picPath = pictures[picsHiddenUpTo].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      picFileName = pictures[picsHiddenUpTo].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      extension = pictures[picsHiddenUpTo].filename.substr(pictures[picsHiddenUpTo].filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "webm" || extension == "mp4") {
        document.getElementById("pic" + picsHiddenUpTo + "container").innerHTML = "<video onclick=\"openDetails(" + pictures[picsHiddenUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsHiddenUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsHiddenUpTo + "\" loop muted autoplay><source src=\"" + pictures[picsHiddenUpTo].path + "\\" + pictures[picsHiddenUpTo].filename + "\" type=\"video/" + extension + "\"></video>";
      } else {
        document.getElementById("pic" + picsHiddenUpTo + "container").innerHTML = "<img onclick=\"openDetails(" + pictures[picsHiddenUpTo].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[picsHiddenUpTo].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[picsHiddenUpTo].path + "\\" + pictures[picsHiddenUpTo].filename + "\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + picsHiddenUpTo + "\" />";
      }
    }
  } else if(linesHiddenNow > linesHidden) {
    while(picsHiddenUpTo < picsPerLine*linesHiddenNow) {
      removeElementById("picture" + picsHiddenUpTo);
      picsHiddenUpTo += 1;
    }
  }
  linesHidden = linesHiddenNow;
}
function showInFolder (id) {
  var picFilePath = db.prepare("SELECT filename, path FROM pictures WHERE id = ?;").get(id);
  return shell.showItemInFolder(picFilePath.path + "\\" + picFilePath.filename);
}
function getCursorPosition(e) {
  return [(window.Event) ? e.pageX : event.clientX + (document.documentElement.scrollLeft ? document.documentElement.scrollLeft : document.body.scrollLeft), (window.Event) ? e.pageY : event.clientY + (document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop)];
}
function copyLocation(id) {
  var picFilePath = db.prepare("SELECT filename, path FROM pictures WHERE id = ?;").get(id);
  clipboard.writeText(picFilePath.path + "\\" + picFilePath.filename);
}
function showContextMenu(event, el, picid) {
  var contextmenu = document.getElementById('contextmenu');
  contextmenuelement = el;
  contextmenu.innerHTML = "<div class=\"contextmenuentrytop contextmenuentry\"><div class=\"contextmenutext\" onclick=\"showInFolder(" + picid + "); hideContextMenu(this.parentNode.parentNode);\">Show in Folder</div></div><div class=\"contextmenuentry contextmenuentrycenter\" onclick=\"openAddTagsDialog('add', " + picid + "); hideContextMenu(this.parentNode.parentNode);\"><div class=\"contextmenutext\">Add Tags</div></div><div class=\"contextmenuentry contextmenuentrycenter\" onclick=\"openAddTagsDialog('remove', \[" + picid + "\]); hideContextMenu(this.parentNode.parentNode);\"><div class=\"contextmenutext\">Remove Tags</div></div><div class=\"contextmenuentry contextmenuentrybottom\" onclick=\"copyLocation(" + picid + "); hideContextMenu(this.parentNode.parentNode);\"><div class=\"contextmenutext\">Copy Location</div></div>";
  var cursorPosition = getCursorPosition(event);
  contextmenu.style.display = "block";
  if(document.getElementById('content').clientWidth - cursorPosition[0] < contextmenu.clientWidth) {
    contextmenu.style.left = document.getElementById('content').clientWidth - contextmenu.clientWidth + "px";
  } else {
    contextmenu.style.left = cursorPosition[0] + "px";
  }
  if(document.getElementById('content').clientHeight - cursorPosition[1] < contextmenu.clientHeight) {
    contextmenu.style.top = document.getElementById('content').clientHeight - contextmenu.clientHeight + "px";
  } else {
    contextmenu.style.top = cursorPosition[1] + "px";
  }
  menuFunc = contextmenu.addEventListener('outclick', function(e) {
    hideContextMenu(contextmenu);
  });
}
function hideContextMenu(el) {
  document.getElementById('contextmenu').style.display = "none";
  el.removeEventListener('outclick', menuFunc);
}
function closeFileDetails() {
  fileDetailsOpen = false;
  var previewedFile = document.getElementById('previewedfile');
  if(previewedFile.tagName.toLowerCase() == "video") {
    previewedFile.pause();
  }
  tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
  var i;
  for(i = 0; i < tagsForAutocomplete.length; i += 1) {
    tagsForAutocomplete[i].tag = tagsForAutocomplete[i].tag.addSlashes();
  }
  var opa = 1;
  var anim = setInterval(animateCloseDetails, 5);
  function animateCloseDetails() {
    if(document.getElementById('details').style.opacity <= "0") {
      document.getElementById('details').style.display = "none";
      document.getElementById('filedetails').innerHTML = "";
      clearInterval(anim);
    } else {
      opa -= 0.05;
      document.getElementById('details').style.opacity = opa;
    }
  }
}
function toggleMultiSelection() {
  if(!fileDetailsOpen) {
    var i;
    if(!multiSelectionActive) {
      document.getElementById("selectMultipleButtonText").innerHTML = "Cancel";
      document.getElementById("multiSelectionAddTagsButton").style.visibility = "visible";
      document.getElementById("multiSelectionRemoveTagsButton").style.visibility = "visible";
      document.getElementById("multiSelectionClearSelectionButton").style.visibility = "visible";
      document.getElementById("multiSelectionCounter").style.visibility = "visible";
      for(i = picsHiddenUpTo; i < picsShownUpTo; i += 1) {
        document.getElementById('picture' + i).classList.add("notSelectedImage");
      }
      multiSelectionActive = true;
    } else {
      document.getElementById("selectMultipleButtonText").innerHTML = "Multi-selection";
      document.getElementById("multiSelectionAddTagsButton").style.visibility = "hidden";
      document.getElementById("multiSelectionRemoveTagsButton").style.visibility = "hidden";
      document.getElementById("multiSelectionClearSelectionButton").style.visibility = "hidden";
      document.getElementById("multiSelectionCounter").style.visibility = "hidden";
      for(i = picsHiddenUpTo; i < picsShownUpTo; i += 1) {
        if(document.getElementById('picture' + i).classList.contains("notSelectedImage")) {
          document.getElementById('picture' + i).classList.remove("notSelectedImage");
        } else {
          document.getElementById('picture' + i).classList.remove("selectedImage");
        }
      }
      selectedPictures = [];
      document.getElementById("multiSelectionCounter").innerHTML = "Pictures selected: " + selectedPictures.length;
      multiSelectionActive = false;
    }
  }
}
function multiSelectionClear() {
  var i;
  for(i = picsHiddenUpTo; i < picsShownUpTo; i += 1) {
    if(document.getElementById('picture' + i).classList.contains("selectedImage")) {
      document.getElementById('picture' + i).classList.remove("selectedImage");
      document.getElementById('picture' + i).classList.add("notSelectedImage");
    }
  }
  selectedPictures = [];
  document.getElementById("multiSelectionCounter").innerHTML = "Pictures selected: " + selectedPictures.length;
}
function multiSelectionAction(action) {
  if(selectedPictures.length > 0) {
    openAddTagsDialog(action, selectedPictures);
  }
}
function openDetails(picdbid) {
  var picid = pictureidarray.indexOf(picdbid);
  if(multiSelectionActive) {
    if(selectedPictures.indexOf(picdbid) == -1) {
      document.getElementById("picture" + picid).classList.add("selectedImage");
      document.getElementById("picture" + picid).classList.remove("notSelectedImage");
      selectedPictures.push(picdbid);
    } else {
      document.getElementById("picture" + picid).classList.remove("selectedImage");
      document.getElementById("picture" + picid).classList.add("notSelectedImage");
      selectedPictures.splice(selectedPictures.indexOf(picdbid), 1);
    }
    document.getElementById("multiSelectionCounter").innerHTML = "Pictures selected: " + selectedPictures.length;
  } else {
    var i;
    var pic = db.prepare('SELECT * FROM pictures WHERE id = ?;').get(picdbid);
    fileDetailsOpen = true;
    var extension = pic.filename.substr(pic.filename.lastIndexOf('.') + 1).toLowerCase();
    var picPath = pic.path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
    var picFileName = pic.filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
    if(extension == "mp4" || extension == "webm") {
      document.getElementById('filepreview').innerHTML = "<video onclick=\"if(this.paused){this.play();} else {this.pause();}\" id=\"previewedfile\" oncontextmenu=\"showContextMenu(event, this, " + picdbid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"filepreview\" loop autoplay><source src=\"" + pic.path + "\\" + pic.filename + "\" type=\"video/" + extension + "\"></video>";
    } else {
      document.getElementById('filepreview').innerHTML = "<img id=\"previewedfile\" oncontextmenu=\"showContextMenu(event, this, " + picdbid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pic.path + "\\" + pic.filename + "\" class=\"filepreview\" />";
    }
    var details = [];
    var rating = "";
    var rated;
    for(i = 0; i < 10; i += 1) {
      rated = "N";
      if(i <= pic.rating) {
        rated = "Y";
      }
      rating += "<div id=\"detailsRating" + i + "\" class=\"inlineblock rating rating" + rated + "\" onclick=\"setRating(" + picdbid + ", " + i + ", 'details');\"></div>";
    }
    details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Filename</div><div class=\"fileDetailsDetails\"><div class=\"fileDetailsScroll\">" + pic.filename.split('.').shift() + "</div></div></div>");
    details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Filetype</div><div class=\"fileDetailsDetails\">" + pic.filename.split('.').pop() + "</div></div>");
    details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Folder</div><div class=\"fileDetailsDetails\"><div class=\"fileDetailsScroll\">" + pic.path + "</div></div></div>");
    details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Added On</div><div class=\"fileDetailsDetails\">" + moment(pic.timeAdded, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") + "</div></div>");
    details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Rating</div><div class=\"fileDetailsDetails\">" + rating + "</div></div>")
    var tags = db.prepare('SELECT tag FROM tags WHERE id = ?;').all(picdbid);
    var tagHtml = "";
    document.getElementById('detailsShowInFolderButton').onclick = function() {
      showInFolder(picdbid);
    };
    document.getElementById('detailsCopyLocationButton').onclick = function() {
      copyLocation(picdbid);
    };
    for(i = 0; i < tags.length; i += 1) {
      tags[i].tag = tags[i].tag.addSlashes();
      tagHtml += "<div class=\"picTagListing\"><div onclick=\"addSearchTag(\'" + tags[i].tag + "\', false);\" oncontextmenu=\"addSearchTag(\'" + tags[i].tag + "\', true);\" class=\"picTagText\">" + tags[i].tag.stripSlashes() + "</div><img src=\"img/close.webp\" class=\"tagDeleteButton\" onclick=\"removeTag(\'" + tags[i].tag + "\', \'" + pic.id + "\', this)\" /></div>";
    }
    details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Tags</div><div class=\"fileDetailsDetails\" id=\"fileDetailsDetails\">" + tagHtml + "</div></div>");
    var i;
    for(i = 0; i < details.length; i += 1) {
      document.getElementById('filedetails').innerHTML += details[i];
    }
    document.getElementById('fileDetailsDetails').innerHTML += "<div id=\"fileDetailsAddTags\" class=\"picTagListing picAddTagListing\" onclick=\"openAddTagsDialog('add', \'" + pic.id + "\')\"><div class=\"picTagText picTagTextAdd\">\+</div></div>";
    document.getElementById('details').style.display = "block";
    var anim = setInterval(animateOpenDetails, 5);
    var opa = 0;
    function animateOpenDetails() {
      if(document.getElementById('details').style.opacity == "1") {
        clearInterval(anim);
      } else {
        opa += 0.05;
        document.getElementById('details').style.opacity = opa;
      }
    }
  }
}
function setRating(picdbid, rating, place) {
  db.prepare("UPDATE pictures SET rating = ? WHERE id = ?;").run(rating, picdbid);
  var i;
  var element;
  if(place == "details") {
    for(i = 0; i < 10; i += 1) {
      element = document.getElementById('detailsRating' + i);
      if(i <= rating) {
        if(element.classList.contains("ratingN")) {
          element.classList.remove("ratingN");
          element.classList.add("ratingY");
        }
      } else {
        if(element.classList.contains("ratingY")) {
          element.classList.remove("ratingY");
          element.classList.add("ratingN");
        }
      }
    }
  }
}
function removeTag (tagname, picid, element) {
  db.prepare('DELETE FROM tags WHERE tag = ? AND id = ?;').run(tagname, picid);
  removeElement(element.parentNode);
}
function openAddTagsDialog(action, picid) {
  var i;
  var z;
  var multiSelection = false;
  if(picid instanceof Array) {
    multiSelection = true;
  }
  if(!(multiSelection && action == "remove")) {
    document.getElementById('editTagsDialogueAdd').style.display = "block";
    document.getElementById('editTagsDialogueRemove').style.display = "none";
    removeElementById("editTagsInput");
    document.getElementById('editTagsAddButton').insertAdjacentHTML("beforeBegin", "<input type=\"text\" id=\"editTagsInput\" oninput=\"autocompleteEditTags();\" onfocus=\"autocompleteEditTags();\" onkeypress=\"if(event.keyCode == 13) {if(this.value != '') {editTagsAddTagToList(this.value.toLowerCase());} else {editTagsConfirm(\'" + action + "\', [" + picid + "], " + multiSelection + ");}}\" />");
    tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
    if(!multiSelection) {
      editTagsAlreadyAssigned = db.prepare('SELECT tag FROM tags WHERE id = ?;').all(picid);
    } else {
      editTagsAlreadyAssigned = [];
    }
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      tagsForAutocomplete[i].tag = tagsForAutocomplete[i].tag.addSlashes();
    }
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      for(z = 0; z < editTagsAlreadyAssigned.length; z += 1) {
        if(tagsForAutocomplete[i].tag == editTagsAlreadyAssigned[z].tag) {
          tagsForAutocomplete.splice(i, 1);
        }
      }
    }
  } else {
    document.getElementById('editTagsDialogueAdd').style.display = "none";
    document.getElementById('editTagsDialogueRemove').style.display = "block";
    var tagsToBeRemoved = [];
    var tagsArray;
    for(i = 0; i < picid.length; i += 1) {
      tagsArray = db.prepare('SELECT tag FROM tags WHERE id = ?;').all(picid[i]);
      for(z = 0; z < tagsArray.length; z += 1) {
        if(tagsToBeRemoved.indexOf(tagsArray[z].tag) == -1) {
          tagsToBeRemoved.push(tagsArray[z].tag);
        }
      }
    }
    var textToBeAdded = "";
    tagsToBeRemoved.forEach(function(tag) {
      textToBeAdded += "<div class=\"inlineblock removeTagsTag\" onclick=\"toggleRemoveTags(this);\">" + tag + "</div>";
    });
    document.getElementById("removeTagsListing").innerHTML = textToBeAdded;
  }
  document.getElementById('editTagsConfirm').onclick = function() {
    editTagsConfirm(action, picid, multiSelection);
  };
  document.getElementById('translucentOverlay').style.display = "block";
  document.getElementById('editTagsDialogueArea').style.display = "block";
  showOverlay();
  var anim = setInterval(animateOpenTagsDialogue, 5);
  var opa = 0;
  function animateOpenTagsDialogue() {
    if(opa >= 1) {
      clearInterval(anim);
    } else {
      opa += 0.05;
      document.getElementById('editTagsDialogueArea').style.opacity = opa;
    }
  }
  if(action == "add") {
    document.getElementById('editTagsInput').focus();
  }
}
function toggleRemoveTags(elm) {
  if(!elm.classList.contains("removeTagsTagTBR")) {
    editTagsArray.push(elm.innerHTML);
    elm.classList.add("removeTagsTagTBR");
  } else {
    editTagsArray.splice(editTagsArray.indexOf(elm.innerHTML), 1);
    elm.classList.remove("removeTagsTagTBR");
  }
}
function editTagsConfirm (action, picid, multi) {
  var i;
  for(i = 0; i < editTagsArray.length; i += 1) {
    editTagsArray[i] = editTagsArray[i].stripIllegal();
  }
  var x;
  var query = "INSERT INTO tags (tag, id) VALUES (?, ?);";
  if(multi) {
    var picidlength = picid.length;
  } else {
    var picidlength = 1;
  }
  if(action == "remove") {
    query = "DELETE FROM tags WHERE tag = ? AND id = ?;";
  }
  for(i = 0; i < editTagsArray.length; i += 1) {
    for(x = 0; x < picidlength; x += 1) {
      var cont = true;
      if(action == "add" && multi) {
        if(db.prepare("SELECT count(*) FROM tags WHERE tag = ? AND id = ?;").get(editTagsArray[i], picid[x])["count(*)"] > 0) {
          cont = false;
        }
      } else if(action == "remove" && multi) {
        if(db.prepare("SELECT count(*) FROM tags WHERE tag = ? AND id = ?;").get(editTagsArray[i], picid[x])["count(*)"] == 0) {
          cont = false;
        }
      }
      if(multi && cont) {
        db.prepare(query).run(editTagsArray[i], picid[x]);
      } else if(!multi) {
        db.prepare(query).run(editTagsArray[i], picid);
      }
      if(fileDetailsOpen) {
        document.getElementById('fileDetailsAddTags').insertAdjacentHTML("beforeBegin", "<div class=\"picTagListing\"><div onclick=\"addSearchTag(\'" + editTagsArray[i] + "\', false);\" oncontextmenu=\"addSearchTag(\'" + editTagsArray[i] + "\', true);\" class=\"picTagText\">" + editTagsArray[i] + "</div><img src=\"img/close.webp\" class=\"tagDeleteButton\" onclick=\"removeTag(\'" + editTagsArray[i] + "\', \'" + picid + "\', this)\" /></div>");
      } else if(multiSelectionActive) {
        multiSelectionClear();
      }
    }
  }
  tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
  for(i = 0; i < tagsForAutocomplete.length; i += 1) {
    tagsForAutocomplete[i].tag = tagsForAutocomplete[i].tag.addSlashes();
  }
  hideEditTagsDialogue();
}
function allowDrop(ev) {
  ev.preventDefault();
}
function drop(ev) {
  ev.preventDefault();
  var data = ev.dataTransfer.files;
  if(data.length == 1) {
    var droppedPic = db.prepare("SELECT id, count(*) FROM pictures WHERE filename = ? AND path = ?;").get(data[0].name, data[0].path.substring(0, data[0].path.lastIndexOf("\\")));
    if(droppedPic["count(*)"] == 1) {
      openDetails(droppedPic.id);
    }
  }
}
function autocompleteEditTags () {
  var value = document.getElementById('editTagsInput').value.stripIllegal();
  var i;
  var tagsToList = "";
  var z;
  var add;
  if(value != "") {
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      add = true;
      if(tagsForAutocomplete[i].tag.stripSlashes().substring(0, value.length).toLowerCase() == value.toLowerCase()) {
        for(z = 0; z < editTagsArray.length; z += 1) {
          if(editTagsArray[z] == tagsForAutocomplete[i].tag) {
            add = false;
          }
        }
        if(add) {
          tagsToList += "<div class=\"autocompleteEntry\" onclick=\"editTagsAddTagToList(\'" + tagsForAutocomplete[i].tag + "\');\"><b>" + value.toLowerCase() + "</b>" + tagsForAutocomplete[i].tag.stripSlashes().substr(value.length) + "</div>";
        }
      }
    }
  }
  document.getElementById('editTagsAutocomplete').innerHTML = tagsToList;
  autoEditHide = document.getElementById('editTagsAutoWrapper').addEventListener('outclick', function (e) {
    hideEditTagsAutocomplete();
  });
}
function hideEditTagsAutocomplete() {
  document.getElementById('editTagsAutocomplete').style.backgroundColor = "";
  var childarray = Array.from(document.getElementById('editTagsAutocomplete').childNodes);
  var i;
  for(i = 0; i < childarray.length; i += 1) {
    childarray[i].style.backgroundColor = "";
    childarray[i].style.display = "none";
  }
  document.getElementById('editTagsAutoWrapper').removeEventListener('outclick', autoEditHide);
}
function toggleSortingDropdown () {
  var elm = document.getElementById('sortingDropdown');
  var rotatePic = document.getElementById('sortByDropDownImage');
  if(!sortingDropdownShown) {
    rotatePic.classList.add('rotate180');
    elm.classList.add('sortingDropdownDrop');
    sortingDropdownShown = true;
    sortingDropdownHide = document.getElementById('sortingDropdownHide').addEventListener('outclick', function(e) {
      toggleSortingDropdown();
    });
  } else {
    elm.classList.remove('sortingDropdownDrop');
    rotatePic.classList.remove('rotate180');
    sortingDropdownShown = false;
    document.getElementById('sortingDropdownHide').removeEventListener('outclick', sortingDropdownHide);
  }
}
function toggleOrderDropdown () {
  var elm = document.getElementById('orderDropdown');
  var rotatePic = document.getElementById('orderByDropDownImage');
  if(!orderDropdownShown) {
    rotatePic.classList.add('rotate180');
    elm.classList.add('orderDropdownDrop');
    orderDropdownShown = true;
    orderDropdownHide = document.getElementById('orderDropdownHide').addEventListener('outclick', function(e) {
      toggleOrderDropdown();
    });
  } else {
    elm.classList.remove('orderDropdownDrop');
    rotatePic.classList.remove('rotate180');
    orderDropdownShown = false;
    document.getElementById('orderDropdownHide').removeEventListener('outclick', orderDropdownHide);
  }
}
function toggleZoomDropdown () {
  var elm = document.getElementById('zoomDropdown');
  var rotatePic = document.getElementById('zoomDropDownImage');
  if(!zoomDropdownShown) {
    rotatePic.classList.add('rotate180');
    elm.classList.add('zoomDropdownDrop');
    zoomDropdownShown = true;
    zoomDropdownHide = document.getElementById('zoomDropdownHide').addEventListener('outclick', function(e) {
      toggleZoomDropdown();
    });
  } else {
    elm.classList.remove('zoomDropdownDrop');
    rotatePic.classList.remove('rotate180');
    zoomDropdownShown = false;
    document.getElementById('zoomDropdownHide').removeEventListener('outclick', zoomDropdownHide);
  }
}
function toggleFilterDropdown () {
  var elm = document.getElementById('filterDropdown');
  var rotatePic = document.getElementById('filterByDropDownImage');
  if(!filterDropdownShown) {
    rotatePic.classList.add('rotate180');
    elm.classList.add('filterDropdownDrop');
    filterDropdownShown = true;
    filterDropdownHide = document.getElementById('filterDropdownHide').addEventListener('outclick', function(e) {
      toggleFilterDropdown();
    });
  } else {
    elm.classList.remove('filterDropdownDrop');
    rotatePic.classList.remove('rotate180');
    filterDropdownShown = false;
    document.getElementById('filterDropdownHide').removeEventListener('outclick', filterDropdownHide);
  }
}
function expandTagList() {
  clearInterval(expandAnim);
  expandAnim = setInterval(animateExpandTagList, 3);
  var element = document.getElementById('searchTagWrapper');
  var element2 = document.getElementById('searchTags');
  function animateExpandTagList() {
    if(tagListExpanded) {
      document.getElementById('expandTagList').classList.remove('rotate180');
      if(element.clientHeight > 33) {
        element.style.height = (element.clientHeight - 1) + "px";
      } else {
        clearInterval(expandAnim);
        tagListExpanded = false;
      }
    } else {
      document.getElementById('expandTagList').classList.add('rotate180');
      if(element.clientHeight <= element2.clientHeight) {
        element.style.height = (element.clientHeight + 1) + "px";
      } else {
        clearInterval(expandAnim);
        tagListExpanded = true;
      }
    }
  }
}
function sortBy(s) {
  if(orderBy != s) {
    var newtext;
    if(s == "datetime(timeAdded)") {
      newtext = "Time Added";
      if(orderBy == "filename") {
        reverseSortOrder();
      }
    } else if(s == "rating") {
      newtext = "Rating";
      if(orderBy == "filename") {
        reverseSortOrder();
      }
    } else if(s == "filename") {
      newtext = "Filename";
      reverseSortOrder();
    }
    orderBy = s;
    document.getElementById('sortingDropdownText').innerHTML = "Sort By: " + newtext;
    loadPictures();
  }
}
function reverseSortOrder() {
  if(sortingOrder == "ASC") {
    sortOrderBy("DESC", false);
  } else {
    sortOrderBy("ASC", false);
  }
}
function sortOrderBy(s, re) {
  if(sortingOrder != s) {
    sortingOrder = s;
    var newtext;
    if(s == "ASC") {
      newtext = "Ascending";
    } else if(s == "DESC") {
      newtext = "Descending";
    }
    document.getElementById('orderDropdownText').innerHTML = newtext;
    if(re) {
      loadPictures();
    }
}
}
function searchAutocomplete(value) {
  var i;
  var tagsToList = "";
  var z;
  var add;
  var elm = document.getElementById('searchAutocomplete');
  if(value != "") {
    value = value.stripIllegal();
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      add = true;
      if(tagsForAutocomplete[i].tag.stripSlashes().substring(0, value.length).toLowerCase() == value.toLowerCase()) {
        for(z = 0; z < searchArrayInc.length; z += 1) {
          if(searchArrayInc[z] == tagsForAutocomplete[i].tag) {
            add = false;
          }
        }
        for(z = 0; z < searchArrayExc.length; z += 1) {
          if(searchArrayExc[z] == tagsForAutocomplete[i].tag) {
            add = false;
          }
        }
        if(add) {
          tagsToList += "<div class=\"autocompleteEntry\" onclick=\"addSearchTag('" + tagsForAutocomplete[i].tag + "', false);\" oncontextmenu=\"addSearchTag('" + tagsForAutocomplete[i].tag + "', true);\"><b>" + value.toLowerCase() + "</b>" + tagsForAutocomplete[i].tag.stripSlashes().substring(value.length) + "</div>";
        }
      }
    }
  }
  elm.innerHTML = tagsToList;
  var autoSearchOut = document.getElementById('autoSearchWrapper');
  autoSearchHide = autoSearchOut.addEventListener('outclick', function (e) {
    hideSearchAutocomplete();
  });
}
function hideSearchAutocomplete() {
  var elm = document.getElementById('searchAutocomplete');
  elm.style.backgroundColor = "";
  var childarray = Array.from(elm.childNodes);
  var i;
  for(i = 0; i < childarray.length; i += 1) {
    childarray[i].style.backgroundColor = "";
    childarray[i].style.display = "none";
  }
  document.getElementById('autoSearchWrapper').removeEventListener('outclick', autoSearchHide);
}
function addSearchTag(tag, exclude) {
  document.getElementById('searchbar').value = "";
  tag = tag.stripIllegal();
  var classname;
  var element;
  var removeExclude;
  var i;
  var add = true;
  if(tag == "nsfw" && !exclude) {
    if(db.prepare('SELECT value FROM settings WHERE name = ?;').get("hidensfw").value == 1) {
      searchArrayExc.splice(searchArrayExc.indexOf("nsfw"), 1);
    }
  }
  for(i = 0; i < searchArrayInc.length; i += 1) {
    if(searchArrayInc[i] == tag) {
      add = false;
    }
  }
  for(i = 0; i < searchArrayExc.length; i += 1) {
    if(searchArrayExc[i] == tag) {
      add = false;
    }
  }
  if(!exclude && add) {
    searchArrayInc.push(tag);
    classname = "includetag";
    removeExclude = "false";
  } else if (add) {
    searchArrayExc.push(tag);
    classname = "excludetag";
    removeExclude = "true";
  }
  element = document.getElementById('searchTags');
  if(add) {
    element.innerHTML += "<div id=\"searchTagName" + tag + "\" class=\"tag " + classname + "\"><div class=\"inlineblock\" onclick=\"switchIncludeExclude('" + tag + "', " + removeExclude + ", this);\">" + tag + "</div><img src=\"img/close.webp\" class=\"searchRemoveTag inlineblock\" onclick=\"removeSearchTag('" + tag.addSlashes() + "', " + removeExclude + ", this);\" /></div>";
    loadPictures();
    hideSearchAutocomplete();
  }
  if(document.getElementById('searchTags').clientHeight > 33) {
    document.getElementById('expandTagList').style.display = "block";
    document.getElementById('searchTags').style.paddingLeft = "60px";
  } else {
    document.getElementById('expandTagList').style.display = "none";
    document.getElementById('searchTags').style.paddingLeft = "35px";
  }
  if(tagListExpanded && document.getElementById('searchTags').clientHeight > document.getElementById('searchTagWrapper').clientHeight) {
    clearInterval(expandAnim);
    expandAnim = setInterval(animateExpandTagList, 3);
    var element = document.getElementById('searchTagWrapper');
    var element2 = document.getElementById('searchTags');
    function animateExpandTagList() {
      if(element.clientHeight <= element2.clientHeight) {
        element.style.height = (element.clientHeight + 1) + "px";
      } else {
        clearInterval(expandAnim);
      }
    }
  }
  if(!clearTagButtonShown) {
    document.getElementById('clearSearchTags').style.display = "block";
    clearTagButtonShown = true;
  }
}
function removeSearchTag(tag, exclude, elm) {
  console.log(tag);
  var i;
  if(!exclude) {
    for(i = 0; i < searchArrayInc.length; i += 1) {
      console.log(searchArrayInc[i]);
      if(searchArrayInc[i] == tag) {
        searchArrayInc.splice(i, 1);
        if(tag == "nsfw" && db.prepare('SELECT value FROM settings WHERE name = ?;').get("hidensfw").value == 1) {
          searchArrayExc.push("nsfw");
        }
      }
    }
  } else {
    for(i = 0; i < searchArrayExc.length; i += 1) {
      if(searchArrayExc[i] == tag) {
        searchArrayExc.splice(i, 1);
      }
    }
  }
  removeElement(elm.parentNode);
  if(document.getElementById('searchTags').clientHeight < document.getElementById('searchTagWrapper').clientHeight && tagListExpanded) {
    clearInterval(expandAnim);
    expandAnim = setInterval(animateExpandTagList, 3);
    var element = document.getElementById('searchTagWrapper');
    var element2 = document.getElementById('searchTags');
    function animateExpandTagList() {
      if(element.clientHeight > element2.clientHeight) {
        element.style.height = (element.clientHeight - 1) + "px";
      } else {
        clearInterval(expandAnim);
      }
    }
    if(element2.clientHeight == 33) {
    document.getElementById('expandTagList').style.display = "none";
    document.getElementById('searchTags').style.paddingLeft = "35px";
    document.getElementById('expandTagList').classList.remove('rotate180');
    tagListExpanded = false;
    }
  }
  var nsfwExcluded = db.prepare('SELECT value FROM settings WHERE name = ?;').get("hidensfw").value == 1;
  if((nsfwExcluded == 0 && searchArrayInc.length == 0 && searchArrayExc.length == 0) || (nsfwExcluded == 1 && searchArrayInc.length == 0 && searchArrayExc.length == 1)) {
    document.getElementById('clearSearchTags').style.display = "none";
    clearTagButtonShown = false;
    document.getElementById('searchTags').style.paddingLeft = "0px";
  }
  if(document.getElementById('searchTags').clientHeight == 33 && !tagListExpanded) {
    document.getElementById('expandTagList').style.display = "none";
    document.getElementById('searchTags').style.paddingLeft = "35px";
  }
  loadPictures();
}
function clearSearchTags(reload) {
  searchArrayInc = [];
  searchArrayExc = [];
  if(db.prepare('SELECT value FROM settings WHERE name = ?;').get("hidensfw").value == 1) {
    searchArrayExc.push("nsfw");
  }
  document.getElementById('searchTags').innerHTML = "";
  document.getElementById('clearSearchTags').style.display = "none";
  clearTagButtonShown = false;
  document.getElementById('expandTagList').style.display = "none";
  document.getElementById('searchTags').style.paddingLeft = "35px";
  if(tagListExpanded) {
    document.getElementById('expandTagList').classList.remove('rotate180');
    clearInterval(expandAnim);
    document.getElementById('searchTagWrapper').style.height = "33px";
  }
  tagListExpanded = false;
  document.getElementById('searchTags').style.paddingLeft = "0px";
  if(reload == undefined) {
    loadPictures();
  }
}
function switchIncludeExclude(tag, exclude, elm) {
  var i;
  var element;
  var classname;
  var removeExclude;
  if(!exclude) {
    for(i = 0; i < searchArrayInc.length; i += 1) {
      if(searchArrayInc[i] == tag) {
        searchArrayInc.splice(i, 1);
        searchArrayExc.push(tag);
        element = document.getElementById('searchTagName' + tag);
        classadd = "excludetag";
        classremove = "includetag";
        removeExclude = "true";
      }
    }
  } else {
    for(i = 0; i < searchArrayExc.length; i += 1) {
      if(searchArrayExc[i] == tag) {
        searchArrayExc.splice(i, 1);
        searchArrayInc.push(tag);
        element = document.getElementById('searchTagName' + tag);
        classadd = "includetag";
        classremove = "excludetag";
        removeExclude = "false";
      }
    }
  }
  element.classList.add(classadd);
  element.classList.remove(classremove);
  element.innerHTML = "<div class=\"inlineblock\"  onclick=\"switchIncludeExclude('" + tag + "', " + removeExclude + ", this);\">" + tag + "</div><img src=\"img/close.webp\" class=\"searchRemoveTag inlineblock\" onclick=\"removeSearchTag('" + tag.addSlashes() + "', " + removeExclude + ", this);\" />";
  loadPictures();
}
function editTagsAddTagToList (tagname) {
  if(tagname != "") {
    tagname = tagname.stripIllegal();
    var i;
    var add = true;
    var z;
    for(i = 0; i < editTagsArray.length; i += 1) {
      if(tagname.toLowerCase() == editTagsArray[i]) {
        add = false;
      }
    }
    for(z = 0; z < editTagsAlreadyAssigned.length; z += 1) {
      if(tagname.toLowerCase() == editTagsAlreadyAssigned[z].tag) {
        add = false;
      }
    }
    if(add) {
      editTagsArray.push(tagname.toLowerCase());
      document.getElementById('editTagsListing').innerHTML += "<div class=\"editTagsListingTag\"><div class=\"editTagsListingTagText\">" + tagname + "</div><img src=\"img/close.webp\" class=\"editTagsRemoveTag\" onclick=\"editTagsRemoveTag('" + tagname + "', this);\" /></div>";
      document.getElementById('editTagsInput').value = "";
    }
    hideEditTagsAutocomplete();
  }
}
function editTagsRemoveTag (tag, elm) {
  var i;
  for(i = 0; i < editTagsArray.length; i += 1) {
    if(tag == editTagsArray[i]) {
      editTagsArray.splice(i, 1);
      removeElement(elm.parentNode);
    }
  }
}
function hideEditTagsDialogue() {
  var anim = setInterval(animateCloseTagsDialogue, 5);
  var opa = 1;
  hideOverlay();
  function animateCloseTagsDialogue() {
    if(opa <= 0) {
      document.getElementById('editTagsDialogueArea').style.display = "none";
      clearInterval(anim);
    } else {
      opa -= 0.05;
      document.getElementById('editTagsDialogueArea').style.opacity = opa;
    }
  }
  document.getElementById('editTagsInput').value = "";
  editTagsArray = [];
  document.getElementById('editTagsListing').innerHTML = "";
}
function showOverlay() {
  var anim = setInterval(animateShowOverlay, 5);
  var opa = 0;
  document.getElementById('translucentOverlay').style.display = "block";
  function animateShowOverlay() {
    if(opa < 0.5) {
      opa += 0.025;
      document.getElementById('translucentOverlay').style.opacity = opa;
    } else {
      clearInterval(anim);
    }
  }
}
function toggleAboutPage() {
  if(!aboutPageShown) {
    aboutPageShown = true;
    showOverlay();
    var opa = 0;
    document.getElementById("aboutArea").style.display = "block";
    var anim = setInterval(animateShowAbout, 5);
    function animateShowAbout() {
      if(opa < 1) {
        opa += 0.05;
        document.getElementById("aboutArea").style.opacity = opa;
      } else {
        clearInterval(anim);
      }
    }
  } else {
    aboutPageShown = false;
    hideOverlay();
    var opa = 1;
    var anim = setInterval(animateHideAbout, 5);
    function animateHideAbout() {
      if(opa > 0) {
        opa -= 0.05;
        document.getElementById("aboutArea").style.opacity = opa;
      } else {
        clearInterval(anim);
        document.getElementById("aboutArea").style.display = "none";
      }
    }
  }
}
function hideOverlay() {
  var anim = setInterval(animateHideOverlay, 5);
  var opa = 0.5;
  function animateHideOverlay() {
    if(opa > 0) {
      opa -= 0.025;
      document.getElementById('translucentOverlay').style.opacity = opa;
    } else {
      clearInterval(anim);
      document.getElementById('translucentOverlay').style.display = "none";
    }
  }
}
function loadMorePictures() {
    for(i = pictureid; i < piccount; i+=1) {
      document.getElementById("picloader").insertAdjacentHTML("beforeBegin", "<div class=\"piccontainer " + zoomClass + "\" id=\"pic" + pictureid + "container\"></div>");
      picPaths.push(pictures[i].path + "\\" + pictures[i].filename);
      pictureidarray.push(pictures[i].id);
      pictureid += 1;
    }
}
function loadPictures() {
  lastScrollTop = 0;
  document.getElementById("mainpagecontent").scrollTop = 0;
  picsHiddenUpTo = 0;
  picPaths = [];
  pictureidarray = [];
  pictureid = 0;
  var i;
  document.getElementById('picturecontainer').innerHTML = "";
  tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
  for(i = 0; i < tagsForAutocomplete.length; i += 1) {
    tagsForAutocomplete[i].tag = tagsForAutocomplete[i].tag.addSlashes();
  }
  var extension;
  var excludeQuery;
  if(excludedFiletypes.length == 0) {
    excludeQuery = "";
  } else {
    excludeQuery = " AND filetype NOT IN("
    for(i = 0; i < excludedFiletypes.length; i += 1) {
      excludeQuery += "'" + excludedFiletypes[i] + "'";
      if(i+1 < excludedFiletypes.length) {
        excludeQuery += ", ";
      }
    }
    excludeQuery += ")";
  }
  if(searchArrayInc.length > 0 && (searchArrayInc.indexOf("untagged") == -1 && searchArrayExc.indexOf("untagged") == -1)) {
    var queryadd = "";
    var query;
    var excludePictures;
    for(i = 0; i < searchArrayInc.length; i += 1) {
      queryadd += "tags.tag = ?";
      if(i+1 < searchArrayInc.length) {
        queryadd += " OR ";
      }
    }
    query = "SELECT * FROM pictures JOIN tags ON tags.id = pictures.id WHERE (" + queryadd + ") AND excluded = ? AND available = ?" + excludeQuery + " GROUP BY tags.id HAVING count(*) = ? ORDER BY " + orderBy + " " + sortingOrder + ";";
    pictures = db.prepare(query).all(searchArrayInc, 0, 1, searchArrayInc.length);
    if(searchArrayExc.length > 0) {
      queryadd = "";
      for(i = 0; i < searchArrayExc.length; i += 1) {
        queryadd += "tags.tag = ?";
        if(i+1 < searchArrayExc.length) {
          queryadd += " OR ";
        }
      }
      query = "SELECT * FROM pictures JOIN tags ON tags.id = pictures.id WHERE (" + queryadd + ") AND excluded = ? AND available = ?" + excludeQuery + " GROUP BY tags.id ORDER BY " + orderBy + " " + sortingOrder + ";";
      excludePictures = db.prepare(query).all(searchArrayExc, 0, 1);
      var x;
      for(i = excludePictures.length-1; i >= 0; i -= 1) {
        for(x = pictures.length-1; x >= 0; x -= 1) {
          if(pictures[x].id == excludePictures[i].id) {
            pictures.splice(x, 1);
          }
        }
      }
    }
  } else if(searchArrayInc.indexOf("untagged") == -1 && searchArrayExc.indexOf("untagged") == -1) {
    pictures = db.prepare("SELECT * FROM pictures WHERE excluded = ? AND available = ?" + excludeQuery + " ORDER BY " + orderBy + " " + sortingOrder + ";").all(0, 1);
    if(searchArrayExc.length > 0) {
      queryadd = "";
      for(i = 0; i < searchArrayExc.length; i += 1) {
        queryadd += "tags.tag = ?";
        if(i+1 < searchArrayExc.length) {
          queryadd += " OR ";
        }
      }
      query = "SELECT * FROM pictures JOIN tags ON tags.id = pictures.id WHERE (" + queryadd + ") AND excluded = ? AND available = ?" + excludeQuery + " GROUP BY tags.id ORDER BY " + orderBy + " " + sortingOrder + ";";
      excludePictures = db.prepare(query).all(searchArrayExc, 0, 1);
      var x;
      for(i = excludePictures.length-1; i >= 0; i -= 1) {
        for(x = pictures.length-1; x >= 0; x -= 1) {
          if(pictures[x].id == excludePictures[i].id) {
            pictures.splice(x, 1);
          }
        }
      }
    }
  }
  if(searchArrayInc.indexOf("untagged") != -1 || searchArrayExc.indexOf("untagged") != -1) {
    var taggedids = db.prepare("SELECT DISTINCT id FROM tags;").all();
    pictures = db.prepare("SELECT * FROM pictures WHERE excluded = ? AND available = ? ORDER BY " + orderBy + " " + sortingOrder + ";").all(0, 1);
    for(i = 0; i < taggedids.length; i += 1) {
      for(x = 0; x < pictures.length; x += 1) {
        if(taggedids[i].id == pictures[x].id) {
          pictures.splice(x, 1);
          break;
        }
      }
    }
  }
  countPics();
  var mainHeight = document.getElementById("mainpagecontent").clientHeight;
  var mainWidth = document.getElementById("mainpagecontent").clientWidth;
  var picAmount = (Math.floor(mainWidth/(pictureClientSize))*Math.ceil(mainHeight/(pictureClientSize)))+Math.floor(mainWidth/(pictureClientSize));
  lastPicsPerLine = Math.floor((mainWidth)/(pictureClientSize));
  canLoadMore = true;
  if(piccount < picAmount) {
    picAmount = piccount;
    canLoadMore = false;
  }
  var picPath;
  var addMulti;
  var picFileName;
  if(orderBy == "filename") {
    pictures.sort(naturalSort({order: sortingOrder}));
  }
  for(i = 0; i < picAmount; i+=1) {
    if(!multiSelectionActive) {
      addMulti = "";
    } else if(multiSelectionActive && selectedPictures.indexOf(pictures[i].id) != -1) {
      addMulti = " selectedImage";
    } else if(multiSelectionActive) {
      addMulti = " notSelectedImage";
    }
    picPath = pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
    picFileName = pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
    extension = pictures[i].filename.substr(pictures[i].filename.lastIndexOf('.') + 1).toLowerCase();
    if(extension == "webm" || extension == "mp4") {
      document.getElementById("picturecontainer").innerHTML += "<div class=\"piccontainer " + zoomClass + "\" id=\"pic" + pictureid + "container\"><video onclick=\"openDetails(" + pictures[i].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[i].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + pictureid + "\" loop muted autoplay><source src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" type=\"video/" + extension + "\"></video></div>";
    } else {
      document.getElementById("picturecontainer").innerHTML += "<div class=\"piccontainer " + zoomClass + "\" id=\"pic" + pictureid + "container\"><img onclick=\"openDetails(" + pictures[i].id + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictures[i].id + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture " + mainZoomClass + addMulti + "\" id=\"picture" + pictureid + "\" /></div>";
    }
    picPaths.push(pictures[i].path + "\\" + pictures[i].filename);
    pictureidarray.push(pictures[i].id);
    pictureid += 1;
  }
  document.getElementById("picturecontainer").innerHTML += "<div id=\"picloader\"></div>";
  loadMorePictures();
  var picAmountShown = Math.floor(mainWidth/(pictureClientSize))*Math.ceil(mainHeight/(pictureClientSize));
  var element;
  if(picAmount < picAmountShown) {
    picAmountShown = picAmount;
  }
  picsShownUpTo = picAmountShown;
  linesHidden = 0;
  linesShown = Math.ceil(mainHeight/(pictureClientSize));
}
function returnMatching(array1, array2) {
  return array1.filter(function(n){ return array2.indexOf(n)>-1?n:false;});
}
function returnDifferents(array1, array2) {
  return array1.filter(function(n){ return array2.indexOf(n)>-1?false:n;});
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
function removeElement(el) {
  el.parentNode.removeChild(el);
}
function removeTagFromPicture(picid, tag) {

}
function getDirectories(dir, isSub, isSubOf) {
  var files = fs.readdirSync(dir);
  dirList = dirList || [];
  var i;
  var isDir;
  for(i = 0; i < files.length; i += 1) {
    try {
      isDir = fs.lstatSync(dir + "\\" + files[i]).isDirectory();
    } catch(err) {
      isDir = false;
    }
    if(isDir) {
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
  document.getElementById('setupcontent').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div><br />Adding pictures into database";
  var subb;
  if(sub) {
    subb = 1;
  } else {
    subb = 0;
  }
  setTimeout(function() {
    db.prepare('INSERT INTO directories VALUES (?, ?, ?, ?);').run(directory, subb, 1, 1);
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
    var insertquery = 'INSERT INTO pictures (filename, path, hash, excluded, timeAdded, rating, filetype, available) VALUES (?,?,?,?,?,?,?,?);';
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
              db.prepare(insertquery).run(filename, picpath, filehash, 0, moment(fs.statSync(pictures[i]).mtime).format("YYYY-MM-DD HH:mm:ss"), 4, extension, 1);
              x += 1;
              if(tag) {
                id = db.prepare('SELECT id FROM pictures WHERE hash = ?;').get(filehash);
                tags = directories[z].split("\\");
                for(o = 0; o < tags.length; o += 1) {
                  db.prepare('INSERT INTO tags (id, tag) VALUES (?, ?);').run(id.id, tags[o].toLowerCase());
                }
              }
            }
          }
        }
      }
    }
    pictures = getFiles(directory);
    for (i = 0; i < pictures.length; i += 1) {
      picpath = pictures[i].substring(0, pictures[i].lastIndexOf("\\"));
      filename = pictures[i].split('\\').pop();
      extension = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
        filehash = xxh.hash64(fs.readFileSync(pictures[i]), xxhashsalt, 'hex');
        checkduplicate = db.prepare('SELECT count(*) FROM pictures WHERE hash = ?;').get(filehash)["count(*)"];
        if(checkduplicate == 0) {
          db.prepare(insertquery).run(filename, picpath, filehash, 0, moment(fs.statSync(pictures[i]).mtime).format("YYYY-MM-DD HH:mm:ss"), 4, extension, 1);
          x += 1;
        }
      }
    }
    if(firstRun) {
      if(!tag) {
        document.getElementById('setupcontent').innerHTML = "<br /><br /><br />Successfully added " + x + " pictures!<br /><br /><br /><button id=\"finishsetup\" class=\"roundbutton\">Continue</button>";
      } else {
        document.getElementById('setupcontent').innerHTML = "<br /><br /><br />Successfully added and tagged " + x + " pictures!<br /><br /><br /><button id=\"finishsetup\" class=\"roundbutton\">Continue</button>";
      }
    }
    document.getElementById('finishsetup').addEventListener("click", function() {
      reload();
    });
  }, 50);
}
function getFiles(dir){
  var fileList = [];
  var files = fs.readdirSync(dir);
  var i;
  var filestats;
  var cont;
  for(i = 0; i < files.length; i+=1){
    cont = true;
    var name = dir+'\\'+files[i];
    try {
      filestats = fs.statSync(name);
    } catch(err) {
      cont = false;
    }
    if(cont == true) {
      if(filestats.isDirectory() || filestats.size > 300000000) {
        cont = false;
      }
    }
    if (cont){
      fileList.push(name);
    }
  }
  return fileList;
}
function drag(event, path) {
  document.getElementById("content").ondrop = (event) => {};
  event.preventDefault();
  ipcRenderer.send('ondragstart', path);
  setTimeout(function() {
    enableDrop();
  }, 2000);
}
function enableDrop() {
  document.getElementById("content").ondrop = (event) => {
    drop(event);
  };
}
document.onreadystatechange = function () {
  if (document.readyState == "complete") {
    init();
  }
};
window.onbeforeunload = function() {
  db.close();
  var i;
  for(i = 0; i < watcher.length; i += 1) {
    watcher[i].close();
  }
};
