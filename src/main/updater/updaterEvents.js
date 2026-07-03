const { app, ipcMain } = require("electron");
const { t } = require("../i18n");

function registerUpdaterEvents(autoUpdater, core, debugLog) {
	autoUpdater.on("checking-for-update", () => {
		debugLog.log("logs.updater.checking");
	});

	autoUpdater.on("update-available", (info) => {
		debugLog.log("logs.updater.available", info.version);
		core.broadcast("update-message", {
			status: "available",
			msg: t("messages.updater.available", {
				version: info.version,
				currentVersion: app.getVersion(),
			}),
		});
	});

	autoUpdater.on("update-not-available", () => {
		debugLog.log("logs.updater.notAvailable");
		core.broadcast("update-message", {
			status: "not-available",
			msg: t("messages.updater.notAvailable"),
		});
	});

	autoUpdater.on("download-progress", (progressObj) => {
		core.broadcast("update-progress", {
			percent: progressObj.percent,
			transferred: progressObj.transferred,
			total: progressObj.total,
			bytesPerSecond: progressObj.bytesPerSecond,
		});
	});

	autoUpdater.on("update-downloaded", (info) => {
		debugLog.log("logs.updater.downloaded", info);
		core.broadcast("update-message", {
			status: "downloaded",
			msg: t("messages.updater.downloaded"),
		});
	});

	autoUpdater.on("error", (error) => {
		debugLog.error("logs.updater.error", error);
		core.broadcast("update-message", {
			status: "error",
			msg: t("messages.updater.error"),
		});
	});
}

function registerUpdaterIpc(autoUpdater) {
	ipcMain.on("check-for-updates", () => {
		autoUpdater.checkForUpdates();
	});

	ipcMain.on("download-update", () => {
		autoUpdater.downloadUpdate();
	});

	ipcMain.on("quit-and-install", () => {
		autoUpdater.quitAndInstall();
	});
}

module.exports = {
	registerUpdaterEvents,
	registerUpdaterIpc,
};
