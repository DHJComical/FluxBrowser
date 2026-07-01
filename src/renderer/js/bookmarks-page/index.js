const { ipcRenderer } = require("electron");
const { showToast, confirmAction } = require("../shared/feedback");
const { renderBookmarks } = require("./renderers");

function openBookmark(bookmark) {
	ipcRenderer.send("open-bookmark", bookmark);
	showToast("已将书签定位发送到主窗口。", {
		type: "success",
		title: "正在跳转",
	});
	window.close();
}

async function deleteBookmark(index) {
	const confirmed = await confirmAction({
		title: "删除书签",
		message: "确定要删除这条书签记录吗？删除后将无法恢复。",
		confirmText: "确认删除",
		tone: "danger",
	});

	if (!confirmed) {
		return;
	}

	ipcRenderer.send("delete-bookmark", index);
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
		renderBookmarks(bookmarks, {
			openBookmark,
			deleteBookmark,
		});
	});
}

function init() {
	bindBookmarkListeners();
	requestBookmarks();
}

init();
