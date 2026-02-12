const { ipcRenderer } = require("electron");

const shortcutList = document.getElementById("shortcut-list");
const saveBtn = document.getElementById("save-btn");
const checkUpdateBtn = document.getElementById("check-update-btn");
const updateStatus = document.getElementById("update-status");
const installUpdateBtn = document.getElementById("install-update-btn");

let tempKeyMap = {};
const labelMap = {
	BossKey: "老板键",
	ImmersionMode: "沉浸模式",
	"Video-Pause": "视频 播放/暂停",
	"Video-Forward": "视频 快进",
	"Video-Backward": "视频 快退",
	"Opacity-Up": "透明度 +",
	"Opacity-Down": "透明度 -",
	GoBack: "网页后退",
	GoForward: "网页前进",
};

async function init() {
	// 获取应用版本号
	const version = await ipcRenderer.invoke("get-app-version");
	const updateStatus = document.getElementById("update-status");
	if (updateStatus) {
		updateStatus.innerText = `当前版本: v${version}`;
	}

	// 加载快捷键配置
	const map = await ipcRenderer.invoke("get-shortcuts");
	tempKeyMap = { ...map };
	shortcutList.innerHTML = "";
	Object.entries(map).forEach(([id, key]) => {
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
			let k = e.key.toUpperCase();
			if (k === " ") k = "Space";
			if (k.startsWith("ARROW")) k = k.replace("ARROW", "");
			keys.push(k);
			const str = keys.join("+");
			input.value = str;
			tempKeyMap[id] = str;
			input.blur();
		};

		// 添加到列表
		shortcutList.appendChild(div);
	});
}

// 保存快捷键配置
saveBtn.onclick = () => {
	ipcRenderer.send("save-shortcuts", tempKeyMap);
	window.close();
};

// 检查更新
checkUpdateBtn.onclick = () => {
	ipcRenderer.send("check-for-updates");

	// UI 立即变更
	updateStatus.innerText = "正在检查更新...";
	checkUpdateBtn.disabled = true; // 变灰并禁止点击
};

ipcRenderer.on("update-message", (e, data) => {
	updateStatus.innerText = data.msg;

	// 情况 A: 已经是最新版本，或者检查出错了
	if (data.status === "not-available" || data.status === "error") {
		checkUpdateBtn.disabled = false; // 恢复按钮颜色和功能
	}

	// 情况 B: 发现新版本并下载完成了
	if (data.status === "downloaded") {
		installUpdateBtn.classList.remove("hidden");
		checkUpdateBtn.classList.add("hidden"); // 既然要安装了，就隐藏检查按钮
	}

	// 情况 C: 发现新版本正在下载中
	if (data.status === "available") {
		// 保持 checkUpdateBtn.disabled = true; 不让用户乱点
		updateStatus.innerText = data.msg;
	}
});

// 安装更新
ipcRenderer.on("update-message", (e, data) => {
	updateStatus.innerText = data.msg;
	if (data.status === "downloaded") installUpdateBtn.classList.remove("hidden");
});

// 安装更新按钮
checkUpdateBtn.onclick = () => {
	ipcRenderer.send("check-for-updates");
	updateStatus.innerText = "正在检查更新...";
	checkUpdateBtn.disabled = true; // 暂时禁用，等待后端回传结果
};
init();
