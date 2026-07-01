const configManager = require("../ConfigManager");
const { WINDOW_CONSTANTS } = require("../../constants/config");
const createMainWindow = require("../windows/MainWindow");
const createTabBarWindow = require("../windows/TabBarWindow");
const createSettingsWindow = require("../windows/SettingsWindow");
const createBookmarksWindow = require("../windows/BookmarksWindow");
const {
	focusBorderlessMaximizedApp,
	bringWindowToFront,
} = require("./windowFocusHelper");
const { collectActiveWindows } = require("./windowCollection");

class WindowManager {
	constructor() {
		this.mainWindow = null;
		this.tabBarWindow = null;
		this.settingsWindow = null;
		this.bookmarksWindow = null;
		this.shouldFocusMainWindowAfterSettingsClose = false;
		this.savedBounds = configManager.getBoundsConfig();
		this.userAlwaysOnTop = configManager.getAppConfig().alwaysOnTop === true;
		this.temporaryAlwaysOnTop = false;
		this.currentOpacity = this.savedBounds.opacity || 1.0;
		this.isImmersionMode = false;
	}

	createMainWindow(options = {}) {
		this.mainWindow = createMainWindow({
			savedBounds: this.savedBounds,
			userAlwaysOnTop: this.userAlwaysOnTop,
			onRequestNewTab: options.onRequestNewTab,
			onClose: () => {
				this.saveWindowBounds();
				if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
					this.tabBarWindow.destroy();
				}
				if (this.settingsWindow) this.settingsWindow.close();
			},
		});

