const { app } = require("electron");
const path = require("path");
const fs = require("fs");

// 检测是否为开发环境 (IDE 调试时 app.isPackaged 为 false)
const isDev = !app.isPackaged;

// 根据环境定义文件名前缀
const prefix = isDev ? "dev-" : "";

// 动态拼接路径
const USER_DATA_PATH = app.getPath("userData");
const KEY_CONFIG_PATH = path.join(USER_DATA_PATH, `${prefix}key-config.json`);
const BOUNDS_CONFIG_PATH = path.join(
	USER_DATA_PATH,
	`${prefix}window-bounds.json`,
);
const APP_CONFIG_PATH = path.join(
	USER_DATA_PATH,
	`${prefix}app-config.json`,
);

// 默认配置
const DEFAULT_KEY_CONFIG = {
	BossKey: "Alt+Q",
	ImmersionMode: "Alt+W",
	"Video-Pause": "Alt+Space",
	"Video-Forward": "Alt+Right",
	"Video-Backward": "Alt+Left",
	"Opacity-Up": "Alt+Up",
	"Opacity-Down": "Alt+Down",
	GoBack: "Alt+Left",
	GoForward: "Alt+Right",
};

const DEFAULT_BOUNDS_CONFIG = {
	width: 800,
	height: 600,
	opacity: 1.0,
};

const DEFAULT_APP_CONFIG = {
	debugMode: false,
};

class ConfigManager {
	constructor() {
		this.keyConfig = DEFAULT_KEY_CONFIG;
		this.boundsConfig = DEFAULT_BOUNDS_CONFIG;
		this.appConfig = DEFAULT_APP_CONFIG;
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
}

// 导出单例
module.exports = new ConfigManager();
