const { ipcRenderer } = require("electron");

const webview = document.getElementById("browser-view");
const urlInput = document.getElementById("url-input");
const goBtn = document.getElementById("go-btn");
const fluxBar = document.getElementById("flux-bar");

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
    const targetUrl = (lastUrl && lastUrl.startsWith("http")) ? lastUrl : DEFAULT_URL;
    
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
