const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const { normalizeNumber } = require("./helpers");
const {
	setUpdateProgress,
	resetUpdateProgress,
	updateDebugToggle,
	updateBossKeyProtectionToggle,
	updateAlwaysOnTopToggle,
	updateVideoControlInputs,
	renderShortcuts,
	renderResolutionPresets,
	updateAspectLockButton,
	updateToggleState,
} = require("./renderers");

function initTabs() {
	const tabs = document.querySelectorAll(".settings-tab");
	const panels = document.querySelectorAll(".settings-panel");
	if (!tabs.length || !panels.length) return;

	function activatePanel(targetPanel) {
		tabs.forEach((item) => {
			item.classList.toggle(
				"active",
				item.getAttribute("data-panel") === targetPanel,
			);
		});
		panels.forEach((panel) => {
			panel.classList.toggle("active", panel.id === `panel-${targetPanel}`);
		});
	}

	const defaultTab = document.querySelector(".settings-tab.active") || tabs[0];
	if (defaultTab) {
		activatePanel(defaultTab.getAttribute("data-panel"));
	}

	tabs.forEach((tab) => {
		tab.addEventListener("click", (event) => {
			event.stopPropagation();
			activatePanel(tab.getAttribute("data-panel"));
		});
	});
}

function bindVideoControlEvents() {
	if (dom.videoForwardSecondsInput) {
		dom.videoForwardSecondsInput.addEventListener("input", () => {
			state.videoForwardSecondsState = normalizeNumber(
				dom.videoForwardSecondsInput.value,
				10,
				1,
				600,
			);
		});
	}

	if (dom.videoBackwardSecondsInput) {
		dom.videoBackwardSecondsInput.addEventListener("input", () => {
			state.videoBackwardSecondsState = normalizeNumber(
				dom.videoBackwardSecondsInput.value,
				10,
				1,
				600,
			);
		});
	}

	if (dom.videoLongPressRateInput) {
		dom.videoLongPressRateInput.addEventListener("input", () => {
			state.videoLongPressRateState = normalizeNumber(
				dom.videoLongPressRateInput.value,
				2.0,
				0.25,
				16,
			);
		});
	}
}

function bindResolutionEvents(debugLog) {
	if (!dom.aspectRatioLock) return;

	dom.aspectRatioLock.addEventListener("click", (event) => {
		event.preventDefault();
		if (dom.presetWidth.value && dom.presetHeight.value) {
			state.aspectLocked = !state.aspectLocked;
			state.lockedAspectRatio =
				parseFloat(dom.presetWidth.value) / parseFloat(dom.presetHeight.value);
			updateAspectLockButton();
		}
	});

	dom.presetWidth.addEventListener("input", () => {
		if (state.aspectLocked && dom.presetWidth.value && state.lockedAspectRatio) {
			dom.presetHeight.value = Math.round(
				dom.presetWidth.value / state.lockedAspectRatio,
			);
		}
	});

	dom.presetHeight.addEventListener("input", () => {
		if (state.aspectLocked && dom.presetHeight.value && state.lockedAspectRatio) {
			dom.presetWidth.value = Math.round(
				dom.presetHeight.value * state.lockedAspectRatio,
			);
		}
	});

	dom.addPresetBtn.addEventListener("click", () => {
		const name = dom.presetName.value.trim();
		const width = parseInt(dom.presetWidth.value);
		const height = parseInt(dom.presetHeight.value);

		if (!name || !width || !height) {
			alert("请填写完整的分辨率信息");
			return;
		}

		if (width < 200 || width > 4000 || height < 150 || height > 3000) {
			alert("分辨率范围不合法（宽度200-4000, 高度150-3000）");
			return;
		}

		const duplicate = state.tempResolutionPresets.some(
			(preset) => preset.width === width && preset.height === height,
		);
		if (duplicate) {
			alert("该分辨率已存在");
			return;
		}

		state.tempResolutionPresets.push({ width, height, name });
		renderResolutionPresets(debugLog);

		dom.presetName.value = "";
		dom.presetWidth.value = "";
		dom.presetHeight.value = "";
		state.aspectLocked = false;
		state.lockedAspectRatio = null;
		updateAspectLockButton();
	});
}

