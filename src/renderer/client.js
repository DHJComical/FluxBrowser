const { ipcRenderer } = require("electron");

const webview = document.getElementById("browser-view");
const urlInput = document.getElementById("url-input");
const goBtn = document.getElementById("go-btn");
const fluxBar = document.getElementById("flux-bar");
const menuBtn = document.getElementById("menu-btn");
const dropdownMenu = document.getElementById("dropdown-menu");
const settingsBtn = document.getElementById("settings-btn");
const exitBtn = document.getElementById("exit-btn");
const resizeHandles = document.querySelectorAll(".resize-handle");
const dragRegion = document.querySelector(".drag-region");

let isImmersionMode = false;

// 恢复 Session
const lastUrl =
	localStorage.getItem("flux-last-url") || "https://www.bilibili.com";
webview.src = lastUrl;
urlInput.value = lastUrl;

// 导航
const navigate = () => {
	let url = urlInput.value.trim();
	if (!url.startsWith("http")) url = "https://" + url;
	webview.src = url;
};
goBtn.onclick = navigate;
urlInput.onkeydown = (e) => {
	if (e.key === "Enter") navigate();
};

webview.addEventListener("did-navigate", () => {
	urlInput.value = webview.getURL();
	localStorage.setItem("flux-last-url", webview.getURL());
});
webview.addEventListener("did-navigate-in-page", () => {
	urlInput.value = webview.getURL();
	localStorage.setItem("flux-last-url", webview.getURL());
});

// 设置相关
menuBtn.onclick = (e) => {
	e.stopPropagation();
	dropdownMenu.classList.toggle("hidden");
};
document.onclick = () => dropdownMenu.classList.add("hidden");
settingsBtn.onclick = () => ipcRenderer.send("open-settings");
exitBtn.onclick = () => ipcRenderer.send("app-exit");

// 穿透与沉浸
ipcRenderer.on("toggle-immersion-ui", (e, isImmersion) => {
	isImmersionMode = isImmersion;
	document.body.classList.toggle("immersion", isImmersion);
	if (!isImmersion) ipcRenderer.send("set-ignore-mouse", false);
});

[fluxBar, ...resizeHandles].forEach((el) => {
	el.onmouseenter = () => ipcRenderer.send("set-ignore-mouse", false);
});

webview.onmouseenter = () => {
	if (isImmersionMode) ipcRenderer.send("set-ignore-mouse", true);
};

// 缩放
resizeHandles.forEach((h) => {
	h.onmousedown = (e) => {
		if (isImmersionMode) return;
		ipcRenderer.send("start-resizing", h.getAttribute("data-direction"));
	};
});
window.onmouseup = () => ipcRenderer.send("stop-resizing");

// 原生拖拽
if (dragRegion) {
	dragRegion.onmousedown = (e) => {
		// 如果是沉浸模式，通常标题栏是隐藏的，但为了保险加个判断
		if (isImmersionMode) return;

		e.preventDefault();
		// 发送开始移动指令
		ipcRenderer.send("start-moving");
	};
}

// 统一使用已有的 window.onmouseup 来停止所有动作（缩放和移动）
window.addEventListener("mouseup", () => {
	ipcRenderer.send("stop-moving"); // 新增：停止移动
	ipcRenderer.send("stop-resizing");
});

// 透明度
ipcRenderer.on("set-opacity", (e, op) => (webview.style.opacity = op));

webview.addEventListener("dom-ready", () => {
	webview.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	);
	webview.focus();
});

// 执行 Webview JS 代码
ipcRenderer.on("execute-webview-js", (e, code) => {
	console.log("收到视频控制指令"); // 调试用
	if (webview) {
		webview.executeJavaScript(code);
	}
});

// 捕获网页内的未处理错误
window.onerror = (msg, url, line) => {
	log.error(`[Renderer Error] ${msg} at ${url}:${line}`);
};

console.log("主渲染进程已加载");
