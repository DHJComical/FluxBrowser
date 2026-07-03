const { BrowserWindow } = require("electron");
const { t } = require("../i18n");
const {
	getCenteredPosition,
	getRendererPath,
	getWindowIconPath,
} = require("./windowUtils");

function createSettingsWindow({ parentWindow, onClosed }) {
	const windowWidth = 860;
	const windowHeight = 620;
	const { x, y } = getCenteredPosition(windowWidth, windowHeight);

	const settingsWindow = new BrowserWindow({
		x,
		y,
		width: windowWidth,
		height: windowHeight,
		minWidth: 820,
		minHeight: 560,
		parent: parentWindow,
		title: t("windows.settings.title"),
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
