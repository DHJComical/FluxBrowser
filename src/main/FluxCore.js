const {
	BrowserWindow,
	ipcMain,
	screen,
	app,
	globalShortcut,
} = require("electron");
const path = require("path");
const configManager = require("./ConfigManager");
const Updater = require("./Updater");
const setupLogger = require("./Logger");

class FluxCore {
	constructor() {
		this.logger = setupLogger();

		// 调试日志输出
		this.debugLog("--- FluxCore 启动 ---");
		this.debugLog(`运行环境: ${app.isPackaged ? "生产" : "开发"}`);
		this.debugLog(`存储路径: ${app.getPath("userData")}`);

		this.window = null;
		this.settingsWindow = null;
		this.pluginLoader = null;
		this.savedBounds = configManager.getBoundsConfig();
		this.currentOpacity = this.savedBounds.opacity || 1.0;

		// 输出启动时的窗口位置和大小到日志
		this.debugLog(
			`启动窗口位置: X=${this.savedBounds.x}, Y=${this.savedBounds.y}`,
		);
		this.debugLog(
			`启动窗口大小: Width=${this.savedBounds.width}, Height=${this.savedBounds.height}`,
		);
	}

	// 调试模式日志输出
	debugLog(...args) {
		if (configManager.isDebugMode()) {
			console.log(...args);
		}
	}

	launch(PluginLoaderClass) {
		this.createWindow();
		this.setupResizeHandler();
		this.setupIpc();
		new Updater(this);
		this.pluginLoader = new PluginLoaderClass(this);
		this.pluginLoader.loadAll();
	}

	createWindow() {
		let { x, y, width, height } = this.savedBounds;
		this.window = new BrowserWindow({
			x: x,
			y: y,
			width: width || 800,
			height: height || 600,
			frame: false,
			transparent: true,
			alwaysOnTop: false,
			hasShadow: false,
			icon: path.join(__dirname, "../../resources/image/FluxBrowser-icon.ico"),
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				webviewTag: true,
				javascript: true,
			},
		});

		this.window.setMenu(null);
		this.window.loadFile(path.join(__dirname, "../renderer/index.html"));

		this.window.on("close", () => {
			this.saveWindowBounds();
			if (this.settingsWindow) this.settingsWindow.close();
		});

