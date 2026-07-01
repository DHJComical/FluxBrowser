const configManager = require("../ConfigManager");
const registerWindowHandlers = require("../ipc/handlers/windowHandlers");
const registerConfigHandlers = require("../ipc/handlers/configHandlers");
const registerShortcutHandlers = require("../ipc/handlers/shortcutHandlers");
const registerAppHandlers = require("../ipc/handlers/appHandlers");
const registerResizeHandlers = require("../ipc/handlers/resizeHandlers");
const registerMoveHandlers = require("../ipc/handlers/moveHandlers");
const registerSyncHandlers = require("../ipc/handlers/syncHandlers");
const registerBookmarkHandlers = require("../ipc/handlers/bookmarkHandlers");
const {
	createIPCServices,
	createIPCSharedContext,
} = require("./ipcContextFactory");
const { broadcastToWindows, adjustWindowOpacity } = require("./ipcWindowOps");

class IPCManager {
	constructor(windowManager, pluginLoader, logger) {
		this.windowManager = windowManager;
		this.pluginLoader = pluginLoader;
		this.logger = logger;
		this.currentOpacity = configManager.getBoundsConfig().opacity || 1.0;
		const services = createIPCServices(logger);
		this.gitSyncManager = services.gitSyncManager;
		this.bookmarkService = services.bookmarkService;
		this.bookmarkSyncService = services.bookmarkSyncService;
	}

	setupAllHandlers() {
		const sharedContext = createIPCSharedContext(this);

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
		broadcastToWindows(this.windowManager, channel, data);
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
		adjustWindowOpacity(this, delta);
	}
}

module.exports = IPCManager;
