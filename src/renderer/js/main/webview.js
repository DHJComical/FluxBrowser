const { ipcRenderer } = require("electron");
const { webview, pageTitle } = require("./dom");
const debugLog = require("./debug");
const { setWindowStatus } = require("./navigation");

async function restoreOpacity() {
	try {
		const opacity = await ipcRenderer.invoke("get-opacity");
		debugLog.info("启动恢复透明度", opacity);
		webview.style.opacity = opacity;
	} catch (error) {
		debugLog.error("恢复透明度失败:", error);
	}
}

function updatePageTitle() {
	if (!pageTitle) return;
	const title = webview.getTitle && webview.getTitle();
	pageTitle.textContent = title || "当前页面";
}

function bindWebviewEvents() {
	ipcRenderer.on("set-opacity", (_event, opacity) => {
		webview.style.opacity = opacity;
	});

	webview.addEventListener("dom-ready", () => {
		webview.setUserAgent(
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		);
		webview.focus();
		setWindowStatus("页面已准备交互", "ready");
		updatePageTitle();
	});

	webview.addEventListener("page-title-updated", () => {
		updatePageTitle();
	});

	ipcRenderer.on("execute-webview-js", (_event, code) => {
		debugLog.info("收到 Webview 指令，执行代码:", code);
		if (webview) {
			webview.executeJavaScript(code);
		}
	});

	window.onerror = (message, url, line) => {
		debugLog.error(`[Renderer Error] ${message} at ${url}:${line}`);
	};
}

module.exports = {
	bindWebviewEvents,
	restoreOpacity,
};
