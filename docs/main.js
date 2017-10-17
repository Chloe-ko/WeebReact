function init() {
  document.getElementById('ghlink').onclick = () => {
    window.open("https:\/\/github.com\/Shironomia\/WeebReact", "_blank");
  };
  document.getElementById('electronlink').onclick = () => {
    window.open("https:\/\/electron.atom.io\/", "_blank");
  };
  document.getElementById('fjlink').onclick = () => {
    window.open("http:\/\/funnyjunk.com\/user\/shironomia", "_blank");
  };
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if(this.readyState == 4 && this.status == 200) {
      var res = JSON.parse(this.responseText);
      var tagName = res.tag_name;
      res.assets.forEach(function (ass) {
        if(ass.name.substr(ass.name.lastIndexOf('.') + 1).toLowerCase() == "exe") {
          document.getElementById('downloadbutton').onclick = () => {
            window.location.href = "http:\/\/github.com\/Shironomia\/WeebReact\/releases\/download\/" + tagName + "\/" + ass.name;
          };
        }
      });
    }
  };
  xhttp.open("GET", "https://api.github.com/repos/Shironomia/WeebReact/releases/latest", true);
  xhttp.send();
}
document.onreadystatechange = function () {
  if (document.readyState == "complete") {
    init();
  }
};
