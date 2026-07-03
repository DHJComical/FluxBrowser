const { t } = require("../../i18n");

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
			logger.debug("logs.sync.exported");
			broadcast("sync-all-status", {
				success: true,
				message: "messages.sync.exported",
			});
		} else {
			broadcast("sync-all-status", {
				success: false,
				message: t("messages.sync.exportFailed", {
					error: result.error,
				}),
			});
		}
	});

	ipcMain.on("import-configs", () => {
		const result = gitSyncManager.importConfigs();
		if (result.success) {
			const msg = t("messages.sync.imported", {
				items: result.imported.join(", "),
			});
			logger.debug(msg);
			broadcast("sync-all-status", {
				success: true,
				message: msg,
				imported: result.imported,
			});
		} else {
			broadcast("sync-all-status", {
				success: false,
				message: t("messages.sync.importFailed", {
					error: result.error,
				}),
			});
		}
	});
}

module.exports = registerSyncHandlers;