function bindCacheToggleEvents(performCacheClear) {
	if (dom.clearLogsToggle) {
		dom.clearLogsToggle.addEventListener("click", () => {
			state.cacheClearOptions.clearLogs = !state.cacheClearOptions.clearLogs;
			updateToggleState(
				dom.clearLogsToggle,
				state.cacheClearOptions.clearLogs,
			);
		});
	}

	if (dom.clearKeyConfigToggle) {
		dom.clearKeyConfigToggle.addEventListener("click", () => {
			state.cacheClearOptions.clearKeyConfig =
				!state.cacheClearOptions.clearKeyConfig;
			updateToggleState(
				dom.clearKeyConfigToggle,
				state.cacheClearOptions.clearKeyConfig,
			);
		});
	}

	if (dom.clearWindowConfigToggle) {
		dom.clearWindowConfigToggle.addEventListener("click", () => {
			state.cacheClearOptions.clearWindowConfig =
				!state.cacheClearOptions.clearWindowConfig;
			updateToggleState(
				dom.clearWindowConfigToggle,
				state.cacheClearOptions.clearWindowConfig,
			);
		});
	}

	if (dom.clearAppConfigToggle) {
		dom.clearAppConfigToggle.addEventListener("click", () => {
			state.cacheClearOptions.clearAppConfig =
				!state.cacheClearOptions.clearAppConfig;
			updateToggleState(
				dom.clearAppConfigToggle,
				state.cacheClearOptions.clearAppConfig,
			);
		});
	}

	if (dom.clearResolutionPresetsToggle) {
		dom.clearResolutionPresetsToggle.addEventListener("click", () => {
			state.cacheClearOptions.clearResolutionPresets =
				!state.cacheClearOptions.clearResolutionPresets;
			updateToggleState(
				dom.clearResolutionPresetsToggle,
				state.cacheClearOptions.clearResolutionPresets,
			);
		});
	}

	if (dom.cacheClearBtn) {
		dom.cacheClearBtn.addEventListener("click", () => {
			performCacheClear();
		});
	}
}

