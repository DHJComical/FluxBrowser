const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const {
	setUpdateProgress,
	resetUpdateProgress,
	renderResolutionPresets,
	updateAspectLockButton,
	updateToggleState,
} = require("./renderers");
const {
	reloadAppConfig,
	reloadDebugMode,
} = require("./appConfigUtils");
const {
	loadShortcuts,
	loadResolutionPresets,
} = require("./experienceSection");

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
			const value = Number(dom.videoForwardSecondsInput.value);
			if (Number.isFinite(value)) {
				state.videoForwardSecondsState = Math.min(600, Math.max(1, value));
			}
		});
	}

	if (dom.videoBackwardSecondsInput) {
		dom.videoBackwardSecondsInput.addEventListener("input", () => {
			const value = Number(dom.videoBackwardSecondsInput.value);
			if (Number.isFinite(value)) {
				state.videoBackwardSecondsState = Math.min(600, Math.max(1, value));
			}
		});
	}

	if (dom.videoLongPressRateInput) {
		dom.videoLongPressRateInput.addEventListener("input", () => {
			const value = Number(dom.videoLongPressRateInput.value);
			if (Number.isFinite(value)) {
				state.videoLongPressRateState = Math.min(16, Math.max(0.25, value));
			}
		});
	}
}

function bindResolutionEvents({ debugLog, showToast }) {
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
		const width = parseInt(dom.presetWidth.value, 10);
		const height = parseInt(dom.presetHeight.value, 10);

		if (!name || !width || !height) {
			showToast("请填写完整的分辨率名称、宽度和高度。", {
				type: "warning",
				title: "信息不完整",
			});
			return;
		}

		if (width < 200 || width > 4000 || height < 150 || height > 3000) {
			showToast("分辨率范围不合法，请保持宽度 200-4000、高度 150-3000。", {
				type: "warning",
				title: "数值超出范围",
			});
			return;
		}

		const duplicate = state.tempResolutionPresets.some(
			(preset) => preset.width === width && preset.height === height,
		);
		if (duplicate) {
			showToast("该分辨率预设已经存在。", {
				type: "warning",
				title: "重复预设",
			});
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
		showToast(`已添加预设：${name}`, {
			type: "success",
			title: "分辨率已保存",
		});
	});
}

function bindCacheToggleEvents() {
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
}

function resetSyncButtons() {
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
}

function resetCacheClearState() {
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
}

async function reloadClearedState(debugLog) {
	if (state.cacheClearOptions.clearKeyConfig) {
		await loadShortcuts();
	}

	if (state.cacheClearOptions.clearAppConfig) {
		await reloadAppConfig();
		await reloadDebugMode();
	}

	if (state.cacheClearOptions.clearResolutionPresets) {
		await loadResolutionPresets(debugLog);
	}
}

function bindStatusListeners({ debugLog, showToast }) {
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
			if (data.status === "error") {
				showToast(data.msg || "更新检查失败，请稍后重试。", {
					type: "error",
					title: "更新失败",
				});
			}
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
			showToast("更新已下载完成，随时可以安装。", {
				type: "success",
				title: "更新已就绪",
			});
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
			showToast(data.msg || "发现新版本，可开始下载。", {
				type: "info",
				title: "发现更新",
			});
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
			return;
		}

		if (data.status === "pulling") {
			if (dom.pullBookmarksBtn) {
				dom.pullBookmarksBtn.disabled = true;
				dom.pullBookmarksBtn.innerHTML =
					'<i class="material-icons">sync</i> 拉取中...';
			}
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
			return;
		}

		resetSyncButtons();
		showToast(data.message, {
			type: data.success ? "success" : "error",
			title: data.success ? "书签同步完成" : "书签同步失败",
		});
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
			return;
		}

		if (data.status === "pulling") {
			if (dom.pullAllBtn) {
				dom.pullAllBtn.disabled = true;
				dom.pullAllBtn.innerHTML =
					'<i class="material-icons">sync</i> 下载中...';
			}
			if (dom.syncAllBtn) dom.syncAllBtn.disabled = true;
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = true;
			return;
		}

		resetSyncButtons();
		showToast(data.message, {
			type: data.success ? "success" : "error",
			title: data.success ? "同步完成" : "同步失败",
		});
	});

	ipcRenderer.on("cache-cleared", async (_event, data) => {
		if (!data.success) {
			showToast("缓存清理失败，请重试。", {
				type: "error",
				title: "清理失败",
			});
			resetCacheClearState();
			return;
		}

		try {
			await reloadClearedState(debugLog);
		} catch (error) {
			console.error("重新加载配置数据失败:", error);
			showToast("缓存已清理，但界面状态刷新失败，请重新打开设置页。", {
				type: "warning",
				title: "状态未完全刷新",
			});
		}

		resetCacheClearState();
		showToast(data.message || "缓存清理完成。", {
			type: "success",
			title: "清理完成",
		});
	});
}

module.exports = {
	initTabs,
	bindVideoControlEvents,
	bindResolutionEvents,
	bindCacheToggleEvents,
	bindStatusListeners,
};
