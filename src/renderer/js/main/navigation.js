const { ipcRenderer } = require("electron");
const { urlInput, goBtn, backBtn, forwardBtn, refreshBtn } = require("./dom");
const debugLog = require("./debug");
const { showToast } = require("../shared/feedback");
const { getActiveTab, getActiveWebview } = require("./tabs");
const { syncActiveTabUi } = require("./activeTabUi");
const { t } = require("../shared/i18n");

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

	ipcRenderer.send("navigate-tab", { tabId: activeTab.id, url });
}

function goBack() {
	const webview = getActiveWebview();
	if (webview && webview.canGoBack()) {
		webview.goBack();
		debugLog.info("logs.main.navigation.goBack");
	}
}

function goForward() {
	const webview = getActiveWebview();
	if (webview && webview.canGoForward()) {
		webview.goForward();
		debugLog.info("logs.main.navigation.goForward");
	}
}

function refreshActivePage() {
	const webview = getActiveWebview();
	if (!webview) return;

	try {
		if (typeof webview.isLoading === "function" && webview.isLoading()) {
			if (typeof webview.stop === "function") {
				webview.stop();
			}
			return;
		}

		if (typeof webview.reload === "function") {
			webview.reload();
		}
	} catch (_error) {
		// Ignore transient reload errors from destroyed or navigating webviews.
	}
}

function bindNavigationEvents() {
	goBtn.onclick = navigate;
	if (backBtn) {
		backBtn.onclick = goBack;
	}
	if (forwardBtn) {
		forwardBtn.onclick = goForward;
	}
	if (refreshBtn) {
		refreshBtn.onclick = refreshActivePage;
	}
	urlInput.onkeydown = (event) => {
		if (event.key === "Enter") navigate();
	};

	ipcRenderer.on("web-go-back", () => {
		goBack();
	});

	ipcRenderer.on("web-go-forward", () => {
		goForward();
	});

	ipcRenderer.on("tabs-state-changed", () => {
		syncActiveTabUi();
	});
}

module.exports = {
	bindNavigationEvents,
	navigate,
};
