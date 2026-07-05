const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const { t } = require("../shared/i18n");

async function performCacheClear({ confirmAction, showToast }) {
	try {
		const hasAnyOption = Object.values(state.cacheClearOptions).some(
			(option) => option,
		);
		if (!hasAnyOption) {
			showToast(t("settings.cache.selectOneMessage"), { type: "warning" });
			return;
		}

		const confirmed = await confirmAction({
			title: "settings.cache.confirmTitle",
			message: "settings.cache.confirmMessage",
			confirmText: "settings.cache.startAction",
			tone: "danger",
		});
		if (!confirmed) {
			return;
		}

		ipcRenderer.send("clear-cache", state.cacheClearOptions);
		dom.cacheClearBtn.dataset.busy = "true";
		dom.cacheClearBtn.disabled = true;
		dom.cacheClearBtn.textContent = t("settings.cache.runningAction");
	} catch (error) {
		console.error("logs.settings.cache.performFailed", error);
		showToast(t("settings.cache.runningErrorMessage"), { type: "error" });
		dom.cacheClearBtn.dataset.busy = "false";
		dom.cacheClearBtn.disabled = false;
		dom.cacheClearBtn.textContent = t("settings.cache.startAction");
	}
}

function bindSystemActions({ resetUpdateProgress, showToast, confirmAction }) {
	if (dom.checkUpdateBtn) {
		dom.checkUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("check-for-updates");
			dom.updateStatus.innerText = t("settings.update.checking");
			dom.checkUpdateBtn.disabled = true;
			if (dom.downloadUpdateBtn) dom.downloadUpdateBtn.classList.add("hidden");
			if (dom.installUpdateBtn) dom.installUpdateBtn.classList.add("hidden");
			dom.checkUpdateBtn.classList.remove("hidden");
			resetUpdateProgress();
		});
	}

	if (dom.downloadUpdateBtn) {
		dom.downloadUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("download-update");
			dom.downloadUpdateBtn.disabled = true;
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = true;
			resetUpdateProgress({ hide: false, percent: 0 });
			if (dom.updateStatus) {
				dom.updateStatus.innerText = t("settings.update.downloading");
			}
		});
	}

	if (dom.installUpdateBtn) {
		dom.installUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("quit-and-install");
		});
	}

	if (dom.cacheClearBtn) {
		dom.cacheClearBtn.addEventListener("click", () => {
			performCacheClear({
				confirmAction,
				showToast,
			});
		});
	}
}

module.exports = {
	bindSystemActions,
	performCacheClear,
};
