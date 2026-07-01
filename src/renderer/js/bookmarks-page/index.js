const { ipcRenderer } = require("electron");
const dom = require("./dom");
const { showToast, confirmAction } = require("../shared/feedback");
const { renderBookmarks } = require("./renderers");

const sortLabelMap = {
	latest: "最近保存",
	oldest: "最早保存",
	"progress-desc": "进度最长",
	"progress-asc": "进度最短",
	title: "标题 A-Z",
};

let allBookmarks = [];
let currentSort = "latest";

function getKeyword() {
	return (dom.searchInput?.value || "").trim().toLowerCase();
}

function setSortMenuOpen(open) {
	if (!dom.sortMenu || !dom.sortTrigger) return;
	dom.sortMenu.classList.toggle("hidden", !open);
	dom.sortTrigger.classList.toggle("active", open);
}

function updateSortUI() {
	if (dom.sortTriggerLabel) {
		dom.sortTriggerLabel.textContent = sortLabelMap[currentSort] || "最近保存";
	}

	dom.sortOptions?.forEach((option) => {
		option.classList.toggle("active", option.dataset.value === currentSort);
	});
}

function getSortedEntries(entries) {
	const list = [...entries];

	if (currentSort === "oldest") {
		return list.sort(
			(a, b) => (a.bookmark.timestamp || 0) - (b.bookmark.timestamp || 0),
		);
	}
	if (currentSort === "progress-desc") {
		return list.sort((a, b) => (b.bookmark.time || 0) - (a.bookmark.time || 0));
	}
	if (currentSort === "progress-asc") {
		return list.sort((a, b) => (a.bookmark.time || 0) - (b.bookmark.time || 0));
	}
	if (currentSort === "title") {
		return list.sort((a, b) =>
			String(a.bookmark.title || "").localeCompare(
				String(b.bookmark.title || ""),
				"zh-CN",
			),
		);
	}
	return list.sort(
		(a, b) => (b.bookmark.timestamp || 0) - (a.bookmark.timestamp || 0),
	);
}

function filterBookmarks(bookmarks) {
	const keyword = getKeyword();
	const entries = bookmarks.map((bookmark, originalIndex) => ({
		bookmark,
		originalIndex,
	}));

	if (!keyword) {
		return {
			keyword,
			items: getSortedEntries(entries),
		};
	}

	const items = entries.filter(({ bookmark }) => {
		const title = String(bookmark.title || "").toLowerCase();
		const url = String(bookmark.url || "").toLowerCase();
		return title.includes(keyword) || url.includes(keyword);
	});

	return {
		keyword,
		items: getSortedEntries(items),
	};
}

function rerender() {
	updateSortUI();
	const { items, keyword } = filterBookmarks(allBookmarks);
	renderBookmarks(
		items,
		allBookmarks,
		{
			openBookmark,
			deleteBookmark,
		},
		keyword,
	);
}

function openBookmark(bookmark) {
	ipcRenderer.send("open-bookmark", bookmark);
	showToast("已将书签定位发送到主窗口。", {
		type: "success",
		title: "正在跳转",
	});
	window.close();
}

async function deleteBookmark(originalIndex) {
	const confirmed = await confirmAction({
		title: "删除书签",
		message: "确定要删除这条继续观看记录吗？删除后将无法恢复。",
		confirmText: "确认删除",
		tone: "danger",
	});

	if (!confirmed) {
		return;
	}

	ipcRenderer.send("delete-bookmark", originalIndex);
	showToast("书签已删除。", {
		type: "success",
		title: "删除完成",
	});
}

function requestBookmarks() {
	ipcRenderer.send("get-bookmarks");
}

function bindBookmarkListeners() {
	ipcRenderer.on("bookmarks-data", (_event, bookmarks) => {
		allBookmarks = Array.isArray(bookmarks) ? bookmarks : [];
		rerender();
	});
}

function bindToolbarEvents() {
	if (dom.searchInput) {
		dom.searchInput.addEventListener("input", () => {
			rerender();
		});
	}

	if (dom.sortTrigger) {
		dom.sortTrigger.addEventListener("click", (event) => {
			event.stopPropagation();
			const isHidden = dom.sortMenu?.classList.contains("hidden");
			setSortMenuOpen(Boolean(isHidden));
		});
	}

	dom.sortOptions?.forEach((option) => {
		option.addEventListener("click", () => {
			currentSort = option.dataset.value || "latest";
			setSortMenuOpen(false);
			rerender();
		});
	});

	document.addEventListener("click", () => {
		setSortMenuOpen(false);
	});

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			setSortMenuOpen(false);
		}
	});
}

function init() {
	updateSortUI();
	bindBookmarkListeners();
	bindToolbarEvents();
	requestBookmarks();
}

init();
