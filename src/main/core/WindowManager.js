const configManager = require("../ConfigManager");
const createMainWindow = require("../windows/MainWindow");
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
		this.settingsWindow = null;
		this.bookmarksWindow = null;
		this.shouldFocusMainWindowAfterSettingsClose = false;
		this.savedBounds = configManager.getBoundsConfig();
		this.userAlwaysOnTop = configManager.getAppConfig().alwaysOnTop === true;
		this.temporaryAlwaysOnTop = false;
		this.currentOpacity = this.savedBounds.opacity || 1.0;
	}

	createMainWindow() {
		this.mainWindow = createMainWindow({
			savedBounds: this.savedBounds,
			userAlwaysOnTop: this.userAlwaysOnTop,
			onClose: () => {
				this.saveWindowBounds();
				if (this.settingsWindow) this.settingsWindow.close();
			},
		});

		return this.mainWindow;
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

	toggleVisibility() {
		if (!this.mainWindow) return;
		this.mainWindow.isVisible()
			? this.mainWindow.hide()
			: this.mainWindow.show();
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
		}
	}

	setIgnoreMouseEvents(ignore) {
		if (this.mainWindow) {
			this.mainWindow.setIgnoreMouseEvents(ignore, { forward: ignore });
		}
	}

	setFocusable(focusable) {
		if (this.mainWindow) {
			this.mainWindow.setFocusable(focusable);
		}
	}

	focusBorderlessMaximizedApp() {
		focusBorderlessMaximizedApp();
	}

	setWindowSize(width, height, titleBarHeight = 40) {
		if (this.mainWindow) {
			const currentBounds = this.mainWindow.getBounds();
			this.mainWindow.setBounds({
				x: currentBounds.x,
				y: currentBounds.y,
				width,
				height: height + titleBarHeight,
			});
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
}

module.exports = WindowManager;
