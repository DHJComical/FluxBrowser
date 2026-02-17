const { ipcRenderer } = require("electron");

// 获取界面元素
const shortcutList = document.getElementById("shortcut-list");
const saveBtn = document.getElementById("save-btn");
const cancelBtn = document.getElementById("cancel-btn");
const checkUpdateBtn = document.getElementById("check-update-btn");
const updateStatus = document.getElementById("update-status");
const installUpdateBtn = document.getElementById("install-update-btn");
const debugModeToggle = document.getElementById("debug-mode-toggle");
const versionNumber = document.getElementById("version-number");

// 缓存清理相关元素
const clearLogsToggle = document.getElementById("clear-logs-toggle");
const clearKeyConfigToggle = document.getElementById("clear-key-config-toggle");
const clearWindowConfigToggle = document.getElementById("clear-window-config-toggle");
const clearAppConfigToggle = document.getElementById("clear-app-config-toggle");
const clearResolutionPresetsToggle = document.getElementById("clear-resolution-presets-toggle");
const cacheClearBtn = document.getElementById("cache-clear-btn");

// 分辨率预设相关元素
const resolutionList = document.getElementById("resolution-list");
const presetName = document.getElementById("preset-name");
const presetWidth = document.getElementById("preset-width");
const presetHeight = document.getElementById("preset-height");
const aspectRatioLock = document.getElementById("aspect-ratio-lock");
const addPresetBtn = document.getElementById("add-preset-btn");

// 调试模式日志
const debugLog = {
	info: (...args) => {
		console.log(...args);
	},
	error: (...args) => {
		console.error(...args);
	},
	warn: (...args) => {
		console.warn(...args);
	}
};

// 临时存储数据
let tempKeyMap = {};
let debugModeState = false;
let tempResolutionPresets = [];
let aspectLocked = false;
let lockedAspectRatio = null;

// 缓存清理相关状态
let cacheClearOptions = {
    clearLogs: false,
    clearKeyConfig: false,
    clearWindowConfig: false,
    clearAppConfig: false,
    clearResolutionPresets: false
};

// 快捷键标签映射
const labelMap = {
    BossKey: "老板键 (隐藏窗口)",
    ImmersionMode: "沉浸模式",
    "Video-Pause": "视频 暂停/播放",
    "Video-Forward": "视频 快进",
    "Video-Backward": "视频 快退",
    "Opacity-Up": "透明度 +",
    "Opacity-Down": "透明度 -",
    GoBack: "网页后退",
    GoForward: "网页前进",
};

// 初始化
async function init() {
	try {
		// 获取应用版本号
		const version = await ipcRenderer.invoke("get-app-version");
		if (versionNumber) {
			versionNumber.innerText = `v${version}`;
		}

		// 加载快捷键配置
		const map = await ipcRenderer.invoke("get-shortcuts");
		tempKeyMap = { ...map };
		renderShortcuts();

		// 加载调试模式状态
		const debugMode = await ipcRenderer.invoke("get-debug-mode");
		debugModeState = debugMode;
		updateDebugToggle();

		// 加载分辨率预设
		const presets = await ipcRenderer.invoke("get-resolution-presets");
		tempResolutionPresets = JSON.parse(JSON.stringify(presets));
		renderResolutionPresets();

		// 初始化Tab切换
		initTabs();

		// 绑定按钮事件
		bindButtonEvents();

		// 绑定分辨率预设事件
		bindResolutionEvents();
	} catch (error) {
		console.error("初始化设置页面失败:", error);
	}
}

// 绑定按钮事件
function bindButtonEvents() {
	// 保存设置
	if (saveBtn) {
		saveBtn.addEventListener("click", () => {
			// 使用新的保存逻辑处理自动重启
			handleSaveWithRestart();
		});
	}

	// 取消按钮
	if (cancelBtn) {
		cancelBtn.addEventListener("click", () => {
			window.close();
		});
	}

	// 检查更新按钮
	if (checkUpdateBtn) {
		checkUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("check-for-updates");
			updateStatus.innerText = "正在检查更新...";
			checkUpdateBtn.disabled = true;
			const progressContainer = document.getElementById("update-progress-container");
			if (progressContainer) {
				progressContainer.classList.add("active");
			}
		});
	}

	// 安装更新按钮
	if (installUpdateBtn) {
		installUpdateBtn.addEventListener("click", () => {
			ipcRenderer.send("quit-and-install");
		});
	}

	// 调试模式开关
	if (debugModeToggle) {
		debugModeToggle.addEventListener("click", () => {
			debugModeState = !debugModeState;
			updateDebugToggle();
		});
	}

	// 缓存清理开关绑定
	bindCacheToggleEvents();
}

