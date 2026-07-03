const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const configManager = require("../../ConfigManager");
const { t } = require("../../i18n");
const { CONFIG_FILES } = require("./constants");

class SyncDataStore {
	constructor(logger) {
		this.logger = logger;
		this.userDataPath = app.getPath("userData");
		this.syncDataPath = path.join(this.userDataPath, "sync-data");

		if (!fs.existsSync(this.syncDataPath)) {
			fs.mkdirSync(this.syncDataPath, { recursive: true });
		}
	}

	getSyncDataPath() {
		return this.syncDataPath;
	}

	getEnvPrefix() {
		return app.isPackaged ? "" : "dev-";
	}

	exportConfigs() {
		try {
			const keyConfig = configManager.getKeyConfig();
			const boundsConfig = configManager.getBoundsConfig();
			const resolutionPresets = configManager.getResolutionPresets();
			const isDev = !app.isPackaged;
			const prefix = this.getEnvPrefix();

			fs.writeFileSync(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.KEY_CONFIG}`),
				JSON.stringify(keyConfig, null, 2),
			);
			fs.writeFileSync(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.BOUNDS_CONFIG}`),
				JSON.stringify(boundsConfig, null, 2),
			);
			fs.writeFileSync(
				path.join(
					this.syncDataPath,
					`${prefix}${CONFIG_FILES.RESOLUTION_PRESETS}`,
				),
				JSON.stringify(resolutionPresets, null, 2),
			);

			const bookmarksDir = path.join(this.userDataPath, "bookmarks");
			const bookmarksFileName = isDev ? "bookmarks-dev.json" : "bookmarks.json";
			const bookmarksSrc = path.join(bookmarksDir, bookmarksFileName);
			const bookmarksDst = path.join(this.syncDataPath, bookmarksFileName);

			if (fs.existsSync(bookmarksSrc)) {
				fs.copyFileSync(bookmarksSrc, bookmarksDst);
			}

			const metadata = {
				exportedAt: new Date().toISOString(),
				appVersion: app.getVersion(),
				platform: process.platform,
				isDev,
			};
			fs.writeFileSync(
				path.join(this.syncDataPath, "metadata.json"),
				JSON.stringify(metadata, null, 2),
			);

			this.logger.debug("logs.syncData.exportCompleted");
			return { success: true, path: this.syncDataPath };
		} catch (error) {
			this.logger.debug(
				t("logs.syncData.exportFailed", {
					message: error.message,
				}),
			);
			return { success: false, error: error.message };
		}
	}

	importConfigs() {
		try {
			const isDev = !app.isPackaged;
			const prefix = this.getEnvPrefix();
			const results = { imported: [], failed: [] };

			this.importJsonConfig(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.KEY_CONFIG}`),
				(data) => configManager.saveKeyConfig(data),
				t("settings.syncAll.includeShortcuts"),
				results,
			);
			this.importJsonConfig(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.BOUNDS_CONFIG}`),
				(data) => configManager.saveBoundsConfig(data),
				t("settings.syncAll.includeWindowBounds"),
				results,
			);
			this.importJsonConfig(
				path.join(
					this.syncDataPath,
					`${prefix}${CONFIG_FILES.RESOLUTION_PRESETS}`,
				),
				(data) => configManager.saveResolutionPresets(data),
				t("settings.syncAll.includeResolutionPresets"),
				results,
			);

			const bookmarksFileName = isDev ? "bookmarks-dev.json" : "bookmarks.json";
			const bookmarksDst = path.join(this.userDataPath, "bookmarks", bookmarksFileName);
			const bookmarksSrc = path.join(this.syncDataPath, bookmarksFileName);

			if (fs.existsSync(bookmarksSrc)) {
				try {
					const bookmarksDir = path.dirname(bookmarksDst);
					if (!fs.existsSync(bookmarksDir)) {
						fs.mkdirSync(bookmarksDir, { recursive: true });
					}
					fs.copyFileSync(bookmarksSrc, bookmarksDst);
					results.imported.push(t("settings.syncAll.includeBookmarks"));
				} catch (error) {
					results.failed.push(
						t("logs.syncData.importItemFailed", {
							item: t("settings.syncAll.includeBookmarks"),
							message: error.message,
						}),
					);
				}
			}

			this.logger.debug(
				t("logs.syncData.importCompleted", {
					imported: results.imported.length,
					failed: results.failed.length,
				}),
			);
			return { success: true, ...results };
		} catch (error) {
			this.logger.debug(
				t("logs.syncData.importFailed", {
					message: error.message,
				}),
			);
			return { success: false, error: error.message };
		}
	}

	importJsonConfig(filePath, saveConfig, label, results) {
		if (!fs.existsSync(filePath)) return;

		try {
			const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			saveConfig(data);
			results.imported.push(label);
		} catch (error) {
			results.failed.push(`${label}: ${error.message}`);
		}
	}

	getSyncFiles() {
		const files = [];
		if (fs.existsSync(this.syncDataPath)) {
			const items = fs.readdirSync(this.syncDataPath);
			for (const item of items) {
				const itemPath = path.join(this.syncDataPath, item);
				if (fs.statSync(itemPath).isFile()) {
					files.push(item);
				}
			}
		}
		return files;
	}
}

module.exports = SyncDataStore;
