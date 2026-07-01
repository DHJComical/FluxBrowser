const { ipcRenderer } = require("electron");
const {
	menuBtn,
	dropdownMenu,
	settingsBtn,
	addBookmarkBtn,
	viewBookmarksBtn,
	exitBtn,
	resolutionSubmenu,
	webview,
} = require("./dom");
const debugLog = require("./debug");
const { showToast } = require("../shared/feedback");
const { setWindowStatus } = require("./navigation");

function closeMenu() {
	dropdownMenu.classList.add("hidden");
	menuBtn.classList.remove("active");
}

function toggleMenu() {
	const willOpen = dropdownMenu.classList.contains("hidden");
	dropdownMenu.classList.toggle("hidden");
	menuBtn.classList.toggle("active", willOpen);
}

async function addBookmarkFromCurrentPage() {
	closeMenu();
	const url = webview.getURL();
	const code = `
		(function() {
			const title = document.title;
			const video = document.querySelector('video');
			const time = video ? video.currentTime : 0;
			return { title, time };
		})()
	`;

	try {
		const videoInfo = await webview.executeJavaScript(code);
		ipcRenderer.send("add-bookmark", {
			title: videoInfo.title,
			url,
			time: videoInfo.time,
			timestamp: Date.now(),
		});
		setWindowStatus("当前进度已加入书签", "ready", { autoReset: true });
		showToast("当前进度已经加入书签。", {
			type: "success",
			title: "书签已保存",
		});
	} catch (error) {
		debugLog.error("获取视频信息失败:", error);
		setWindowStatus("书签保存失败", "error", { autoReset: true, resetDelay: 2200 });
		showToast("读取当前页面信息失败，暂时无法添加书签。", {
			type: "error",
			title: "添加失败",
		});
	}
}

async function loadResolutionPresets() {
	try {
		debugLog.info("开始加载分辨率预设");
		const presets = await ipcRenderer.invoke("get-resolution-presets");
		debugLog.info(`获取到 ${presets ? presets.length : 0} 个分辨率预设`);

		resolutionSubmenu.innerHTML = "";
		if (presets && Array.isArray(presets)) {
			presets.forEach((preset) => {
				const element = document.createElement("div");
				element.className = "menu-item resolution-item";
				element.textContent = preset.name;
				element.setAttribute("data-width", preset.width);
				element.setAttribute("data-height", preset.height);
				resolutionSubmenu.appendChild(element);
			});
			debugLog.info(`已渲染 ${presets.length} 个分辨率预设到下拉菜单`);
		} else {
			debugLog.warn("分辨率预设数据无效或为空");
		}
	} catch (error) {
		debugLog.error("加载分辨率预设失败:", error);
	}
}

function bindMenuEvents() {
	menuBtn.onclick = (event) => {
		event.stopPropagation();
		toggleMenu();
	};

	document.onclick = () => closeMenu();

	document.addEventListener("keydown", (event) => {
		if (event.key === "Escape") {
			closeMenu();
		}
	});

	settingsBtn.onclick = () => {
		closeMenu();
		ipcRenderer.send("open-settings");
	};

	addBookmarkBtn.onclick = addBookmarkFromCurrentPage;

	viewBookmarksBtn.onclick = () => {
		closeMenu();
		setWindowStatus("正在打开书签页", "idle", { autoReset: true });
		ipcRenderer.send("open-bookmarks-window");
	};

	exitBtn.onclick = () => ipcRenderer.send("app-exit");

	document.addEventListener("click", (event) => {
		if (event.target && event.target.classList.contains("resolution-item")) {
			event.stopPropagation();
			const width = parseInt(event.target.getAttribute("data-width"), 10);
			const height = parseInt(event.target.getAttribute("data-height"), 10);
			debugLog.info(
				`应用分辨率预设 ${event.target.textContent} (${width} x ${height})`,
			);
			ipcRenderer.send("set-window-size", { width, height });
			setWindowStatus(`已切换到 ${event.target.textContent}`, "ready", {
				autoReset: true,
			});
			showToast(`窗口已切换到 ${event.target.textContent}。`, {
				type: "success",
				title: "尺寸已应用",
			});
			closeMenu();
		}
	});

	ipcRenderer.on("resolution-presets-updated", loadResolutionPresets);
}

module.exports = {
	bindMenuEvents,
	loadResolutionPresets,
};
