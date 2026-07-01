const { ipcRenderer } = require("electron");
const dom = require("./dom");
const state = require("./state");
const { labelMap } = require("./constants");

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

function renderShortcuts() {
	if (!dom.shortcutList) return;
	dom.shortcutList.innerHTML = "";
	Object.entries(state.tempKeyMap).forEach(([id, key]) => {
		const div = document.createElement("div");
		div.className = "shortcut-item";
		div.innerHTML = `<span>${labelMap[id] || id}</span><input type="text" class="shortcut-input" value="${key}" readonly>`;
		const input = div.querySelector("input");

		input.onfocus = () => {
			ipcRenderer.send("suspend-shortcuts");
			input.value = "请按键...";
			input.classList.add("recording");
		};

		input.onblur = () => {
			ipcRenderer.send("resume-shortcuts");
			input.classList.remove("recording");
			if (input.value === "请按键...") input.value = state.tempKeyMap[id];
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
		`渲染分辨率预设，共有 ${state.tempResolutionPresets.length} 个预设`,
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
				<button class="preset-btn use-btn" data-index="${index}">应用</button>
				<button class="preset-btn delete-btn" data-index="${index}">删除</button>
			</div>
		`;

		const useBtn = div.querySelector(".use-btn");
		const deleteBtn = div.querySelector(".delete-btn");

		useBtn.addEventListener("click", () => {
			debugLog.info(
				`应用分辨率预设: ${preset.name} (${preset.width} × ${preset.height})`,
			);
			ipcRenderer.send("set-window-size", {
				width: preset.width,
				height: preset.height,
			});
		});

		deleteBtn.addEventListener("click", () => {
			debugLog.info(`删除分辨率预设: ${preset.name}`);
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
	updateVideoControlInputs,
	renderShortcuts,
	renderResolutionPresets,
	updateAspectLockButton,
	updateToggleState,
};
