const { BrowserWindow, screen, app } = require("electron");
const path = require("path");
const configManager = require("../ConfigManager");

class WindowManager {
	constructor() {
		this.mainWindow = null;
		this.settingsWindow = null;
		this.savedBounds = configManager.getBoundsConfig();
		this.currentOpacity = this.savedBounds.opacity || 1.0;
	}

	// 创建主窗口
	createMainWindow() {
		let { x, y, width, height } = this.savedBounds;

		// 获取应用根目录
		const appPath = app.getAppPath();
		const iconPath = path.join(appPath, "resources/image/FluxBrowser-icon.ico");

		this.mainWindow = new BrowserWindow({
			x: x,
			y: y,
			width: width || 800,
			height: height || 600,
			minWidth: 40, // 最小宽度（整个窗口）
			minHeight: 80, // 最小高度：40px标题栏 + 40px Webview区域
			frame: false,
			transparent: true,
			alwaysOnTop: false,
			hasShadow: false,
			icon: iconPath,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				webviewTag: true,
				javascript: true,
			},
		});

		this.mainWindow.setMenu(null);
		this.mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));

		this.mainWindow.on("close", () => {
			this.saveWindowBounds();
			if (this.settingsWindow) this.settingsWindow.close();
		});

		// 拦截新窗口跳转
		this.mainWindow.webContents.on("did-attach-webview", (event, wc) => {
			wc.setWindowOpenHandler(({ url }) => {
				wc.loadURL(url);
				return { action: "deny" };
			});
		});

		return this.mainWindow;
	}

	// 创建设置窗口
	createSettingsWindow(parentWindow) {
		if (this.settingsWindow) {
			this.settingsWindow.focus();
			return this.settingsWindow;
		}

		// 获取应用根目录
		const appPath = app.getAppPath();
		const iconPath = path.join(appPath, "resources/image/FluxBrowser-icon.ico");

		// 获取屏幕尺寸
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width: screenWidth, height: screenHeight } =
			primaryDisplay.workAreaSize;

		// 计算窗口居中位置
		const windowWidth = 800;
		const windowHeight = 600;
		const x = Math.round((screenWidth - windowWidth) / 2);
		const y = Math.round((screenHeight - windowHeight) / 2);

		this.settingsWindow = new BrowserWindow({
			x: x,
			y: y,
			width: windowWidth,
			height: windowHeight,
			minWidth: 700,
			minHeight: 500,
			parent: parentWindow,
			title: "FluxBrowser 设置",
			icon: iconPath,
			backgroundColor: "#1e1e1e",
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		this.settingsWindow.setMenu(null);
		this.settingsWindow.loadFile(
			path.join(__dirname, "../../renderer/settings.html"),
		);

		this.settingsWindow.on("closed", () => {
			this.settingsWindow = null;
		});

		return this.settingsWindow;
	}

	// 保存窗口尺寸和位置
	saveWindowBounds() {
		if (this.mainWindow) {
			const bounds = this.mainWindow.getBounds();
			configManager.saveBoundsConfig(bounds);
		}
	}

	// 获取主窗口
	getMainWindow() {
		return this.mainWindow;
	}

	// 获取设置窗口
	getSettingsWindow() {
		return this.settingsWindow;
	}

	// 切换窗口显示状态
	toggleVisibility() {
		if (!this.mainWindow) return;
		this.mainWindow.isVisible()
			? this.mainWindow.hide()
			: this.mainWindow.show();
	}

	// 设置窗口置顶状态
	setAlwaysOnTop(flag) {
		if (this.mainWindow) this.mainWindow.setAlwaysOnTop(flag, "screen-saver");
	}

	// 设置鼠标穿透
	setIgnoreMouseEvents(ignore) {
		if (this.mainWindow) {
			this.mainWindow.setIgnoreMouseEvents(ignore, { forward: ignore });
		}
	}

	// 设置窗口大小
	setWindowSize(width, height, titleBarHeight = 40) {
		if (this.mainWindow) {
			const currentBounds = this.mainWindow.getBounds();
			this.mainWindow.setBounds({
				x: currentBounds.x,
				y: currentBounds.y,
				width: width,
				height: height + titleBarHeight,
			});
		}
	}

	// 获取所有窗口
	getAllWindows() {
		const windows = [];
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			windows.push(this.mainWindow);
		}
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			windows.push(this.settingsWindow);
		}
		return windows;
	}

	// 关闭设置窗口
	closeSettingsWindow() {
		if (this.settingsWindow) {
			this.settingsWindow.close();
			this.settingsWindow = null;
		}
	}
}

module.exports = WindowManager;
