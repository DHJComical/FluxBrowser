const { app } = require("electron");
const configManager = require("../../ConfigManager");
const { setLocale, t } = require("../../i18n");
const { IPC_CHANNELS } = require("../../../constants/config");

function registerAppHandlers({
	ipcMain,
	logger,
	windowManager,
	broadcast,
}) {
	ipcMain.on("clear-cache", (_event, options) => {
		logger.debug("logs.app.cache.start");
		logger.debug(
			t("logs.app.cache.options", {
				options: JSON.stringify(options),
			}),
		);

		if (options.clearLogs && logger.clearLogFiles) {
			logger.debug("logs.app.cache.clearLogs");
			logger.clearLogFiles();
		}

		if (options.clearKeyConfig) {
			logger.debug("logs.app.cache.resetShortcuts");
			configManager.saveKeyConfig(configManager.DEFAULT_KEY_CONFIG);
		}

		if (options.clearWindowConfig) {
			logger.debug("logs.app.cache.resetWindow");
			configManager.saveBoundsConfig(configManager.DEFAULT_BOUNDS_CONFIG);
			configManager.saveAppConfig({
				floatingPanels: {
					...configManager.DEFAULT_APP_CONFIG.floatingPanels,
				},
			});
			broadcast(IPC_CHANNELS.APP_CONFIG_UPDATED, configManager.getAppConfig());
		}

		if (options.clearAppConfig) {
			logger.debug("logs.app.cache.resetApp");
			configManager.saveAppConfig(configManager.DEFAULT_APP_CONFIG);
			setLocale(configManager.DEFAULT_APP_CONFIG.language);
			windowManager.setUserAlwaysOnTop(
				configManager.DEFAULT_APP_CONFIG.alwaysOnTop,
			);
			if (typeof windowManager.updateWindowTitles === "function") {
				windowManager.updateWindowTitles();
			}
		}

		if (options.clearResolutionPresets) {
			logger.debug("logs.app.cache.resetResolution");
			configManager.saveResolutionPresets(
				configManager.DEFAULT_RESOLUTION_PRESETS,
			);
		}

		logger.debug("logs.app.cache.done");

		broadcast("cache-cleared", {
			success: true,
			message: t("settings.cache.doneMessage"),
		});
		broadcast(IPC_CHANNELS.LANGUAGE_CHANGED, {
			locale: configManager.getAppConfig().language,
		});
	});

	ipcMain.on("restart-after-save", () => {
		logger.debug("logs.app.restart.requested");
		app.relaunch();
		app.exit(0);
	});
}

module.exports = registerAppHandlers;
