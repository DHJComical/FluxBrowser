const { app } = require("electron");
const fs = require("fs");
const path = require("path");

class BookmarkService {
	constructor(logger) {
		this.logger = logger;
	}

	getBookmarksDir() {
		const userDataDir = path.join(app.getPath("userData"), "bookmarks");
		if (!fs.existsSync(userDataDir)) {
			fs.mkdirSync(userDataDir, { recursive: true });
		}
		return userDataDir;
	}

	getBookmarksFileName() {
		return app.isPackaged ? "bookmarks.json" : "bookmarks-dev.json";
	}

	getBookmarksPath() {
		return path.join(this.getBookmarksDir(), this.getBookmarksFileName());
	}

	readBookmarks() {
		const localBookmarksPath = this.getBookmarksPath();
		if (!fs.existsSync(localBookmarksPath)) {
			return [];
		}

		try {
			return JSON.parse(fs.readFileSync(localBookmarksPath, "utf8"));
		} catch (error) {
			this.logger.debug(`解析书签文件失败: ${error.message}`);
			return [];
		}
	}

	writeBookmarks(bookmarks) {
		fs.writeFileSync(
			this.getBookmarksPath(),
			JSON.stringify(bookmarks, null, 2),
		);
	}

	addBookmark(bookmark) {
		const bookmarks = this.readBookmarks();
		bookmarks.push(bookmark);
		this.writeBookmarks(bookmarks);
		this.logger.debug("书签已保存", bookmark.title);
		return bookmarks;
	}

	deleteBookmark(index) {
		const bookmarks = this.readBookmarks();
		bookmarks.splice(index, 1);
		this.writeBookmarks(bookmarks);
		return bookmarks;
	}
}

module.exports = BookmarkService;
