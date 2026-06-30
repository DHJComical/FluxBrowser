const dom = require("./dom");
const { formatTime } = require("./helpers");

function createEmptyState() {
	const emptyState = document.createElement("div");
	emptyState.className = "empty-state";
	emptyState.innerHTML = `
		<i class="material-icons">bookmark_border</i>
		<p>暂无书签记录</p>
	`;
	return emptyState;
}

function createBookmarkItem(bookmark, index, handlers) {
	const div = document.createElement("div");
	div.className = "bookmark-item";
	div.innerHTML = `
		<div class="bookmark-icon">
			<i class="material-icons">play_circle_filled</i>
		</div>
		<div class="bookmark-content">
			<div class="bookmark-title">${bookmark.title}</div>
			<div class="bookmark-meta">
				<div class="bookmark-time">
					<i class="material-icons">schedule</i>
					<span>进度: ${formatTime(bookmark.time)}</span>
				</div>
				${bookmark.url ? `<div class="bookmark-url">${bookmark.url}</div>` : ""}
			</div>
		</div>
		<div class="bookmark-actions">
			<button class="bookmark-btn delete" data-index="${index}" title="删除书签">
				<i class="material-icons">delete</i>
			</button>
		</div>
	`;

	div.onclick = () => {
		handlers.openBookmark(bookmark);
	};

	const deleteBtn = div.querySelector(".bookmark-btn.delete");
	if (deleteBtn) {
		deleteBtn.onclick = (event) => {
			event.stopPropagation();
			handlers.deleteBookmark(index);
		};
	}

	return div;
}

function renderBookmarks(bookmarks, handlers) {
	if (!dom.bookmarkList || !dom.bookmarksCount) return;

	dom.bookmarkList.innerHTML = "";
	dom.bookmarksCount.textContent = `${bookmarks.length} 个书签`;

	if (bookmarks.length === 0) {
		dom.bookmarkList.appendChild(createEmptyState());
		return;
	}

	bookmarks.forEach((bookmark, index) => {
		dom.bookmarkList.appendChild(
			createBookmarkItem(bookmark, index, handlers),
		);
	});
}

module.exports = {
	renderBookmarks,
};
