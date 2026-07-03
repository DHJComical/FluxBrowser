const configManager = require("../../ConfigManager");
const { app } = require("electron");
const { normalizeLocale, setLocale, t } = require("../../i18n");
const { IPC_CHANNELS } = require("../../../constants/config");

function normalizeBounds(bounds = {}) {
	return {
		x: Math.round(Number(bounds.x) || 0),
		y: Math.round(Number(bounds.y) || 0),
		width: Math.round(Number(bounds.width) || 0),
		height: Math.round(Number(bounds.height) || 0),
	};
}

function areBoundsEqual(left, right) {
	return (
		left.x === right.x &&
		left.y === right.y &&
		left.width === right.width &&
		left.height === right.height
	);
}

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
		logger.debug(
			t("logs.config.ipcReturnResolutionPresets", {
				count: presets.length,
			}),
		);
		return presets;
	});

	ipcMain.on("save-resolution-presets", (_event, presets) => {
		logger.debug(
			t("logs.config.ipcSaveResolutionPresets", {
				count: presets.length,
			}),
		);
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
		const nextConfig = { ...config };
		if (Object.hasOwn(nextConfig, "language")) {
			nextConfig.language = normalizeLocale(nextConfig.language);
		}
		configManager.saveAppConfig(nextConfig);
		if (Object.hasOwn(nextConfig, "language")) {
			const activeLocale = setLocale(nextConfig.language);
			if (windowManager && typeof windowManager.updateWindowTitles === "function") {
				windowManager.updateWindowTitles();
			}
			broadcast(IPC_CHANNELS.LANGUAGE_CHANGED, { locale: activeLocale });
		}
		if (Object.hasOwn(nextConfig, "alwaysOnTop")) {
			windowManager.setUserAlwaysOnTop(nextConfig.alwaysOnTop);
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

		const nextBounds = normalizeBounds(payload.bounds);
		const appConfig = configManager.getAppConfig();
		const floatingPanels = appConfig.floatingPanels || {};
		const previousBounds = normalizeBounds(floatingPanels[panelId]);
		if (areBoundsEqual(previousBounds, nextBounds)) return;

		configManager.saveAppConfig({
			floatingPanels: {
				...floatingPanels,
				[panelId]: nextBounds,
			},
		});
		logger.debug(
			t("logs.config.floatingPanelSaved", {
				panelId,
				x: nextBounds.x,
				y: nextBounds.y,
				width: nextBounds.width,
				height: nextBounds.height,
			}),
		);
	});
}

module.exports = registerConfigHandlers;
