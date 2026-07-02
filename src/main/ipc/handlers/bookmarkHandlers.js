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
		logger.debug("Git 配置不完整，无法同步");
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: "请先配置 Git 设置",
		});
		return;
	}

	if (!bookmarkSyncService.hasBookmarksFile()) {
		logger.debug("书签文件不存在，无法同步");
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: "书签文件不存在",
		});
		return;
	}

	broadcastBookmarkSyncStatus(broadcast, {
		status: "syncing",
		message: "正在同步...",
	});

	try {
		const result = await bookmarkSyncService.sync(config);
		if (result.changed) {
			logger.debug("Git 同步成功");
			broadcastBookmarkSyncStatus(broadcast, {
				success: true,
				message: "同步成功",
			});
			return;
		}

		logger.debug("没有变更需要同步");
		broadcastBookmarkSyncStatus(broadcast, {
			success: true,
			message: "没有变更需要同步",
		});
	} catch (error) {
		logger.debug(`Git 同步失败: ${error.message}`);
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: `同步失败: ${error.message}`,
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
		logger.debug("Git 配置不完整，无法拉取");
		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: "请先配置 Git 设置",
		});
		return;
	}

	broadcastBookmarkSyncStatus(broadcast, {
		status: "pulling",
		message: "正在拉取...",
	});

	try {
		logger.debug("正在获取远程分支信息...");
		const result = await bookmarkSyncService.pull(config);
		logger.debug(`远程默认分支: ${result.defaultBranch}`);

		logger.debug("Git 拉取成功");
		broadcastBookmarkSyncStatus(broadcast, {
			success: true,
			message: "拉取成功",
		});
		broadcast("bookmarks-data", result.bookmarks);
	} catch (error) {
		logger.debug(`Git 拉取失败: ${error.message}`);
		if (
			error.message.includes("Couldn") ||
			error.message.includes("connection") ||
			error.message.includes("connect")
		) {
			broadcastBookmarkSyncStatus(broadcast, {
				success: false,
				message: "网络连接失败，请检查网络或代理设置",
			});
			return;
		}

		broadcastBookmarkSyncStatus(broadcast, {
			success: false,
			message: `拉取失败: ${error.message}`,
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
