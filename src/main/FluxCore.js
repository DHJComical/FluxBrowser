const { app } = require("electron");
const configManager = require("./ConfigManager");
const setupLogger = require("./Logger");
const launchRuntime = require("./core/launchRuntime");
const {
	debugLog,
	logStartupInfo,
} = require("./core/coreLogger");
const {
	toggleBossKey,
	isBossKeyProtectionEnabled,
	pausePlayingVideosForBossKey,
	resumeBossKeyPausedVideos,
	suspendShortcutsExceptBossKey,
	resumeShortcutsExceptBossKey,
} = require("./core/bossKeyController");

// 导入新的核心模块
const WindowManager = require("./core/WindowManager");

class FluxCore {
	constructor() {
		this.logger = setupLogger();
		logStartupInfo();

		// 初始化核心管理器
		this.windowManager = new WindowManager();
		this.pluginLoader = null;
		this.ipcManager = null;
		this.shortcutManager = null;
		this.lastBossKeyToggleAt = 0;
	}

	// 调试模式日志输出
	debugLog(...args) {
		debugLog(...args);
	}

	launch(PluginLoaderClass) {
		launchRuntime(this, PluginLoaderClass);
		this.debugLog("FluxCore 启动完成");
	}

	// 获取快捷键（供插件系统使用）
	getKey(id) {
		return configManager.getKeyConfig()[id];
	}

	// 发送消息到渲染进程
	sendToRenderer(channel, data) {
		if (this.ipcManager) {
			this.ipcManager.sendToRenderer(channel, data);
		}
	}

	// 执行网页内的JS（用于视频控制插件）
	executeOnWebview(jsCode) {
		this.sendToRenderer("execute-webview-js", jsCode);
	}

	// 切换窗口显示状态
	toggleVisibility() {
		this.windowManager.toggleVisibility();
	}

	// 触发老板键
	toggleBossKey() {
		toggleBossKey(this);
	}

	// 老板键保护选项：隐藏时暂停视频并只保留老板键快捷键
	isBossKeyProtectionEnabled() {
		return isBossKeyProtectionEnabled();
	}

	pausePlayingVideosForBossKey() {
		pausePlayingVideosForBossKey(this);
	}

	resumeBossKeyPausedVideos() {
		resumeBossKeyPausedVideos(this);
	}

	suspendShortcutsExceptBossKey() {
		suspendShortcutsExceptBossKey(this.shortcutManager);
	}

	resumeShortcuts() {
		if (this.shortcutManager) {
			this.shortcutManager.resumeShortcuts();
		}
	}

	resumeShortcutsExceptBossKey() {
		resumeShortcutsExceptBossKey(this.shortcutManager);
	}

	// 设置窗口置顶状态
	setAlwaysOnTop(flag) {
		this.windowManager.setAlwaysOnTop(flag);
	}

	// 设置鼠标穿透
	setIgnoreMouse(ignore) {
		this.windowManager.setIgnoreMouseEvents(ignore);
	}

	// 设置主窗口是否可聚焦
	setFocusable(focusable) {
		this.windowManager.setFocusable(focusable);
	}

	// 聚焦无边框最大化的前台应用
	focusBorderlessMaximizedApp() {
		this.windowManager.focusBorderlessMaximizedApp();
	}

	// 调整透明度
	adjustOpacity(delta) {
		if (this.ipcManager) {
			this.ipcManager.adjustOpacity(delta);
		}
	}

	// 获取窗口管理器
	getWindowManager() {
		return this.windowManager;
	}

	// 获取IPC管理器
	getIPCManager() {
		return this.ipcManager;
	}

	// 获取快捷键管理器
	getShortcutManager() {
		return this.shortcutManager;
	}

	// 获取插件加载器
	getPluginLoader() {
		return this.pluginLoader;
	}

	// 广播消息到所有窗口
	broadcast(channel, data) {
		if (this.ipcManager) {
			this.ipcManager.broadcast(channel, data);
		}
	}

	// 保存窗口尺寸和位置
	saveWindowBounds() {
		this.windowManager.saveWindowBounds();
	}
}

module.exports = new FluxCore();
