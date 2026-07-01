const { app, ipcMain } = require("electron");

function registerUpdaterEvents(autoUpdater, core, debugLog) {
	autoUpdater.on("checking-for-update", () => {
		debugLog.log("正在检查更新...");
	});

	autoUpdater.on("update-available", (info) => {
		debugLog.log("发现新版本:", info.version);
		core.broadcast("update-message", {
			status: "available",
			msg: `发现新版本 v${info.version} (当前: v${app.getVersion()})`,
		});
	});

	autoUpdater.on("update-not-available", () => {
		debugLog.log("当前已是最新版本");
		core.broadcast("update-message", {
			status: "not-available",
			msg: "当前已是最新版本",
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
		debugLog.log("更新已下载完成", info);
		core.broadcast("update-message", {
			status: "downloaded",
			msg: "更新已下载完成，重启应用即可应用更新。",
		});
	});

	autoUpdater.on("error", (error) => {
		debugLog.error("更新错误:", error);
		core.broadcast("update-message", {
			status: "error",
			msg: "检查更新失败，请稍后再试",
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
