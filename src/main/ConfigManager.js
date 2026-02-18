const { app } = require("electron");
const path = require("path");
const fs = require("fs");

// 导入常量
const {
	DEFAULT_KEY_CONFIG,
	DEFAULT_BOUNDS_CONFIG,
	DEFAULT_APP_CONFIG,
	DEFAULT_RESOLUTION_PRESETS,
	CONFIG_FILE_NAMES,
	DEV_CONFIG_PREFIX,
} = require("../constants/config");

// 检测是否为开发环境 (IDE 调试时 app.isPackaged 为 false)
const isDev = !app.isPackaged;

// 根据环境定义文件名前缀
const prefix = isDev ? DEV_CONFIG_PREFIX : "";

// 动态拼接路径
const USER_DATA_PATH = app.getPath("userData");
const KEY_CONFIG_PATH = path.join(
	USER_DATA_PATH,
	`${prefix}${CONFIG_FILE_NAMES.KEY_CONFIG}`,
);
const BOUNDS_CONFIG_PATH = path.join(
	USER_DATA_PATH,
	`${prefix}${CONFIG_FILE_NAMES.BOUNDS_CONFIG}`,
);
const APP_CONFIG_PATH = path.join(
	USER_DATA_PATH,
	`${prefix}${CONFIG_FILE_NAMES.APP_CONFIG}`,
);
const RESOLUTION_PRESET_PATH = path.join(
	USER_DATA_PATH,
	`${prefix}${CONFIG_FILE_NAMES.RESOLUTION_PRESETS}`,
);

class ConfigManager {
	constructor() {
		this.keyConfig = DEFAULT_KEY_CONFIG;
		this.boundsConfig = DEFAULT_BOUNDS_CONFIG;
		this.appConfig = DEFAULT_APP_CONFIG;
		this.resolutionPresets = DEFAULT_RESOLUTION_PRESETS;
		this.init();
	}

	// 初始化加载所有配置
	init() {
		this.keyConfig = this._loadConfig(KEY_CONFIG_PATH, DEFAULT_KEY_CONFIG);
		this.boundsConfig = this._loadConfig(
			BOUNDS_CONFIG_PATH,
			DEFAULT_BOUNDS_CONFIG,
		);
		this.appConfig = this._loadConfig(APP_CONFIG_PATH, DEFAULT_APP_CONFIG);
		this.resolutionPresets = this._loadConfig(
			RESOLUTION_PRESET_PATH,
			DEFAULT_RESOLUTION_PRESETS,
		);
	}

	// 调试日志辅助函数
	_debugLog(...args) {
		if (this.appConfig.debugMode === true) {
			console.log(...args);
		}
	}

	// 内部私有方法：读取
	_loadConfig(filePath, defaultConfig) {
		try {
			if (fs.existsSync(filePath)) {
				const fileContent = fs.readFileSync(filePath, "utf-8");
				const savedConfig = JSON.parse(fileContent);

				// 特殊处理数组类型的配置
				if (Array.isArray(defaultConfig) && Array.isArray(savedConfig)) {
					return savedConfig;
				}

				// 对于对象类型，进行合并
				return { ...defaultConfig, ...savedConfig };
			}
		} catch (e) {
			this._debugLog(`加载配置文件 [${path.basename(filePath)}] 失败:`, e);
		}
		return defaultConfig;
	}

	// 内部私有方法：保存
	_saveConfig(filePath, data) {
		try {
			fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
		} catch (e) {
			this._debugLog(`保存配置文件 [${path.basename(filePath)}] 失败:`, e);
		}
	}

	// --- 公开 API ---

	// 获取快捷键配置
	getKeyConfig() {
		return this.keyConfig;
	}

	// 保存快捷键配置
	saveKeyConfig(newKeyMap) {
		this.keyConfig = { ...this.keyConfig, ...newKeyMap };
		this._saveConfig(KEY_CONFIG_PATH, this.keyConfig);
	}

	// 获取窗口位置配置
	getBoundsConfig() {
		return this.boundsConfig;
	}

	// 保存窗口位置配置
	saveBoundsConfig(config) {
		this.boundsConfig = { ...this.boundsConfig, ...config };
		this._saveConfig(BOUNDS_CONFIG_PATH, this.boundsConfig);
	}

	// 获取应用配置
	getAppConfig() {
		return this.appConfig;
	}

	// 保存应用配置
	saveAppConfig(config) {
		this.appConfig = { ...this.appConfig, ...config };
		this._saveConfig(APP_CONFIG_PATH, this.appConfig);
	}

	// 获取调试模式状态
	isDebugMode() {
		return this.appConfig.debugMode === true;
	}

	// 获取分辨率预设
	getResolutionPresets() {
		this._debugLog(
			`获取分辨率预设，当前共有 ${this.resolutionPresets.length} 个预设`,
		);
		return this.resolutionPresets;
	}

	// 保存分辨率预设
	saveResolutionPresets(presets) {
		// 确保presets参数有效
		if (!presets || !Array.isArray(presets)) {
			this._debugLog("保存分辨率预设时接收到无效参数，使用默认值");
			presets = DEFAULT_RESOLUTION_PRESETS;
		}

		this._debugLog(`保存分辨率预设，共有 ${presets.length} 个预设`);
		this.resolutionPresets = presets;
		this._saveConfig(RESOLUTION_PRESET_PATH, this.resolutionPresets);
	}
}

// 导出单例
module.exports = new ConfigManager();

// 导出默认配置供其他模块使用
module.exports.DEFAULT_KEY_CONFIG = DEFAULT_KEY_CONFIG;
module.exports.DEFAULT_BOUNDS_CONFIG = DEFAULT_BOUNDS_CONFIG;
module.exports.DEFAULT_APP_CONFIG = DEFAULT_APP_CONFIG;
module.exports.DEFAULT_RESOLUTION_PRESETS = DEFAULT_RESOLUTION_PRESETS;
