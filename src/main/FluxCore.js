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

class FluxCore {
	constructor() {
		this.window = null;
		this.settingsWindow = null;
		this.pluginLoader = null;
		this.savedBounds = configManager.getBoundsConfig();
		this.currentOpacity = this.savedBounds.opacity || 1.0;
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
			icon: path.join(__dirname, "../../build/icon.png"),
			webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webviewTag: true,
            javascript: true
        }
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

		ipcMain.on("start-resizing", (event, direction) => {
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
		});
	}

	// 设置并打开设置窗口
	openSettingsWindow() {
		if (this.settingsWindow) {
			this.settingsWindow.focus();
			return;
		}
		this.settingsWindow = new BrowserWindow({
			width: 450,
			height: 650,
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
			configManager.saveBoundsConfig(this.window.getBounds());
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
