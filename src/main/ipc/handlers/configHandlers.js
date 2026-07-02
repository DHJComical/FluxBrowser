const configManager = require("../../ConfigManager");
const { app } = require("electron");

function registerConfigHandlers({
	ipcMain,
	logger,
	windowManager,
	pluginLoader,
	broadcast,
	getCurrentOpacity,
}) {
	ipcMain.handle("get-shortcuts", () => configManager.getKeyConfig());

	ipcMain.on("save-shortcuts", (_event, map) => {
		configManager.saveKeyConfig(map);
		if (pluginLoader) {
			pluginLoader.reloadShortcuts();
		}
	});

	ipcMain.handle("get-resolution-presets", () => {
		const presets = configManager.getResolutionPresets();
		logger.debug(`IPC: 返回分辨率预设，数量: ${presets.length}`);
		return presets;
	});

	ipcMain.on("save-resolution-presets", (_event, presets) => {
		logger.debug(`IPC: 收到保存分辨率预设请求，数量: ${presets.length}`);
		configManager.saveResolutionPresets(presets);
		broadcast("resolution-presets-updated");
	});

	ipcMain.handle("get-opacity", () => getCurrentOpacity());

	ipcMain.handle("get-app-version", () => app.getVersion());

	ipcMain.handle("get-debug-mode", () => configManager.isDebugMode());

	ipcMain.on("set-debug-mode", (_event, enabled) => {
		configManager.saveAppConfig({ debugMode: enabled });
		if (logger && logger.setDebugMode) {
			logger.setDebugMode(enabled);
		}
	});

	ipcMain.on("save-app-config", (_event, config) => {
		configManager.saveAppConfig(config);
		if (Object.hasOwn(config, "alwaysOnTop")) {
			windowManager.setUserAlwaysOnTop(config.alwaysOnTop);
		}
	});

	ipcMain.handle("get-app-config", () => configManager.getAppConfig());

	ipcMain.handle("get-floating-panels", () => {
		const appConfig = configManager.getAppConfig();
		return appConfig.floatingPanels || {};
	});

	ipcMain.on("save-floating-panel", (_event, payload = {}) => {
		const panelId =
			typeof payload.panelId === "string" && payload.panelId.trim()
				? payload.panelId.trim()
				: "";
		if (!panelId) return;

		const bounds = payload.bounds || {};
		const nextBounds = {
			x: Math.round(Number(bounds.x) || 0),
			y: Math.round(Number(bounds.y) || 0),
			width: Math.round(Number(bounds.width) || 0),
			height: Math.round(Number(bounds.height) || 0),
		};

		const appConfig = configManager.getAppConfig();
		configManager.saveAppConfig({
			floatingPanels: {
				...(appConfig.floatingPanels || {}),
				[panelId]: nextBounds,
			},
		});
		logger.debug(
			`悬浮窗位置已保存: ${panelId} X=${nextBounds.x}, Y=${nextBounds.y}, Width=${nextBounds.width}, Height=${nextBounds.height}`,
		);
	});
}

module.exports = registerConfigHandlers;