// 渲染快捷键列表
function renderShortcuts() {
	if (!shortcutList) return;
	shortcutList.innerHTML = "";
	Object.entries(tempKeyMap).forEach(([id, key]) => {
		const div = document.createElement("div");
		div.className = "shortcut-item";
		div.innerHTML = `<span>${labelMap[id] || id}</span><input type="text" class="shortcut-input" value="${key}" readonly>`;
		const input = div.querySelector("input");

		// 录制快捷键
		input.onfocus = () => {
			ipcRenderer.send("suspend-shortcuts");
			input.value = "请按键...";
			input.classList.add("recording");
		};

		// 结束录制
		input.onblur = () => {
			ipcRenderer.send("resume-shortcuts");
			input.classList.remove("recording");
			if (input.value === "请按键...") input.value = tempKeyMap[id];
		};

		// 监听按键
		input.onkeydown = (e) => {
			e.preventDefault();
			if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
			const keys = [];
			if (e.ctrlKey) keys.push("Ctrl");
			if (e.altKey) keys.push("Alt");
			if (e.shiftKey) keys.push("Shift");
			let k = e.key;
			// 处理特殊按键显示
			if (k === " ") {
				k = "Space";
			} else if (k.startsWith("Arrow")) {
				k = k.replace("Arrow", "");
			} else if (k === "Home" || k === "End" || k === "PageUp" || k === "PageDown" || k === "Insert" || k === "Delete") {
				// 这些按键直接显示英文
			} else {
				k = k.toUpperCase();
			}
			keys.push(k);
			const str = keys.join("+");
			input.value = str;
			tempKeyMap[id] = str;
			input.blur();
		};

		shortcutList.appendChild(div);
	});
}

// 初始化Tab切换
function initTabs() {
	const tabs = document.querySelectorAll(".settings-tab");
	const panels = document.querySelectorAll(".settings-panel");

	tabs.forEach((tab) => {
		tab.addEventListener("click", (e) => {
			e.stopPropagation(); // 阻止事件冒泡
			const targetPanel = tab.getAttribute("data-panel");

			// 更新Tab激活状态
			tabs.forEach((t) => t.classList.remove("active"));
			tab.classList.add("active");

			// 更新面板显示
			panels.forEach((p) => {
				p.classList.remove("active");
				if (p.id === `panel-${targetPanel}`) {
					p.classList.add("active");
				}
			});
		});
	});
}

// 更新调试模式开关显示
function updateDebugToggle() {
	if (debugModeToggle) {
		if (debugModeState) {
			debugModeToggle.classList.add("active");
		} else {
			debugModeToggle.classList.remove("active");
		}
	}
}

// 分辨率预设相关函数
function renderResolutionPresets() {
	if (!resolutionList) return;
	debugLog.info(`渲染分辨率预设，共有 ${tempResolutionPresets.length} 个预设`);

	resolutionList.innerHTML = "";

	tempResolutionPresets.forEach((preset, index) => {
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
			debugLog.info(`应用分辨率预设: ${preset.name} (${preset.width} × ${preset.height})`);
			ipcRenderer.send("set-window-size", {
				width: preset.width,
				height: preset.height,
			});
		});

		deleteBtn.addEventListener("click", () => {
			debugLog.info(`删除分辨率预设: ${preset.name}`);
			tempResolutionPresets.splice(index, 1);
			renderResolutionPresets();
		});

		resolutionList.appendChild(div);
	});
}

