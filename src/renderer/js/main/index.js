const { ipcRenderer } = require("electron");
const debugLog = require("./debug");
const { setDebugMode } = require("./state");
const { bindNavigationEvents } = require("./navigation");
const { bindMenuEvents, loadResolutionPresets } = require("./menu");
const { bindImmersionEvents } = require("./immersion");
const { bindWebviewEvents, restoreOpacity } = require("./webview");
const { bindTabsEvents, hydrateTabsState } = require("./tabs");
const { bindLayoutEvents } = require("./layout");
const { bindFloatingPanels } = require("./floatingPanels");

async function init() {
	bindFloatingPanels();
	bindTabsEvents();
	bindNavigationEvents();
	bindMenuEvents();
	bindImmersionEvents();
	bindWebviewEvents();
	bindLayoutEvents();
	await hydrateTabsState();

	ipcRenderer
		.invoke("get-debug-mode")
		.then((debugMode) => {
			setDebugMode(debugMode);
		})
		.catch((error) => {
			console.error("获取调试模式失败:", error);
		});

	restoreOpacity();
	loadResolutionPresets();

	debugLog.info("主渲染进程已加载");
}

init();
