const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const { labelMap } = require("./constants");
const { t } = require("../shared/i18n");

function setUpdateProgress(percent) {
	const progressContainer = document.getElementById(
		"update-progress-container",
	);
	const progressBar = document.getElementById("update-progress-bar");
	if (!progressContainer || !progressBar) return;

	const normalizedPercent = Math.max(0, Math.min(100, Number(percent) || 0));
	progressContainer.classList.add("active");
	progressBar.style.width = `${normalizedPercent}%`;
}

function resetUpdateProgress({ hide = true, percent = 0 } = {}) {
	const progressContainer = document.getElementById(
		"update-progress-container",
	);
	const progressBar = document.getElementById("update-progress-bar");
	if (!progressContainer || !progressBar) return;

	progressBar.style.width = `${Math.max(0, Math.min(100, Number(percent) || 0))}%`;
	if (hide) {
		progressContainer.classList.remove("active");
	} else {
		progressContainer.classList.add("active");
	}
}

function updateDebugToggle() {
	if (dom.debugModeToggle) {
		dom.debugModeToggle.classList.toggle("active", state.debugModeState);
	}
}

function updateBossKeyProtectionToggle() {
	if (dom.bossKeyProtectionToggle) {
		dom.bossKeyProtectionToggle.classList.toggle(
			"active",
			state.bossKeyProtectionState,
		);
	}
}

function updateAlwaysOnTopToggle() {
	if (dom.alwaysOnTopToggle) {
		dom.alwaysOnTopToggle.classList.toggle("active", state.alwaysOnTopState);
	}
}

function updateDirectionIndicatorToggle() {
	if (dom.directionIndicatorToggle) {
		dom.directionIndicatorToggle.classList.toggle(
			"active",
			state.directionIndicatorEnabledState,
		);
	}
}

function updateVideoControlInputs() {
	if (dom.videoForwardSecondsInput) {
		dom.videoForwardSecondsInput.value = state.videoForwardSecondsState;
	}
	if (dom.videoBackwardSecondsInput) {
		dom.videoBackwardSecondsInput.value = state.videoBackwardSecondsState;
	}
	if (dom.videoLongPressRateInput) {
		dom.videoLongPressRateInput.value = state.videoLongPressRateState;
	}
}

function getLanguageOptionLabel(value) {
	if (value === "en-US") {
		return t("locale.en-US");
	}
	return t("locale.zh-CN");
}

function renderLanguageOptions() {
	if (!dom.languageSelect) return;

	const options = Array.from(dom.languageSelect.options);
	options.forEach((option) => {
		if (option.value === "zh-CN") {
			option.textContent = t("locale.zh-CN");
			return;
		}
		if (option.value === "en-US") {
			option.textContent = t("locale.en-US");
		}
	});

	dom.languageSelect.value = state.language;

	if (dom.languageSelectLabel) {
		dom.languageSelectLabel.textContent = getLanguageOptionLabel(state.language);
	}

	dom.languageSelectOptions.forEach((option) => {
		const isActive = option.dataset.value === state.language;
		option.classList.toggle("active", isActive);
		option.setAttribute("aria-selected", String(isActive));
	});
}

function setLanguageSelectOpen(open) {
	if (!dom.languageSelectTrigger || !dom.languageSelectMenu) return;

	dom.languageSelectTrigger.classList.toggle("active", open);
	dom.languageSelectTrigger.setAttribute("aria-expanded", String(open));
	dom.languageSelectMenu.classList.toggle("hidden", !open);
}

