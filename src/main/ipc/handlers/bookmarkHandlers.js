function registerBookmarkHandlers({
	ipcMain,
	windowManager,
	bookmarkService,
	gitSyncManager,
	configManager,
	broadcast,
	logger,
}) {
	ipcMain.on("add-bookmark", (_event, bookmark) => {
		bookmarkService.addBookmark(bookmark);
	});

	ipcMain.on("sync-bookmarks", () => {
		const config = configManager.getAppConfig();
		if (!config.gitPat || !config.gitRemote) {
			logger.debug("Git 配置不完整，无法同步");
			broadcast("bookmark-sync-status", {
				success: false,
				message: "请先配置 Git 设置",
			});
			return;
		}

		const cwd = bookmarkService.getBookmarksDir();
		const fileName = bookmarkService.getBookmarksFileName();
		const bookmarksFile = bookmarkService.getBookmarksPath();

		if (!require("fs").existsSync(bookmarksFile)) {
			logger.debug("书签文件不存在，无法同步");
			broadcast("bookmark-sync-status", {
				success: false,
				message: "书签文件不存在",
			});
			return;
		}

		const remoteUrl = `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;

		broadcast("bookmark-sync-status", {
			status: "syncing",
			message: "正在同步...",
		});

		(async () => {
			try {
				await gitSyncManager.initGitRepo(cwd, config);
				await gitSyncManager.setupRemote(cwd, remoteUrl);
				await gitSyncManager._runGitCommand(cwd, `add -f "${fileName}"`);

				const status = await gitSyncManager._runGitCommand(
					cwd,
					"status --porcelain",
				);
				if (status.trim()) {
					await gitSyncManager._runGitCommand(
						cwd,
						'commit -m "更新书签"',
					);
					await gitSyncManager._runGitCommand(cwd, "push -u origin HEAD");
					logger.debug("Git 同步成功");
					broadcast("bookmark-sync-status", {
						success: true,
						message: "同步成功",
					});
				} else {
					logger.debug("没有变更需要同步");
					broadcast("bookmark-sync-status", {
						success: true,
						message: "没有变更需要同步",
					});
				}
			} catch (error) {
				logger.debug(`Git 同步失败: ${error.message}`);
				broadcast("bookmark-sync-status", {
					success: false,
					message: `同步失败: ${error.message}`,
				});
			}
		})();
	});

	ipcMain.on("pull-bookmarks", () => {
		const config = configManager.getAppConfig();
		if (!config.gitPat || !config.gitRemote) {
			logger.debug("Git 配置不完整，无法拉取");
			broadcast("bookmark-sync-status", {
				success: false,
				message: "请先配置 Git 设置",
			});
			return;
		}

		const cwd = bookmarkService.getBookmarksDir();
		const remoteUrl = `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;

		broadcast("bookmark-sync-status", {
			status: "pulling",
			message: "正在拉取...",
		});

		(async () => {
			try {
				await gitSyncManager.initGitRepo(cwd, config);
				await gitSyncManager.setupRemote(cwd, remoteUrl);
				logger.debug("正在获取远程分支信息...");
				await gitSyncManager._runGitCommand(cwd, "fetch origin");

				const defaultBranch = await gitSyncManager.getRemoteDefaultBranch(cwd);
				logger.debug(`远程默认分支: ${defaultBranch}`);

				await gitSyncManager._runGitCommand(
					cwd,
					`reset --hard origin/${defaultBranch}`,
				);

				logger.debug("Git 拉取成功");
				broadcast("bookmark-sync-status", {
					success: true,
					message: "拉取成功",
				});

				broadcast("bookmarks-data", bookmarkService.readBookmarks());
			} catch (error) {
				logger.debug(`Git 拉取失败: ${error.message}`);
				if (
					error.message.includes("Couldn") ||
					error.message.includes("connection") ||
					error.message.includes("connect")
				) {
					broadcast("bookmark-sync-status", {
						success: false,
						message: "网络连接失败，请检查网络或代理设置",
					});
				} else {
					broadcast("bookmark-sync-status", {
						success: false,
						message: `拉取失败: ${error.message}`,
					});
				}
			}
		})();
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
		const mainWindow = windowManager.getMainWindow();
		if (mainWindow) {
			const escapedUrl = bookmark.url.replace(/'/g, "\\'");
			const escapedTime = parseFloat(bookmark.time) || 0;
			mainWindow.webContents.send(
				"execute-webview-js",
				`window.location.href = '${escapedUrl}'; setTimeout(() => { const v = document.querySelector('video'); if(v) v.currentTime = ${escapedTime}; }, 2000);`,
			);
		}
	});
}

module.exports = registerBookmarkHandlers;
