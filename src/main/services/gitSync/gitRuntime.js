const path = require("path");
const { exec } = require("child_process");
const { filterPat, buildRemoteUrl } = require("./gitSyncUtils");
const { EXCLUDED_FILES } = require("./constants");

class GitRuntime {
	constructor(logger) {
		this.logger = logger;
	}

	runGitCommand(cwd, subCmd) {
		return new Promise((resolve, reject) => {
			const gitCmd = `git --git-dir="${path.join(cwd, ".git")}" --work-tree="${cwd}" ${subCmd}`;
			this.logger.debug(`执行Git命令: ${filterPat(gitCmd)}`);

			exec(gitCmd, { cwd }, (error, stdout, stderr) => {
				if (error) {
					this.logger.debug(
						`Git命令失败: ${filterPat(stderr || error.message)}`,
					);
					reject(new Error(stderr || error.message));
					return;
				}
				resolve(stdout);
			});
		});
	}

	async initGitRepo(cwd, config) {
		const gitDir = path.join(cwd, ".git");
		const { existsSync } = require("fs");
		const isNewRepo = !existsSync(gitDir);

		if (isNewRepo) {
			await this.runGitCommand(cwd, "init");
		}

		await this.runGitCommand(
			cwd,
			`config user.name "${config.gitName || "FluxBrowser"}"`,
		);
		await this.runGitCommand(
			cwd,
			`config user.email "${config.gitEmail || "fluxbrowser@example.com"}"`,
		);
		await this.runGitCommand(cwd, "config credential.helper store");

		return isNewRepo;
	}

	async setupRemote(cwd, config) {
		const remoteUrl =
			typeof config === "string" ? config : buildRemoteUrl(config);
		try {
			await this.runGitCommand(cwd, "remote remove origin");
		} catch (_error) {}
		await this.runGitCommand(cwd, `remote add origin ${remoteUrl}`);
		return remoteUrl;
	}

	async getRemoteDefaultBranch(cwd) {
		try {
			await this.runGitCommand(cwd, "rev-parse --verify origin/main");
			return "main";
		} catch (_mainError) {
			try {
				await this.runGitCommand(cwd, "rev-parse --verify origin/master");
				return "master";
			} catch (_masterError) {
				return "main";
			}
		}
	}

	async markExcludedFiles(cwd) {
		for (const excludedFile of EXCLUDED_FILES) {
			await this.runGitCommand(
				cwd,
				`update-index --assume-unchanged "${excludedFile}"`,
			).catch(() => {});
		}
	}
}

module.exports = GitRuntime;
