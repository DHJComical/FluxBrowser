const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const { normalizeNumber } = require("./helpers");
const {
	resetUpdateProgress,
	updateDebugToggle,
	updateBossKeyProtectionToggle,
	updateAlwaysOnTopToggle,
	updateVideoControlInputs,
	renderShortcuts,
	renderResolutionPresets,
	updateAspectLockButton,
} = require("./renderers");
const {
	initTabs,
	bindVideoControlEvents,
	bindResolutionEvents,
	bindCacheToggleEvents,
	bindStatusListeners,
} = require("./listeners");

const debugLog = {
	info: (...args) => {
		console.log(...args);
	},
	error: (...args) => {
		console.error(...args);
	},
	warn: (...args) => {
		console.warn(...args);
	},
};

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
		} else {
			ipcRenderer.send("settings-window-closing");
			window.close();
		}
	} catch (error) {
		console.error("保存设置失败:", error);
		alert("保存设置时出现错误，请重试");
	}
}

async function performCacheClear() {
	try {
		const hasAnyOption = Object.values(state.cacheClearOptions).some(
			(option) => option,
		);
		if (!hasAnyOption) {
			alert("请至少选择一个要清理的项目");
			return;
		}

		if (!confirm("确定要清理选中的文件吗？此操作不可逆。")) {
			return;
		}

		ipcRenderer.send("clear-cache", state.cacheClearOptions);
		dom.cacheClearBtn.disabled = true;
		dom.cacheClearBtn.textContent = "清理中...";
	} catch (error) {
		console.error("执行缓存清理失败:", error);
		alert("清理过程中出现错误，请重试");
		dom.cacheClearBtn.disabled = false;
		dom.cacheClearBtn.textContent = "开始清理";
	}
}

function bindButtonEvents() {
	if (dom.saveBtn) {
		dom.saveBtn.addEventListener("click", handleSaveWithRestart);
	}

	if (dom.cancelBtn) {
		dom.cancelBtn.addEventListener("click", () => {
			ipcRenderer.send("settings-window-closing");
			window.close();
		});
	}

	if (dom.checkUpdateBtn) {
		dom.checkUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("check-for-updates");
			dom.updateStatus.innerText = "正在检查更新...";
			dom.checkUpdateBtn.disabled = true;
			if (dom.downloadUpdateBtn) dom.downloadUpdateBtn.classList.add("hidden");
			if (dom.installUpdateBtn) dom.installUpdateBtn.classList.add("hidden");
			dom.checkUpdateBtn.classList.remove("hidden");
			resetUpdateProgress();
		});
	}

	if (dom.downloadUpdateBtn) {
		dom.downloadUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("download-update");
			dom.downloadUpdateBtn.disabled = true;
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = true;
			resetUpdateProgress({ hide: false, percent: 0 });
			if (dom.updateStatus) {
				dom.updateStatus.innerText = "\u6b63\u5728\u4e0b\u8f7d\u66f4\u65b0...";
			}
		});
	}

	if (dom.installUpdateBtn) {
		dom.installUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("quit-and-install");
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

	if (dom.syncBookmarksBtn) {
		dom.syncBookmarksBtn.addEventListener("click", () => {
			ipcRenderer.send("sync-bookmarks");
		});
	}

	if (dom.pullBookmarksBtn) {
		dom.pullBookmarksBtn.addEventListener("click", () => {
			if (confirm("确定要从远程仓库覆盖本地书签吗？此操作不可逆。")) {
				ipcRenderer.send("pull-bookmarks");
			}
		});
	}

	if (dom.syncAllBtn) {
		dom.syncAllBtn.addEventListener("click", () => {
			if (confirm("确定要上传所有配置和书签到云端吗？")) {
				ipcRenderer.send("sync-all");
			}
		});
	}

	if (dom.pullAllBtn) {
		dom.pullAllBtn.addEventListener("click", () => {
			if (confirm("确定要从云端下载并覆盖本地所有配置吗？此操作不可逆！")) {
				ipcRenderer.send("pull-all");
			}
		});
	}

	bindCacheToggleEvents(performCacheClear);
}

async function init() {
	try {
		const version = await ipcRenderer.invoke("get-app-version");
		if (dom.versionNumber) {
			dom.versionNumber.innerText = `v${version}`;
		}

		const map = await ipcRenderer.invoke("get-shortcuts");
		state.tempKeyMap = { ...map };
		renderShortcuts();

		const debugMode = await ipcRenderer.invoke("get-debug-mode");
		state.debugModeState = debugMode;
		updateDebugToggle();

		const appConfig = await ipcRenderer.invoke("get-app-config");
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

		const presets = await ipcRenderer.invoke("get-resolution-presets");
		state.tempResolutionPresets = JSON.parse(JSON.stringify(presets));
		renderResolutionPresets(debugLog);

		initTabs();
		bindButtonEvents();
		bindResolutionEvents(debugLog);
		bindStatusListeners(debugLog);
		updateAspectLockButton();
	} catch (error) {
		console.error("初始化设置页面失败:", error);
	}
}

init();