function bindStatusListeners(debugLog) {
	ipcRenderer.on("update-message", (_event, data) => {
		if (dom.updateStatus) {
			dom.updateStatus.innerText = data.msg;
		}

		if (data.status === "not-available" || data.status === "error") {
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = false;
			if (dom.downloadUpdateBtn) {
				dom.downloadUpdateBtn.classList.add("hidden");
				dom.downloadUpdateBtn.disabled = false;
			}
			resetUpdateProgress();
		}

		if (data.status === "downloaded") {
			if (dom.downloadUpdateBtn) {
				dom.downloadUpdateBtn.classList.add("hidden");
				dom.downloadUpdateBtn.disabled = false;
			}
			if (dom.installUpdateBtn) dom.installUpdateBtn.classList.remove("hidden");
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.classList.add("hidden");
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = false;
			resetUpdateProgress({ hide: false, percent: 100 });
		}

		if (data.status === "available") {
			if (dom.updateStatus) dom.updateStatus.innerText = data.msg;
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = false;
			if (dom.downloadUpdateBtn) {
				dom.downloadUpdateBtn.classList.remove("hidden");
				dom.downloadUpdateBtn.disabled = false;
			}
			if (dom.installUpdateBtn) dom.installUpdateBtn.classList.add("hidden");
			resetUpdateProgress();
		}
	});

	ipcRenderer.on("update-progress", (_event, data) => {
		if (!data || data.percent === undefined) return;
		setUpdateProgress(data.percent);
		if (dom.updateStatus) {
			dom.updateStatus.innerText = `正在下载更新... ${Math.round(data.percent)}%`;
		}
	});

	ipcRenderer.on("bookmark-sync-status", (_event, data) => {
		if (data.status === "syncing") {
			if (dom.syncBookmarksBtn) {
				dom.syncBookmarksBtn.disabled = true;
				dom.syncBookmarksBtn.innerHTML =
					'<i class="material-icons">sync</i> 同步中...';
			}
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = true;
		} else if (data.status === "pulling") {
			if (dom.pullBookmarksBtn) {
				dom.pullBookmarksBtn.disabled = true;
				dom.pullBookmarksBtn.innerHTML =
					'<i class="material-icons">sync</i> 拉取中...';
			}
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
		} else {
			if (dom.syncBookmarksBtn) {
				dom.syncBookmarksBtn.disabled = false;
				dom.syncBookmarksBtn.innerHTML =
					'<i class="material-icons">bookmark</i> 仅上传书签';
			}
			if (dom.pullBookmarksBtn) {
				dom.pullBookmarksBtn.disabled = false;
				dom.pullBookmarksBtn.innerHTML =
					'<i class="material-icons">bookmark</i> 仅下载书签';
			}
			alert(data.success ? data.message : `操作失败: ${data.message}`);
		}
	});

	ipcRenderer.on("sync-all-status", (_event, data) => {
		if (data.status === "syncing") {
			if (dom.syncAllBtn) {
				dom.syncAllBtn.disabled = true;
				dom.syncAllBtn.innerHTML =
					'<i class="material-icons">sync</i> 同步中...';
			}
			if (dom.pullAllBtn) dom.pullAllBtn.disabled = true;
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = true;
		} else if (data.status === "pulling") {
			if (dom.pullAllBtn) {
				dom.pullAllBtn.disabled = true;
				dom.pullAllBtn.innerHTML =
					'<i class="material-icons">sync</i> 下载中...';
			}
			if (dom.syncAllBtn) dom.syncAllBtn.disabled = true;
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = true;
		} else {
			if (dom.syncAllBtn) {
				dom.syncAllBtn.disabled = false;
				dom.syncAllBtn.innerHTML =
					'<i class="material-icons">cloud_upload</i> 上传所有配置到云端';
			}
			if (dom.pullAllBtn) {
				dom.pullAllBtn.disabled = false;
				dom.pullAllBtn.innerHTML =
					'<i class="material-icons">cloud_download</i> 从云端下载覆盖本地';
			}
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = false;
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = false;
			alert(data.success ? data.message : `操作失败: ${data.message}`);
		}
	});

	ipcRenderer.on("cache-cleared", async (_event, data) => {
		if (!data.success) {
			alert("缓存清理失败，请重试");
			return;
		}

		alert("缓存清理完成！");

		try {
			if (state.cacheClearOptions.clearKeyConfig) {
				const map = await ipcRenderer.invoke("get-shortcuts");
				state.tempKeyMap = { ...map };
				renderShortcuts();
			}

			if (state.cacheClearOptions.clearAppConfig) {
				const appConfig = await ipcRenderer.invoke("get-app-config");
				const debugMode = await ipcRenderer.invoke("get-debug-mode");
				state.debugModeState = debugMode;
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
				updateDebugToggle();
				updateBossKeyProtectionToggle();
				updateAlwaysOnTopToggle();
				updateVideoControlInputs();
			}

			if (state.cacheClearOptions.clearResolutionPresets) {
				const presets = await ipcRenderer.invoke("get-resolution-presets");
				state.tempResolutionPresets = JSON.parse(JSON.stringify(presets));
				renderResolutionPresets(debugLog);
			}
		} catch (error) {
			console.error("重新加载配置数据失败:", error);
		}

		Object.keys(state.cacheClearOptions).forEach((key) => {
			state.cacheClearOptions[key] = false;
		});
		document
			.querySelectorAll(".cache-section .toggle-switch")
			.forEach((toggle) => {
				toggle.classList.remove("active");
			});
		if (dom.cacheClearBtn) {
			dom.cacheClearBtn.disabled = false;
			dom.cacheClearBtn.textContent = "开始清理";
		}
	});
}

module.exports = {
	initTabs,
	bindVideoControlEvents,
	bindResolutionEvents,
	bindCacheToggleEvents,
	bindStatusListeners,
};
