const { BrowserWindow } = require("electron");
const { getRendererPath, getWindowIconPath } = require("./windowUtils");

function createTabBarWindow({ bounds, alwaysOnTop, onClose }) {
	const tabBarWindow = new BrowserWindow({
		x: bounds.x,
		y: bounds.y,
		width: bounds.width,
		height: bounds.height,
		minWidth: 260,
		minHeight: bounds.height,
		maximizable: false,
		resizable: false,
		frame: false,
		transparent: true,
		alwaysOnTop,
		hasShadow: false,
		show: false,
		focusable: true,
		skipTaskbar: true,
		icon: getWindowIconPath(),
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
			javascript: true,
		},
	});

	tabBarWindow.setMenu(null);
	tabBarWindow.loadFile(getRendererPath("tabbar.html"));

	if (typeof onClose === "function") {
		tabBarWindow.on("close", onClose);
	}

	return tabBarWindow;
}

module.exports = createTabBarWindow;
