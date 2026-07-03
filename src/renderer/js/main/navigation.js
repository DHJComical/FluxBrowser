const { ipcRenderer } = require("electron");
const { urlInput, goBtn } = require("./dom");
const debugLog = require("./debug");
const { showToast } = require("../shared/feedback");
const { getActiveTab, getActiveWebview } = require("./tabs");
const { syncActiveTabUi } = require("./activeTabUi");
const {
	clearStatusResetTimer,
	setWindowStatus,
	syncWindowStatusWithWebview,
} = require("./status");

function normalizeUrl(value) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/^[a-zA-Z]+:\/\//.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

function navigate() {
	const activeTab = getActiveTab();
	if (!activeTab) return;

	const url = normalizeUrl(urlInput.value);
	if (!url) {
		showToast(t("main.navigation.invalidUrlMessage"), {
			type: "warning",
			title: t("main.navigation.invalidUrlTitle"),
		});
		return;
	}

	setWindowStatus("main.navigation.navigating", "loading");
	ipcRenderer.send("navigate-tab", { tabId: activeTab.id, url });
}

function bindNavigationEvents() {
	setWindowStatus("main.navigation.restoredSession", "idle", {
		autoReset: true,
	});

	goBtn.onclick = navigate;
	urlInput.onkeydown = (event) => {
		if (event.key === "Enter") navigate();
	};

	ipcRenderer.on("web-go-back", () => {
		const webview = getActiveWebview();
		if (webview && webview.canGoBack()) {
			webview.goBack();
			setWindowStatus("main.navigation.wentBack", "idle", { autoReset: true });
			debugLog.info("logs.main.navigation.goBack");
		} else {
			setWindowStatus("main.navigation.atFirstPage", "idle", {
				autoReset: true,
			});
		}
	});

	ipcRenderer.on("web-go-forward", () => {
		const webview = getActiveWebview();
		if (webview && webview.canGoForward()) {
			webview.goForward();
			setWindowStatus("main.navigation.wentForward", "idle", {
				autoReset: true,
			});
			debugLog.info("logs.main.navigation.goForward");
		} else {
			setWindowStatus("main.navigation.atLatestPage", "idle", {
				autoReset: true,
			});
		}
	});

	ipcRenderer.on("settings-window-closed", () => {
		clearStatusResetTimer();
		syncWindowStatusWithWebview();
	});

	ipcRenderer.on("tabs-state-changed", () => {
		syncActiveTabUi();
		syncWindowStatusWithWebview();
	});
}

module.exports = {
	bindNavigationEvents,
	navigate,
	setWindowStatus,
	syncWindowStatusWithWebview,
};
