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
ipcRenderer.send("save-shortcuts", tempKeyMap);
ipcRenderer.send("set-debug-mode", debugModeState);
ipcRenderer.send("save-resolution-presets", tempResolutionPresets);
window.close();
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
			const progressContainer = document.getElementById(
				"update-progress-container",
			);
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
const progressBar = document.getElementById("update-progress-bar");

// 情况 A: 已经是最新版本，或者检查出错了
if (data.status === "not-available" || data.status === "error") {
if (checkUpdateBtn) checkUpdateBtn.disabled = false;
const progressContainer = document.getElementById(
"update-progress-container",
);
if (progressContainer) progressContainer.classList.remove("active");
}

// 情况 B: 发现新版本并下载完成了
if (data.status === "downloaded") {
if (installUpdateBtn) installUpdateBtn.classList.remove("hidden");
if (checkUpdateBtn) checkUpdateBtn.classList.add("hidden");
if (progressBar) progressBar.style.width = "100%";
}

// 情况 C: 发现新版本正在下载中
if (data.status === "available") {
if (updateStatus) updateStatus.innerText = data.msg;
}

// 更新下载进度（如果有进度百分比）
if (data.percent !== undefined && progressBar) {
progressBar.style.width = `${data.percent}%`;
}
});

// 启动初始化
init();
