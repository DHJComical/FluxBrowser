const { ipcRenderer } = require("electron");
const state = require("./state");
const { applyAppConfig } = require("./appConfigUtils");
const {
	renderShortcuts,
	renderResolutionPresets,
	updateAspectLockButton,
	updateDebugToggle,
} = require("./renderers");

async function loadShortcuts() {
	const map = await ipcRenderer.invoke("get-shortcuts");
	state.tempKeyMap = { ...map };
	renderShortcuts();
}

async function loadDebugMode() {
	const debugMode = await ipcRenderer.invoke("get-debug-mode");
	state.debugModeState = debugMode;
	updateDebugToggle();
}

async function loadResolutionPresets(debugLog) {
	const presets = await ipcRenderer.invoke("get-resolution-presets");
	state.tempResolutionPresets = JSON.parse(JSON.stringify(presets));
	renderResolutionPresets(debugLog);
	updateAspectLockButton();
}

async function initExperienceSection(debugLog) {
	const appConfig = await ipcRenderer.invoke("get-app-config");

	await loadShortcuts();
	await loadDebugMode();
	applyAppConfig(appConfig);
	await loadResolutionPresets(debugLog);
}

module.exports = {
	initExperienceSection,
	loadShortcuts,
	loadDebugMode,
	loadResolutionPresets,
};
