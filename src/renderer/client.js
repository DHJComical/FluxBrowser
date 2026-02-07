const { ipcRenderer } = require("electron");

const webview = document.getElementById("browser-view");
const urlInput = document.getElementById("url-input");
const goBtn = document.getElementById("go-btn");
const fluxBar = document.getElementById("flux-bar");

// 设置GUI
const menuBtn = document.getElementById("menu-btn");
const dropdownMenu = document.getElementById("dropdown-menu");
const settingsBtn = document.getElementById("settings-btn");
const exitBtn = document.getElementById("exit-btn");
const settingsModal = document.getElementById("settings-modal");
const closeSettings = document.getElementById("close-settings");
const shortcutList = document.getElementById("shortcut-list");
const saveShortcutsBtn = document.getElementById("save-shortcuts");

// 全局状态
let isImmersionMode = false;
// [新增] 定义默认主页
const DEFAULT_URL = "https://www.bilibili.com";

// ==========================================
// [新增] 启动时恢复上次浏览的页面
// ==========================================
// 这一步必须在获取 DOM 元素之后立即执行
const restoreLastSession = () => {
	// 从本地存储获取
	const lastUrl = localStorage.getItem("flux-last-url");

	// 如果有存档且是合法的 http 地址，就用存档；否则用默认主页
	const targetUrl =
		lastUrl && lastUrl.startsWith("http") ? lastUrl : DEFAULT_URL;

	// 设置给 webview 和 输入框
	// 注意：这里我们不需要改 HTML 里的 src，JS 会覆盖它
	webview.src = targetUrl;
	urlInput.value = targetUrl;
};

// 执行恢复逻辑
restoreLastSession();

// ==========================================
// 2. 导航逻辑
// ==========================================
const navigate = () => {
	let url = urlInput.value.trim();
	if (!url) return;
	if (!url.startsWith("http")) url = "https://" + url;
	webview.src = url;
};

goBtn.onclick = navigate;
urlInput.onkeydown = (e) => {
	if (e.key === "Enter") navigate();
};

// ==========================================
// A. URL 自动刷新逻辑 (修改：加入保存功能)
// ==========================================
const syncUrl = () => {
	const currentUrl = webview.getURL();
	urlInput.value = currentUrl;

	// [新增] 每次 URL 变化时，保存到本地存储
	// 过滤掉空的或者非 http 的地址 (比如空白页)
	if (currentUrl && currentUrl.startsWith("http")) {
		localStorage.setItem("flux-last-url", currentUrl);
	}
};

webview.addEventListener("did-navigate", syncUrl);
webview.addEventListener("did-navigate-in-page", syncUrl);
// B. 渲染进程的辅助拦截 (作为第二层保险)
webview.addEventListener("new-window", (e) => {
	e.preventDefault(); // 阻止默认开窗
	webview.src = e.url; // 当前窗口跳转
});

// C. 注入 User-Agent (极其重要！)
// 有些网站发现你是 Electron 就会故意弹出新窗口，模拟 Chrome 可以避开很多问题
webview.addEventListener("dom-ready", () => {
	// 设置一个伪装成普通浏览器的 UA
	webview.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	);
});

// ==========================================
// 2. 接收后端指令
// ==========================================
ipcRenderer.on("toggle-immersion-ui", (e, isImmersion) => {
	isImmersionMode = isImmersion; // 更新状态记录
	if (isImmersion) {
		document.body.classList.add("immersion");
	} else {
		document.body.classList.remove("immersion");
		// 显式确保退出沉浸模式时，窗口不再穿透
		ipcRenderer.send("set-ignore-mouse", false);
	}
});

ipcRenderer.on("execute-webview-js", (e, code) => {
	webview.executeJavaScript(code);
});

// ==========================================
// 3. 智能鼠标穿透增强 (修正逻辑)
// ==========================================
const resizeHandles = document.querySelectorAll(".resize-handle");
const interactiveElements = [fluxBar, ...resizeHandles];

// 鼠标进入 UI 区域：无论什么模式，都必须关闭穿透，否则点不动地址栏
interactiveElements.forEach((el) => {
	el.addEventListener("mouseenter", () => {
		ipcRenderer.send("set-ignore-mouse", false);
	});
});