function bindResolutionEvents() {
	if (!aspectRatioLock) return;

	// 纵横比锁定
	aspectRatioLock.addEventListener("click", (e) => {
		e.preventDefault();
		if (presetWidth.value && presetHeight.value) {
			aspectLocked = !aspectLocked;
			lockedAspectRatio = parseFloat(presetWidth.value) / parseFloat(presetHeight.value);
			updateAspectLockButton();
		}
	});

	// 宽度变化
	presetWidth.addEventListener("input", () => {
		if (aspectLocked && presetWidth.value && lockedAspectRatio) {
			const newHeight = Math.round(presetWidth.value / lockedAspectRatio);
			presetHeight.value = newHeight;
		}
	});

	// 高度变化
	presetHeight.addEventListener("input", () => {
		if (aspectLocked && presetHeight.value && lockedAspectRatio) {
			const newWidth = Math.round(presetHeight.value * lockedAspectRatio);
			presetWidth.value = newWidth;
		}
	});

	// 添加预设
	addPresetBtn.addEventListener("click", () => {
		const name = presetName.value.trim();
		const width = parseInt(presetWidth.value);
		const height = parseInt(presetHeight.value);

		if (!name || !width || !height) {
			alert("请填写完整的分辨率信息");
			return;
		}

		if (width < 200 || width > 4000 || height < 150 || height > 3000) {
			alert("分辨率范围不合法（宽度200-4000, 高度150-3000）");
			return;
		}

		// 检查重复
		const duplicate = tempResolutionPresets.some(
			(p) => p.width === width && p.height === height,
		);
		if (duplicate) {
			alert("该分辨率已存在");
			return;
		}

		// 添加新预设
		tempResolutionPresets.push({ width, height, name });
		renderResolutionPresets();

		// 清空表单
		presetName.value = "";
		presetWidth.value = "";
		presetHeight.value = "";
		aspectLocked = false;
		lockedAspectRatio = null;
		updateAspectLockButton();
	});
}

function updateAspectLockButton() {
	if (aspectRatioLock) {
		if (aspectLocked) {
			aspectRatioLock.classList.add("locked");
			aspectRatioLock.innerHTML = '<i class="material-icons">lock</i>';
		} else {
			aspectRatioLock.classList.remove("locked");
			aspectRatioLock.innerHTML = '<i class="material-icons">lock_open</i>';
		}
	}
}

// 监听更新消息
ipcRenderer.on("update-message", (e, data) => {
	if (updateStatus) {
		updateStatus.innerText = data.msg;
	}
	const progressBar = document.getElementById("update-progress-container");
	const progressBarInner = document.getElementById("update-progress-bar");

	// 情况 A: 已经是最新版本，或者检查更新失败
	if (data.status === "not-available" || data.status === "error") {
		if (checkUpdateBtn) checkUpdateBtn.disabled = false;
		if (progressBar) progressBar.classList.remove("active");
	}

	// 情况 B: 发现新版本并下载完成了
	if (data.status === "downloaded") {
		if (installUpdateBtn) installUpdateBtn.classList.remove("hidden");
		if (checkUpdateBtn) checkUpdateBtn.classList.add("hidden");
		if (progressBar && progressBarInner) {
			progressBar.classList.remove("active");
			progressBarInner.style.width = "100%";
		}
	}

	// 情况 C: 发现新版本正在下载中
	if (data.status === "available") {
		if (updateStatus) updateStatus.innerText = data.msg;
	}

	// 更新下载进度（如果有进度百分比）
	if (data.percent !== undefined && progressBarInner) {
		progressBarInner.style.width = `${data.percent}%`;
	}
});

// 监听缓存清理结果
ipcRenderer.on("cache-cleared", async (e, data) => {
	if (data.success) {
		alert("缓存清理完成！");
		
		// 重新加载被清理的配置数据
		try {
			// 如果清理了快捷键配置，重新加载快捷键
			if (cacheClearOptions.clearKeyConfig) {
				const map = await ipcRenderer.invoke("get-shortcuts");
				tempKeyMap = { ...map };
				renderShortcuts();
			}
			
			// 如果清理了应用配置，重新加载调试模式状态
			if (cacheClearOptions.clearAppConfig) {
				const debugMode = await ipcRenderer.invoke("get-debug-mode");
				debugModeState = debugMode;
				updateDebugToggle();
			}
			
			// 如果清理了分辨率预设，重新加载分辨率预设数据
			if (cacheClearOptions.clearResolutionPresets) {
				const presets = await ipcRenderer.invoke("get-resolution-presets");
				tempResolutionPresets = JSON.parse(JSON.stringify(presets));
				renderResolutionPresets();
			}
		} catch (error) {
			console.error("重新加载配置数据失败:", error);
		}
		
		// 重置清理选项
		Object.keys(cacheClearOptions).forEach(key => cacheClearOptions[key] = false);
		bindCacheToggleEvents();
		// 重置UI状态
		document.querySelectorAll('[id$="-toggle"]').forEach(toggle => {
			toggle.classList.remove("active");
		});
		// 重置按钮状态
		if (cacheClearBtn) {
			cacheClearBtn.disabled = false;
			cacheClearBtn.textContent = "开始清理";
		}
	} else {
		alert("缓存清理失败，请重试");
	}
});

