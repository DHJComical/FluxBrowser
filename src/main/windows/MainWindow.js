const { BrowserWindow, screen } = require("electron");
const {
	getRendererPath,
	getWindowIconPath,
} = require("./windowUtils");

function createMainWindow({
	userAlwaysOnTop,
	onClose,
	onRequestNewTab,
}) {
	const { workArea } = screen.getPrimaryDisplay();
	const windowWidth = workArea.width;
	const windowHeight = workArea.height;

	const mainWindow = new BrowserWindow({
		x: workArea.x,
		y: workArea.y,
		width: windowWidth,
		height: windowHeight,
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
