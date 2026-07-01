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
		showToast("请输入有效的网址后再前往。", {
			type: "warning",
			title: "地址为空",
		});
		return;
	}

	setWindowStatus("正在前往页面", "loading");
	ipcRenderer.send("navigate-tab", { tabId: activeTab.id, url });
}

function bindNavigationEvents() {
	setWindowStatus("已恢复标签会话", "idle", { autoReset: true });

	goBtn.onclick = navigate;
	urlInput.onkeydown = (event) => {
		if (event.key === "Enter") navigate();
	};

	ipcRenderer.on("web-go-back", () => {
		const webview = getActiveWebview();
		if (webview && webview.canGoBack()) {
			webview.goBack();
			setWindowStatus("已返回上一页", "idle", { autoReset: true });
			debugLog.info("执行网页后退操作");
		} else {
			setWindowStatus("已经在起始页", "idle", { autoReset: true });
		}
	});

	ipcRenderer.on("web-go-forward", () => {
		const webview = getActiveWebview();
		if (webview && webview.canGoForward()) {
			webview.goForward();
			setWindowStatus("已前往下一页", "idle", { autoReset: true });
			debugLog.info("执行网页前进操作");
		} else {
			setWindowStatus("已经在最新页", "idle", { autoReset: true });
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
