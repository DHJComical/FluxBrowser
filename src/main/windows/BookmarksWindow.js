const { BrowserWindow } = require("electron");
const { t } = require("../i18n");
const {
	getCenteredPosition,
	getRendererPath,
	getWindowIconPath,
} = require("./windowUtils");

function createBookmarksWindow({ parentWindow, onClosed }) {
	const windowWidth = 820;
	const windowHeight = 620;
	const { x, y } = getCenteredPosition(windowWidth, windowHeight);

	const bookmarksWindow = new BrowserWindow({
		x,
		y,
		width: windowWidth,
		height: windowHeight,
		minWidth: 620,
		minHeight: 520,
		parent: parentWindow,
		title: t("windows.bookmarks.title"),
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