// 启动初始化
init();

// 处理保存并自动重启
function handleSaveWithRestart() {
	try {
		// 保存快捷键配置
		ipcRenderer.send("save-shortcuts", tempKeyMap);
		
		// 保存调试模式状态
		ipcRenderer.send("set-debug-mode", debugModeState);
		
		// 保存分辨率预设
		ipcRenderer.send("save-resolution-presets", tempResolutionPresets);

		// 检查是否需要重启
		const needsRestart = cacheClearOptions.clearKeyConfig ||
						   cacheClearOptions.clearWindowConfig ||
						   cacheClearOptions.clearAppConfig ||
						   cacheClearOptions.clearResolutionPresets;

		if (needsRestart) {
			// 需要重启，发送重启命令
			ipcRenderer.send("restart-after-save");
			window.close();
		} else {
			// 不需要重启，直接关闭
			window.close();
		}
	} catch (error) {
		console.error("保存设置失败:", error);
		alert("保存设置时出现错误，请重试");
	}
}

// 缓存清理开关绑定
function bindCacheToggleEvents() {
	// 日志文件清理开关
	if (clearLogsToggle) {
		clearLogsToggle.addEventListener("click", () => {
			cacheClearOptions.clearLogs = !cacheClearOptions.clearLogs;
			updateToggleState(clearLogsToggle, cacheClearOptions.clearLogs);
		});
	}

	// 快捷键配置清理开关
	if (clearKeyConfigToggle) {
		clearKeyConfigToggle.addEventListener("click", () => {
			cacheClearOptions.clearKeyConfig = !cacheClearOptions.clearKeyConfig;
			updateToggleState(clearKeyConfigToggle, cacheClearOptions.clearKeyConfig);
		});
	}

	// 窗口配置清理开关
	if (clearWindowConfigToggle) {
		clearWindowConfigToggle.addEventListener("click", () => {
			cacheClearOptions.clearWindowConfig = !cacheClearOptions.clearWindowConfig;
			updateToggleState(clearWindowConfigToggle, cacheClearOptions.clearWindowConfig);
		});
	}

	// 应用配置清理开关
	if (clearAppConfigToggle) {
		clearAppConfigToggle.addEventListener("click", () => {
			cacheClearOptions.clearAppConfig = !cacheClearOptions.clearAppConfig;
			updateToggleState(clearAppConfigToggle, cacheClearOptions.clearAppConfig);
		});
	}

	// 分辨率预设清理开关
	if (clearResolutionPresetsToggle) {
		clearResolutionPresetsToggle.addEventListener("click", () => {
			cacheClearOptions.clearResolutionPresets = !cacheClearOptions.clearResolutionPresets;
			updateToggleState(clearResolutionPresetsToggle, cacheClearOptions.clearResolutionPresets);
		});
	}

	// 开始清理按钮
	if (cacheClearBtn) {
		cacheClearBtn.addEventListener("click", () => {
			performCacheClear();
		});
	}
}

// 更新开关状态显示
function updateToggleState(toggleElement, isActive) {
	if (isActive) {
		toggleElement.classList.add("active");
	} else {
		toggleElement.classList.remove("active");
	}
}

// 执行缓存清理
async function performCacheClear() {
	try {
		// 检查是否有清理选项被选中
		const hasAnyOption = Object.values(cacheClearOptions).some(option => option);
		if (!hasAnyOption) {
			alert("请至少选择一个要清理的项目");
			return;
		}

		// 确认清理操作
		if (!confirm("确定要清理选中的文件吗？此操作不可逆。")) {
			return;
		}

		// 发送清理请求到主进程
		ipcRenderer.send("clear-cache", cacheClearOptions);

		// 禁用按钮防止重复点击
		cacheClearBtn.disabled = true;
		cacheClearBtn.textContent = "清理中...";

	} catch (error) {
		console.error("执行缓存清理失败:", error);
		alert("清理过程中出现错误，请重试");
		cacheClearBtn.disabled = false;
		cacheClearBtn.textContent = "开始清理";
	}
}
