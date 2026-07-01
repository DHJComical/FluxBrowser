const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");

async function performCacheClear({ confirmAction, showToast }) {
	try {
		const hasAnyOption = Object.values(state.cacheClearOptions).some(
			(option) => option,
		);
		if (!hasAnyOption) {
			showToast("请至少选择一个要清理的项目", { type: "warning" });
			return;
		}

		const confirmed = await confirmAction({
			title: "清理本地缓存",
			message: "确定要清理选中的文件吗？此操作不可逆。",
			confirmText: "开始清理",
			tone: "danger",
		});
		if (!confirmed) {
			return;
		}

		ipcRenderer.send("clear-cache", state.cacheClearOptions);
		dom.cacheClearBtn.disabled = true;
		dom.cacheClearBtn.textContent = "清理中...";
	} catch (error) {
		console.error("执行缓存清理失败:", error);
		showToast("清理过程中出现错误，请重试", { type: "error" });
		dom.cacheClearBtn.disabled = false;
		dom.cacheClearBtn.textContent = "开始清理";
	}
}

function bindSystemActions({ resetUpdateProgress, showToast, confirmAction }) {
	if (dom.checkUpdateBtn) {
		dom.checkUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("check-for-updates");
			dom.updateStatus.innerText = "正在检查更新...";
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
				dom.updateStatus.innerText = "正在下载更新...";
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
