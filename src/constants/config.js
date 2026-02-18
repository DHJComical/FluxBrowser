/**
 * 配置常量
 * 包含项目中使用的所有配置相关常量
 */

// 默认快捷键配置
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

// 默认窗口边界配置
const DEFAULT_BOUNDS_CONFIG = {
	width: 800,
	height: 600,
	opacity: 1.0,
};

// 默认应用配置
const DEFAULT_APP_CONFIG = {
	debugMode: false,
};

// 默认分辨率预设
const DEFAULT_RESOLUTION_PRESETS = [
	{ width: 480, height: 270, name: "480 × 270" },
	{ width: 640, height: 360, name: "640 × 360" },
	{ width: 800, height: 450, name: "800 × 450" },
	{ width: 960, height: 540, name: "960 × 540" },
	{ width: 1024, height: 576, name: "1024 × 576" },
	{ width: 1280, height: 720, name: "1280 × 720 (HD)" },
];

// 配置文件名称
const CONFIG_FILE_NAMES = {
	KEY_CONFIG: "key-config.json",
	BOUNDS_CONFIG: "window-bounds.json",
	APP_CONFIG: "app-config.json",
	RESOLUTION_PRESETS: "resolution-presets.json",
};

// 开发环境配置文件前缀
const DEV_CONFIG_PREFIX = "dev-";

// 窗口相关常量
const WINDOW_CONSTANTS = {
	TITLE_BAR_HEIGHT: 40, // 标题栏高度（像素）
	MIN_WIDTH: 300, // 最小宽度
	MIN_HEIGHT: 200, // 最小高度
	MAX_WIDTH: 4000, // 最大宽度
	MAX_HEIGHT: 3000, // 最大高度
	DEFAULT_WIDTH: 800, // 默认宽度
	DEFAULT_HEIGHT: 600, // 默认高度
};

// 透明度相关常量
const OPACITY_CONSTANTS = {
	MIN: 0.2, // 最小透明度
	MAX: 1.0, // 最大透明度
	STEP: 0.1, // 调整步长
};

// 快捷键相关常量
const SHORTCUT_CONSTANTS = {
	MODIFIERS: [
		"Control",
		"Ctrl",
		"Alt",
		"Shift",
		"Command",
		"Cmd",
		"Option",
		"Opt",
	],
	SEPARATOR: "+",
};

// IPC通信通道名称
const IPC_CHANNELS = {
	// 窗口相关
	OPEN_SETTINGS: "open-settings",
	SET_IGNORE_MOUSE: "set-ignore-mouse",
	SET_WINDOW_SIZE: "set-window-size",
	APP_EXIT: "app-exit",
	START_RESIZING: "start-resizing",
	STOP_RESIZING: "stop-resizing",
	START_MOVING: "start-moving",
	STOP_MOVING: "stop-moving",

	// 配置相关
	GET_SHORTCUTS: "get-shortcuts",
	SAVE_SHORTCUTS: "save-shortcuts",
	GET_RESOLUTION_PRESETS: "get-resolution-presets",
	SAVE_RESOLUTION_PRESETS: "save-resolution-presets",
	GET_OPACITY: "get-opacity",
	GET_APP_VERSION: "get-app-version",
	GET_DEBUG_MODE: "get-debug-mode",
	SET_DEBUG_MODE: "set-debug-mode",

	// 快捷键相关
	SUSPEND_SHORTCUTS: "suspend-shortcuts",
	RESUME_SHORTCUTS: "resume-shortcuts",

	// 应用相关
	CLEAR_CACHE: "clear-cache",
	RESTART_AFTER_SAVE: "restart-after-save",

	// 广播消息
	RESOLUTION_PRESETS_UPDATED: "resolution-presets-updated",
	CACHE_CLEARED: "cache-cleared",
	SET_OPACITY: "set-opacity",
	EXECUTE_WEBVIEW_JS: "execute-webview-js",
	TOGGLE_IMMERSION_UI: "toggle-immersion-ui",
	WEB_GO_BACK: "web-go-back",
	WEB_GO_FORWARD: "web-go-forward",
	IMMERSION_MODE_CHANGED: "immersion-mode-changed",
};

// 插件相关常量
const PLUGIN_CONSTANTS = {
	REQUIRED_FIELDS: ["name"],
	OPTIONAL_FIELDS: ["shortcuts", "initialize", "init"],
};

// 日志相关常量
const LOG_CONSTANTS = {
	LOG_FOLDER: "logs",
	MAIN_LOG_FILE: "main.log",
	MAX_LOG_SIZE: 10 * 1024 * 1024, // 10MB
};

module.exports = {
	DEFAULT_KEY_CONFIG,
	DEFAULT_BOUNDS_CONFIG,
	DEFAULT_APP_CONFIG,
	DEFAULT_RESOLUTION_PRESETS,
	CONFIG_FILE_NAMES,
	DEV_CONFIG_PREFIX,
	WINDOW_CONSTANTS,
	OPACITY_CONSTANTS,
	SHORTCUT_CONSTANTS,
	IPC_CHANNELS,
	PLUGIN_CONSTANTS,
	LOG_CONSTANTS,
};
