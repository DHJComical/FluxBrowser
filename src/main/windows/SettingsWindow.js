const { BrowserWindow } = require("electron");
const {
	getCenteredPosition,
	getRendererPath,
	getWindowIconPath,
} = require("./windowUtils");

function createSettingsWindow({ parentWindow, onClosed }) {
	const windowWidth = 800;
	const windowHeight = 600;
	const { x, y } = getCenteredPosition(windowWidth, windowHeight);

	const settingsWindow = new BrowserWindow({
		x,
		y,
		width: windowWidth,
		height: windowHeight,
		minWidth: 700,
		minHeight: 500,
		parent: parentWindow,
		title: "FluxBrowser 设置",
		icon: getWindowIconPath(),
		backgroundColor: "#1e1e1e",
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});

	settingsWindow.setMenu(null);
	settingsWindow.loadFile(getRendererPath("settings.html"));

	if (typeof onClosed === "function") {
		settingsWindow.on("closed", onClosed);
	}

	return settingsWindow;
}

module.exports = createSettingsWindow;
