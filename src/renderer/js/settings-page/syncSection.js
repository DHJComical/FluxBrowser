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
				title: "settings.sync.pullBookmarksConfirmTitle",
				message: "settings.sync.pullBookmarksConfirmMessage",
				confirmText: "settings.sync.confirmOverwrite",
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
				title: "settings.sync.pushAllConfirmTitle",
				message: "settings.sync.pushAllConfirmMessage",
				confirmText: "settings.sync.startUpload",
			});
			if (confirmed) {
				ipcRenderer.send("sync-all");
			}
		});
	}

	if (dom.pullAllBtn) {
		dom.pullAllBtn.addEventListener("click", async () => {
			const confirmed = await confirmAction({
				title: "settings.sync.pullAllConfirmTitle",
				message: "settings.sync.pullAllConfirmMessage",
				confirmText: "settings.sync.confirmOverwrite",
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
