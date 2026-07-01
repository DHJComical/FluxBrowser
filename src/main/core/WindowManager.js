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
		this.pendingWebviewSizeTarget = null;
		this.webviewSizeCalibrationId = 0;
		this.webviewSizeMeasurementTimer = null;
		this.preImmersionBounds = null;
		this.normalWindowBounds = null;
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

		this.normalWindowBounds = this.normalizeBounds(this.mainWindow.getBounds());
		this.mainWindow.on("move", () => {
			this.rememberNormalWindowBounds();
			this.syncAuxiliaryWindows();
		});
		this.mainWindow.on("resize", () => {
			this.rememberNormalWindowBounds();
			this.syncAuxiliaryWindows();
		});
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
			const bounds =
				this.isImmersionMode && this.normalWindowBounds
					? this.normalWindowBounds
					: this.mainWindow.getBounds();
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
			const calibrationId = ++this.webviewSizeCalibrationId;
			this.pendingWebviewSizeTarget = {
				id: calibrationId,
				width,
				height,
				attempt: 0,
			};
			const nextBounds = {
				x: currentBounds.x,
				y: currentBounds.y,
				width,
				height: height + titleBarHeight,
			};
			this.mainWindow.setBounds(nextBounds);
			this.rememberNormalWindowBounds(nextBounds);
			this.syncAuxiliaryWindows();
			this.requestWebviewSizeMeasurement();
		}
	}

	requestWebviewSizeMeasurement() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
		if (!this.pendingWebviewSizeTarget) return;

		const { id, width, height, attempt } = this.pendingWebviewSizeTarget;
		if (this.webviewSizeMeasurementTimer) {
			clearTimeout(this.webviewSizeMeasurementTimer);
		}

		this.webviewSizeMeasurementTimer = setTimeout(() => {
			if (!this.mainWindow || this.mainWindow.isDestroyed()) return;
			if (!this.pendingWebviewSizeTarget) return;
			if (this.pendingWebviewSizeTarget.id !== id) return;

			this.mainWindow.webContents.send("measure-webview-size", {
				calibrationId: id,
				targetWidth: width,
				targetHeight: height,
				attempt,
			});
		}, 40);
	}

	cancelWebviewSizeCalibration() {
		this.webviewSizeCalibrationId += 1;
		this.pendingWebviewSizeTarget = null;
		if (this.webviewSizeMeasurementTimer) {
			clearTimeout(this.webviewSizeMeasurementTimer);
			this.webviewSizeMeasurementTimer = null;
		}
	}

	calibrateWebviewSize(measurement = {}) {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return false;
		if (!this.pendingWebviewSizeTarget) return false;
		if (measurement.calibrationId !== this.pendingWebviewSizeTarget.id) {
			return false;
		}

		const targetWidth = Number(this.pendingWebviewSizeTarget.width);
		const targetHeight = Number(this.pendingWebviewSizeTarget.height);
		const actualWidth = Number(measurement.actualWidth);
		const actualHeight = Number(measurement.actualHeight);

		if (
			!Number.isFinite(targetWidth) ||
			!Number.isFinite(targetHeight) ||
			!Number.isFinite(actualWidth) ||
			!Number.isFinite(actualHeight)
		) {
			return false;
		}

		const deltaWidth = targetWidth - actualWidth;
		const deltaHeight = targetHeight - actualHeight;
		const isSettled = Math.abs(deltaWidth) <= 1 && Math.abs(deltaHeight) <= 1;

		if (isSettled) {
			this.pendingWebviewSizeTarget = null;
			return true;
		}

		const attempt = this.pendingWebviewSizeTarget.attempt + 1;
		if (attempt > 4) {
			this.pendingWebviewSizeTarget = null;
			return false;
		}

		this.pendingWebviewSizeTarget.attempt = attempt;
		const currentBounds = this.mainWindow.getBounds();
		const nextBounds = {
			x: currentBounds.x,
			y: currentBounds.y,
			width: Math.max(WINDOW_CONSTANTS.MIN_WIDTH, currentBounds.width + deltaWidth),
			height: Math.max(
				WINDOW_CONSTANTS.MIN_HEIGHT,
				currentBounds.height + deltaHeight,
			),
		};
		this.mainWindow.setBounds(nextBounds);
		this.rememberNormalWindowBounds(nextBounds);
		this.syncAuxiliaryWindows();
		this.requestWebviewSizeMeasurement();
		return false;
	}

	enterImmersionMode(
		titleBarHeight = null,
	) {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) {
			return this.isImmersionMode;
		}
		if (this.isImmersionMode) return true;

		this.cancelWebviewSizeCalibration();
		const currentBounds = this.normalWindowBounds
			? this.normalizeBounds(this.normalWindowBounds)
			: this.normalizeBounds(this.mainWindow.getBounds());
		const chromeHeight =
			titleBarHeight || this.getContentChromeHeight(currentBounds.width);
		this.normalWindowBounds = currentBounds;
		this.preImmersionBounds = currentBounds;
		this.setImmersionMode(true);
		this.mainWindow.setBounds({
			x: currentBounds.x,
			y: currentBounds.y + chromeHeight,
			width: currentBounds.width,
			height: Math.max(
				WINDOW_CONSTANTS.MIN_HEIGHT,
				currentBounds.height - chromeHeight,
			),
		});
		return true;
	}

	exitImmersionMode() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) {
			return this.isImmersionMode;
		}
		if (!this.isImmersionMode) return false;

		this.cancelWebviewSizeCalibration();
		const restoreBounds = this.normalWindowBounds
			? this.normalizeBounds(this.normalWindowBounds)
			: this.preImmersionBounds
				? this.normalizeBounds(this.preImmersionBounds)
				: null;

		if (restoreBounds) {
			this.mainWindow.setBounds(restoreBounds);
			this.normalWindowBounds = restoreBounds;
		}
		this.preImmersionBounds = null;
		this.setImmersionMode(false);
		return false;
	}

	toggleImmersionMode(titleBarHeight = null) {
		if (this.isImmersionMode) {
			return this.exitImmersionMode();
		}

		return this.enterImmersionMode(titleBarHeight);
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

	getContentChromeHeight(width) {
		return width <= 860 ? 64 : WINDOW_CONSTANTS.TITLE_BAR_HEIGHT;
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
