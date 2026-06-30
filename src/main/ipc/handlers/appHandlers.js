const { app } = require("electron");
const configManager = require("../../ConfigManager");

function registerAppHandlers({
	ipcMain,
	logger,
	windowManager,
	broadcast,
}) {
	ipcMain.on("clear-cache", (_event, options) => {
		logger.debug("开始清理缓存...");
		logger.debug(`清理选项: ${JSON.stringify(options)}`);

		if (options.clearLogs && logger.clearLogFiles) {
			logger.debug("正在清理日志文件...");
			logger.clearLogFiles();
		}

		if (options.clearKeyConfig) {
			logger.debug("正在重置快捷键配置...");
			configManager.saveKeyConfig(configManager.DEFAULT_KEY_CONFIG);
		}

		if (options.clearWindowConfig) {
			logger.debug("正在重置窗口配置...");
			configManager.saveBoundsConfig(configManager.DEFAULT_BOUNDS_CONFIG);
		}

		if (options.clearAppConfig) {
			logger.debug("正在重置应用配置...");
			configManager.saveAppConfig(configManager.DEFAULT_APP_CONFIG);
			windowManager.setUserAlwaysOnTop(
				configManager.DEFAULT_APP_CONFIG.alwaysOnTop,
			);
		}

		if (options.clearResolutionPresets) {
			logger.debug("正在重置分辨率预设为默认值...");
			configManager.saveResolutionPresets(
				configManager.DEFAULT_RESOLUTION_PRESETS,
			);
		}

		logger.debug("缓存清理完成");

		broadcast("cache-cleared", {
			success: true,
			message: "缓存清理完成",
		});
	});

	ipcMain.on("restart-after-save", () => {
		logger.debug("收到重启请求，准备重启应用...");
		app.relaunch();
		app.exit(0);
	});
}

module.exports = registerAppHandlers;
