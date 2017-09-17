(function () {
	const remote = require('electron').remote;
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
			window.close();
		});
	};
	document.onreadystatechange = function () {
		if (document.readyState == "complete") {
			init(); 
	};
})();