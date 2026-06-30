const { ipcRenderer } = require("electron");
const { renderBookmarks } = require("./renderers");

function openBookmark(bookmark) {
	ipcRenderer.send("open-bookmark", bookmark);
	window.close();
}

function deleteBookmark(index) {
	ipcRenderer.send("delete-bookmark", index);
}

function requestBookmarks() {
	ipcRenderer.send("get-bookmarks");
}

function bindBookmarkListeners() {
	ipcRenderer.on("bookmarks-data", (_event, bookmarks) => {
		renderBookmarks(bookmarks, {
			openBookmark,
			deleteBookmark,
		});
	});
}

function init() {
	bindBookmarkListeners();
	requestBookmarks();
}

init();
