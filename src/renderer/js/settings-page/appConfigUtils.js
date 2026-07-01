const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const { normalizeNumber } = require("./helpers");
const {
	updateDebugToggle,
	updateBossKeyProtectionToggle,
	updateAlwaysOnTopToggle,
	updateVideoControlInputs,
} = require("./renderers");

function applyAppConfig(appConfig) {
	if (dom.gitPatInput) dom.gitPatInput.value = appConfig.gitPat || "";
	if (dom.gitRemoteInput) dom.gitRemoteInput.value = appConfig.gitRemote || "";
	if (dom.gitNameInput) dom.gitNameInput.value = appConfig.gitName || "";
	if (dom.gitEmailInput) dom.gitEmailInput.value = appConfig.gitEmail || "";

	state.bossKeyProtectionState = appConfig.bossKeyProtection !== false;
	state.alwaysOnTopState = appConfig.alwaysOnTop === true;
	state.videoForwardSecondsState = normalizeNumber(
		appConfig.videoForwardSeconds,
		10,
		1,
		600,
	);
	state.videoBackwardSecondsState = normalizeNumber(
		appConfig.videoBackwardSeconds,
		10,
		1,
		600,
	);
	state.videoLongPressRateState = normalizeNumber(
		appConfig.videoLongPressRate,
		2.0,
		0.25,
		16,
	);

	updateBossKeyProtectionToggle();
	updateAlwaysOnTopToggle();
	updateVideoControlInputs();
}

async function reloadAppConfig() {
	const appConfig = await ipcRenderer.invoke("get-app-config");
	applyAppConfig(appConfig);
	return appConfig;
}

async function reloadDebugMode() {
	const debugMode = await ipcRenderer.invoke("get-debug-mode");
	state.debugModeState = debugMode;
	updateDebugToggle();
	return debugMode;
}

module.exports = {
	applyAppConfig,
	reloadAppConfig,
	reloadDebugMode,
};
