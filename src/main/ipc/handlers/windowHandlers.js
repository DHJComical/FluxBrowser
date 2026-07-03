const { app } = require("electron");

function registerWindowHandlers({ ipcMain, windowManager, logger }) {
	ipcMain.on("open-settings", () => {
		const mainWindow = windowManager.getMainWindow();
		if (mainWindow) {
			windowManager.createSettingsWindow(mainWindow);
		}
	});

	ipcMain.on("set-ignore-mouse", (_event, ignore) => {
		windowManager.setIgnoreMouseEvents(ignore);
	});

	ipcMain.on("set-window-size", (_event, { width, height }) => {
		windowManager.setWindowSize(width, height);
		logger.debug(`WebView 区域尺寸已设置: ${width} x ${height}`);
	});

	ipcMain.on("app-exit", () => {
		windowManager.saveWindowBounds();
		app.quit();
	});

	ipcMain.on("settings-window-closing", () => {
		windowManager.focusMainWindowAfterSettingsClose();
	});
}

module.exports = registerWindowHandlers;