// 新增：鼠标回到网页区域时的逻辑
webview.addEventListener("mouseenter", () => {
	// 只有在沉浸模式下，回到网页才需要恢复穿透
	if (isImmersionMode) {
		ipcRenderer.send("set-ignore-mouse", true);
	}
});

// ==========================================
// 4. 窗口缩放逻辑
// ==========================================
resizeHandles.forEach((handle) => {
	handle.addEventListener("mousedown", (e) => {
		e.preventDefault();
		const direction = handle.getAttribute("data-direction");
		ipcRenderer.send("start-resizing", direction);
	});
});

window.addEventListener("mouseup", () => {
	ipcRenderer.send("stop-resizing");
});

// 1. 切换下拉菜单
menuBtn.onclick = (e) => {
	e.stopPropagation();
	dropdownMenu.classList.toggle("hidden");
};

// 点击其他地方关闭菜单
document.addEventListener("click", (e) => {
	if (!menuBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
		dropdownMenu.classList.add("hidden");
	}
});

// 2. 退出程序
exitBtn.onclick = () => {
	ipcRenderer.send("app-exit");
};

// 3. 打开设置面板
settingsBtn.onclick = async () => {
	dropdownMenu.classList.add("hidden");
	settingsModal.classList.remove("hidden");

	// 获取当前快捷键配置
	const keyMap = await ipcRenderer.invoke("get-shortcuts");
	renderShortcuts(keyMap);
};

// 关闭设置面板
closeSettings.onclick = () => {
	settingsModal.classList.add("hidden");
};

// 4. 渲染快捷键列表
let tempKeyMap = {}; // 暂存修改

const labelMap = {
	BossKey: "老板键 (隐藏窗口)",
	ImmersionMode: "沉浸模式 (穿透)",
	"Video-Pause": "视频 暂停/播放",
	"Video-Forward": "视频 快进",
};

function renderShortcuts(map) {
	tempKeyMap = { ...map };
	shortcutList.innerHTML = "";

	for (const [id, key] of Object.entries(map)) {
		const li = document.createElement("li");
		li.className = "shortcut-item";

		const label = document.createElement("label");
		label.innerText = labelMap[id] || id;

		const input = document.createElement("input");
		input.type = "text";
		input.className = "shortcut-input";
		input.value = key;
		input.readOnly = true; // 禁止直接打字，必须通过录制

		// 绑定录制事件
		input.onkeydown = (e) => handleRecordKey(e, input, id);

		li.appendChild(label);
		li.appendChild(input);
		shortcutList.appendChild(li);
	}
}

// 5. 核心：录制快捷键
function handleRecordKey(e, input, id) {
	e.preventDefault();

	// 忽略单独按下的修饰键
	if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

	const keys = [];
	if (e.ctrlKey) keys.push("Ctrl");
	if (e.metaKey) keys.push("Command"); // Mac
	if (e.altKey) keys.push("Alt");
	if (e.shiftKey) keys.push("Shift");

	// 处理普通键 (把 a 变成 A, ArrowRight 变成 Right)
	let keyName = e.key.toUpperCase();
	if (keyName === " ") keyName = "Space";
	if (keyName.startsWith("ARROW")) keyName = keyName.replace("ARROW", "");

	keys.push(keyName);

	const shortcutString = keys.join("+");
	input.value = shortcutString;
	tempKeyMap[id] = shortcutString;

	// 录制完成后让输入框失去焦点，防止连续误触
	// input.blur();
}

// 6. 保存设置
saveShortcutsBtn.onclick = () => {
	ipcRenderer.send("save-shortcuts", tempKeyMap);
	settingsModal.classList.add("hidden");
	alert("快捷键已更新！");
};

// 检查元素是否获取成功
console.log("按钮检查:", menuBtn, settingsBtn, settingsModal);

menuBtn.onclick = (e) => {
    e.stopPropagation();
    console.log("菜单按钮被点击");
    dropdownMenu.classList.toggle("hidden");
};

settingsBtn.onclick = async () => {
    console.log("设置按钮被点击");
    dropdownMenu.classList.add("hidden");
    
    try {
        console.log("正在请求快捷键数据...");
        const keyMap = await ipcRenderer.invoke("get-shortcuts");
        console.log("获取成功:", keyMap);
        
        renderShortcuts(keyMap);
        settingsModal.classList.remove("hidden"); // 显示模态框
    } catch (err) {
        console.error("无法弹出设置界面:", err);
    }
};