		this.mainWindow.on("move", () => this.syncAuxiliaryWindows());
		this.mainWindow.on("resize", () => this.syncAuxiliaryWindows());
		this.mainWindow.on("show", () => this.showAuxiliaryWindows());
		this.mainWindow.on("hide", () => this.hideAuxiliaryWindows());
		this.mainWindow.on("focus", () => {
			if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
				this.tabBarWindow.moveTop();
			}
		});

		return this.mainWindow;
	}

	createTabBarWindow() {
		if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
			return this.tabBarWindow;
		}

		const bounds = this.getTabBarBounds();
		this.tabBarWindow = createTabBarWindow({
			bounds,
			alwaysOnTop: this.userAlwaysOnTop || this.temporaryAlwaysOnTop,
			onClose: () => {
				if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
					this.tabBarWindow.hide();
				}
			},
		});

		this.tabBarWindow.on("closed", () => {
			this.tabBarWindow = null;
		});

		this.syncAuxiliaryWindows();
		if (this.mainWindow && this.mainWindow.isVisible()) {
			this.tabBarWindow.showInactive();
		}

		return this.tabBarWindow;
	}

	getTabBarBounds() {
		const mainBounds = this.mainWindow
			? this.mainWindow.getBounds()
			: this.savedBounds;
		const height = WINDOW_CONSTANTS.TAB_BAR_HEIGHT;

		return {
			x: mainBounds.x,
			y: mainBounds.y - height,
			width: mainBounds.width,
			height,
		};
	}

	createSettingsWindow(parentWindow) {
		if (this.settingsWindow) {
			this.settingsWindow.focus();
			return this.settingsWindow;
		}

		this.settingsWindow = createSettingsWindow({
			parentWindow,
			onClosed: () => {
				this.settingsWindow = null;
				if (this.mainWindow && !this.mainWindow.isDestroyed()) {
					this.mainWindow.webContents.send("settings-window-closed");
				}
				if (this.shouldFocusMainWindowAfterSettingsClose) {
					this.shouldFocusMainWindowAfterSettingsClose = false;
					setTimeout(() => this.bringMainWindowToFront(), 0);
				}
			},
		});

		return this.settingsWindow;
	}

	saveWindowBounds() {
		if (this.mainWindow) {
			const bounds = this.mainWindow.getBounds();
			configManager.saveBoundsConfig(bounds);
		}
	}

	getMainWindow() {
		return this.mainWindow;
	}

	getSettingsWindow() {
		return this.settingsWindow;
	}

	getTabBarWindow() {
		return this.tabBarWindow;
	}

	toggleVisibility() {
		if (!this.mainWindow) return;
		if (this.mainWindow.isVisible()) {
			this.hideAuxiliaryWindows();
			this.mainWindow.hide();
			return;
		}

		this.mainWindow.show();
		this.showAuxiliaryWindows();
	}

	setAlwaysOnTop(flag) {
		this.temporaryAlwaysOnTop = flag === true;
		this.applyAlwaysOnTop();
	}

	setUserAlwaysOnTop(flag) {
		this.userAlwaysOnTop = flag === true;
		this.applyAlwaysOnTop();
	}

	applyAlwaysOnTop() {
		if (this.mainWindow) {
			const shouldAlwaysOnTop =
				this.userAlwaysOnTop || this.temporaryAlwaysOnTop;
			this.mainWindow.setAlwaysOnTop(shouldAlwaysOnTop, "screen-saver");
			if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
				this.tabBarWindow.setAlwaysOnTop(shouldAlwaysOnTop, "screen-saver");
			}
		}
	}

	setIgnoreMouseEvents(ignore) {
		if (this.mainWindow) {
			this.mainWindow.setIgnoreMouseEvents(ignore, { forward: ignore });
		}
		if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
			this.tabBarWindow.setIgnoreMouseEvents(ignore, { forward: ignore });
		}
	}

	setFocusable(focusable) {
		if (this.mainWindow) {
			this.mainWindow.setFocusable(focusable);
		}
		if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
			this.tabBarWindow.setFocusable(focusable);
		}
	}

	focusBorderlessMaximizedApp() {
		focusBorderlessMaximizedApp();
	}

	setWindowSize(
		width,
		height,
		titleBarHeight = WINDOW_CONSTANTS.TITLE_BAR_HEIGHT,
	) {
		if (this.mainWindow) {
			const currentBounds = this.mainWindow.getBounds();
			this.mainWindow.setBounds({
				x: currentBounds.x,
				y: currentBounds.y,
				width,
				height: height + titleBarHeight,
			});
			this.syncAuxiliaryWindows();
		}
	}

	getAllWindows() {
		return collectActiveWindows(this);
	}

	closeSettingsWindow() {
		if (this.settingsWindow) {
			this.settingsWindow.close();
			this.settingsWindow = null;
		}
	}

	focusMainWindowAfterSettingsClose() {
		this.shouldFocusMainWindowAfterSettingsClose = true;
	}

	bringMainWindowToFront() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		bringWindowToFront(this.mainWindow);
		if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
			this.tabBarWindow.moveTop();
		}
		if (!this.mainWindow.isAlwaysOnTop()) {
			this.applyAlwaysOnTop();
		}
	}

	createBookmarksWindow(parentWindow) {
		if (this.bookmarksWindow) {
			this.bookmarksWindow.focus();
			return this.bookmarksWindow;
		}

		this.bookmarksWindow = createBookmarksWindow({
			parentWindow,
			onClosed: () => {
				this.bookmarksWindow = null;
			},
		});

		return this.bookmarksWindow;
	}

	syncAuxiliaryWindows() {
		if (
			!this.mainWindow ||
			this.mainWindow.isDestroyed() ||
			!this.tabBarWindow ||
			this.tabBarWindow.isDestroyed()
		) {
			return;
		}

		const tabBarBounds = this.getTabBarBounds();
		this.tabBarWindow.setBounds(tabBarBounds);
		if (this.isImmersionMode) {
			this.tabBarWindow.hide();
		}
	}

	showAuxiliaryWindows() {
		if (
			this.tabBarWindow &&
			!this.tabBarWindow.isDestroyed() &&
			!this.isImmersionMode
		) {
			this.tabBarWindow.showInactive();
		}
	}

	hideAuxiliaryWindows() {
		if (this.tabBarWindow && !this.tabBarWindow.isDestroyed()) {
			this.tabBarWindow.hide();
		}
	}

	setImmersionMode(isImmersionMode) {
		this.isImmersionMode = isImmersionMode === true;
		if (this.isImmersionMode) {
			this.hideAuxiliaryWindows();
			return;
		}

		this.syncAuxiliaryWindows();
		if (this.mainWindow && this.mainWindow.isVisible()) {
			this.showAuxiliaryWindows();
		}
	}
}

module.exports = WindowManager;
