const { ipcMain } = require("electron");
const configManager = require("../ConfigManager");
const GitSyncManager = require("../GitSyncManager");
const BookmarkService = require("../services/BookmarkService");
const BookmarkSyncService = require("../services/BookmarkSyncService");
const registerWindowHandlers = require("../ipc/handlers/windowHandlers");
const registerConfigHandlers = require("../ipc/handlers/configHandlers");
const registerShortcutHandlers = require("../ipc/handlers/shortcutHandlers");
const registerAppHandlers = require("../ipc/handlers/appHandlers");
const registerResizeHandlers = require("../ipc/handlers/resizeHandlers");
const registerMoveHandlers = require("../ipc/handlers/moveHandlers");
const registerSyncHandlers = require("../ipc/handlers/syncHandlers");
const registerBookmarkHandlers = require("../ipc/handlers/bookmarkHandlers");

class IPCManager {
	constructor(windowManager, pluginLoader, logger) {
		this.windowManager = windowManager;
		this.pluginLoader = pluginLoader;
		this.logger = logger;
		this.currentOpacity = configManager.getBoundsConfig().opacity || 1.0;
		this.gitSyncManager = new GitSyncManager(logger);
		this.bookmarkService = new BookmarkService(logger);
		this.bookmarkSyncService = new BookmarkSyncService(
			this.bookmarkService,
			this.gitSyncManager,
		);
	}

	setupAllHandlers() {
		const sharedContext = {
			ipcMain,
			windowManager: this.windowManager,
			pluginLoader: this.pluginLoader,
			logger: this.logger,
			configManager,
			gitSyncManager: this.gitSyncManager,
			bookmarkService: this.bookmarkService,
			bookmarkSyncService: this.bookmarkSyncService,
			broadcast: this.broadcast.bind(this),
			sendToRenderer: this.sendToRenderer.bind(this),
			getCurrentOpacity: this.getCurrentOpacity.bind(this),
			setCurrentOpacity: this.setCurrentOpacity.bind(this),
		};

		registerWindowHandlers(sharedContext);
		registerConfigHandlers(sharedContext);
		registerShortcutHandlers(sharedContext);
		registerAppHandlers(sharedContext);
		registerResizeHandlers(sharedContext);
		registerMoveHandlers(sharedContext);
		registerBookmarkHandlers(sharedContext);
		registerSyncHandlers(sharedContext);
	}

	broadcast(channel, data) {
		const windows = this.windowManager.getAllWindows();
		windows.forEach((win) => {
			if (win && !win.isDestroyed()) {
				win.webContents.send(channel, data);
			}
		});
	}

	sendToRenderer(channel, data) {
		this.broadcast(channel, data);
	}

	setCurrentOpacity(opacity) {
		this.currentOpacity = opacity;
	}

	getCurrentOpacity() {
		return this.currentOpacity;
	}

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