		// 拦截新窗口跳转
		this.window.webContents.on("did-attach-webview", (event, wc) => {
			wc.setWindowOpenHandler(({ url }) => {
				wc.loadURL(url);
				return { action: "deny" };
			});
		});
	}

	// 缩放处理逻辑
	setupResizeHandler() {
		let resizeInterval = null;
		this.isResizing = false; // 标志：是否正在调整大小

		ipcMain.on("start-resizing", (event, direction) => {
			this.isResizing = true; // 标记为正在调整大小
			if (resizeInterval) clearInterval(resizeInterval);

			const startMousePos = screen.getCursorScreenPoint();
			const startBounds = this.window.getBounds();

			resizeInterval = setInterval(() => {
				if (!this.window || this.window.isDestroyed()) {
					clearInterval(resizeInterval);
					return;
				}

				const currentMousePos = screen.getCursorScreenPoint();
				const deltaX = currentMousePos.x - startMousePos.x;
				const deltaY = currentMousePos.y - startMousePos.y;

				let newWidth = startBounds.width;
				let newHeight = startBounds.height;

				if (direction === "right" || direction === "both") {
					newWidth = Math.max(300, startBounds.width + deltaX);
				}
				if (direction === "bottom" || direction === "both") {
					newHeight = Math.max(200, startBounds.height + deltaY);
				}

				this.window.setBounds({
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
			// 只有真正在调整大小时才输出日志
			if (this.isResizing && this.window) {
				const bounds = this.window.getBounds();
				this.debugLog(
					`窗口大小已调整: Width=${bounds.width}, Height=${bounds.height}`,
				);
			}
			this.isResizing = false;
		});
	}

	// 设置并打开设置窗口
	openSettingsWindow() {
		if (this.settingsWindow) {
			this.settingsWindow.focus();
			return;
		}

		// 获取屏幕尺寸
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width: screenWidth, height: screenHeight } =
			primaryDisplay.workAreaSize;

		// 计算窗口居中位置
		const windowWidth = 450;
		const windowHeight = 650;
		const x = Math.round((screenWidth - windowWidth) / 2);
		const y = Math.round((screenHeight - windowHeight) / 2);

		this.settingsWindow = new BrowserWindow({
			x: x,
			y: y,
			width: windowWidth,
			height: windowHeight,
			parent: this.window,
			title: "FluxBrowser 设置",
			backgroundColor: "#1e1e1e",
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});
		this.settingsWindow.setMenu(null);
		this.settingsWindow.loadFile(
			path.join(__dirname, "../renderer/settings.html"),
		);
		this.settingsWindow.on("closed", () => {
			this.settingsWindow = null;
		});
	}

	// 设置 IPC 通信
	setupIpc() {
		// 打开设置窗口
		ipcMain.on("open-settings", () => this.openSettingsWindow());

		// 获取快捷键配置
		ipcMain.handle("get-shortcuts", () => configManager.getKeyConfig());

		// 保存快捷键配置
		ipcMain.on("save-shortcuts", (e, map) => {
			configManager.saveKeyConfig(map);
			this.pluginLoader.reloadShortcuts();
		});

		// 调整透明度
		ipcMain.on("suspend-shortcuts", () => globalShortcut.unregisterAll());

		// 获取当前透明度
		ipcMain.handle("get-opacity", () => {
			return this.currentOpacity;
		});

		// 恢复快捷键
		ipcMain.on("resume-shortcuts", () => this.pluginLoader.reloadShortcuts());

		// 退出应用
		ipcMain.on("app-exit", () => {
			this.saveWindowBounds();
			app.quit();
		});

		// 设置鼠标穿透
		ipcMain.on("set-ignore-mouse", (e, ignore) => {
			if (this.window)
				this.window.setIgnoreMouseEvents(ignore, { forward: ignore });
		});

		// 设置窗口大小 (分辨率预设)
		ipcMain.on("set-window-size", (e, { width, height }) => {
			if (this.window) {
				const currentBounds = this.window.getBounds();
				this.window.setBounds({
					x: currentBounds.x,
					y: currentBounds.y,
					width: width,
					height: height,
				});
				this.debugLog(`窗口分辨率已设置为: ${width} × ${height}`);
			}
		});

		// 获取应用版本号
		ipcMain.handle("get-app-version", () => {
			return app.getVersion(); // 自动从 package.json 读取 version 字段
		});

		// 获取调试模式状态
		ipcMain.handle("get-debug-mode", () => {
			return configManager.isDebugMode();
		});

		// 设置调试模式状态
		ipcMain.on("set-debug-mode", (e, enabled) => {
			configManager.saveAppConfig({ debugMode: enabled });
			// 更新 Logger 模块的调试模式状态
			this.logger.setDebugMode(enabled);
		});

		// 手动窗口移动监听
		let moveInterval = null;
		let startWindowBounds = null;
		ipcMain.on("start-moving", (event) => {
			if (moveInterval) clearInterval(moveInterval);
			if (!this.window) return;

			// 获取初始鼠标位置和初始窗口 bounds（包含大小）
			const startMousePos = screen.getCursorScreenPoint();
			startWindowBounds = this.window.getBounds();

			moveInterval = setInterval(() => {
				if (!this.window || this.window.isDestroyed()) {
					clearInterval(moveInterval);
					return;
				}

				const currentMousePos = screen.getCursorScreenPoint();

				// 计算偏移量
				const deltaX = currentMousePos.x - startMousePos.x;
				const deltaY = currentMousePos.y - startMousePos.y;

				// 使用 setBounds 设置窗口新位置，同时保持原有大小不变
				this.window.setBounds({
					x: startWindowBounds.x + deltaX,
					y: startWindowBounds.y + deltaY,
					width: startWindowBounds.width,
					height: startWindowBounds.height,
				});
			}, 10); // 10ms 刷新率，保证拖拽丝滑
		});

		// 停止移动监听
		ipcMain.on("stop-moving", () => {
			if (moveInterval) {
				clearInterval(moveInterval);
				moveInterval = null;
			}
			// 输出移动后的窗口位置
			if (this.window) {
				const bounds = this.window.getBounds();
				this.debugLog(`窗口位置已移动: X=${bounds.x}, Y=${bounds.y}`);
			}
		});
	}

	// 广播消息到所有窗口
	broadcast(channel, data) {
		const windows = [this.window, this.settingsWindow];
		windows.forEach((win) => {
			if (win && !win.isDestroyed()) win.webContents.send(channel, data);
		});
	}

	// 保存窗口尺寸和位置
	saveWindowBounds() {
		if (this.window) {
			const bounds = this.window.getBounds();
			this.debugLog(`窗口位置已保存: X=${bounds.x}, Y=${bounds.y}`);
			this.debugLog(
				`窗口大小已保存: Width=${bounds.width}, Height=${bounds.height}`,
			);
			configManager.saveBoundsConfig(bounds);
		}
	}

	// 获取快捷键
	getKey(id) {
		return configManager.getKeyConfig()[id];
	}

	// 发送消息到渲染进程
	sendToRenderer(channel, data) {
		this.broadcast(channel, data);
	}

	// 发送指令给前端
	sendToRenderer(channel, data) {
		this.broadcast(channel, data);
	}

	// 执行网页内的 JS (用于视频控制插件)
	executeOnWebview(jsCode) {
		this.sendToRenderer("execute-webview-js", jsCode);
	}

	// 切换窗口显示状态
	toggleVisibility() {
		if (!this.window) return;
		this.window.isVisible() ? this.window.hide() : this.window.show();
	}

	// 设置窗口置顶状态
	setAlwaysOnTop(flag) {
		if (this.window) this.window.setAlwaysOnTop(flag, "screen-saver");
	}

	// 控制视频 (供 video-ctrl.js 调用)
	executeOnWebview(jsCode) {
		this.sendToRenderer("execute-webview-js", jsCode);
	}

	// 设置鼠标穿透 (供 immersion.js 调用)
	setIgnoreMouse(ignore) {
		if (this.window) {
			this.window.setIgnoreMouseEvents(ignore, { forward: ignore });
		}
	}

	// 调整透明度 (供 opacity.js 调用)
	adjustOpacity(delta) {
		let newOp = parseFloat((this.currentOpacity + delta).toFixed(1));
		if (newOp > 1.0) newOp = 1.0;
		if (newOp < 0.2) newOp = 0.2;
		this.currentOpacity = newOp;
		this.broadcast("set-opacity", newOp);
		configManager.saveBoundsConfig({ opacity: newOp });
	}
}

module.exports = new FluxCore();
