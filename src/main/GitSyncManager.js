/**
 * GitSyncManager - Git同步管理器
 * 负责将配置和书签同步到Git仓库
 */
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");
const configManager = require("./ConfigManager");

// 配置文件列表
const CONFIG_FILES = {
	KEY_CONFIG: "key-config.json",
	BOUNDS_CONFIG: "window-bounds.json",
	APP_CONFIG: "app-config.json",
	RESOLUTION_PRESETS: "resolution-presets.json",
	BOOKMARKS: "bookmarks.json"
};

class GitSyncManager {
	constructor(logger) {
		this.logger = logger;
		this.userDataPath = app.getPath("userData");
		this.syncDataPath = path.join(this.userDataPath, "sync-data");
		
		// 确保同步目录存在
		if (!fs.existsSync(this.syncDataPath)) {
			fs.mkdirSync(this.syncDataPath, { recursive: true });
		}
	}

	/**
	 * 过滤日志中的PAT敏感信息
	 */
	_filterPat(text) {
		if (!text) return "";
		return text.replace(/https:\/\/[^@]+@/g, "https://***@")
		           .replace(/[a-f0-9]{36,}/gi, "***PAT***");
	}

	/**
	 * 执行Git命令
	 */
	_runGitCommand(cwd, subCmd) {
		return new Promise((resolve, reject) => {
			const gitCmd = `git --git-dir="${path.join(cwd, ".git")}" --work-tree="${cwd}" ${subCmd}`;
			this.logger.debug(`执行Git命令: ${this._filterPat(gitCmd)}`);
			
			exec(gitCmd, { cwd }, (err, stdout, stderr) => {
				if (err) {
					this.logger.debug(`Git命令失败: ${this._filterPat(stderr || err.message)}`);
					reject(new Error(stderr || err.message));
				} else {
					resolve(stdout);
				}
			});
		});
	}

	/**
	 * 初始化Git仓库
	 */
	async initGitRepo(cwd, config) {
		const gitDir = path.join(cwd, ".git");
		const isNewRepo = !fs.existsSync(gitDir);

		if (isNewRepo) {
			await this._runGitCommand(cwd, "init");
		}

		// 设置用户信息
		await this._runGitCommand(cwd, `config user.name "${config.gitName || "FluxBrowser"}"`);
		await this._runGitCommand(cwd, `config user.email "${config.gitEmail || "fluxbrowser@example.com"}"`);
		await this._runGitCommand(cwd, "config credential.helper store");

		return isNewRepo;
	}

	/**
	 * 设置远程仓库
	 */
	async setupRemote(cwd, remoteUrl) {
		try {
			await this._runGitCommand(cwd, "remote remove origin");
		} catch (e) {
			// 忽略"remote不存在"的错误
		}
		await this._runGitCommand(cwd, `remote add origin ${remoteUrl}`);
	}

	/**
	 * 获取远程默认分支名
	 */
	async getRemoteDefaultBranch(cwd) {
		try {
			await this._runGitCommand(cwd, "rev-parse --verify origin/main");
			return "main";
		} catch (e1) {
			try {
				await this._runGitCommand(cwd, "rev-parse --verify origin/master");
				return "master";
			} catch (e2) {
				return "main";
			}
		}
	}

