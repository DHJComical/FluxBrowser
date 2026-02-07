const { BrowserWindow, ipcMain, screen } = require("electron");
const path = require("path");

class FluxCore {
	constructor() {
		this.window = null;
		this.pluginLoader = null;
	}

	// 启动核心
	launch(PluginLoaderClass) {
		this.createWindow();
		this.setupResizeHandler();
		// 初始化插件加载器，把核心实例传给插件
		this.pluginLoader = new PluginLoaderClass(this);
		this.pluginLoader.loadAll();
	}

	createWindow() {
		this.window = new BrowserWindow({
			width: 600,
			height: 400,
			frame: false, // 无边框
			transparent: true, // 透明背景
			alwaysOnTop: true, // 永远置顶
			hasShadow: false,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				webviewTag: true, // 允许 <webview>
			},
		});

		this.window.loadFile(path.join(__dirname, "../renderer/index.html"));

		// 监听前端的鼠标穿透请求（智能穿透）
		ipcMain.on("set-ignore-mouse", (e, ignore) => {
			this.setIgnoreMouse(ignore);
		});
	}
	setupResizeHandler() {
		let resizeInterval;

		ipcMain.on("start-resizing", (event, direction) => {
			const startMousePos = screen.getCursorScreenPoint();
			const startBounds = this.window.getBounds();

			if (resizeInterval) clearInterval(resizeInterval);

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

				// 根据方向计算新尺寸
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

	// --- 开放给插件使用的 API ---

	// 1. 发送指令给前端 (View层)
	sendToRenderer(channel, data) {
		if (this.window && !this.window.isDestroyed()) {
			this.window.webContents.send(channel, data);
		}
	}

	// 2. 控制窗口显隐
	toggleVisibility() {
		if (this.window.isVisible()) this.window.hide();
		else this.window.show();
	}

	// 3. 设置鼠标穿透 (核心技术)
	setIgnoreMouse(ignore) {
		if (this.window) {
			// forward: true 让鼠标事件能穿透到后面的窗口
			this.window.setIgnoreMouseEvents(ignore, { forward: true });
		}
	}

	// 4. 执行网页内的 JS (控制视频用)
	executeOnWebview(jsCode) {
		this.sendToRenderer("execute-webview-js", jsCode);
	}
}

module.exports = new FluxCore(); // 导出单例
