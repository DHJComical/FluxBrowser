const { ipcRenderer } = require("electron");

const webview = document.getElementById("browser-view");
const urlInput = document.getElementById("url-input");
const goBtn = document.getElementById("go-btn");
const fluxBar = document.getElementById("flux-bar");

// 1. 导航逻辑
const navigate = () => {
	let url = urlInput.value;
	if (!url.startsWith("http")) url = "https://" + url;
	webview.src = url;
};

goBtn.onclick = navigate;
urlInput.onkeydown = (e) => {
	if (e.key === "Enter") navigate();
};

webview.addEventListener("did-navigate", (e) => {
	urlInput.value = e.url;
});

// 2. 接收后端指令
ipcRenderer.on("toggle-immersion-ui", (e, isImmersion) => {
	if (isImmersion) {
		document.body.classList.add("immersion");
	} else {
		document.body.classList.remove("immersion");
	}
});

ipcRenderer.on("execute-webview-js", (e, code) => {
	webview.executeJavaScript(code);
});

// 3. 智能鼠标穿透 (关键！)
// 当鼠标移入控制栏时，必须关闭穿透，否则点不到输入框
const interactiveElements = [fluxBar, document.getElementById("resize-handle")];

interactiveElements.forEach((el) => {
	el.addEventListener("mouseenter", () => {
		// 告诉后端：这块区域我要点击，别穿透！
		ipcRenderer.send("set-ignore-mouse", false);
	});
	el.addEventListener("mouseleave", () => {
		// 离开控制区后，如果处于沉浸模式，后端会保持穿透；否则保持不穿透
		// 但为了保险，我们只在“非交互区”请求恢复穿透逻辑，具体由后端状态决定比较复杂
		// 简单做法：这里我们发送 false, 让后端 WindowMgr 决定是否真的要穿透
		// 但更简单的做法是：
		// 我们不需要手动发送 true，因为默认情况是 false。
		// 只有开启了沉浸模式，主进程才会强制设为 true。
		// 这里主要是为了防止在沉浸模式下，鼠标移入隐藏的菜单时无法操作。
	});
});

const resizeHandle = document.getElementById("resize-handle");

// 1. 鼠标按下：告诉后端“开始干活”
resizeHandle.addEventListener("mousedown", (e) => {
	e.preventDefault(); // 防止选中文字
	ipcRenderer.send("start-resizing");
});

// 2. 鼠标松开（在任何地方松开）：告诉后端“停！”
// 注意：这里用 window 监听，防止鼠标跑出浏览器外松开检测不到
window.addEventListener("mouseup", () => {
	ipcRenderer.send("stop-resizing");
});
