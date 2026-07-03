const { app } = require("electron");
const { t } = require("../../i18n");

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
		logger.debug(
			t("logs.window.webviewSizeSet", {
				width,
				height,
			}),
		);
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
