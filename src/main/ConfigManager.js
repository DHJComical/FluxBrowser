const {
	DEFAULT_KEY_CONFIG,
	DEFAULT_BOUNDS_CONFIG,
	DEFAULT_APP_CONFIG,
	DEFAULT_RESOLUTION_PRESETS,
} = require("../constants/config");
const { normalizeLocale, t } = require("./i18n");
const { getConfigPaths } = require("./config/configPaths");
const { loadConfig, saveConfig } = require("./config/configStore");

class ConfigManager {
	constructor() {
		this.keyConfig = DEFAULT_KEY_CONFIG;
		this.boundsConfig = DEFAULT_BOUNDS_CONFIG;
		this.appConfig = DEFAULT_APP_CONFIG;
		this.resolutionPresets = DEFAULT_RESOLUTION_PRESETS;
		this.tabsState = { tabs: [], activeTabId: null };
		this.paths = getConfigPaths();
		this.init();
	}

	init() {
		this.keyConfig = this._loadConfig(
			this.paths.keyConfigPath,
			DEFAULT_KEY_CONFIG,
		);
		this.boundsConfig = this._loadConfig(
			this.paths.boundsConfigPath,
			DEFAULT_BOUNDS_CONFIG,
		);
		this.appConfig = this._loadConfig(
			this.paths.appConfigPath,
			DEFAULT_APP_CONFIG,
		);
		this.appConfig.language = normalizeLocale(this.appConfig.language);
		this.resolutionPresets = this._loadConfig(
			this.paths.resolutionPresetPath,
			DEFAULT_RESOLUTION_PRESETS,
		);
		this.tabsState = this._loadConfig(this.paths.tabsStatePath, this.tabsState);
	}

	_debugLog(...args) {
		if (this.appConfig.debugMode === true) {
			console.log(...args);
		}
	}

	_loadConfig(filePath, defaultConfig) {
		return loadConfig(filePath, defaultConfig, this._debugLog.bind(this));
	}

	_saveConfig(filePath, data) {
		saveConfig(filePath, data, this._debugLog.bind(this));
	}

	getKeyConfig() {
		return this.keyConfig;
	}

	saveKeyConfig(newKeyMap) {
		this.keyConfig = { ...this.keyConfig, ...newKeyMap };
		this._saveConfig(this.paths.keyConfigPath, this.keyConfig);
	}

	getBoundsConfig() {
		return this.boundsConfig;
	}

	saveBoundsConfig(config) {
		this.boundsConfig = { ...this.boundsConfig, ...config };
		this._saveConfig(this.paths.boundsConfigPath, this.boundsConfig);
	}

	getAppConfig() {
		return this.appConfig;
	}

	saveAppConfig(config) {
		this.appConfig = { ...this.appConfig, ...config };
		this.appConfig.language = normalizeLocale(this.appConfig.language);
		this._saveConfig(this.paths.appConfigPath, this.appConfig);
	}

	isDebugMode() {
		return this.appConfig.debugMode === true;
	}

	getResolutionPresets() {
		this._debugLog(
			t("logs.config.getResolutionPresets", {
				count: this.resolutionPresets.length,
			}),
		);
		return this.resolutionPresets;
	}

	saveResolutionPresets(presets) {
		if (!presets || !Array.isArray(presets)) {
			this._debugLog("logs.config.invalidResolutionPresets");
			presets = DEFAULT_RESOLUTION_PRESETS;
		}

		this._debugLog(
			t("logs.config.saveResolutionPresets", {
				count: presets.length,
			}),
		);
		this.resolutionPresets = presets;
		this._saveConfig(
			this.paths.resolutionPresetPath,
			this.resolutionPresets,
		);
	}

	getTabsState() {
		return this.tabsState;
	}

	saveTabsState(tabsState) {
		this.tabsState = { ...tabsState };
		this._saveConfig(this.paths.tabsStatePath, this.tabsState);
	}
}

module.exports = new ConfigManager();
module.exports.DEFAULT_KEY_CONFIG = DEFAULT_KEY_CONFIG;
module.exports.DEFAULT_BOUNDS_CONFIG = DEFAULT_BOUNDS_CONFIG;
module.exports.DEFAULT_APP_CONFIG = DEFAULT_APP_CONFIG;
module.exports.DEFAULT_RESOLUTION_PRESETS = DEFAULT_RESOLUTION_PRESETS;
