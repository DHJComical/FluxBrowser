const configManager = require("./ConfigManager");
const { t } = require("./i18n");
const GitRuntime = require("./services/gitSync/gitRuntime");
const SyncDataStore = require("./services/gitSync/syncDataStore");
const {
	CONFIG_FILES,
} = require("./services/gitSync/constants");
const {
	filterPat,
	checkGitConfig,
	buildRemoteUrl,
	mapPullErrorMessage,
} = require("./services/gitSync/gitSyncUtils");

class GitSyncManager {
	constructor(logger) {
		this.logger = logger;
		this.gitRuntime = new GitRuntime(logger);
		this.syncDataStore = new SyncDataStore(logger);
		this.syncDataPath = this.syncDataStore.getSyncDataPath();
	}

	_filterPat(text) {
		return filterPat(text);
	}

	_runGitCommand(cwd, subCmd) {
		return this.gitRuntime.runGitCommand(cwd, subCmd);
	}

	async initGitRepo(cwd, config) {
		return this.gitRuntime.initGitRepo(cwd, config);
	}

	async setupRemote(cwd, remoteUrl) {
		return this.gitRuntime.setupRemote(cwd, remoteUrl);
	}

	async getRemoteDefaultBranch(cwd) {
		return this.gitRuntime.getRemoteDefaultBranch(cwd);
	}

	buildRemoteUrl(config) {
		return buildRemoteUrl(config);
	}

	checkGitConfig(config) {
		return checkGitConfig(config);
	}

	exportConfigs() {
		return this.syncDataStore.exportConfigs();
	}

	importConfigs() {
		return this.syncDataStore.importConfigs();
	}

	getSyncFiles() {
		return this.syncDataStore.getSyncFiles();
	}

	async pushAll(broadcast) {
		const config = configManager.getAppConfig();
		const configCheck = this.checkGitConfig(config);

		if (!configCheck.valid) {
			const msg = t("logs.gitSync.configMissing", {
				fields: configCheck.missing.join(", "),
			});
			this.logger.debug(msg);
			broadcast({ success: false, message: msg });
			return;
		}

		// 导出当前配置
		const exportResult = this.exportConfigs();
		if (!exportResult.success) {
			broadcast({
				success: false,
				message: t("logs.gitSync.exportFailed", {
					error: exportResult.error,
				}),
			});
			return;
		}

		const remoteUrl = this.buildRemoteUrl(config);
		broadcast({
			status: "syncing",
			message: t("logs.gitSync.syncingAll"),
		});

		(async () => {
			try {
				await this.initGitRepo(this.syncDataPath, config);
				await this.setupRemote(this.syncDataPath, remoteUrl);
				await this.gitRuntime.markExcludedFiles(this.syncDataPath);
				await this._runGitCommand(this.syncDataPath, "add -A");
				const status = await this._runGitCommand(this.syncDataPath, "status --porcelain");
				
				if (status.trim()) {
					const timestamp = new Date().toISOString();
					await this._runGitCommand(this.syncDataPath, `commit -m "Sync all configs at ${timestamp}"`);
					await this._runGitCommand(this.syncDataPath, "push -u origin HEAD --force");
					this.logger.debug("logs.gitSync.pushSuccess");
					broadcast({ success: true, message: t("logs.gitSync.pushSuccessMessage") });
				} else {
					this.logger.debug("logs.gitSync.noChanges");
					broadcast({ success: true, message: t("logs.gitSync.noChangesMessage") });
				}
			} catch (err) {
				this.logger.debug(
					t("logs.gitSync.pushFailed", {
						message: this._filterPat(err.message),
					}),
				);
				broadcast({
					success: false,
					message: t("logs.gitSync.syncFailedMessage", {
						message: err.message,
					}),
				});
			}
		})();
	}

	async pullAll(broadcast) {
		const config = configManager.getAppConfig();
		const configCheck = this.checkGitConfig(config);

		if (!configCheck.valid) {
			const msg = t("logs.gitSync.configMissing", {
				fields: configCheck.missing.join(", "),
			});
			this.logger.debug(msg);
			broadcast({ success: false, message: msg });
			return;
		}

		const remoteUrl = this.buildRemoteUrl(config);
		broadcast({
			status: "pulling",
			message: t("logs.gitSync.pullingAll"),
		});

		(async () => {
			try {
				await this.initGitRepo(this.syncDataPath, config);
				await this.setupRemote(this.syncDataPath, remoteUrl);
				await this._runGitCommand(this.syncDataPath, "fetch origin");
				const defaultBranch = await this.getRemoteDefaultBranch(this.syncDataPath);
				try {
					await this._runGitCommand(this.syncDataPath, `pull origin ${defaultBranch} --rebase`);
				} catch (_pullError) {
					this.logger.debug("logs.gitSync.pullForceReset");
				}
				await this._runGitCommand(this.syncDataPath, `reset --hard origin/${defaultBranch}`);
				this.logger.debug("logs.gitSync.pullSuccess");
				
				const importResult = this.importConfigs();
				
				if (importResult.success) {
					const msg = t("logs.gitSync.pullImported", {
						items: importResult.imported.join(", "),
					});
					broadcast({ success: true, message: msg, imported: importResult.imported });
				} else {
					broadcast({
						success: false,
						message: t("logs.gitSync.pullImportFailed", {
							error: importResult.error,
						}),
					});
				}
			} catch (err) {
				this.logger.debug(
					t("logs.gitSync.pullFailed", {
						message: this._filterPat(err.message),
					}),
				);
				const userMsg = mapPullErrorMessage(err.message);
				broadcast({
					success: false,
					message: t("logs.gitSync.pullFailedMessage", {
						message: userMsg,
					}),
				});
			}
		})();
	}
}

module.exports = GitSyncManager;
module.exports.CONFIG_FILES = CONFIG_FILES;
