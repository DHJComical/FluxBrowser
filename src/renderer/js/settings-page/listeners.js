const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const {
	setUpdateProgress,
	resetUpdateProgress,
	renderLanguageOptions,
	renderResolutionPresets,
	setLanguageSelectOpen,
	updateAspectLockButton,
	updateToggleState,
} = require("./renderers");
const {
	reloadAppConfig,
	reloadDebugMode,
} = require("./appConfigUtils");
const { t } = require("../shared/i18n");
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

	if (dom.languageSelect) {
		dom.languageSelect.addEventListener("change", () => {
			state.language = dom.languageSelect.value || "zh-CN";
			renderLanguageOptions();
		});
	}

	if (dom.languageSelectTrigger && dom.languageSelectCustom) {
		dom.languageSelectTrigger.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const isHidden = dom.languageSelectMenu?.classList.contains("hidden");
			setLanguageSelectOpen(Boolean(isHidden));
		});

		dom.languageSelectTrigger.addEventListener("keydown", (event) => {
			if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
				event.preventDefault();
				setLanguageSelectOpen(true);
				const activeOption =
					dom.languageSelectOptions.find(
						(option) => option.dataset.value === state.language,
					) || dom.languageSelectOptions[0];
				activeOption?.focus();
			}
		});

		dom.languageSelectOptions.forEach((option, index) => {
			option.addEventListener("click", (event) => {
				event.preventDefault();
				const nextLanguage = option.dataset.value || "zh-CN";
				state.language = nextLanguage;
				if (dom.languageSelect) {
					dom.languageSelect.value = nextLanguage;
				}
				renderLanguageOptions();
				setLanguageSelectOpen(false);
			});

			option.addEventListener("keydown", (event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					setLanguageSelectOpen(false);
					dom.languageSelectTrigger?.focus();
					return;
				}

				if (event.key === "ArrowDown") {
					event.preventDefault();
					dom.languageSelectOptions[index + 1]?.focus();
					return;
				}

				if (event.key === "ArrowUp") {
					event.preventDefault();
					if (index === 0) {
						dom.languageSelectTrigger?.focus();
						return;
					}
					dom.languageSelectOptions[index - 1]?.focus();
				}
			});
		});

		document.addEventListener("click", (event) => {
			if (!dom.languageSelectCustom.contains(event.target)) {
				setLanguageSelectOpen(false);
			}
		});

		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				setLanguageSelectOpen(false);
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
			showToast(t("settings.resolution.incompleteMessage"), {
				type: "warning",
				title: t("settings.resolution.incompleteTitle"),
			});
			return;
		}

		if (width < 200 || width > 4000 || height < 150 || height > 3000) {
			showToast(t("settings.resolution.outOfRangeMessage"), {
				type: "warning",
				title: t("settings.resolution.outOfRangeTitle"),
			});
			return;
		}

		const duplicate = state.tempResolutionPresets.some(
			(preset) => preset.width === width && preset.height === height,
		);
		if (duplicate) {
			showToast(t("settings.resolution.duplicateMessage"), {
				type: "warning",
				title: t("settings.resolution.duplicateTitle"),
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
		showToast(t("settings.resolution.addedMessage", { name }), {
			type: "success",
			title: t("settings.resolution.savedTitle"),
		});
	});
}

function bindCacheToggleEvents() {
	function syncCacheClearButtonState() {
		if (!dom.cacheClearBtn || dom.cacheClearBtn.dataset.busy === "true") {
			return;
		}

		const hasAnyOption = Object.values(state.cacheClearOptions).some(Boolean);
		dom.cacheClearBtn.disabled = !hasAnyOption;
	}

	if (dom.clearLogsToggle) {
		dom.clearLogsToggle.addEventListener("change", () => {
			state.cacheClearOptions.clearLogs = dom.clearLogsToggle.checked;
			updateToggleState(
				dom.clearLogsToggle,
				state.cacheClearOptions.clearLogs,
			);
			syncCacheClearButtonState();
		});
	}

	if (dom.clearKeyConfigToggle) {
		dom.clearKeyConfigToggle.addEventListener("change", () => {
			state.cacheClearOptions.clearKeyConfig = dom.clearKeyConfigToggle.checked;
			updateToggleState(
				dom.clearKeyConfigToggle,
				state.cacheClearOptions.clearKeyConfig,
			);
			syncCacheClearButtonState();
		});
	}

	if (dom.clearWindowConfigToggle) {
		dom.clearWindowConfigToggle.addEventListener("change", () => {
			state.cacheClearOptions.clearWindowConfig =
				dom.clearWindowConfigToggle.checked;
			updateToggleState(
				dom.clearWindowConfigToggle,
				state.cacheClearOptions.clearWindowConfig,
			);
			syncCacheClearButtonState();
		});
	}

	if (dom.clearAppConfigToggle) {
		dom.clearAppConfigToggle.addEventListener("change", () => {
			state.cacheClearOptions.clearAppConfig = dom.clearAppConfigToggle.checked;
			updateToggleState(
				dom.clearAppConfigToggle,
				state.cacheClearOptions.clearAppConfig,
			);
			syncCacheClearButtonState();
		});
	}

	if (dom.clearResolutionPresetsToggle) {
		dom.clearResolutionPresetsToggle.addEventListener("change", () => {
			state.cacheClearOptions.clearResolutionPresets =
				dom.clearResolutionPresetsToggle.checked;
			updateToggleState(
				dom.clearResolutionPresetsToggle,
				state.cacheClearOptions.clearResolutionPresets,
			);
			syncCacheClearButtonState();
		});
	}

	syncCacheClearButtonState();
}

