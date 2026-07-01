const { BrowserWindow } = require("electron");
const {
	getRendererPath,
	getWindowIconPath,
} = require("./windowUtils");

function createMainWindow({
	savedBounds,
	userAlwaysOnTop,
	onClose,
	onRequestNewTab,
}) {
	const { x, y, width, height } = savedBounds;

	const mainWindow = new BrowserWindow({
		x,
		y,
		width: width || 800,
		height: height || 600,
		minWidth: 40,
		minHeight: 80,
		frame: false,
		transparent: true,
		alwaysOnTop: userAlwaysOnTop,
		hasShadow: false,
		icon: getWindowIconPath(),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			webviewTag: true,
			javascript: true,
		},
	});

	mainWindow.setMenu(null);
	mainWindow.loadFile(getRendererPath("index.html"));

	if (typeof onClose === "function") {
		mainWindow.on("close", onClose);
	}

	mainWindow.webContents.on("did-attach-webview", (_event, webContents) => {
		webContents.setWindowOpenHandler(({ url }) => {
			if (typeof onRequestNewTab === "function") {
				onRequestNewTab(url);
			} else {
				webContents.loadURL(url);
			}
			return { action: "deny" };
		});
	});

	return mainWindow;
}

module.exports = createMainWindow;
