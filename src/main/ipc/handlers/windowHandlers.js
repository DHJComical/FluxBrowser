const { app } = require("electron");
const { t } = require("../../i18n");

function registerWindowHandlers({ ipcMain, windowManager, logger }) {
	ipcMain.on("open-settings", () => {
		const mainWindow = windowManager.getMainWindow();
		if (mainWindow) {
			windowManager.createSettingsWindow(mainWindow);
		}
	});

	ipcMain.on("set-ignore-mouse", (_event, payload) => {
		if (payload && typeof payload === "object") {
			windowManager.setIgnoreMouseEvents(payload.ignore, {
				forward: payload.forward,
			});
			return;
		}

		windowManager.setIgnoreMouseEvents(payload);
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
