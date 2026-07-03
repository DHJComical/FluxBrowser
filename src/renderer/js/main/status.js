const { windowStatus } = require("./dom");
const debugLog = require("./debug");
const { getWebview } = require("./state");
const { t } = require("../shared/i18n");

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
	windowStatus.textContent = t(message);
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
			windowStatus.textContent = t("main.status.loading");
			windowStatus.dataset.tone = "loading";
			return;
		}

		const currentUrl =
			typeof activeWebview.getURL === "function"
				? activeWebview.getURL()
				: "";
		if (currentUrl && currentUrl !== "about:blank") {
			windowStatus.textContent = t("main.status.ready");
			windowStatus.dataset.tone = "ready";
			return;
		}
	} catch (error) {
		debugLog.warn("logs.main.status.syncFailed", error);
	}

	windowStatus.textContent = t("main.status.idle");
	windowStatus.dataset.tone = "idle";
}

module.exports = {
	clearStatusResetTimer,
	setWindowStatus,
	syncWindowStatusWithWebview,
};
