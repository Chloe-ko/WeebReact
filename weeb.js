const sql = require('better-sqlite3');
const fs = require('fs');
const {remote, ipcRenderer, shell, clipboard} = require('electron');
const dialog = remote.require('electron').dialog;
const xxh = require('xxhash');
const path = require('path');
const outclick = require('outclick');
const moment = require('moment');
const chokidar = require('chokidar');
var contextmenuelement;
var piccount;
var lastX;
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
var fileDetailsId;
var canLoadMore;
var tagSettingChanged;
var nsfwSettingChanged;
var settingsExcludedFiletypes;
var watcher;
var orderBy = "datetime(timeAdded)";
var sortingOrder = "DESC";
var editTagsArray = [];
var editTagsAlreadyAssigned = [];
var searchArrayInc = [];
var searchArrayExc = [];
var excludedFiletypes = [];
var renamedmovedfiles = [];
var filetypes = ["jpg", "png", "gif", "webm", "mp4"];
var pictureClientSize = 210;
var pictureid = 0;
var xxhashsalt = 4152;
var lastZ = 0;
var pictureScale = 1;
var firstRun = true;
var loadnew = true;
var tagListExpanded = false;
var sqlalreadysetup = false;
var clearTagButtonShown = false;
var sortingDropdownShown = false;
var orderDropdownShown = false;
var filterDropdownShown = false;
var fileDetailsOpen = false;
var settingsShown = false;
var appDataFolder = process.env.APPDATA + "\\WeebReact";
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
function countPics() {
  piccount = pictures.length;
  setContainerheight();
}
function setContainerheight () {
  document.getElementById("picturescrollcontainer").style.height = Math.ceil(piccount/Math.floor(document.getElementById("mainpagecontent").clientWidth/(pictureScale*pictureClientSize)))*(pictureScale*pictureClientSize) + "px";
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
    if(!sqlalreadysetup) {
      db.pragma("journal_mode = WAL");
      db.prepare("CREATE TABLE pictures (id integer primary key autoincrement, filename text, path text, filetype text, rating integer, hash text unique, excluded integer, available integer, timeAdded integer, unique(path, filename));").run();
      db.prepare("CREATE TABLE tags (tag text, id int, unique(tag, id));").run();
      db.prepare("CREATE TABLE directories (directory text, includeSubdirectories integer, watch integer);").run();
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
    document.getElementById("setupcontent").innerHTML = "Welcome!<br /><br />It looks like you don\'t have any folders set up yet. Please select the folder that contains your Reaction Pictures.<br /><br /><br /><button id=\"browsefolder\" class=\"roundbutton\">Select Folder</button><br /><br /><br /><div id=\"filetype-hint\">Supported Filetypes: .jpg .jpeg .png .gif .webm .mp4</div>";
    document.getElementById("browsefolder").addEventListener("click", function() {
      dialog.showOpenDialog({properties:["openDirectory"]}, checkPictures);
    });
    document.getElementById("overlay").style.display = "block";
    document.getElementById("setup").style.display = "block";
  } else {
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
    var picDirectories = db.prepare('SELECT directory FROM directories WHERE watch = ?;').all(1);
    watcher = chokidar.watch(picDirectories[0].directory, {ignored: /(^|[\/\\])\../, ignoreInitial: true}).on('all', (event, path) => {
        fileChange(event, path);
      });
    for(i = 1; i < picDirectories.length; i += 1) {
      watcher.add(picDirectories[i].directory);
    }
    removeElementById("setup");
    loadPictures();
    if(db.prepare('SELECT value FROM settings WHERE name = ?;').get("hidensfw").value == 1) {
      searchArrayExc.push("nsfw");
    }
    document.getElementById("mainpagecontent").addEventListener("scroll", function() {
      scrollFunctions();
    });
    window.addEventListener("resize", function() {
      scrollFunctions();
    });
    document.getElementById("mainpageoverlay").style.display = "none";
  }
}
function fileChange(event, file) {
  console.log(event, file);
  var picpath = file.substring(0, file.lastIndexOf("\\"));
  var filename = file.split('\\').pop();
  if(event == "add") {
    var filehash = xxh.hash64(fs.readFileSync(file), xxhashsalt, 'hex');
    var amountQuery = db.prepare('SELECT count(*),available FROM pictures WHERE hash = ?;').get(filehash);
    if(amountQuery["count(*)"] > 0 && amountQuery.available == 1) {
      renamedmovedfiles.push({filename: filename, path: picpath, filehash: filehash});
    } else if(amountQuery["count(*)"] > 0 && amountQuery.available == 0) {
      db.prepare("UPDATE pictures SET filename = ?, path = ?, available = ? WHERE hash = ?;").run(filename, picpath, 1, filehash);
      loadPictures();
    } else {
      addFile(file, filehash);
    }
  } else if (event == "change") {
    var filehash = xxh.hash64(fs.readFileSync(file), xxhashsalt, 'hex');
    db.prepare("UPDATE pictures SET hash = ? WHERE path = ? AND filename = ?;").run(filehash, picpath, filename)
  } else if (event == "unlink") {
    var i;
    var moved = false;
    var renamed = false;
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
    if(moved) {
      db.prepare("UPDATE pictures SET path = ? WHERE filename = ? AND hash = ?;").run(renamedmovedfiles[arrayindex].path, filename, renamedmovedfiles[arrayindex].filehash);
      renamedmovedfiles.splice(arrayindex, 1);
    } else if (renamed) {
      db.prepare("UPDATE pictures SET filename = ? WHERE path = ? AND hash = ?;").run(renamedmovedfiles[arrayindex].filename, picpath, renamedmovedfiles[arrayindex].filehash);
      renamedmovedfiles.splice(arrayindex, 1);
    }
    if(!moved && !renamed) {
      db.prepare("UPDATE pictures SET available = ? WHERE path = ? and filename = ?;").run(0, picpath, filename);
    }
    loadPictures();
  }
}
function addFile (file, filehash, picpath, filename) {
  var insertquery = 'INSERT INTO pictures (filename, path, hash, excluded, timeAdded, rating, filetype, available) VALUES (?,?,?,?,?,?,?,?);';
  var extension = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
  if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
    db.prepare(insertquery).run(filename, picpath, filehash, 0, moment(fs.statSync(file).mtime).format("YYYY-MM-DD HH:mm:ss"), 0, extension, 1);
      loadPictures();
  }
}
function scrollFunctions() {
  var obj = document.getElementById("mainpagecontent");
  var picsPerLine = Math.floor(obj.clientWidth/(pictureScale*pictureClientSize));
  scrollingTopside(obj, picsPerLine);
  scrollingBottomside(obj, picsPerLine);
  checkIfAtBottom(obj);
  if(document.getElementById('contextmenu').style.display == "block") {
    hideContextMenu(contextmenuelement);
  }
  setContainerheight();
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
    var i;
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
  if(reloadNeeded) {
    loadPictures();
  }
  toggleSettingsWindow();
}
function toggleSettingsWindow () {
  if(!settingsShown) {
    nsfwSettingChanged = false;
    tagSettingChanged = false;
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
function scrollingBottomside(obj, picsPerLine) {
  var i;
  var element;
  var x = Math.ceil((obj.scrollTop + obj.clientHeight)/(pictureScale*pictureClientSize))*(Math.floor(obj.clientWidth/(pictureScale*pictureClientSize)));
  if(x > lastX && x <= pictureid) {
    for(i = x - picsPerLine; i < x; i += 1) {
      element = document.getElementById('picture' + i);
      if(element.tagName.toLowerCase() == "video") {
        element.play();
      }
    }
    lastX = x;
  } else if(x < lastX && x < pictureid && lastX < pictureid) {
    for(i = x; i < x + picsPerLine; i += 1) {
      element = document.getElementById('picture' + i);
      if(element.tagName.toLowerCase() == "video") {
        element.pause();
      }
    }
    lastX = x;
  } else if (x > lastX && x > pictureid && pictureid == piccount && lastX < pictureid) {
    var picsToPlay = picsPerLine - (x - pictureid);
    var p;
    for(i = 0; i < picsToPlay; i += 1) {
      p = lastX + i;
      element = document.getElementById('picture' + p);
      if(element.tagName.toLowerCase() == "video") {
        element.play();
      }
    }
    lastX = x;
  } else if (x < lastX && lastX > pictureid && x < pictureid) {
    var p;
    var picsToPause = pictureid - x;
    for(i = 0; i < picsToPause; i += 1) {
      p = x + i;
      element = document.getElementById('picture' + p);
      if(element.tagName.toLowerCase() == "video") {
        element.pause();
      }
    }
    lastX = x;
  }
}
function scrollingTopside(obj, picsPerLine) {
  var i;
  var element;
  var z = Math.floor((obj.scrollTop)/(pictureScale*pictureClientSize))*(Math.floor(obj.clientWidth/(pictureScale*pictureClientSize)));
  if(z > 0 && z > lastZ && z < pictureid) {
    for(i = z - picsPerLine; i < z; i += 1) {
      element = document.getElementById('picture' + i);
      if(element.tagName.toLowerCase() == "video") {
        element.pause();
      }
    }
    lastZ = z;
  } else if (z < lastZ && z < pictureid) {
    for(i = z; i < z + picsPerLine; i += 1) {
      element = document.getElementById('picture' + i);
      if(element.tagName.toLowerCase() == "video") {
        element.play();
      }
    }
    lastZ = z;
  }
}
function showInFolder (id) {
  return shell.showItemInFolder(picPaths[id]);
}
function getCursorPosition(e) {
  return [(window.Event) ? e.pageX : event.clientX + (document.documentElement.scrollLeft ? document.documentElement.scrollLeft : document.body.scrollLeft), (window.Event) ? e.pageY : event.clientY + (document.documentElement.scrollTop ? document.documentElement.scrollTop : document.body.scrollTop)];
}
function copyLocation(id) {
  clipboard.writeText(picPaths[id]);
}
function showContextMenu(event, el, picid) {
  var contextmenu = document.getElementById('contextmenu');
  contextmenuelement = el;
  contextmenu.innerHTML = "<div class=\"contextmenuentrytop contextmenuentry\"><div class=\"contextmenutext\" onclick=\"showInFolder(" + picid + "); hideContextMenu(this.parentNode.parentNode);\">Show in Folder</div></div><div class=\"contextmenuentry contextmenuentrycenter\" onclick=\"copyLocation(" + picid + "); hideContextMenu(this.parentNode.parentNode);\"><div class=\"contextmenutext\">Copy Location</div></div><div class=\"contextmenuentrybottom contextmenuentry\"><div class=\"contextmenutext\">Exclude</div></div>";
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
function checkIfAtBottom(scrollcontainer) {
  obj = scrollcontainer;
  obj2 = document.getElementById("picturecontainer");
  if(obj2.scrollHeight - obj.clientHeight - obj.scrollTop < (pictureScale*pictureClientSize)) {
    if(loadnew && canLoadMore) {
      loadnew = false;
      loadMorePictures();
      loadnew = true;
      checkIfAtBottom(obj);
    }
  }
}
function closeFileDetails() {
  fileDetailsOpen = false;
  var previewedFile = document.getElementById('previewedfile');
  if(previewedFile.tagName.toLowerCase() == "video") {
    previewedFile.pause();
  }
  tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
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
function openDetails(picid) {
  fileDetailsOpen = true;
  fileDetailsId = picid;
  var pic = db.prepare('SELECT * FROM pictures WHERE id = ?;').get(pictureidarray[picid]);
  var extension = pic.filename.substr(pic.filename.lastIndexOf('.') + 1).toLowerCase();
  var picPath = pic.path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
  var picFileName = pic.filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
  if(extension == "mp4" || extension == "webm") {
    document.getElementById('filepreview').innerHTML = "<video onclick=\"if(this.paused){this.play();} else {this.pause();}\" id=\"previewedfile\" oncontextmenu=\"showContextMenu(event, this, " + picid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"filepreview\" loop autoplay><source src=\"" + pic.path + "\\" + pic.filename + "\" type=\"video/" + extension + "\"></video>";
  } else {
    document.getElementById('filepreview').innerHTML = "<img id=\"previewedfile\" oncontextmenu=\"showContextMenu(event, this, " + picid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pic.path + "\\" + pic.filename + "\" class=\"filepreview\" />";
  }
  var details = [];
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Filename</div><div class=\"fileDetailsDetails\">" + pic.filename.split('.').shift() + "</div></div>");
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Filetype</div><div class=\"fileDetailsDetails\">" + pic.filename.split('.').pop() + "</div></div>");
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Folder</div><div class=\"fileDetailsDetails\">" + pic.path + "</div>");
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Added On</div><div class=\"fileDetailsDetails\">" + moment(pic.timeAdded, "YYYY-MM-DD HH:mm:ss").format("DD/MM/YYYY") + "</div></div></div><br /><br />");
  var tags = db.prepare('SELECT tag FROM tags WHERE id = ?;').all(pictureidarray[picid]);
  var tagHtml = "";
  var i;
  document.getElementById('detailsShowInFolderButton').onclick = function() {
    showInFolder(picid);
  };
  document.getElementById('detailsCopyLocationButton').onclick = function() {
    copyLocation(picid);
  };
  for(i = 0; i < tags.length; i += 1) {
    tagHtml += "<div class=\"picTagListing\"><div onclick=\"addSearchTag(\'" + tags[i].tag + "\', false);\" oncontextmenu=\"addSearchTag(\'" + tags[i].tag + "\', true);\" class=\"picTagText\">" + tags[i].tag + "</div><img src=\"img/close.png\" class=\"tagDeleteButton\" onclick=\"removeTag(\'" + tags[i].tag + "\', \'" + pic.id + "\', this)\" /></div>";
  }
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Tags</div><div class=\"fileDetailsDetails\" id=\"fileDetailsDetails\">" + tagHtml + "</div></div>");
  var i;
  for(i = 0; i < details.length; i += 1) {
    document.getElementById('filedetails').innerHTML += details[i];
  }
  document.getElementById('fileDetailsDetails').innerHTML += "<div id=\"fileDetailsAddTags\" class=\"picTagListing picAddTagListing\" onclick=\"openAddTagsDialog(\'" + pic.id + "\')\"><div class=\"picTagText picTagTextAdd\">\+</div></div>";
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
function removeTag (tagname, picid, element) {
  db.prepare('DELETE FROM tags WHERE tag = ? AND id = ?;').run(tagname, picid);
  removeElement(element.parentNode);
}
function openAddTagsDialog(picid) {
  removeElementById("editTagsInput");
  document.getElementById('editTagsAddButton').insertAdjacentHTML("beforeBegin", "<input type=\"text\" id=\"editTagsInput\" oninput=\"autocompleteEditTags();\" onfocus=\"autocompleteEditTags();\" onkeypress=\"if(event.keyCode == 13) {if(this.value != '') {editTagsAddTagToList(this.value.toLowerCase());} else {editTagsConfirm(" + picid + ");}}\" />");
  tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
  editTagsAlreadyAssigned = db.prepare('SELECT tag FROM tags WHERE id = ?;').all(picid);
  var i;
  var z;
  for(i = 0; i < tagsForAutocomplete.length; i += 1) {
    for(z = 0; z < editTagsAlreadyAssigned.length; z += 1) {
      if(tagsForAutocomplete[i].tag == editTagsAlreadyAssigned[z].tag) {
        tagsForAutocomplete.splice(i, 1);
      }
    }
  }
  document.getElementById('editTagsConfirm').onclick = function() {
    editTagsConfirm(picid);
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
  document.getElementById('editTagsInput').focus();
}
function editTagsConfirm (picid) {
  var i;
  for(i = 0; i < editTagsArray.length; i += 1) {
    db.prepare('INSERT INTO tags (tag, id) VALUES (?, ?);').run(editTagsArray[i], picid);
    if(fileDetailsOpen) {
      document.getElementById('fileDetailsAddTags').insertAdjacentHTML("beforeBegin", "<div class=\"picTagListing\"><div onclick=\"addSearchTag(\'" + editTagsArray[i] + "\', false);\" oncontextmenu=\"addSearchTag(\'" + editTagsArray[i] + "\', true);\" class=\"picTagText\">" + editTagsArray[i] + "</div><img src=\"img/close.png\" class=\"tagDeleteButton\" onclick=\"removeTag(\'" + editTagsArray[i] + "\', \'" + picid + "\', this)\" /></div>");
    }
  }
  hideEditTagsDialogue();
}
function autocompleteEditTags () {
  var value = document.getElementById('editTagsInput').value;
  var i;
  var tagsToList = "";
  var z;
  var add;
  if(value != "") {
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      add = true;
      if(tagsForAutocomplete[i].tag.substring(0, value.length).toLowerCase() == value.toLowerCase()) {
        for(z = 0; z < editTagsArray.length; z += 1) {
          if(editTagsArray[z] == tagsForAutocomplete[i].tag) {
            add = false;
          }
        }
        if(add) {
          tagsToList += "<div class=\"autocompleteEntry\" onclick=\"editTagsAddTagToList(\'" + tagsForAutocomplete[i].tag + "\');\"><b>" + value.toLowerCase() + "</b>" + tagsForAutocomplete[i].tag.substr(value.length) + "</div>";
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
  orderBy = s;
  var newtext;
  if(s == "datetime(timeAdded)") {
    newtext = "Time Added";
  } else if(s == "rating") {
    newtext = "Rating";
  } else if(s == "filename") {
    newtext = "Filename";
  }
  document.getElementById('sortingDropdownText').innerHTML = "Sort By: " + newtext;
  loadPictures();
}
function sortOrderBy(s) {
  sortingOrder = s;
  var newtext;
  if(s == "ASC") {
    newtext = "Ascending";
  } else if(s == "DESC") {
    newtext = "Descending";
  }
  document.getElementById('orderDropdownText').innerHTML = newtext;
  loadPictures();
}
function searchAutocomplete(value) {
  var i;
  var tagsToList = "";
  var z;
  var add;
  var elm = document.getElementById('searchAutocomplete');
  if(value != "") {
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      add = true;
      if(tagsForAutocomplete[i].tag.substring(0, value.length).toLowerCase() == value.toLowerCase()) {
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
          tagsToList += "<div class=\"autocompleteEntry\" onclick=\"addSearchTag('" + tagsForAutocomplete[i].tag + "', false);\" oncontextmenu=\"addSearchTag('" + tagsForAutocomplete[i].tag + "', true);\"><b>" + value.toLowerCase() + "</b>" + tagsForAutocomplete[i].tag.substring(value.length) + "</div>";
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
  element = document.getElementById('searchTags');
  if(!exclude && add) {
    searchArrayInc.push(tag);
    classname = "includetag";
    removeExclude = "false";
  } else if (add) {
    searchArrayExc.push(tag);
    classname = "excludetag";
    removeExclude = "true";
  }
  if(add) {
    element.innerHTML += "<div id=\"searchTagName" + tag + "\" class=\"tag " + classname + "\"><div class=\"inlineblock\" onclick=\"switchIncludeExclude('" + tag + "', " + removeExclude + ", this);\">" + tag + "</div><img src=\"img/close.png\" class=\"searchRemoveTag inlineblock\" onclick=\"removeSearchTag('" + tag + "', " + removeExclude + ", this);\" /></div>";
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
  var i;
  if(!exclude) {
    for(i = 0; i < searchArrayInc.length; i += 1) {
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
function clearSearchTags() {
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
  loadPictures();
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
  element.innerHTML = "<div class=\"inlineblock\"  onclick=\"switchIncludeExclude('" + tag + "', " + removeExclude + ", this);\">" + tag + "</div><img src=\"img/close.png\" class=\"searchRemoveTag inlineblock\" onclick=\"removeSearchTag('" + tag + "', " + removeExclude + ", this);\" />";
  loadPictures();
}
function editTagsAddTagToList (tagname) {
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
    document.getElementById('editTagsListing').innerHTML += "<div class=\"editTagsListingTag\"><div class=\"editTagsListingTagText\">" + tagname + "</div><img src=\"img/close.png\" class=\"editTagsRemoveTag\" onclick=\"editTagsRemoveTag('" + tagname + "', this);\" /></div>";
    document.getElementById('editTagsInput').value = "";
  }
  hideEditTagsAutocomplete();
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
  if(canLoadMore) {
    var mainHeight = document.getElementById("mainpagecontent").clientHeight;
    var mainWidth = document.getElementById("mainpagecontent").clientWidth;
    var picAmount = (Math.floor(mainWidth/(pictureScale*pictureClientSize))*Math.floor(mainHeight/(pictureScale*pictureClientSize)));
    if(pictureid + picAmount > piccount) {
      picAmount = piccount - pictureid;
      canLoadMore = false;
    }
    var picState = pictureid + picAmount;
    for(i = pictureid; i < picState; i+=1) {
      picPath = pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      picFileName = pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      extension = pictures[i].filename.substr(pictures[i].filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "mp4" || extension == "webm") {
        document.getElementById("picloader").insertAdjacentHTML("beforeBegin", "<div class=\"piccontainer\"><video onclick=\"openDetails(" + pictureid + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" loop muted><source src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" type=\"video/" + extension + "\"></video></div>");
      } else {
        document.getElementById("picloader").insertAdjacentHTML("beforeBegin", "<div class=\"piccontainer\"><img onclick=\"openDetails(" + pictureid + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>");
      }
      picPaths.push(pictures[i].path + "\\" + pictures[i].filename);
      pictureidarray.push(pictures[i].id);
      pictureid += 1;
    }
  }
}
function loadPictures() {
  document.getElementById("mainpagecontent").scrollTop = 0;
  picPaths = [];
  pictureidarray = [];
  pictureid = 0;
  var i;
  document.getElementById('picturecontainer').innerHTML = "";
  tagsForAutocomplete = db.prepare('SELECT DISTINCT tag FROM tags;').all();
  var mainHeight = document.getElementById("mainpagecontent").clientHeight;
  var mainWidth = document.getElementById("mainpagecontent").clientWidth;
  var picAmount = 3*(Math.floor(mainWidth/(pictureScale*pictureClientSize))*Math.floor(mainHeight/(pictureScale*pictureClientSize)));
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
  if(searchArrayInc.length > 0) {
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
  } else {
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
  countPics();
  canLoadMore = true;
  if(piccount < picAmount) {
    picAmount = piccount;
    canLoadMore = false;
  }
  var picPath;
  var picFileName;
  for(i = 0; i < picAmount; i+=1) {
    picPath = pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
    picFileName = pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
    extension = pictures[i].filename.substr(pictures[i].filename.lastIndexOf('.') + 1).toLowerCase();
    if(extension == "webm" || extension == "mp4") {
      document.getElementById("picturecontainer").innerHTML += "<div class=\"piccontainer\"><video onclick=\"openDetails(" + pictureid + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" loop muted><source src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" type=\"video/" + extension + "\"></video></div>";
    } else {
      document.getElementById("picturecontainer").innerHTML += "<div class=\"piccontainer\"><img onclick=\"openDetails(" + pictureid + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>";
    }
    picPaths.push(pictures[i].path + "\\" + pictures[i].filename);
    pictureidarray.push(pictures[i].id);
    pictureid += 1;
  }
  document.getElementById("picturecontainer").innerHTML += "<div id=\"picloader\"></div>";
  var picAmountShown = Math.floor(mainWidth/(pictureScale*pictureClientSize))*Math.ceil(mainHeight/(pictureScale*pictureClientSize));
  var element;
  if(picAmount < picAmountShown) {
    picAmountShown = picAmount;
  }
  for(i = 0; i < picAmountShown; i += 1) {
    element = document.getElementById("picture" + i);
    if(element.tagName.toLowerCase() == "video") {
      element.play();
    }
  }
  lastX = picAmountShown;
  lastZ = 0;
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
  document.getElementById('setupcontent').innerHTML = "<div class=\"loader\" id=\"setuploader\"></div><br />Adding pictures into database..";
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
              db.prepare(insertquery).run(filename, picpath, filehash, 0, moment(fs.statSync(pictures[i]).mtime).format("YYYY-MM-DD HH:mm:ss"), 0, extension, 1);
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
          db.prepare(insertquery).run(filename, picpath, filehash, 0, moment(fs.statSync(pictures[i]).mtime).format("YYYY-MM-DD HH:mm:ss"), 0, extension, 1);
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
