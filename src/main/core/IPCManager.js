const configManager = require("../ConfigManager");
const registerWindowHandlers = require("../ipc/handlers/windowHandlers");
const registerConfigHandlers = require("../ipc/handlers/configHandlers");
const registerShortcutHandlers = require("../ipc/handlers/shortcutHandlers");
const registerAppHandlers = require("../ipc/handlers/appHandlers");
const registerSyncHandlers = require("../ipc/handlers/syncHandlers");
const registerBookmarkHandlers = require("../ipc/handlers/bookmarkHandlers");
const registerTabHandlers = require("../ipc/handlers/tabHandlers");
const registerLiveSubtitleHandlers = require("../ipc/handlers/liveSubtitleHandlers");
const LiveSubtitleMonitor = require("../services/LiveSubtitleMonitor");
const LiveSubtitleAnalysisCoordinator = require("../services/LiveSubtitleAnalysisCoordinator");
const SubtitleKeywordDetector = require("../services/SubtitleKeywordDetector");
const DirectionKeywordDetector = require("../services/DirectionKeywordDetector");
const {
	createIPCServices,
	createIPCSharedContext,
} = require("./ipcContextFactory");
const {
	broadcastToWindows,
	sendToWindow,
	adjustWindowOpacity,
} = require("./ipcWindowOps");

class IPCManager {
	constructor(windowManager, pluginLoader, logger, tabStateManager) {
		this.windowManager = windowManager;
		this.pluginLoader = pluginLoader;
		this.logger = logger;
		this.tabStateManager = tabStateManager;
		this.currentOpacity = configManager.getBoundsConfig().opacity || 1.0;
		const services = createIPCServices(logger);
		this.gitSyncManager = services.gitSyncManager;
		this.bookmarkService = services.bookmarkService;
		this.bookmarkSyncService = services.bookmarkSyncService;
		this.liveSubtitleMonitor = new LiveSubtitleMonitor({
			logger,
			sendToMainWindow: this.sendToMainWindow.bind(this),
			broadcast: this.broadcast.bind(this),
		});
		this.subtitleKeywordDetector = new SubtitleKeywordDetector({
			logger,
			configManager,
			broadcast: this.broadcast.bind(this),
		});
		this.directionKeywordDetector = new DirectionKeywordDetector({
			logger,
			configManager,
			broadcast: this.broadcast.bind(this),
		});
		this.liveSubtitleAnalysisCoordinator = new LiveSubtitleAnalysisCoordinator({
			subtitleKeywordDetector: this.subtitleKeywordDetector,
			directionKeywordDetector: this.directionKeywordDetector,
		});
	}

	setupAllHandlers() {
		const sharedContext = createIPCSharedContext(this);

		registerWindowHandlers(sharedContext);
		registerConfigHandlers(sharedContext);
		registerShortcutHandlers(sharedContext);
		registerAppHandlers(sharedContext);
		registerBookmarkHandlers(sharedContext);
		registerSyncHandlers(sharedContext);
		registerTabHandlers(sharedContext);
		registerLiveSubtitleHandlers(sharedContext);
	}

	broadcast(channel, data) {
		broadcastToWindows(this.windowManager, channel, data);
	}

	sendToRenderer(channel, data) {
		this.broadcast(channel, data);
	}

	sendToMainWindow(channel, data) {
		sendToWindow(this.windowManager.getMainWindow(), channel, data);
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