	/**
	 * 构建远程URL（包含认证信息）
	 */
	buildRemoteUrl(config) {
		if (!config.gitPat || !config.gitRemote) {
			return null;
		}
		return `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;
	}

	/**
	 * 检查Git配置是否完整
	 */
	checkGitConfig(config) {
		const errors = [];
		if (!config.gitPat) errors.push("GitHub PAT");
		if (!config.gitRemote) errors.push("远程仓库地址");
		if (!config.gitName) errors.push("Git用户名");
		if (!config.gitEmail) errors.push("Git邮箱");
		
		if (errors.length > 0) {
			return { valid: false, missing: errors };
		}
		return { valid: true };
	}

	/**
	 * 导出所有配置到同步目录
	 */
	exportConfigs() {
		try {
			const keyConfig = configManager.getKeyConfig();
			const boundsConfig = configManager.getBoundsConfig();
			const appConfig = configManager.getAppConfig();
			const resolutionPresets = configManager.getResolutionPresets();
			const isDev = !app.isPackaged;
			const prefix = isDev ? "dev-" : "";

			// 写入配置文件
			fs.writeFileSync(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.KEY_CONFIG}`),
				JSON.stringify(keyConfig, null, 2)
			);
			fs.writeFileSync(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.BOUNDS_CONFIG}`),
				JSON.stringify(boundsConfig, null, 2)
			);
			fs.writeFileSync(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.APP_CONFIG}`),
				JSON.stringify(appConfig, null, 2)
			);
			fs.writeFileSync(
				path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.RESOLUTION_PRESETS}`),
				JSON.stringify(resolutionPresets, null, 2)
			);

			// 复制书签文件
			const bookmarksDir = path.join(this.userDataPath, "bookmarks");
			const bookmarksFileName = isDev ? "bookmarks-dev.json" : "bookmarks.json";
			const bookmarksSrc = path.join(bookmarksDir, bookmarksFileName);
			const bookmarksDst = path.join(this.syncDataPath, bookmarksFileName);

			if (fs.existsSync(bookmarksSrc)) {
				fs.copyFileSync(bookmarksSrc, bookmarksDst);
			}

			// 写入元数据文件
			const metadata = {
				exportedAt: new Date().toISOString(),
				appVersion: app.getVersion(),
				platform: process.platform,
				isDev: isDev
			};
			fs.writeFileSync(
				path.join(this.syncDataPath, "metadata.json"),
				JSON.stringify(metadata, null, 2)
			);

			this.logger.debug("配置导出完成");
			return { success: true, path: this.syncDataPath };
		} catch (error) {
			this.logger.debug(`导出配置失败: ${error.message}`);
			return { success: false, error: error.message };
		}
	}

	/**
	 * 从同步目录导入所有配置
	 */
	importConfigs() {
		try {
			const isDev = !app.isPackaged;
			const prefix = isDev ? "dev-" : "";
			const results = { imported: [], failed: [] };

			// 导入快捷键配置
			const keyConfigPath = path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.KEY_CONFIG}`);
			if (fs.existsSync(keyConfigPath)) {
				try {
					const data = JSON.parse(fs.readFileSync(keyConfigPath, "utf-8"));
					configManager.saveKeyConfig(data);
					results.imported.push("快捷键配置");
				} catch (e) {
					results.failed.push(`快捷键配置: ${e.message}`);
				}
			}

			// 导入窗口边界配置
			const boundsConfigPath = path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.BOUNDS_CONFIG}`);
			if (fs.existsSync(boundsConfigPath)) {
				try {
					const data = JSON.parse(fs.readFileSync(boundsConfigPath, "utf-8"));
					configManager.saveBoundsConfig(data);
					results.imported.push("窗口边界配置");
				} catch (e) {
					results.failed.push(`窗口边界配置: ${e.message}`);
				}
			}

			// 导入应用配置
			const appConfigPath = path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.APP_CONFIG}`);
			if (fs.existsSync(appConfigPath)) {
				try {
					const data = JSON.parse(fs.readFileSync(appConfigPath, "utf-8"));
					configManager.saveAppConfig(data);
					results.imported.push("应用配置");
				} catch (e) {
					results.failed.push(`应用配置: ${e.message}`);
				}
			}

			// 导入分辨率预设
			const resolutionConfigPath = path.join(this.syncDataPath, `${prefix}${CONFIG_FILES.RESOLUTION_PRESETS}`);
			if (fs.existsSync(resolutionConfigPath)) {
				try {
					const data = JSON.parse(fs.readFileSync(resolutionConfigPath, "utf-8"));
					configManager.saveResolutionPresets(data);
					results.imported.push("分辨率预设");
				} catch (e) {
					results.failed.push(`分辨率预设: ${e.message}`);
				}
			}

			// 复制书签文件
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
					results.imported.push("书签");
				} catch (e) {
					results.failed.push(`书签: ${e.message}`);
				}
			}

			this.logger.debug(`配置导入完成: 成功${results.imported.length}项, 失败${results.failed.length}项`);
			return { success: true, ...results };
		} catch (error) {
			this.logger.debug(`导入配置失败: ${error.message}`);
			return { success: false, error: error.message };
		}
	}

	/**
	 * 获取需要同步的文件列表
	 */
	getSyncFiles() {
		const isDev = !app.isPackaged;
		const prefix = isDev ? "dev-" : "";
		const files = [];

		const syncDir = this.syncDataPath;
		if (fs.existsSync(syncDir)) {
			const items = fs.readdirSync(syncDir);
			for (const item of items) {
				const itemPath = path.join(syncDir, item);
				if (fs.statSync(itemPath).isFile()) {
					files.push(item);
				}
			}
		}

		return files;
	}

	/**
	 * 推送所有配置到远程仓库
	 */
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
				// 初始化Git仓库
				await this.initGitRepo(this.syncDataPath, config);

				// 设置远程仓库
				await this.setupRemote(this.syncDataPath, remoteUrl);

				// 添加所有文件
				await this._runGitCommand(this.syncDataPath, "add -A");

				// 检查是否有变更
				const status = await this._runGitCommand(this.syncDataPath, "status --porcelain");
				
				if (status.trim()) {
					// 有变更，提交并推送
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

	/**
	 * 从远程仓库拉取所有配置
	 */
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
				// 初始化Git仓库
				await this.initGitRepo(this.syncDataPath, config);

				// 设置远程仓库
				await this.setupRemote(this.syncDataPath, remoteUrl);

				// 获取远程引用
				await this._runGitCommand(this.syncDataPath, "fetch origin");

				// 获取默认分支
				const defaultBranch = await this.getRemoteDefaultBranch(this.syncDataPath);

				// 尝试拉取最新内容
				try {
					await this._runGitCommand(this.syncDataPath, `pull origin ${defaultBranch} --rebase`);
				} catch (pullError) {
					// 如果拉取失败（可能是首次同步），直接重置
					this.logger.debug("首次同步或拉取冲突，使用force reset");
				}

				// 重置到远程分支
				await this._runGitCommand(this.syncDataPath, `reset --hard origin/${defaultBranch}`);

				this.logger.debug("Git拉取成功");
				
				// 导入配置
				const importResult = this.importConfigs();
				
				if (importResult.success) {
					const msg = `拉取成功! 已导入: ${importResult.imported.join(", ")}`;
					broadcast({ success: true, message: msg, imported: importResult.imported });
				} else {
					broadcast({ success: false, message: `拉取成功但导入失败: ${importResult.error}` });
				}
			} catch (err) {
				this.logger.debug(`Git拉取失败: ${this._filterPat(err.message)}`);
				
				// 根据错误类型提供更友好的提示
				let userMsg = err.message;
				if (err.message.includes("Could not resolve proxy") || 
				    err.message.includes("Connection refused") ||
				    err.message.includes("Failed to connect")) {
					userMsg = "网络连接失败，请检查网络或代理设置";
				} else if (err.message.includes("Authentication failed")) {
					userMsg = "认证失败，请检查GitHub PAT是否正确";
				} else if (err.message.includes("Repository not found")) {
					userMsg = "仓库不存在，请检查仓库地址是否正确";
				}
				
				broadcast({ success: false, message: `拉取失败: ${userMsg}` });
			}
		})();
	}
}

module.exports = GitSyncManager;
module.exports.CONFIG_FILES = CONFIG_FILES;
