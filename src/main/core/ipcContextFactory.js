const { ipcMain } = require("electron");
const configManager = require("../ConfigManager");
const GitSyncManager = require("../GitSyncManager");
const BookmarkService = require("../services/BookmarkService");
const BookmarkSyncService = require("../services/BookmarkSyncService");

function createIPCServices(logger) {
	const gitSyncManager = new GitSyncManager(logger);
	const bookmarkService = new BookmarkService(logger);
	const bookmarkSyncService = new BookmarkSyncService(
		bookmarkService,
		gitSyncManager,
	);

	return {
		gitSyncManager,
		bookmarkService,
		bookmarkSyncService,
	};
}

function createIPCSharedContext(ipcManager) {
	return {
		ipcMain,
		windowManager: ipcManager.windowManager,
		pluginLoader: ipcManager.pluginLoader,
		logger: ipcManager.logger,
		configManager,
		gitSyncManager: ipcManager.gitSyncManager,
		bookmarkService: ipcManager.bookmarkService,
		bookmarkSyncService: ipcManager.bookmarkSyncService,
		liveSubtitleMonitor: ipcManager.liveSubtitleMonitor,
		liveSubtitleAnalysisCoordinator: ipcManager.liveSubtitleAnalysisCoordinator,
		subtitleKeywordDetector: ipcManager.subtitleKeywordDetector,
		directionKeywordDetector: ipcManager.directionKeywordDetector,
		tabStateManager: ipcManager.tabStateManager,
		broadcast: ipcManager.broadcast.bind(ipcManager),
		sendToRenderer: ipcManager.sendToRenderer.bind(ipcManager),
		sendToMainWindow: ipcManager.sendToMainWindow.bind(ipcManager),
		getCurrentOpacity: ipcManager.getCurrentOpacity.bind(ipcManager),
		setCurrentOpacity: ipcManager.setCurrentOpacity.bind(ipcManager),
	};
}

module.exports = {
	createIPCServices,
	createIPCSharedContext,
};
