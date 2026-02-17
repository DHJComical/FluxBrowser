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
const APP_CONFIG_PATH = path.join(USER_DATA_PATH, `${prefix}app-config.json`);
const RESOLUTION_PRESET_PATH = path.join(USER_DATA_PATH, `${prefix}resolution-presets.json`);

// 默认配置
const DEFAULT_KEY_CONFIG = {
	BossKey: "Delete",
	ImmersionMode: "Home",
	"Video-Pause": "Down",
	"Video-Forward": "Right",
	"Video-Backward": "Left",
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

const DEFAULT_RESOLUTION_PRESETS = [
{ width: 480, height: 270, name: "480 × 270" },
{ width: 640, height: 360, name: "640 × 360" },
{ width: 800, height: 450, name: "800 × 450" },
{ width: 960, height: 540, name: "960 × 540" },
{ width: 1024, height: 576, name: "1024 × 576" },
{ width: 1280, height: 720, name: "1280 × 720 (HD)" },
];

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
this.resolutionPresets = this._loadConfig(RESOLUTION_PRESET_PATH, DEFAULT_RESOLUTION_PRESETS);
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
this._debugLog(`获取分辨率预设，当前共有 ${this.resolutionPresets.length} 个预设`);
return this.resolutionPresets;
}

// 保存分辨率预设
saveResolutionPresets(presets) {
this._debugLog(`保存分辨率预设，共有 ${presets.length} 个预设`);
this.resolutionPresets = presets;
this._saveConfig(RESOLUTION_PRESET_PATH, this.resolutionPresets);
}
}

// 导出单例
module.exports = new ConfigManager();
