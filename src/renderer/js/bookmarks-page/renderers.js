const dom = require("./dom");
const { t } = require("../shared/i18n");
const {
	formatTime,
	formatDurationLabel,
	formatBookmarkDate,
	isWithinRecentDays,
} = require("./helpers");

function createEmptyState(keyword) {
	const emptyState = document.createElement("div");
	emptyState.className = "empty-state";
	emptyState.innerHTML = `
		<i class="material-icons">auto_stories</i>
		<h2>${keyword ? t("bookmarks.empty.matchTitle") : t("bookmarks.empty.defaultTitle")}</h2>
		<p>
			${keyword ? t("bookmarks.empty.matchDescription") : t("bookmarks.empty.defaultDescription")}
		</p>
	`;
	return emptyState;
}

function createBookmarkItem(entry, handlers) {
	const { bookmark, originalIndex } = entry;
	const div = document.createElement("article");
	div.className = "bookmark-item";

	const title = bookmark.title || t("bookmarks.item.untitled");
	const url = bookmark.url || t("bookmarks.item.noUrl");
	const savedAt = formatBookmarkDate(bookmark.timestamp);
	const progress = formatTime(bookmark.time);

	div.innerHTML = `
		<div class="bookmark-accent"></div>
		<div class="bookmark-main">
			<div class="bookmark-head">
				<div class="bookmark-icon">
					<i class="material-icons">play_circle_filled</i>
				</div>
				<div class="bookmark-heading">
					<h3 class="bookmark-title">${title}</h3>
					<div class="bookmark-badges">
						<span class="bookmark-badge">
							<i class="material-icons">schedule</i>
							${t("bookmarks.item.progress", { progress })}
						</span>
						<span class="bookmark-badge">
							<i class="material-icons">event</i>
							${t("bookmarks.item.savedAt", { savedAt })}
						</span>
					</div>
				</div>
			</div>
			<div class="bookmark-url-row">
				<i class="material-icons">link</i>
				<span class="bookmark-url">${url}</span>
			</div>
		</div>
		<div class="bookmark-actions">
			<button class="bookmark-btn open" data-index="${originalIndex}" title="${t("bookmarks.item.open")}">
				<i class="material-icons">play_arrow</i>
			</button>
			<button class="bookmark-btn delete" data-index="${originalIndex}" title="${t("bookmarks.item.delete")}">
				<i class="material-icons">delete</i>
			</button>
		</div>
	`;

	div.onclick = () => {
		handlers.openBookmark(bookmark);
	};

	const openBtn = div.querySelector(".bookmark-btn.open");
	if (openBtn) {
		openBtn.onclick = (event) => {
			event.stopPropagation();
			handlers.openBookmark(bookmark);
		};
	}

	const deleteBtn = div.querySelector(".bookmark-btn.delete");
	if (deleteBtn) {
		deleteBtn.onclick = (event) => {
			event.stopPropagation();
			handlers.deleteBookmark(originalIndex);
		};
	}

	return div;
}

function renderSummary(bookmarks) {
	if (dom.summaryTotal) {
		dom.summaryTotal.textContent = String(bookmarks.length);
	}

	if (dom.summaryRecent) {
		const recentCount = bookmarks.filter((bookmark) =>
			isWithinRecentDays(bookmark.timestamp),
		).length;
		dom.summaryRecent.textContent = String(recentCount);
	}

	if (dom.summaryDuration) {
		const totalDuration = bookmarks.reduce(
			(sum, bookmark) => sum + (Number(bookmark.time) || 0),
			0,
		);
		dom.summaryDuration.textContent = formatDurationLabel(totalDuration);
	}
}

function renderBookmarks(entries, sourceBookmarks, handlers, keyword = "") {
	if (!dom.bookmarkList || !dom.resultsCount) return;

	renderSummary(sourceBookmarks);
	dom.bookmarkList.innerHTML = "";
	dom.resultsCount.textContent = t("bookmarks.results.count", {
		count: entries.length,
	});

	if (entries.length === 0) {
		dom.bookmarkList.appendChild(createEmptyState(keyword));
		return;
	}

	entries.forEach((entry) => {
		dom.bookmarkList.appendChild(createBookmarkItem(entry, handlers));
	});
}

module.exports = {
	renderBookmarks,
};
