const { ipcRenderer } = require("electron");
const { webview, urlInput, goBtn } = require("./dom");
const { state, setLastUrl } = require("./state");
const debugLog = require("./debug");

function navigate() {
	let url = urlInput.value.trim();
	if (!url.startsWith("http")) url = `https://${url}`;
	webview.src = url;
}

function bindNavigationEvents() {
	webview.src = state.lastUrl;
	urlInput.value = state.lastUrl;
	debugLog.info("已恢复上次访问的 URL:", state.lastUrl);

	goBtn.onclick = navigate;
	urlInput.onkeydown = (event) => {
		if (event.key === "Enter") navigate();
	};

	const persistCurrentUrl = () => {
		const currentUrl = webview.getURL();
		urlInput.value = currentUrl;
		setLastUrl(currentUrl);
	};

	webview.addEventListener("did-navigate", persistCurrentUrl);
	webview.addEventListener("did-navigate-in-page", persistCurrentUrl);

	ipcRenderer.on("web-go-back", () => {
		if (webview.canGoBack()) {
			webview.goBack();
			debugLog.info("执行网页后退操作");
		} else {
			debugLog.info("无法后退，已到达历史记录起点");
		}
	});

	ipcRenderer.on("web-go-forward", () => {
		if (webview.canGoForward()) {
			webview.goForward();
			debugLog.info("执行网页前进操作");
		} else {
			debugLog.info("无法前进，已到达历史记录终点");
		}
	});
}

module.exports = {
	bindNavigationEvents,
	navigate,
};
