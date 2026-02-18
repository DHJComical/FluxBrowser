const { ipcMain, globalShortcut, app } = require("electron");
const configManager = require("../ConfigManager");

class IPCManager {
	constructor(windowManager, pluginLoader, logger) {
		this.windowManager = windowManager;
		this.pluginLoader = pluginLoader;
		this.logger = logger;
		// 从配置加载透明度
		const boundsConfig = configManager.getBoundsConfig();
		this.currentOpacity = boundsConfig.opacity || 1.0;
	}

	// 初始化所有IPC处理器
	setupAllHandlers() {
		this.setupWindowHandlers();
		this.setupConfigHandlers();
		this.setupShortcutHandlers();
		this.setupAppHandlers();
		this.setupResizeHandlers();
		this.setupMoveHandlers();
	}

	// 窗口相关处理器
	setupWindowHandlers() {
		// 打开设置窗口
		ipcMain.on("open-settings", () => {
			const mainWindow = this.windowManager.getMainWindow();
			if (mainWindow) {
				this.windowManager.createSettingsWindow(mainWindow);
			}
		});

		// 设置鼠标穿透
		ipcMain.on("set-ignore-mouse", (e, ignore) => {
			this.windowManager.setIgnoreMouseEvents(ignore);
		});

		// 设置窗口大小
		ipcMain.on("set-window-size", (e, { width, height }) => {
			this.windowManager.setWindowSize(width, height);
			this.logger.debug(
				`窗口分辨率已设置为: ${width} × ${height} (webview区域)`,
			);
		});

		// 退出应用
		ipcMain.on("app-exit", () => {
			this.windowManager.saveWindowBounds();
			app.quit();
		});
	}

	// 配置相关处理器
	setupConfigHandlers() {
		// 获取快捷键配置
		ipcMain.handle("get-shortcuts", () => configManager.getKeyConfig());

		// 保存快捷键配置
		ipcMain.on("save-shortcuts", (e, map) => {
			configManager.saveKeyConfig(map);
			if (this.pluginLoader) {
				this.pluginLoader.reloadShortcuts();
			}
		});

		// 获取分辨率预设
		ipcMain.handle("get-resolution-presets", () => {
			const presets = configManager.getResolutionPresets();
			this.logger.debug(`IPC: 返回分辨率预设，数量: ${presets.length}`);
			return presets;
		});

		// 保存分辨率预设
		ipcMain.on("save-resolution-presets", (e, presets) => {
			this.logger.debug(`IPC: 收到保存分辨率预设请求，数量: ${presets.length}`);
			configManager.saveResolutionPresets(presets);
			this.broadcast("resolution-presets-updated");
		});

		// 获取当前透明度
		ipcMain.handle("get-opacity", () => {
			return this.currentOpacity;
		});

		// 获取应用版本号
		ipcMain.handle("get-app-version", () => {
			return app.getVersion();
		});

		// 获取调试模式状态
		ipcMain.handle("get-debug-mode", () => {
			return configManager.isDebugMode();
		});

		// 设置调试模式状态
		ipcMain.on("set-debug-mode", (e, enabled) => {
			configManager.saveAppConfig({ debugMode: enabled });
			if (this.logger && this.logger.setDebugMode) {
				this.logger.setDebugMode(enabled);
			}
		});
	}

	// 快捷键相关处理器
	setupShortcutHandlers() {
		// 暂停快捷键
		ipcMain.on("suspend-shortcuts", () => globalShortcut.unregisterAll());

		// 恢复快捷键
		ipcMain.on("resume-shortcuts", () => {
			if (this.pluginLoader) {
				this.pluginLoader.reloadShortcuts();
			}
		});
	}

	// 应用相关处理器
	setupAppHandlers() {
		// 清理缓存
		ipcMain.on("clear-cache", (e, options) => {
			this.logger.debug("开始清理缓存...");
			this.logger.debug(`清理选项: ${JSON.stringify(options)}`);

			// 清理日志文件
			if (options.clearLogs && this.logger.clearLogFiles) {
				this.logger.debug("正在清理日志文件...");
				this.logger.clearLogFiles();
			}

			// 重置配置文件
			if (options.clearKeyConfig) {
				this.logger.debug("正在重置快捷键配置...");
				configManager.saveKeyConfig(configManager.DEFAULT_KEY_CONFIG);
			}

			if (options.clearWindowConfig) {
				this.logger.debug("正在重置窗口配置...");
				configManager.saveBoundsConfig(configManager.DEFAULT_BOUNDS_CONFIG);
			}

			if (options.clearAppConfig) {
				this.logger.debug("正在重置应用配置...");
				configManager.saveAppConfig(configManager.DEFAULT_APP_CONFIG);
			}

			if (options.clearResolutionPresets) {
				this.logger.debug("正在重置分辨率预设为默认值...");
				configManager.saveResolutionPresets(
					configManager.DEFAULT_RESOLUTION_PRESETS,
				);
			}

			this.logger.debug("缓存清理完成");

			// 发送清理完成消息
			this.broadcast("cache-cleared", {
				success: true,
				message: "缓存清理完成",
			});
		});

		// 重启应用
		ipcMain.on("restart-after-save", () => {
			this.logger.debug("收到重启请求，准备重启应用...");
			app.relaunch();
			app.exit(0);
		});
	}

