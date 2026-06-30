function registerSyncHandlers({ ipcMain, gitSyncManager, broadcast, logger }) {
	ipcMain.on("sync-all", () => {
		gitSyncManager.pushAll((data) => {
			broadcast("sync-all-status", data);
		});
	});

	ipcMain.on("pull-all", () => {
		gitSyncManager.pullAll((data) => {
			broadcast("sync-all-status", data);
		});
	});

	ipcMain.handle("get-sync-files", () => {
		return gitSyncManager.getSyncFiles();
	});

	ipcMain.on("export-configs", () => {
		const result = gitSyncManager.exportConfigs();
		if (result.success) {
			logger.debug("配置已导出到同步目录");
			broadcast("sync-all-status", { success: true, message: "配置已导出" });
		} else {
			broadcast("sync-all-status", {
				success: false,
				message: `导出失败: ${result.error}`,
			});
		}
	});

	ipcMain.on("import-configs", () => {
		const result = gitSyncManager.importConfigs();
		if (result.success) {
			const msg = `已导入: ${result.imported.join(", ")}`;
			logger.debug(msg);
			broadcast("sync-all-status", {
				success: true,
				message: msg,
				imported: result.imported,
			});
		} else {
			broadcast("sync-all-status", {
				success: false,
				message: `导入失败: ${result.error}`,
			});
		}
	});
}

module.exports = registerSyncHandlers;
