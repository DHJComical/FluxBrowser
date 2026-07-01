const configManager = require("./ConfigManager");
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
			const msg = `Git配置不完整，请填写: ${configCheck.missing.join(", ")}`;
			this.logger.debug(msg);
			broadcast({ success: false, message: msg });
			return;
		}

		// 导出当前配置
		const exportResult = this.exportConfigs();
		if (!exportResult.success) {
			broadcast({ success: false, message: `导出配置失败: ${exportResult.error}` });
			return;
		}

		const remoteUrl = this.buildRemoteUrl(config);
		broadcast({ status: "syncing", message: "正在同步所有配置..." });

		(async () => {
			try {
				await this.initGitRepo(this.syncDataPath, config);
				await this.setupRemote(this.syncDataPath, remoteUrl);
				await this.gitRuntime.markExcludedFiles(this.syncDataPath);
				await this._runGitCommand(this.syncDataPath, "add -A");
				const status = await this._runGitCommand(this.syncDataPath, "status --porcelain");
				
				if (status.trim()) {
					const timestamp = new Date().toLocaleString("zh-CN");
					await this._runGitCommand(this.syncDataPath, `commit -m "Sync all configs at ${timestamp}"`);
					await this._runGitCommand(this.syncDataPath, "push -u origin HEAD --force");
					this.logger.debug("Git推送成功");
					broadcast({ success: true, message: "所有配置同步成功!" });
				} else {
					this.logger.debug("没有变更需要同步");
					broadcast({ success: true, message: "没有变更需要同步" });
				}
			} catch (err) {
				this.logger.debug(`Git推送失败: ${this._filterPat(err.message)}`);
				broadcast({ success: false, message: `同步失败: ${err.message}` });
			}
		})();
	}

	async pullAll(broadcast) {
		const config = configManager.getAppConfig();
		const configCheck = this.checkGitConfig(config);

		if (!configCheck.valid) {
			const msg = `Git配置不完整，请填写: ${configCheck.missing.join(", ")}`;
			this.logger.debug(msg);
			broadcast({ success: false, message: msg });
			return;
		}

		const remoteUrl = this.buildRemoteUrl(config);
		broadcast({ status: "pulling", message: "正在从远程拉取配置..." });

		(async () => {
			try {
				await this.initGitRepo(this.syncDataPath, config);
				await this.setupRemote(this.syncDataPath, remoteUrl);
				await this._runGitCommand(this.syncDataPath, "fetch origin");
				const defaultBranch = await this.getRemoteDefaultBranch(this.syncDataPath);
				try {
					await this._runGitCommand(this.syncDataPath, `pull origin ${defaultBranch} --rebase`);
				} catch (_pullError) {
					this.logger.debug("首次同步或拉取冲突，使用force reset");
				}
				await this._runGitCommand(this.syncDataPath, `reset --hard origin/${defaultBranch}`);
				this.logger.debug("Git拉取成功");
				
				const importResult = this.importConfigs();
				
				if (importResult.success) {
					const msg = `拉取成功! 已导入: ${importResult.imported.join(", ")}`;
					broadcast({ success: true, message: msg, imported: importResult.imported });
				} else {
					broadcast({ success: false, message: `拉取成功但导入失败: ${importResult.error}` });
				}
			} catch (err) {
				this.logger.debug(`Git拉取失败: ${this._filterPat(err.message)}`);
				const userMsg = mapPullErrorMessage(err.message);
				broadcast({ success: false, message: `拉取失败: ${userMsg}` });
			}
		})();
	}
}

module.exports = GitSyncManager;
module.exports.CONFIG_FILES = CONFIG_FILES;
