const { windowStatus } = require("./dom");
const debugLog = require("./debug");
const { getWebview } = require("./state");

let statusResetTimer = null;

function clearStatusResetTimer() {
	if (statusResetTimer) {
		clearTimeout(statusResetTimer);
		statusResetTimer = null;
	}
}

function setWindowStatus(message, tone = "idle", options = {}) {
	if (!windowStatus) return;

	const { autoReset = false, resetDelay = 1600 } = options;
	windowStatus.textContent = message;
	windowStatus.dataset.tone = tone;

	clearStatusResetTimer();

	if (autoReset) {
		statusResetTimer = setTimeout(() => {
			syncWindowStatusWithWebview();
			statusResetTimer = null;
		}, resetDelay);
	}
}

function syncWindowStatusWithWebview() {
	const activeWebview = getWebview();
	if (!windowStatus || !activeWebview) return;
	if (!activeWebview.isConnected) return;

	try {
		if (
			typeof activeWebview.getWebContentsId === "function"
		) {
			try {
				activeWebview.getWebContentsId();
			} catch {
				return;
			}
		}
		if (
			typeof activeWebview.isLoading === "function" &&
			activeWebview.isLoading()
		) {
			windowStatus.textContent = "页面加载中";
			windowStatus.dataset.tone = "loading";
			return;
		}

		const currentUrl =
			typeof activeWebview.getURL === "function"
				? activeWebview.getURL()
				: "";
		if (currentUrl && currentUrl !== "about:blank") {
			windowStatus.textContent = "当前页面可继续操作";
			windowStatus.dataset.tone = "ready";
			return;
		}
	} catch (error) {
		debugLog.warn("同步窗口状态失败", error);
	}

	windowStatus.textContent = "准备就绪";
	windowStatus.dataset.tone = "idle";
}

module.exports = {
	clearStatusResetTimer,
	setWindowStatus,
	syncWindowStatusWithWebview,
};
