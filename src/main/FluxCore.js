const { BrowserWindow, ipcMain, screen, app, globalShortcut } = require("electron");
const path = require("path"); // 引入 path 模块
const fs = require("fs");     // 引入 fs 模块

// 使用 path.join 而不是直接用 join
const CONFIG_PATH = path.join(app.getPath("userData"), "key-config.json");
const BOUNDS_PATH = path.join(app.getPath("userData"), "window-bounds.json");

class FluxCore {
	constructor() {
		this.window = null;
		this.pluginLoader = null;
		// 默认快捷键映射 (ID -> 快捷键)
		this.keyMap = {
			BossKey: "Alt+Q",
			ImmersionMode: "Alt+W",
			"Video-Pause": "Alt+Space",
			"Video-Forward": "Alt+Right",
		};
		// 加载保存的窗口位置和大小
		this.savedBounds = this.loadWindowBounds();
		this.loadKeyConfig();
	}

	// 1. 加载本地配置
	loadKeyConfig() {
        try {
            // 必须使用 fs.existsSync
            if (fs.existsSync(CONFIG_PATH)) {
                const saved = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
                this.keyMap = { ...this.keyMap, ...saved };
                console.log("快捷键配置加载成功");
            }
        } catch (e) {
            console.error("加载快捷键配置失败", e);
        }
    }

	// 2. 保存配置
	saveKeyConfig(newMap) {
		this.keyMap = { ...this.keyMap, ...newMap };
		try {
			writeFileSync(CONFIG_PATH, JSON.stringify(this.keyMap, null, 2));
			// 重新注册所有快捷键
			this.pluginLoader.reloadShortcuts();
		} catch (e) {
			console.error("保存快捷键配置失败", e);
		}
	}

	// 读取本地窗口状态
	loadWindowBounds() {
        try {
            // 必须使用 fs.existsSync
            if (fs.existsSync(BOUNDS_PATH)) {
                return JSON.parse(fs.readFileSync(BOUNDS_PATH, "utf-8"));
            }
        } catch (e) {
            console.error("加载窗口位置配置失败", e);
        }
        return { width: 600, height: 400 };
    }

	// 保存当前窗口状态
	saveWindowBounds() {
		if (!this.window) return;
		try {
			// 获取当前窗口的坐标和宽高
			const bounds = this.window.getBounds();
			fs.writeFileSync(BOUNDS_PATH, JSON.stringify(bounds));
		} catch (e) {
			console.error("保存窗口位置失败", e);
		}
	}

	// 启动核心
	launch(PluginLoaderClass) {
		this.createWindow();
		this.setupResizeHandler();
		this.setupIpc();
		// 初始化插件加载器，把核心实例传给插件
		this.pluginLoader = new PluginLoaderClass(this);
		this.pluginLoader.loadAll();
	}

	setupIpc() {
		// 前端请求获取当前快捷键
		ipcMain.handle("get-shortcuts", () => {
			console.log("主进程：收到获取快捷键请求", this.keyMap);
			return this.keyMap;
		});

		// 前端请求保存快捷键
		ipcMain.on("save-shortcuts", (e, newMap) => {
			this.saveKeyConfig(newMap);
		});

		// 监听退出
		ipcMain.on("app-exit", () => {
			this.saveWindowBounds();
			app.quit();
	   });
	}

	createWindow() {
		let { x, y, width, height } = this.savedBounds;

		// 如果有保存的坐标，检查它是否在当前可见的屏幕范围内
		if (x !== undefined && y !== undefined) {
			const visible = screen.getDisplayMatching(this.savedBounds);
			if (!visible) {
				// 如果坐标不可见，重置为居中
				x = undefined;
				y = undefined;
			}
		}

		this.window = new BrowserWindow({
			x: x,
			y: y,
			width: width || 800,
			height: height || 600,
			frame: false, // 无边框
			transparent: true, // 透明背景
			alwaysOnTop: false,
			hasShadow: false,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				webviewTag: true, // 允许 <webview>
			},
		});

		this.window.on("close", () => {
			this.saveWindowBounds();
		});

		this.window.webContents.on("did-attach-webview", (event, webContents) => {
			// webContents 是 webview 内部的页面对象
			// setWindowOpenHandler 是 Electron 官方推荐的最强拦截方式
			webContents.setWindowOpenHandler(({ url }) => {
				// console.log("主进程拦截到跳转:", url);

				// 强制让 webview 自身加载这个 URL
				webContents.loadURL(url);

				// 返回 deny 彻底禁止系统创建新窗口
				return { action: "deny" };
			});
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

	// 5. 设置窗口是否置顶
	setAlwaysOnTop(flag) {
		if (this.window) {
			// level 参数 "screen-saver" 可以让置顶更高级，普通置顶用 flag 即可
			this.window.setAlwaysOnTop(flag);
		}
	}

	// 给 PluginLoader 用的辅助函数
	getKey(actionId) {
		return this.keyMap[actionId];
	}
}

module.exports = new FluxCore();