function renderShortcuts() {
	if (!dom.shortcutList) return;
	dom.shortcutList.innerHTML = "";
	Object.entries(state.tempKeyMap).forEach(([id, key]) => {
		const div = document.createElement("div");
		div.className = "shortcut-item";
		div.innerHTML = `<span>${t(labelMap[id] || id)}</span><input type="text" class="shortcut-input" value="${key}" readonly>`;
		const input = div.querySelector("input");

		input.onfocus = () => {
			ipcRenderer.send("suspend-shortcuts");
			input.value = t("settings.shortcuts.pressKey");
			input.classList.add("recording");
		};

		input.onblur = () => {
			ipcRenderer.send("resume-shortcuts");
			input.classList.remove("recording");
			if (input.value === t("settings.shortcuts.pressKey")) {
				input.value = state.tempKeyMap[id];
			}
		};

		input.onkeydown = (event) => {
			event.preventDefault();
			if (["Control", "Alt", "Shift", "Meta"].includes(event.key)) return;
			const keys = [];
			if (event.ctrlKey) keys.push("Ctrl");
			if (event.altKey) keys.push("Alt");
			if (event.shiftKey) keys.push("Shift");
			let keyName = event.key;
			if (keyName === " ") {
				keyName = "Space";
			} else if (keyName.startsWith("Arrow")) {
				keyName = keyName.replace("Arrow", "");
			} else if (
				!(
					keyName === "Home" ||
					keyName === "End" ||
					keyName === "PageUp" ||
					keyName === "PageDown" ||
					keyName === "Insert" ||
					keyName === "Delete"
				)
			) {
				keyName = keyName.toUpperCase();
			}
			keys.push(keyName);
			const shortcut = keys.join("+");
			input.value = shortcut;
			state.tempKeyMap[id] = shortcut;
			input.blur();
		};

		dom.shortcutList.appendChild(div);
	});
}

function renderResolutionPresets(debugLog) {
	if (!dom.resolutionList) return;
	debugLog.info(
		t("settings.log.resolutionRendered", {
			count: state.tempResolutionPresets.length,
		}),
	);

	dom.resolutionList.innerHTML = "";

	state.tempResolutionPresets.forEach((preset, index) => {
		const div = document.createElement("div");
		div.className = "resolution-preset-item";
		div.innerHTML = `
			<div class="preset-info">
				<span class="preset-name">${preset.name}</span>
				<span class="preset-size">${preset.width} × ${preset.height} px</span>
			</div>
			<div class="preset-actions">
				<button class="preset-btn use-btn" data-index="${index}">${t("common.actions.apply")}</button>
				<button class="preset-btn delete-btn" data-index="${index}">${t("common.actions.delete")}</button>
			</div>
		`;

		const useBtn = div.querySelector(".use-btn");
		const deleteBtn = div.querySelector(".delete-btn");

		useBtn.addEventListener("click", () => {
			debugLog.info(
				t("settings.log.resolutionApply", {
					name: preset.name,
					width: preset.width,
					height: preset.height,
				}),
			);
			ipcRenderer.send("set-window-size", {
				width: preset.width,
				height: preset.height,
			});
		});

		deleteBtn.addEventListener("click", () => {
			debugLog.info(
				t("settings.log.resolutionDelete", {
					name: preset.name,
				}),
			);
			state.tempResolutionPresets.splice(index, 1);
			renderResolutionPresets(debugLog);
		});

		dom.resolutionList.appendChild(div);
	});
}

function updateAspectLockButton() {
	if (!dom.aspectRatioLock) return;
	if (state.aspectLocked) {
		dom.aspectRatioLock.classList.add("locked");
		dom.aspectRatioLock.innerHTML = '<i class="material-icons">lock</i>';
	} else {
		dom.aspectRatioLock.classList.remove("locked");
		dom.aspectRatioLock.innerHTML = '<i class="material-icons">lock_open</i>';
	}
}

function updateToggleState(toggleElement, isActive) {
	toggleElement.classList.toggle("active", isActive);
}

module.exports = {
	setUpdateProgress,
	resetUpdateProgress,
	updateDebugToggle,
	updateBossKeyProtectionToggle,
	updateAlwaysOnTopToggle,
	updateDirectionIndicatorToggle,
	updateVideoControlInputs,
	renderLanguageOptions,
	setLanguageSelectOpen,
	renderShortcuts,
	renderResolutionPresets,
	updateAspectLockButton,
	updateToggleState,
};
