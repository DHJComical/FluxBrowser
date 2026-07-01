const { ipcRenderer } = require("electron");
const { webview, urlInput, goBtn, windowStatus } = require("./dom");
const { state, setLastUrl } = require("./state");
const debugLog = require("./debug");
const { showToast } = require("../shared/feedback");

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
	if (!windowStatus || !webview) return;

	try {
		if (typeof webview.isLoading === "function" && webview.isLoading()) {
			windowStatus.textContent = "页面加载中";
			windowStatus.dataset.tone = "loading";
			return;
		}

		const currentUrl =
			typeof webview.getURL === "function" ? webview.getURL() : "";
		if (currentUrl && currentUrl !== "about:blank") {
			windowStatus.textContent = "当前页面可继续操作";
			windowStatus.dataset.tone = "ready";
			return;
		}
	} catch (error) {
		debugLog.warn("同步窗口状态失败:", error);
	}

	windowStatus.textContent = "准备就绪";
	windowStatus.dataset.tone = "idle";
}

function normalizeUrl(value) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	if (/^[a-zA-Z]+:\/\//.test(trimmed)) {
		return trimmed;
	}
	return `https://${trimmed}`;
}

function navigate() {
	const url = normalizeUrl(urlInput.value);
	if (!url) {
		showToast("请输入有效的网址后再前往。", {
			type: "warning",
			title: "地址为空",
		});
		return;
	}

	setWindowStatus("正在前往页面", "loading");
	webview.src = url;
}

function bindNavigationEvents() {
	webview.src = state.lastUrl;
	urlInput.value = state.lastUrl;
	setWindowStatus("已恢复上次访问", "idle", { autoReset: true });
	debugLog.info("已恢复上次访问的 URL:", state.lastUrl);

	goBtn.onclick = navigate;
	urlInput.onkeydown = (event) => {
		if (event.key === "Enter") navigate();
	};

	const persistCurrentUrl = () => {
		const currentUrl = webview.getURL();
		if (!currentUrl) return;
		urlInput.value = currentUrl;
		setLastUrl(currentUrl);
		setWindowStatus("页面已就绪", "ready", { autoReset: true });
	};

	webview.addEventListener("did-start-loading", () => {
		setWindowStatus("页面加载中", "loading");
	});

	webview.addEventListener("did-stop-loading", () => {
		setWindowStatus("页面已完成加载", "ready", { autoReset: true });
	});

	webview.addEventListener("did-fail-load", () => {
		setWindowStatus("页面加载失败", "error", {
			autoReset: true,
			resetDelay: 2200,
		});
		showToast("页面加载失败，请检查网址或网络连接。", {
			type: "error",
			title: "无法打开页面",
		});
	});

	webview.addEventListener("did-navigate", persistCurrentUrl);
	webview.addEventListener("did-navigate-in-page", persistCurrentUrl);

	ipcRenderer.on("web-go-back", () => {
		if (webview.canGoBack()) {
			webview.goBack();
			setWindowStatus("已返回上一页", "idle", { autoReset: true });
			debugLog.info("执行网页后退操作");
		} else {
			setWindowStatus("已经在起始页", "idle", { autoReset: true });
			debugLog.info("无法后退，已到达历史记录起点");
		}
	});

	ipcRenderer.on("web-go-forward", () => {
		if (webview.canGoForward()) {
			webview.goForward();
			setWindowStatus("已前往下一页", "idle", { autoReset: true });
			debugLog.info("执行网页前进操作");
		} else {
			setWindowStatus("已经在最新页", "idle", { autoReset: true });
			debugLog.info("无法前进，已到达历史记录终点");
		}
	});

	ipcRenderer.on("settings-window-closed", () => {
		clearStatusResetTimer();
		syncWindowStatusWithWebview();
	});
}

module.exports = {
	bindNavigationEvents,
	navigate,
	setWindowStatus,
	syncWindowStatusWithWebview,
};
