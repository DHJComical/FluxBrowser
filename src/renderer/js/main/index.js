const { ipcRenderer } = require("electron");
const debugLog = require("./debug");
const { setDebugMode } = require("./state");
const { initI18n } = require("../shared/i18n");
const { bindNavigationEvents } = require("./navigation");
const { bindMenuEvents, loadResolutionPresets } = require("./menu");
const { bindImmersionEvents } = require("./immersion");
const { bindWebviewEvents, restoreOpacity } = require("./webview");
const { bindTabsEvents, hydrateTabsState } = require("./tabs");
const { bindLayoutEvents } = require("./layout");
const { bindFloatingPanels } = require("./floatingPanels");
const { bindDirectionIndicatorEvents } = require("./directionIndicator");
const { bindSubtitleCollectorEvents } = require("./subtitleCollector");
const {
	bindMotionPreferenceEvents,
	hydrateMotionPreference,
} = require("./motion");

async function init() {
	await initI18n();
	await hydrateMotionPreference();
	bindMotionPreferenceEvents();
	await bindFloatingPanels();
	bindTabsEvents();
	bindNavigationEvents();
	bindMenuEvents();
	bindImmersionEvents();
	bindWebviewEvents();
	bindLayoutEvents();
	bindDirectionIndicatorEvents();
	bindSubtitleCollectorEvents();
	await hydrateTabsState();

	ipcRenderer
		.invoke("get-debug-mode")
		.then((debugMode) => {
			setDebugMode(debugMode);
		})
		.catch((error) => {
			console.error("logs.main.debugMode.fetchFailed", error);
		});

	restoreOpacity();
	loadResolutionPresets();

	debugLog.info("logs.main.rendererLoaded");
}

init();