function resetSyncButtons() {
	if (dom.syncBookmarksBtn) {
		dom.syncBookmarksBtn.disabled = false;
		dom.syncBookmarksBtn.innerHTML =
			`<i class="material-icons">bookmark</i> ${t("settings.sync.uploadBookmarks")}`;
	}
	if (dom.pullBookmarksBtn) {
		dom.pullBookmarksBtn.disabled = false;
		dom.pullBookmarksBtn.innerHTML =
			`<i class="material-icons">bookmark</i> ${t("settings.sync.downloadBookmarks")}`;
	}
	if (dom.syncAllBtn) {
		dom.syncAllBtn.disabled = false;
		dom.syncAllBtn.innerHTML =
			`<i class="material-icons">cloud_upload</i> ${t("settings.sync.uploadAll")}`;
	}
	if (dom.pullAllBtn) {
		dom.pullAllBtn.disabled = false;
		dom.pullAllBtn.innerHTML =
			`<i class="material-icons">cloud_download</i> ${t("settings.sync.downloadAll")}`;
	}
}

function resetCacheClearState() {
	Object.keys(state.cacheClearOptions).forEach((key) => {
		state.cacheClearOptions[key] = false;
	});
	document
		.querySelectorAll(".cache-section .cache-option-checkbox")
		.forEach((toggle) => {
			updateToggleState(toggle, false);
		});
	if (dom.cacheClearBtn) {
		dom.cacheClearBtn.dataset.busy = "false";
		dom.cacheClearBtn.disabled = true;
		dom.cacheClearBtn.textContent = t("settings.cache.startAction");
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
			dom.updateStatus.innerText = t(data.msg || "");
		}

		if (data.status === "not-available" || data.status === "error") {
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = false;
			if (dom.downloadUpdateBtn) {
				dom.downloadUpdateBtn.classList.add("hidden");
				dom.downloadUpdateBtn.disabled = false;
			}
			resetUpdateProgress();
			if (data.status === "error") {
				showToast(data.msg || t("settings.update.errorMessage"), {
					type: "error",
					title: t("settings.update.errorTitle"),
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
			showToast(t("settings.update.readyMessage"), {
				type: "success",
				title: t("settings.update.readyTitle"),
			});
		}

		if (data.status === "available") {
			if (dom.updateStatus) dom.updateStatus.innerText = t(data.msg || "");
			if (dom.checkUpdateBtn) dom.checkUpdateBtn.disabled = false;
			if (dom.downloadUpdateBtn) {
				dom.downloadUpdateBtn.classList.remove("hidden");
				dom.downloadUpdateBtn.disabled = false;
			}
			if (dom.installUpdateBtn) dom.installUpdateBtn.classList.add("hidden");
			resetUpdateProgress();
			showToast(data.msg || t("settings.update.availableMessage"), {
				type: "info",
				title: t("settings.update.availableTitle"),
			});
		}
	});

	ipcRenderer.on("update-progress", (_event, data) => {
		if (!data || data.percent === undefined) return;
		setUpdateProgress(data.percent);
		if (dom.updateStatus) {
			dom.updateStatus.innerText = t("settings.update.downloadingProgress", {
				percent: Math.round(data.percent),
			});
		}
	});

	ipcRenderer.on("bookmark-sync-status", (_event, data) => {
		if (data.status === "syncing") {
			if (dom.syncBookmarksBtn) {
				dom.syncBookmarksBtn.disabled = true;
				dom.syncBookmarksBtn.innerHTML =
					`<i class="material-icons">sync</i> ${t("settings.sync.syncing")}`;
			}
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = true;
			return;
		}

		if (data.status === "pulling") {
			if (dom.pullBookmarksBtn) {
				dom.pullBookmarksBtn.disabled = true;
				dom.pullBookmarksBtn.innerHTML =
					`<i class="material-icons">sync</i> ${t("settings.sync.pulling")}`;
			}
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
			return;
		}

		resetSyncButtons();
		showToast(data.message, {
			type: data.success ? "success" : "error",
			title: data.success
				? t("settings.sync.bookmarksSuccessTitle")
				: t("settings.sync.bookmarksErrorTitle"),
		});
	});

	ipcRenderer.on("sync-all-status", (_event, data) => {
		if (data.status === "syncing") {
			if (dom.syncAllBtn) {
				dom.syncAllBtn.disabled = true;
				dom.syncAllBtn.innerHTML =
					`<i class="material-icons">sync</i> ${t("settings.sync.syncing")}`;
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
					`<i class="material-icons">sync</i> ${t("settings.sync.downloading")}`;
			}
			if (dom.syncAllBtn) dom.syncAllBtn.disabled = true;
			if (dom.syncBookmarksBtn) dom.syncBookmarksBtn.disabled = true;
			if (dom.pullBookmarksBtn) dom.pullBookmarksBtn.disabled = true;
			return;
		}

		resetSyncButtons();
		showToast(data.message, {
			type: data.success ? "success" : "error",
			title: data.success
				? t("settings.sync.successTitle")
				: t("settings.sync.errorTitle"),
		});
	});

	ipcRenderer.on("cache-cleared", async (_event, data) => {
		if (!data.success) {
			showToast(t("settings.cache.errorMessage"), {
				type: "error",
				title: t("settings.cache.errorTitle"),
			});
			resetCacheClearState();
			return;
		}

		try {
			await reloadClearedState(debugLog);
		} catch (error) {
			console.error("logs.settings.cache.reloadFailed", error);
			showToast(t("settings.cache.partialRefreshMessage"), {
				type: "warning",
				title: t("settings.cache.partialRefreshTitle"),
			});
		}

		resetCacheClearState();
		showToast(data.message || t("settings.cache.doneMessage"), {
			type: "success",
			title: t("settings.cache.doneTitle"),
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
