const { app } = require("electron");
const path = require("path");
const configManager = require("./ConfigManager");
const Updater = require("./Updater");
const setupLogger = require("./Logger");
const PluginLoader = require("./PluginLoader");

// 导入新的核心模块
const WindowManager = require("./core/WindowManager");
const IPCManager = require("./core/IPCManager");
const ShortcutManager = require("./core/ShortcutManager");

class FluxCore {
	constructor() {
		this.logger = setupLogger();

		// 调试日志输出
		this.debugLog("--- FluxCore 启动 (重构版) ---");
		this.debugLog(`运行环境: ${app.isPackaged ? "生产" : "开发"}`);
		this.debugLog(`存储路径: ${app.getPath("userData")}`);

		// 初始化核心管理器
		this.windowManager = new WindowManager();
		this.pluginLoader = null;
		this.ipcManager = null;
		this.shortcutManager = null;

		// 输出启动时的窗口位置和大小到日志
		const savedBounds = configManager.getBoundsConfig();
		this.debugLog(`启动窗口位置: X=${savedBounds.x}, Y=${savedBounds.y}`);
		this.debugLog(
			`启动窗口大小: Width=${savedBounds.width}, Height=${savedBounds.height}`,
		);
	}

	// 调试模式日志输出
	debugLog(...args) {
		if (configManager.isDebugMode()) {
			console.log(...args);
		}
	}

	// 清理日志文件
	clearLogFiles() {
		try {
			const { app } = require("electron");
			const path = require("path");
			const fs = require("fs");

			const isDev = !app.isPackaged;
			const prefix = isDev ? "dev-" : "";

			// 获取日志文件路径
			const logFolder = path.join(app.getPath("userData"), "logs");
			const logPath = path.join(logFolder, "main.log");

			// 删除日志文件
			if (fs.existsSync(logPath)) {
				fs.unlinkSync(logPath);
				this.debugLog("日志文件已删除");
			}

			// 如果日志文件不存在，创建空的日志文件夹
			if (!fs.existsSync(logFolder)) {
				fs.mkdirSync(logFolder, { recursive: true });
				this.debugLog("日志文件夹已创建");
			}

			this.debugLog("日志清理完成");
		} catch (error) {
			this.debugLog("清理日志文件时出错:", error.message);
		}
	}

	launch(PluginLoaderClass) {
		// 创建主窗口
		this.windowManager.createMainWindow();

		// 初始化插件加载器
		this.pluginLoader = new PluginLoaderClass(this);
		this.pluginLoader.loadAll();

		// 创建logger对象
		const logger = {
			debug: (...args) => this.debugLog(...args),
			error: (...args) => this.debugLog(...args),
			clearLogFiles: () => this.clearLogFiles(),
			setDebugMode: (enabled) => {
				if (this.logger && this.logger.setDebugMode) {
					this.logger.setDebugMode(enabled);
				}
			},
		};

		// 初始化快捷键管理器
		this.shortcutManager = new ShortcutManager(this, this.pluginLoader, logger);

		// 初始化IPC管理器
		this.ipcManager = new IPCManager(
			this.windowManager,
			this.pluginLoader,
			logger,
		);

		// 设置IPC处理器
		this.ipcManager.setupAllHandlers();

		// 初始化快捷键
		this.shortcutManager.reloadShortcuts();

		// 启动更新器
		new Updater(this);

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

	// 设置窗口置顶状态
	setAlwaysOnTop(flag) {
		this.windowManager.setAlwaysOnTop(flag);
	}

	// 设置鼠标穿透
	setIgnoreMouse(ignore) {
		this.windowManager.setIgnoreMouseEvents(ignore);
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
