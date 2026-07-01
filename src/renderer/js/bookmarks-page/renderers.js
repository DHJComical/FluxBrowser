const dom = require("./dom");
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
		<h2>${keyword ? "没有匹配的书签" : "还没有继续观看记录"}</h2>
		<p>
			${keyword ? "试试更换关键词，或者清空搜索条件后重新查看。" : "你在主窗口添加书签后，这里会展示可继续观看的内容。"}
		</p>
	`;
	return emptyState;
}

function createBookmarkItem(entry, handlers) {
	const { bookmark, originalIndex } = entry;
	const div = document.createElement("article");
	div.className = "bookmark-item";

	const title = bookmark.title || "未命名页面";
	const url = bookmark.url || "无来源地址";
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
							进度 ${progress}
						</span>
						<span class="bookmark-badge">
							<i class="material-icons">event</i>
							保存于 ${savedAt}
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
			<button class="bookmark-btn open" data-index="${originalIndex}" title="继续播放">
				<i class="material-icons">play_arrow</i>
			</button>
			<button class="bookmark-btn delete" data-index="${originalIndex}" title="删除书签">
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
	dom.resultsCount.textContent = `${entries.length} 条记录`;

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
