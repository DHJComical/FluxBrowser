const { t } = require("../../i18n");

function broadcastBookmarkSyncStatus(broadcast, data) {
	broadcast("bookmark-sync-status", data);
}

async function syncBookmarks({
	bookmarkSyncService,
	configManager,
	broadcast,
	logger,
}) {
	const config = configManager.getAppConfig();
	if (!bookmarkSyncService.isGitConfigured(config)) {
		logger.debug("logs.bookmarks.sync.gitConfigMissing");
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: "messages.bookmarks.gitConfigRequired",
		});
		return;
	}

	if (!bookmarkSyncService.hasBookmarksFile()) {
		logger.debug("logs.bookmarks.sync.fileMissing");
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: "messages.bookmarks.fileMissing",
		});
		return;
	}

	broadcastBookmarkSyncStatus(broadcast, {
		status: "syncing",
		message: "messages.sync.syncing",
	});

	try {
		const result = await bookmarkSyncService.sync(config);
		if (result.changed) {
			logger.debug("logs.bookmarks.sync.success");
			broadcastBookmarkSyncStatus(broadcast, {
				success: true,
				message: "messages.sync.success",
			});
			return;
		}

		logger.debug("logs.bookmarks.sync.noChanges");
		broadcastBookmarkSyncStatus(broadcast, {
			success: true,
			message: "messages.sync.noChanges",
		});
	} catch (error) {
		logger.debug(
			t("logs.bookmarks.sync.failed", {
				message: error.message,
			}),
		);
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: t("messages.sync.failed", {
				message: error.message,
			}),
		});
	}
}

async function pullBookmarks({
	bookmarkSyncService,
	configManager,
	broadcast,
	logger,
}) {
	const config = configManager.getAppConfig();
	if (!bookmarkSyncService.isGitConfigured(config)) {
		logger.debug("logs.bookmarks.pull.gitConfigMissing");
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: "messages.bookmarks.gitConfigRequired",
		});
		return;
	}

	broadcastBookmarkSyncStatus(broadcast, {
		status: "pulling",
		message: "messages.sync.pulling",
	});

	try {
		logger.debug("logs.bookmarks.pull.fetchRemoteBranch");
		const result = await bookmarkSyncService.pull(config);
		logger.debug(
			t("logs.bookmarks.pull.defaultBranch", {
				branch: result.defaultBranch,
			}),
		);

		logger.debug("logs.bookmarks.pull.success");
		broadcastBookmarkSyncStatus(broadcast, {
			success: true,
			message: "messages.sync.pullSuccess",
		});
		broadcast("bookmarks-data", result.bookmarks);
	} catch (error) {
		logger.debug(
			t("logs.bookmarks.pull.failed", {
				message: error.message,
			}),
		);
		if (
			error.message.includes("Couldn") ||
			error.message.includes("connection") ||
			error.message.includes("connect")
		) {
			broadcastBookmarkSyncStatus(broadcast, {
				success: false,
				message: "messages.sync.networkFailed",
			});
			return;
		}

		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: t("messages.sync.pullFailed", {
				message: error.message,
			}),
		});
	}
}

function openBookmark(windowManager, bookmarkService, bookmark) {
	if (!bookmark || !bookmark.url) return null;

	const script = bookmarkService.buildOpenBookmarkScript(bookmark);
	if (!script) return null;

	return script;
}

function registerBookmarkHandlers({
	ipcMain,
	windowManager,
	bookmarkService,
	bookmarkSyncService,
	configManager,
	tabStateManager,
	sendToMainWindow,
	broadcast,
	logger,
}) {
	ipcMain.on("add-bookmark", (_event, bookmark) => {
		bookmarkService.addBookmark(bookmark);
	});

	ipcMain.on("sync-bookmarks", () => {
		syncBookmarks({
			bookmarkSyncService,
			configManager,
			broadcast,
			logger,
		});
	});

	ipcMain.on("pull-bookmarks", () => {
		pullBookmarks({
			bookmarkSyncService,
			configManager,
			broadcast,
			logger,
		});
	});

	ipcMain.on("open-bookmarks-window", () => {
		windowManager.createBookmarksWindow(windowManager.getMainWindow());
	});

	ipcMain.on("get-bookmarks", (event) => {
		event.sender.send("bookmarks-data", bookmarkService.readBookmarks());
	});

	ipcMain.on("delete-bookmark", (event, index) => {
		event.sender.send("bookmarks-data", bookmarkService.deleteBookmark(index));
	});

	ipcMain.on("open-bookmark", (_event, bookmark) => {
		const script = openBookmark(windowManager, bookmarkService, bookmark);
		if (!script) return;

		tabStateManager.createTab({
			url: bookmark.url,
			title: bookmark.title,
		});
		broadcast("tabs-state-changed", tabStateManager.getState());
		const activeTabId = tabStateManager.getActiveTabId();
		sendToMainWindow("active-tab-navigation", {
			tabId: activeTabId,
			url: bookmark.url,
		});
		sendToMainWindow("execute-active-tab-js", {
			tabId: activeTabId,
			code: script,
		});
		sendToMainWindow("focus-active-tab");
	});
}

module.exports = registerBookmarkHandlers;
