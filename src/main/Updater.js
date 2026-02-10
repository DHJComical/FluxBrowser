const { autoUpdater } = require("electron-updater");
const { ipcMain } = require("electron");

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

		// 监听事件并发送给前端
		autoUpdater.on("checking-for-update", () => {
			console.log("正在检查更新...");
		});

		autoUpdater.on("update-available", (info) => {
			this.core.broadcast("update-message", {
				status: "available",
				msg: `发现新版本 v${info.version} (当前: v${app.getVersion()})`,
			});
		});

		autoUpdater.on("update-not-available", () => {
			console.log("当前已是最新版本");
		});

		autoUpdater.on("download-progress", (progressObj) => {
			this.core.sendToRenderer("update-progress", progressObj.percent);
		});

		autoUpdater.on("update-downloaded", (info) => {
			this.core.sendToRenderer("update-message", {
				status: "downloaded",
				msg: "更新已下载完成，重启应用即可应用更新。",
			});
		});

		autoUpdater.on("error", (err) => {
			console.error("更新错误:", err);
		});

		// 接收前端的“检查更新”请求
		ipcMain.on("check-for-updates", () => {
			autoUpdater.checkForUpdatesAndNotify();
		});

		// 接收前端的“立即重启安装”请求
		ipcMain.on("quit-and-install", () => {
			autoUpdater.quitAndInstall();
		});
	}
}

module.exports = Updater;
