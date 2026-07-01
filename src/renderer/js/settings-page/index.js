const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const debugLog = require("./debugLog");
const {
	resetUpdateProgress,
	updateDebugToggle,
	updateBossKeyProtectionToggle,
	updateAlwaysOnTopToggle,
} = require("./renderers");
const {
	initTabs,
	bindVideoControlEvents,
	bindResolutionEvents,
	bindCacheToggleEvents,
	bindStatusListeners,
} = require("./listeners");
const { initExperienceSection } = require("./experienceSection");
const { bindSyncActions } = require("./syncSection");
const { bindSystemActions } = require("./systemSection");
const { showToast, confirmAction } = require("../shared/feedback");

function handleSaveWithRestart() {
	try {
		ipcRenderer.send("save-shortcuts", state.tempKeyMap);
		ipcRenderer.send("set-debug-mode", state.debugModeState);
		ipcRenderer.send("save-app-config", {
			bossKeyProtection: state.bossKeyProtectionState,
			alwaysOnTop: state.alwaysOnTopState,
			videoForwardSeconds: state.videoForwardSecondsState,
			videoBackwardSeconds: state.videoBackwardSecondsState,
			videoLongPressRate: state.videoLongPressRateState,
			gitPat: dom.gitPatInput.value,
			gitRemote: dom.gitRemoteInput.value,
			gitName: dom.gitNameInput.value,
			gitEmail: dom.gitEmailInput.value,
		});
		ipcRenderer.send("save-resolution-presets", state.tempResolutionPresets);

		const needsRestart =
			state.cacheClearOptions.clearKeyConfig ||
			state.cacheClearOptions.clearWindowConfig ||
			state.cacheClearOptions.clearAppConfig ||
			state.cacheClearOptions.clearResolutionPresets;

		if (needsRestart) {
			ipcRenderer.send("restart-after-save");
			window.close();
			return;
		}

		ipcRenderer.send("settings-window-closing");
		window.close();
	} catch (error) {
		console.error("保存设置失败:", error);
		showToast("保存设置时出现错误，请重试。", {
			type: "error",
			title: "设置未保存",
		});
	}
}

function bindCoreActions() {
	if (dom.saveBtn) {
		dom.saveBtn.addEventListener("click", handleSaveWithRestart);
	}

	if (dom.cancelBtn) {
		dom.cancelBtn.addEventListener("click", () => {
			ipcRenderer.send("settings-window-closing");
			window.close();
		});
	}

	if (dom.debugModeToggle) {
		dom.debugModeToggle.addEventListener("click", () => {
			state.debugModeState = !state.debugModeState;
			updateDebugToggle();
		});
	}

	if (dom.bossKeyProtectionToggle) {
		dom.bossKeyProtectionToggle.addEventListener("click", () => {
			state.bossKeyProtectionState = !state.bossKeyProtectionState;
			updateBossKeyProtectionToggle();
		});
	}

	if (dom.alwaysOnTopToggle) {
		dom.alwaysOnTopToggle.addEventListener("click", () => {
			state.alwaysOnTopState = !state.alwaysOnTopState;
			updateAlwaysOnTopToggle();
		});
	}

	bindVideoControlEvents();
	bindResolutionEvents({ debugLog, showToast });
	bindCacheToggleEvents();
}

async function init() {
	try {
		const version = await ipcRenderer.invoke("get-app-version");
		if (dom.versionNumber) {
			dom.versionNumber.innerText = `v${version}`;
		}

		await initExperienceSection(debugLog);

		initTabs();
		bindCoreActions();
		bindSyncActions({ confirmAction });
		bindSystemActions({
			resetUpdateProgress,
			showToast,
			confirmAction,
		});
		bindStatusListeners({ debugLog, showToast });
	} catch (error) {
		console.error("初始化设置页面失败:", error);
		showToast("设置页初始化失败，请重新打开。", {
			type: "error",
			title: "加载失败",
		});
	}
}

init();
