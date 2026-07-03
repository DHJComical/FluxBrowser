const { ipcRenderer } = require("electron");
const dom = require("./dom");
const { showToast, confirmAction } = require("../shared/feedback");
const { initI18n, t } = require("../shared/i18n");
const { renderBookmarks } = require("./renderers");

const sortLabelMap = {
	latest: "bookmarks.sort.latest",
	oldest: "bookmarks.sort.oldest",
	"progress-desc": "bookmarks.sort.progressDesc",
	"progress-asc": "bookmarks.sort.progressAsc",
	title: "bookmarks.sort.title",
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
		dom.sortTriggerLabel.textContent =
			t(sortLabelMap[currentSort] || "bookmarks.sort.latest");
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
	showToast(t("bookmarks.open.message"), {
		type: "success",
		title: t("bookmarks.open.title"),
	});
	window.close();
}

async function deleteBookmark(originalIndex) {
	const confirmed = await confirmAction({
		title: "bookmarks.delete.title",
		message: "bookmarks.delete.message",
		confirmText: "bookmarks.delete.confirm",
		tone: "danger",
	});

	if (!confirmed) {
		return;
	}

	ipcRenderer.send("delete-bookmark", originalIndex);
	showToast(t("bookmarks.delete.doneMessage"), {
		type: "success",
		title: t("bookmarks.delete.doneTitle"),
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

async function init() {
	await initI18n();
	updateSortUI();
	bindBookmarkListeners();
	bindToolbarEvents();
	requestBookmarks();
	window.addEventListener("flux-language-changed", () => {
		rerender();
	});
}

init();