	// 调整大小处理器
	setupResizeHandlers() {
		let resizeInterval = null;
		let isResizing = false;

		ipcMain.on("start-resizing", (event, direction) => {
			isResizing = true;
			if (resizeInterval) clearInterval(resizeInterval);

			const { screen } = require("electron");
			const mainWindow = this.windowManager.getMainWindow();
			if (!mainWindow) return;

			const startMousePos = screen.getCursorScreenPoint();
			const startBounds = mainWindow.getBounds();

			resizeInterval = setInterval(() => {
				if (!mainWindow || mainWindow.isDestroyed()) {
					clearInterval(resizeInterval);
					return;
				}

				const currentMousePos = screen.getCursorScreenPoint();
				const deltaX = currentMousePos.x - startMousePos.x;
				const deltaY = currentMousePos.y - startMousePos.y;

				let newWidth = startBounds.width;
				let newHeight = startBounds.height;

				if (direction === "right" || direction === "both") {
					newWidth = Math.max(40, startBounds.width + deltaX); // 最小宽度40
				}
				if (direction === "bottom" || direction === "both") {
					newHeight = Math.max(80, startBounds.height + deltaY); // 最小高度80（40px标题栏 + 40px Webview区域）
				}

				mainWindow.setBounds({
					x: startBounds.x,
					y: startBounds.y,
					width: newWidth,
					height: newHeight,
				});
			}, 10);
		});

		ipcMain.on("stop-resizing", () => {
			if (resizeInterval) {
				clearInterval(resizeInterval);
				resizeInterval = null;
			}

			const mainWindow = this.windowManager.getMainWindow();
			if (isResizing && mainWindow) {
				const bounds = mainWindow.getBounds();
				this.logger.debug(
					`窗口大小已调整: Width=${bounds.width}, Height=${bounds.height}`,
				);
			}
			isResizing = false;
		});
	}

	// 移动处理器
	setupMoveHandlers() {
		let moveInterval = null;
		let startWindowBounds = null;

		ipcMain.on("start-moving", (event) => {
			if (moveInterval) clearInterval(moveInterval);

			const mainWindow = this.windowManager.getMainWindow();
			if (!mainWindow) return;

			const { screen } = require("electron");
			const startMousePos = screen.getCursorScreenPoint();
			startWindowBounds = mainWindow.getBounds();

			moveInterval = setInterval(() => {
				if (!mainWindow || mainWindow.isDestroyed()) {
					clearInterval(moveInterval);
					return;
				}

				const currentMousePos = screen.getCursorScreenPoint();
				const deltaX = currentMousePos.x - startMousePos.x;
				const deltaY = currentMousePos.y - startMousePos.y;

				mainWindow.setBounds({
					x: startWindowBounds.x + deltaX,
					y: startWindowBounds.y + deltaY,
					width: startWindowBounds.width,
					height: startWindowBounds.height,
				});
			}, 10);
		});

		ipcMain.on("stop-moving", () => {
			if (moveInterval) {
				clearInterval(moveInterval);
				moveInterval = null;
			}

			const mainWindow = this.windowManager.getMainWindow();
			if (mainWindow) {
				const bounds = mainWindow.getBounds();
				this.logger.debug(`窗口位置已移动: X=${bounds.x}, Y=${bounds.y}`);
			}
		});
	}

	// 广播消息到所有窗口
	broadcast(channel, data) {
		const windows = this.windowManager.getAllWindows();
		windows.forEach((win) => {
			if (win && !win.isDestroyed()) {
				win.webContents.send(channel, data);
			}
		});
	}

	// 发送消息到渲染进程
	sendToRenderer(channel, data) {
		this.broadcast(channel, data);
	}

	// 设置当前透明度
	setCurrentOpacity(opacity) {
		this.currentOpacity = opacity;
	}

	// 获取当前透明度
	getCurrentOpacity() {
		return this.currentOpacity;
	}

	// 调整透明度
	adjustOpacity(delta) {
		let newOp = parseFloat((this.currentOpacity + delta).toFixed(1));
		if (newOp > 1.0) newOp = 1.0;
		if (newOp < 0.2) newOp = 0.2;
		this.currentOpacity = newOp;
		this.broadcast("set-opacity", newOp);
		configManager.saveBoundsConfig({ opacity: newOp });
	}
}

module.exports = IPCManager;
