class BookmarkSyncService {
	constructor(bookmarkService, gitSyncManager) {
		this.bookmarkService = bookmarkService;
		this.gitSyncManager = gitSyncManager;
	}

	isGitConfigured(config) {
		return Boolean(config.gitPat && config.gitRemote);
	}

	hasBookmarksFile() {
		return require("fs").existsSync(this.bookmarkService.getBookmarksPath());
	}

	buildRemoteUrl(config) {
		return `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;
	}

	async sync(config) {
		const cwd = this.bookmarkService.getBookmarksDir();
		const fileName = this.bookmarkService.getBookmarksFileName();

		await this.gitSyncManager.initGitRepo(cwd, config);
		await this.gitSyncManager.setupRemote(cwd, this.buildRemoteUrl(config));
		await this.gitSyncManager._runGitCommand(cwd, `add -f "${fileName}"`);

		const status = await this.gitSyncManager._runGitCommand(
			cwd,
			"status --porcelain",
		);
		if (!status.trim()) {
			return { changed: false };
		}

		await this.gitSyncManager._runGitCommand(cwd, 'commit -m "Update bookmarks"');
		await this.gitSyncManager._runGitCommand(cwd, "push -u origin HEAD");
		return { changed: true };
	}

	async pull(config) {
		const cwd = this.bookmarkService.getBookmarksDir();

		await this.gitSyncManager.initGitRepo(cwd, config);
		await this.gitSyncManager.setupRemote(cwd, this.buildRemoteUrl(config));
		await this.gitSyncManager._runGitCommand(cwd, "fetch origin");

		const defaultBranch = await this.gitSyncManager.getRemoteDefaultBranch(cwd);
		await this.gitSyncManager._runGitCommand(
			cwd,
			`reset --hard origin/${defaultBranch}`,
		);

		return {
			defaultBranch,
			bookmarks: this.bookmarkService.readBookmarks(),
		};
	}
}

module.exports = BookmarkSyncService;
