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
		logger.debug(`窗口分辨率已设置为: ${width} x ${height} (webview区域)`);
	});

	ipcMain.on("webview-size-measured", (_event, measurement) => {
		const calibrated = windowManager.calibrateWebviewSize(measurement);
		if (calibrated) {
			logger.debug(
				`Webview区域已校准为: ${measurement.targetWidth} x ${measurement.targetHeight}`,
			);
		}
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
