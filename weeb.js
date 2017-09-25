const sql = require('better-sqlite3');
const fs = require('fs');
const {remote, ipcRenderer, shell, clipboard} = require('electron');
const dialog = remote.require('electron').dialog;
const xxh = require('xxhash');
const path = require('path');
const outclick = require('outclick');
const moment = require('moment');
var contextmenuelement;
var piccount;
var loadnew = true;
var pictureid = 0;
var firstRun = true;
var canLoadMore = true;
var dirList;
var xxhashsalt = 4152;
var sqlalreadysetup = false;
var canBeOnScreen;
var lastZ = 0;
var lastX;
var menuFunc;
var picPaths = [];
var pictureScale = 1;
var tagsForAutocomplete;
var editTagsArray = [];
var editTagsAlreadyAssigned = [];
var appDataFolder = process.env.APPDATA + "\\WeebReact";
if(!fs.existsSync(appDataFolder)) {
  fs.mkdirSync(appDataFolder);
}
var db = new sql(appDataFolder + "\\data.sqlite");
if(fs.existsSync(appDataFolder + "\\data.sqlite")) {
  firstRun = false;
}
if(!firstRun) {
  var firstR = db.prepare("SELECT count(*) FROM directories").get()["count(*)"];
  if(firstR == 0) {
    firstRun = true;
    sqlalreadysetup = true;
  }
}
function countPics(tags) {
  if(tags == undefined) {
    piccount = db.prepare("SELECT count(*) FROM pictures").get()["count(*)"];
  }
  document.getElementById("picturescrollcontainer").style.height = Math.ceil(piccount/Math.floor(document.getElementById("mainpagecontent").clientWidth/(pictureScale*210)))*(pictureScale*210) + "px";
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
      db.prepare('CREATE TABLE pictures (id integer primary key autoincrement, filename text, path text, hash text unique, excluded integer, timeAdded integer, unique(path, filename));').run();
      db.prepare('CREATE TABLE tags (tag text, id int, unique(tag, id));').run();
      db.prepare('CREATE TABLE directories (directory text, includeSubdirectories integer, watch integer);').run();
    }
  } else {
    removeElementById("setup");
    loadPictures();
  }
    document.getElementById("mainpagecontent").addEventListener("scroll", function() {
      scrollFunctions();
    });
    window.addEventListener("resize", function() {
      scrollFunctions();
    });
    document.getElementById("mainpageoverlay").style.display = "none";
}
function scrollFunctions() {
  var obj = document.getElementById("mainpagecontent");
  var picsPerLine = Math.floor(obj.clientWidth/(pictureScale*210));
  scrollingTopside(obj, picsPerLine);
  scrollingBottomside(obj, picsPerLine);
  checkIfAtBottom(obj);
  if(document.getElementById('contextmenu').style.display == "block") {
    hideContextMenu(contextmenuelement);
  }
  countPics();
}
function scrollingBottomside(obj, picsPerLine) {
  var i;
  var element;
  var x = Math.ceil((obj.scrollTop + obj.clientHeight)/(pictureScale*210))*(Math.floor(obj.clientWidth/(pictureScale*210)));
  if(x > lastX && x < pictureid) {
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
  } else if (x > lastX && x > pictureid && pictureid == piccount) {
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
  var z = Math.floor((obj.scrollTop)/(pictureScale*210))*(Math.floor(obj.clientWidth/(pictureScale*210)));
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
  contextmenu.innerHTML = "<div class=\"contextmenuentrytop contextmenuentry\"><div class=\"contextmenutext\" onclick=\"showInFolder(" + picid + ");\">Show in Folder</div></div><div class=\"contextmenuentry contextmenuentrycenter\" onclick=\"copyLocation(" + picid + ");\"><div class=\"contextmenutext\">Copy Location</div></div><div class=\"contextmenuentrybottom contextmenuentry\"><div class=\"contextmenutext\">Exclude</div></div>";
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
  menuFunc = el.addEventListener('outclick', function(e) {
    hideContextMenu(el);
  });
}
function hideContextMenu(el) {
  document.getElementById('contextmenu').style.display = "none";
  el.removeEventListener('outclick', menuFunc);
}
function checkIfAtBottom(scrollcontainer) {
  obj = scrollcontainer;
  obj2 = document.getElementById("picturecontainer");
  if(obj2.scrollHeight - obj.clientHeight - obj.scrollTop < (pictureScale*210)) {
    if(loadnew && canLoadMore) {
      loadnew = false;
      loadMorePictures();
      loadnew = true;
      checkIfAtBottom(obj);
    }
  }
}
function closeFileDetails() {
  var previewedFile = document.getElementById('previewedfile');
  if(previewedFile.tagName.toLowerCase() == "video") {
    previewedFile.pause();
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
function openDetails(picid) {
  var pic = db.prepare('SELECT * FROM pictures WHERE id = ?;').get(picid+1);
  var extension = pic.filename.substr(pic.filename.lastIndexOf('.') + 1).toLowerCase();
  var picPath = pic.path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
  var picFileName = pic.filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
  if(extension == "mp4" || extension == "webm") {
    document.getElementById('filepreview').innerHTML = "<video id=\"previewedfile\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"filepreview\" loop autoplay><source src=\"" + pic.path + "\\" + pic.filename + "\" type=\"video/" + extension + "\"></video>";
  } else {
    document.getElementById('filepreview').innerHTML = "<img id=\"previewedfile\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pic.path + "\\" + pic.filename + "\" class=\"filepreview\" />";
  }
  var details = [];
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Filename</div><div class=\"fileDetailsDetails\">" + pic.filename.split('.').shift() + "</div></div>");
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Filetype</div><div class=\"fileDetailsDetails\">" + pic.filename.split('.').pop() + "</div></div>");
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Folder</div><div class=\"fileDetailsDetails\">" + pic.path + "</div>");
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Added On</div><div class=\"fileDetailsDetails\">" + moment.unix(pic.timeAdded).format("DD/MM/YYYY") + "</div></div></div><br /><br />");
  var tags = db.prepare('SELECT tag FROM tags WHERE id = ?;').all(picid+1);
  var tagHtml = "";
  var i;
  document.getElementById('detailsShowInFolderButton').onclick = function() {
    showInFolder(picid);
  };
  document.getElementById('detailsCopyLocationButton').onclick = function() {
    copyLocation(picid);
  };
  for(i = 0; i < tags.length; i += 1) {
    tagHtml += "<div class=\"picTagListing\"><div onclick=\"addSearchTag(\'" + tags[i].tag + "\');\" class=\"picTagText\">" + tags[i].tag + "</div><img src=\"img/close.png\" class=\"tagDeleteButton\" /></div>";
  }
  details.push("<div class=\"fileDetailsCategory\"><div class=\"fileDetailsName\">Tags</div><div class=\"fileDetailsDetails\" id=\"fileDetailsDetails\">" + tagHtml + "</div></div>");
  var i;
  for(i = 0; i < details.length; i += 1) {
    document.getElementById('filedetails').innerHTML += details[i];
  }
  document.getElementById('fileDetailsDetails').innerHTML += "<div class=\"picTagListing picAddTagListing\" onclick=\"openAddTagsDialog(\'" + pic.id + "\')\"><div class=\"picTagText picTagTextAdd\">\+</div></div>";
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
function openAddTagsDialog(picid) {
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
  document.getElementById('editTagsDialogueOverlay').style.display = "block";
  document.getElementById('editTagsDialogueArea').style.display = "block";
  var anim = setInterval(animateOpenTagsDialogue, 5);
  var opa = 0;
  var opa2 = 0;
  function animateOpenTagsDialogue() {
    if(opa >= 1) {
      clearInterval(anim);
    } else {
      opa += 0.05;
      opa2 += 0.025;
      document.getElementById('editTagsDialogueArea').style.opacity = opa;
      document.getElementById('editTagsDialogueOverlay').style.opacity = opa2;
    }
  }
}
function autocompleteEditTags () {
  var value = document.getElementById('editTagsInput').value;
  var i;
  var tagsToList = "";
  var x = 0;
  var z;
  var add;
  if(value != "") {
    for(i = 0; i < tagsForAutocomplete.length; i += 1) {
      add = true;
      if(tagsForAutocomplete[i].tag.substring(0, value.length) == value) {
        for(z = 0; z < editTagsArray.length; z += 1) {
          if(editTagsArray[z] == tagsForAutocomplete[i].tag) {
            add = false;
          }
        }
        if(add) {
          tagsToList += "<div id=\"editTagsAutocompleteEntry\" onclick=\"editTagsAddTagToList(\'" + tagsForAutocomplete[i].tag + "\');\"><b>" + value + "</b>" + tagsForAutocomplete[i].tag.substr(value.length) + "</div>";
          x += 1;
        }
      }
      if(x == 8) {
        break;
      }
    }
  }
  document.getElementById('editTagsAutocomplete').innerHTML = tagsToList;
}
function hideEditTagsAutocomplete() {
  var childarray = Array.from(document.getElementById('editTagsAutocomplete').childNodes);
  var i;
  for(i = 0; i < childarray.length; i += 1) {
    childarray[i].style.backgroundColor = "";
    childarray[i].style.display = "none";
  }
}
function editTagsAddTagToList (tagname) {
  var i;
  var add = true;
  var z;
  for(i = 0; i < editTagsArray.length; i += 1) {
    if(tagname == editTagsArray[i]) {
      add = false;
    }
  }
  for(z = 0; z < editTagsAlreadyAssigned.length; z += 1) {
    if(tagname == editTagsAlreadyAssigned[z].tag) {
      add = false;
    }
  }
  if(add) {
    editTagsArray.push(tagname);
    document.getElementById('editTagsListing').innerHTML += "<div class=\"editTagsListingTag\"><div class=\"editTagsListingTagText\">" + tagname + "</div><img src=\"img/close.png\" class=\"editTagsRemoveTag\" onclick=\"editTagsRemoveTag('" + tagname + "', this);\" /></div>";
    document.getElementById('editTagsInput').value = "";
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
  var opa2 = 0.5;
  function animateCloseTagsDialogue() {
    if(opa <= 0) {
      document.getElementById('editTagsDialogueOverlay').style.display = "none";
      document.getElementById('editTagsDialogueArea').style.display = "none";
      clearInterval(anim);
    } else {
      opa -= 0.05;
      opa2 -= 0.025;
      document.getElementById('editTagsDialogueOverlay').style.opacity = opa2;
      document.getElementById('editTagsDialogueArea').style.opacity = opa;
    }
  }
  document.getElementById('editTagsInput').value = "";
  editTagsArray = [];
  document.getElementById('editTagsListing').innerHTML = "";
}
function loadMorePictures() {
  if(canLoadMore) {
    var mainHeight = document.getElementById("mainpagecontent").clientHeight;
    var mainWidth = document.getElementById("mainpagecontent").clientWidth;
    var picAmount = (Math.floor(mainWidth/(pictureScale*210))*Math.floor(mainHeight/(pictureScale*210)));
    if(pictureid + picAmount > piccount) {
      picAmount = piccount - pictureid;
      canLoadMore = false;
    }
    var extension;
    var picPath;
    var picFileName;
    var pictures = db.prepare('SELECT * FROM pictures ORDER BY id ASC LIMIT ? OFFSET ?').all(picAmount, pictureid);
    var i;
    for(i = 0; i < picAmount; i+=1) {
      picPath = pictures[i].path.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      picFileName = pictures[i].filename.replace(/([^\\])\\([^\\])/g,"$1\\\\$2");
      extension = pictures[i].filename.substr(pictures[i].filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "mp4" || extension == "webm") {
        document.getElementById("picloader").insertAdjacentHTML("beforeBegin", "<div class=\"piccontainer\"><video onclick=\"openDetails(" + pictureid + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" loop muted><source src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" type=\"video/" + extension + "\"></video></div>");
      } else {
        document.getElementById("picloader").insertAdjacentHTML("beforeBegin", "<div class=\"piccontainer\"><img onclick=\"openDetails(" + pictureid + ");\" oncontextmenu=\"showContextMenu(event, this, " + pictureid + ");\" draggable=\"true\" ondragstart=\"drag(event, \'" + picPath + "\\\\" + picFileName + "\');\" src=\"" + pictures[i].path + "\\" + pictures[i].filename + "\" class=\"mainpagepicture\" id=\"picture" + pictureid + "\" /></div>");
      }
      picPaths.push(pictures[i].path + "\\" + pictures[i].filename);
      pictureid++;
    }
    if(!canLoadMore) {
      removeElementById('picloader');
    }
  }
}
function loadPictures() {
  var mainHeight = document.getElementById("mainpagecontent").clientHeight;
  var mainWidth = document.getElementById("mainpagecontent").clientWidth;
  var picAmount = 3*(Math.floor(mainWidth/(pictureScale*210))*Math.floor(mainHeight/(pictureScale*210)));
  var extension;
  countPics();
  if(piccount < picAmount) {
    picAmount = piccount;
    canLoadMore = false;
  }
  var pictures = db.prepare('SELECT * FROM pictures ORDER BY id ASC LIMIT ?').all(picAmount);
  var i;
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
    pictureid++;
  }
  if(canLoadMore) {
    document.getElementById("picturecontainer").innerHTML += "<div id=\"picloader\"><div class=\"loader\"></div></div>";
  }
  var picAmountShown = Math.floor(mainWidth/(pictureScale*210))*Math.ceil(mainHeight/(pictureScale*210));
  var element;
  for(i = 0; i < picAmountShown; i += 1) {
    element = document.getElementById("picture" + i);
    if(element.tagName.toLowerCase() == "video") {
      element.play();
    }
  }
  lastX = picAmountShown;
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
              db.prepare('INSERT INTO pictures (filename, path, hash, excluded, timeAdded) VALUES (?,?,?,?,?);').run(filename, picpath, filehash, 0, moment().unix() + (moment().utcOffset()*60));
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
    pictures = getFiles(directory);
    for (i = 0; i < pictures.length; i += 1) {
      picpath = pictures[i].substring(0, pictures[i].lastIndexOf("\\"));
      filename = pictures[i].split('\\').pop();
      extension = filename.substr(filename.lastIndexOf('.') + 1).toLowerCase();
      if(extension == "png" || extension == "jpg" || extension == "jpeg" || extension == "gif" || extension == "webm" || extension == "mp4") {
        filehash = xxh.hash64(fs.readFileSync(pictures[i]), xxhashsalt, 'hex');
        checkduplicate = db.prepare('SELECT count(*) FROM pictures WHERE hash = ?;').get(filehash)["count(*)"];
        if(checkduplicate == 0) {
          db.prepare('INSERT INTO pictures (filename, path, hash, excluded, timeAdded) VALUES (?,?,?,?,?);').run(filename, picpath, filehash, 0, moment().unix() + (moment().utcOffset()*60));
          x++;
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
      removeElementById('setup');
      document.getElementById('overlay').style.display = 'none';
      document.getElementById('mainpage').style.display = "block";
      document.getElementById('greyboxl').style.backgroundColor = "#1f1f1f";
      document.getElementById('greyboxr').style.backgroundColor = "#1f1f1f";
      loadPictures();
    });
    countPics();
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
