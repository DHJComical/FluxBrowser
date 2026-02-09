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
};

async function init() {
	const map = await ipcRenderer.invoke("get-shortcuts");
	tempKeyMap = { ...map };
	shortcutList.innerHTML = "";
	Object.entries(map).forEach(([id, key]) => {
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
			if (input.value === "请按键...") input.value = tempKeyMap[id];
		};
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
		shortcutList.appendChild(div);
	});
}

saveBtn.onclick = () => {
	ipcRenderer.send("save-shortcuts", tempKeyMap);
	window.close();
};

checkUpdateBtn.onclick = () => {
	ipcRenderer.send("check-for-updates");
	updateStatus.innerText = "正在检查更新...";
};

ipcRenderer.on("update-message", (e, data) => {
	updateStatus.innerText = data.msg;
	if (data.status === "downloaded") installUpdateBtn.classList.remove("hidden");
});

ipcRenderer.on("update-progress", (e, percent) => {
	document.getElementById("progress-container").classList.remove("hidden");
	document.getElementById("progress-bar").style.width = percent + "%";
});

init();
