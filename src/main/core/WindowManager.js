const configManager = require("../ConfigManager");
const createMainWindow = require("../windows/MainWindow");
const createSettingsWindow = require("../windows/SettingsWindow");
const createBookmarksWindow = require("../windows/BookmarksWindow");
const { t } = require("../i18n");
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
		this.isImmersionMode = false;
		this.normalWindowBounds = null;
	}

	createMainWindow(options = {}) {
		this.mainWindow = createMainWindow({
			userAlwaysOnTop: this.userAlwaysOnTop,
			onRequestNewTab: options.onRequestNewTab,
			onClose: () => {
				this.saveWindowBounds();
				if (this.settingsWindow) this.settingsWindow.close();
			},
		});

		this.normalWindowBounds = this.normalizeBounds(this.mainWindow.getBounds());
		this.mainWindow.on("move", () => {
			this.rememberNormalWindowBounds();
		});
		this.mainWindow.on("resize", () => {
			this.rememberNormalWindowBounds();
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
		if (!this.mainWindow) return;

		const bounds =
			this.isImmersionMode && this.normalWindowBounds
				? this.normalWindowBounds
				: this.mainWindow.getBounds();
		configManager.saveBoundsConfig(bounds);
	}

	getMainWindow() {
		return this.mainWindow;
	}

	getSettingsWindow() {
		return this.settingsWindow;
	}

	toggleVisibility() {
		if (!this.mainWindow) return;

		if (this.mainWindow.isVisible()) {
			this.mainWindow.hide();
			return;
		}

		this.mainWindow.show();
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
		if (!this.mainWindow) return;

		const shouldAlwaysOnTop = this.userAlwaysOnTop || this.temporaryAlwaysOnTop;
		this.mainWindow.setAlwaysOnTop(shouldAlwaysOnTop, "screen-saver");
	}

	setIgnoreMouseEvents(ignore, options = {}) {
		if (this.mainWindow) {
			const shouldIgnore = ignore === true;
			if (!shouldIgnore) {
				this.mainWindow.setIgnoreMouseEvents(false);
				return;
			}

			const forward =
				typeof options.forward === "boolean" ? options.forward : true;
			this.mainWindow.setIgnoreMouseEvents(true, { forward });
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

	setWindowSize(width, height) {
		if (this.mainWindow) {
			this.mainWindow.webContents.send("set-webview-panel-size", {
				width,
				height,
			});
		}
	}

	enterImmersionMode() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) {
			return this.isImmersionMode;
		}
		if (this.isImmersionMode) return true;

		this.setImmersionMode(true);
		return true;
	}

	exitImmersionMode() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) {
			return this.isImmersionMode;
		}
		if (!this.isImmersionMode) return false;

		this.setImmersionMode(false);
		return false;
	}

	toggleImmersionMode() {
		if (this.isImmersionMode) {
			return this.exitImmersionMode();
		}

		return this.enterImmersionMode();
	}

	getImmersionMode() {
		return this.isImmersionMode;
	}

	normalizeBounds(bounds) {
		return {
			x: Math.round(bounds.x),
			y: Math.round(bounds.y),
			width: Math.round(bounds.width),
			height: Math.round(bounds.height),
		};
	}

	rememberNormalWindowBounds(bounds = null) {
		if (this.isImmersionMode) return;
		if (!bounds && (!this.mainWindow || this.mainWindow.isDestroyed())) return;

		const nextBounds = bounds || this.mainWindow.getBounds();
		this.normalWindowBounds = this.normalizeBounds(nextBounds);
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

	updateWindowTitles() {
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			this.settingsWindow.setTitle(t("windows.settings.title"));
		}
		if (this.bookmarksWindow && !this.bookmarksWindow.isDestroyed()) {
			this.bookmarksWindow.setTitle(t("windows.bookmarks.title"));
		}
	}

	setImmersionMode(isImmersionMode) {
		this.isImmersionMode = isImmersionMode === true;
	}
}

module.exports = WindowManager;
