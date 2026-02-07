const { ipcRenderer } = require("electron");

const webview = document.getElementById("browser-view");
const urlInput = document.getElementById("url-input");
const goBtn = document.getElementById("go-btn");
const fluxBar = document.getElementById("flux-bar");

// 处理“点封面想开新窗”的需求
webview.addEventListener('new-window', (e) => {
    // 强制在当前的 webview 里跳转，而不是开新窗
    webview.src = e.url;
});

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

// 3. 智能鼠标穿透增强
const resizeHandles = document.querySelectorAll(".resize-handle");

// 所有的交互元素进入时都要关闭鼠标穿透
const interactiveElements = [fluxBar, ...resizeHandles];

interactiveElements.forEach((el) => {
	el.addEventListener("mouseenter", () => {
		ipcRenderer.send("set-ignore-mouse", false);
	});
});

// 4. 窗口缩放逻辑
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

webview.addEventListener('dom-ready', () => {
    // 注入脚本到 B 站页面内
    webview.executeJavaScript(`
        // 确保所有链接都能在当前页打开，不触发 Electron 拦截
        document.querySelectorAll('a').forEach(link => {
            link.setAttribute('target', '_self');
        });
        
        // 修复部分 B 站元素在透明窗口下的点击判定
        const style = document.createElement('style');
        style.innerHTML = '*{ pointer-events: auto !important; -webkit-user-drag: none !important; }';
        document.head.appendChild(style);
    `);
});