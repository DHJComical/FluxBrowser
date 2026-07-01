const { ipcRenderer } = require("electron");
const debugLog = require("./debug");
const { getActiveWebview } = require("./tabs");
const { syncActiveTabUi } = require("./activeTabUi");
const {
	state,
	getWebview,
	setWebviewOpacity,
	queuePendingScript,
} = require("./state");

let hasLoggedInitialOpacity = false;

async function restoreOpacity() {
	try {
		const opacity = await ipcRenderer.invoke("get-opacity");
		if (!hasLoggedInitialOpacity) {
			debugLog.info("启动恢复透明度", opacity);
			hasLoggedInitialOpacity = true;
		}
		setWebviewOpacity(opacity);
		state.webviews.forEach((webview) => {
			webview.style.opacity = opacity;
		});
	} catch (error) {
		debugLog.error("恢复透明度失败", error);
	}
}

function bindWebviewEvents() {
	ipcRenderer.on("set-opacity", (_event, opacity) => {
		setWebviewOpacity(opacity);
		state.webviews.forEach((webview) => {
			webview.style.opacity = opacity;
		});
	});

	ipcRenderer.on("execute-active-tab-js", (_event, payload) => {
		const tabId =
			payload && typeof payload === "object" ? payload.tabId : undefined;
		const code =
			payload && typeof payload === "object" ? payload.code : payload;
		debugLog.info("收到活动标签页脚本指令", code);
		const webview = tabId ? getWebview(tabId) : getActiveWebview();
		if (webview && code) {
			webview.executeJavaScript(code);
			return;
		}
		if (tabId && code) {
			queuePendingScript(tabId, code);
		}
	});

	ipcRenderer.on("tabs-state-changed", () => {
		syncActiveTabUi();
	});

	window.onerror = (message, url, line) => {
		debugLog.error(`[Renderer Error] ${message} at ${url}:${line}`);
	};
}

module.exports = {
	bindWebviewEvents,
	restoreOpacity,
};
