const { autoUpdater } = require("electron-updater");
const { ipcMain, app } = require("electron");
const configManager = require("./ConfigManager");

class Updater {
	constructor(core) {
		this.core = core;
		autoUpdater.logger = this.core.logger;
		this.setup();
	}

	setup() {
		// 设置下载后不自动安装（让用户决定）
		autoUpdater.autoDownload = true;
		autoUpdater.autoInstallOnAppQuit = true;

		// 调试日志辅助函数
		const debugLog = {
			log: (...args) => {
				if (configManager.isDebugMode()) console.log(...args);
			},
			error: (...args) => {
				if (configManager.isDebugMode()) console.error(...args);
			},
		};

		// 监听事件并发送给前端
		autoUpdater.on("checking-for-update", () => {
			debugLog.log("正在检查更新...");
		});

		autoUpdater.on("update-available", (info) => {
			debugLog.log("发现新版本:", info.version);
			this.core.broadcast("update-message", {
				status: "available",
				msg: `发现新版本 v${info.version} (当前: v${app.getVersion()})`,
			});
		});

		autoUpdater.on("update-not-available", () => {
			debugLog.log("当前已是最新版本");
			this.core.broadcast("update-message", {
				status: "not-available",
				msg: "当前已是最新版本",
			});
		});

		autoUpdater.on("download-progress", (progressObj) => {
			this.core.sendToRenderer("update-progress", progressObj.percent);
		});

		autoUpdater.on("update-downloaded", (info) => {
			debugLog.log("更新已下载完成:", info);
			this.core.sendToRenderer("update-message", {
				status: "downloaded",
				msg: "更新已下载完成，重启应用即可应用更新。",
			});
		});

		autoUpdater.on("error", (err) => {
			debugLog.error("更新错误:", err);
			this.core.broadcast("update-message", {
				status: "error",
				msg: "检查更新失败，请稍后再试",
			});
		});

		// 接收前端的"检查更新"请求
		ipcMain.on("check-for-updates", () => {
			autoUpdater.checkForUpdatesAndNotify();
		});

		// 接收前端的"立即重启安装"请求
		ipcMain.on("quit-and-install", () => {
			autoUpdater.quitAndInstall();
		});
	}
}

module.exports = Updater;
