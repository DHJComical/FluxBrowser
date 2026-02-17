const { ipcRenderer } = require("electron");
const log = require("electron-log");

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
const resolutionSubmenu = document.getElementById("resolution-submenu");

let isImmersionMode = false;
let debugMode = false;

// 调试模式日志
const debugLog = {
	info: (...args) => {
		if (debugMode) log.info(...args);
	},
	error: (...args) => {
		if (debugMode) log.error(...args);
	},
};

(async () => {
	// 获取调试模式状态
	debugMode = await ipcRenderer.invoke("get-debug-mode");
})();

// 恢复 Session
const lastUrl =
	localStorage.getItem("flux-last-url") ||
	"https://space.bilibili.com/563138217";
webview.src = lastUrl;
urlInput.value = lastUrl;
debugLog.info("已恢复上次访问的 URL:", lastUrl);

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

// 分辨率预设点击事件和子菜单展开
document.addEventListener("click", (e) => {
	// 处理分辨率预设点击
	if (e.target && e.target.classList.contains("resolution-item")) {
		e.stopPropagation();
		const width = parseInt(e.target.getAttribute("data-width"));
		const height = parseInt(e.target.getAttribute("data-height"));
		debugLog.info(
			`应用分辨率预设: ${e.target.textContent} (${width} × ${height})`,
		);
		ipcRenderer.send("set-window-size", { width, height });
		dropdownMenu.classList.add("hidden");
		return;
	}

	// 处理子菜单展开/收起
	if (e.target && e.target.classList.contains("menu-item")) {
		const parent = e.target.closest(".menu-submenu");
		if (parent) {
			e.stopPropagation();
			const submenu = parent.querySelector(".submenu-content");
			if (submenu) {
				submenu.classList.toggle("hidden");
			}
		}
	}
});

// 穿透与沉浸
ipcRenderer.on("toggle-immersion-ui", (e, isImmersion) => {
	isImmersionMode = isImmersion;
	document.body.classList.toggle("immersion", isImmersion);
	if (!isImmersion) ipcRenderer.send("set-ignore-mouse", false);

	// 通知主进程当前的沉浸模式状态
	ipcRenderer.send("immersion-mode-changed", isImmersion);
});

// 监听网页导航事件
ipcRenderer.on("web-go-back", () => {
	if (webview.canGoBack()) {
		webview.goBack();
		debugLog.info("执行网页后退操作");
	} else {
		debugLog.info("无法后退，已到达历史记录起点");
	}
});

ipcRenderer.on("web-go-forward", () => {
	if (webview.canGoForward()) {
		webview.goForward();
		debugLog.info("执行网页前进操作");
	} else {
		debugLog.info("无法前进，已到达历史记录终点");
	}
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
window.onmouseup = (e) => {
	ipcRenderer.send("stop-moving"); // 新增：停止移动
	ipcRenderer.send("stop-resizing");
};

// 透明度
const restoreOpacity = async () => {
	try {
		const op = await ipcRenderer.invoke("get-opacity");
		debugLog.info("启动恢复透明度:", op);
		webview.style.opacity = op;
	} catch (err) {
		debugLog.error("恢复透明度失败:", err);
	}
};

// 加载分辨率预设
const loadResolutionPresets = async () => {
	try {
		debugLog.info("开始加载分辨率预设");
		const presets = await ipcRenderer.invoke("get-resolution-presets");
		debugLog.info(`获取到 ${presets ? presets.length : 0} 个分辨率预设`);

		resolutionSubmenu.innerHTML = "";
		if (presets && Array.isArray(presets)) {
			presets.forEach((preset) => {
				const div = document.createElement("div");
				div.className = "menu-item resolution-item";
				div.textContent = preset.name;
				div.setAttribute("data-width", preset.width);
				div.setAttribute("data-height", preset.height);
				resolutionSubmenu.appendChild(div);
			});
			debugLog.info(`已渲染 ${presets.length} 个分辨率预设到下拉菜单`);
		} else {
			debugLog.warn("分辨率预设数据无效或为空");
		}
	} catch (err) {
		debugLog.error("加载分辨率预设失败:", err);
	}
};

// 监听分辨率预设更新
ipcRenderer.on("resolution-presets-updated", loadResolutionPresets);

restoreOpacity();
loadResolutionPresets();

ipcRenderer.on("set-opacity", (e, op) => (webview.style.opacity = op));

webview.addEventListener("dom-ready", () => {
	webview.setUserAgent(
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
	);
	webview.focus();
});

// 执行 Webview JS 代码
ipcRenderer.on("execute-webview-js", (e, code) => {
	debugLog.info("收到视频控制指令，执行代码:", code); // 调试用，显示具体执行的代码
	if (webview) {
		webview.executeJavaScript(code);
	}
});

// 捕获网页内的未处理错误
window.onerror = (msg, url, line) => {
	debugLog.error(`[Renderer Error] ${msg} at ${url}:${line}`);
};

debugLog.info("主渲染进程已加载");
