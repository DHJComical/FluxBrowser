const { ipcRenderer } = require("electron");
const dom = require("./dom");

function bindSyncActions({ confirmAction }) {
	if (dom.syncBookmarksBtn) {
		dom.syncBookmarksBtn.addEventListener("click", async () => {
			ipcRenderer.send("sync-bookmarks");
		});
	}

	if (dom.pullBookmarksBtn) {
		dom.pullBookmarksBtn.addEventListener("click", async () => {
			const confirmed = await confirmAction({
				title: "下载远程书签",
				message: "确定要从远程仓库覆盖本地书签吗？此操作不可逆。",
				confirmText: "确认覆盖",
				tone: "danger",
			});
			if (confirmed) {
				ipcRenderer.send("pull-bookmarks");
			}
		});
	}

	if (dom.syncAllBtn) {
		dom.syncAllBtn.addEventListener("click", async () => {
			const confirmed = await confirmAction({
				title: "上传全部配置",
				message: "确定要上传所有配置和书签到云端吗？",
				confirmText: "开始上传",
			});
			if (confirmed) {
				ipcRenderer.send("sync-all");
			}
		});
	}

	if (dom.pullAllBtn) {
		dom.pullAllBtn.addEventListener("click", async () => {
			const confirmed = await confirmAction({
				title: "下载并覆盖本地配置",
				message: "确定要从云端下载并覆盖本地所有配置吗？此操作不可逆。",
				confirmText: "确认覆盖",
				tone: "danger",
			});
			if (confirmed) {
				ipcRenderer.send("pull-all");
			}
		});
	}
}

module.exports = {
	bindSyncActions,
};
