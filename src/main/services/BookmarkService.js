const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const { t } = require("../i18n");

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
			this.logger.debug(
				t("logs.bookmarks.parseFailed", {
					message: error.message,
				}),
			);
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
		this.logger.debug("logs.bookmarks.saved", bookmark.title);
		return bookmarks;
	}

	deleteBookmark(index) {
		const bookmarks = this.readBookmarks();
		bookmarks.splice(index, 1);
		this.writeBookmarks(bookmarks);
		return bookmarks;
	}

	buildOpenBookmarkScript(bookmark) {
		if (!bookmark || !bookmark.url) return null;

		const escapedUrl = bookmark.url.replace(/'/g, "\\'");
		const escapedTime = parseFloat(bookmark.time) || 0;
		return `window.location.href = '${escapedUrl}'; setTimeout(() => { const v = document.querySelector('video'); if(v) v.currentTime = ${escapedTime}; }, 2000);`;
	}
}

module.exports = BookmarkService;
