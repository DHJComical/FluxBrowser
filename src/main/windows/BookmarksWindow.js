const { BrowserWindow } = require("electron");
const {
	getCenteredPosition,
	getRendererPath,
	getWindowIconPath,
} = require("./windowUtils");

function createBookmarksWindow({ parentWindow, onClosed }) {
	const windowWidth = 600;
	const windowHeight = 400;
	const { x, y } = getCenteredPosition(windowWidth, windowHeight);

	const bookmarksWindow = new BrowserWindow({
		x,
		y,
		width: windowWidth,
		height: windowHeight,
		parent: parentWindow,
		title: "书签管理",
		icon: getWindowIconPath(),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	bookmarksWindow.setMenu(null);
	bookmarksWindow.loadFile(getRendererPath("bookmarks.html"));

	if (typeof onClosed === "function") {
		bookmarksWindow.on("closed", onClosed);
	}

	return bookmarksWindow;
}

module.exports = createBookmarksWindow;
