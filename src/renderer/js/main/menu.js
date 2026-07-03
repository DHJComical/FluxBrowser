const { ipcRenderer } = require("electron");
const {
	menuBtn,
	dropdownMenu,
	settingsBtn,
	addBookmarkBtn,
	viewBookmarksBtn,
	exitBtn,
	resolutionSubmenu,
} = require("./dom");
const debugLog = require("./debug");
const { showToast } = require("../shared/feedback");
const { t } = require("../shared/i18n");
const { setWindowStatus } = require("./navigation");
const { getActiveWebview } = require("./tabs");

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
	const webview = getActiveWebview();
	if (!webview) {
		showToast(t("main.bookmarks.unavailableMessage"), {
			type: "warning",
			title: t("main.bookmarks.unavailableTitle"),
		});
		return;
	}

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
		setWindowStatus("main.bookmarks.savedStatus", "ready", { autoReset: true });
		showToast(t("main.bookmarks.savedMessage"), {
			type: "success",
			title: t("main.bookmarks.savedTitle"),
		});
	} catch (error) {
		debugLog.error("logs.main.bookmarks.fetchVideoFailed", error);
		setWindowStatus("main.bookmarks.addFailedStatus", "error", {
			autoReset: true,
			resetDelay: 2200,
		});
		showToast(t("main.bookmarks.addFailedMessage"), {
			type: "error",
			title: t("main.bookmarks.addFailedTitle"),
		});
	}
}

async function loadResolutionPresets() {
	try {
		debugLog.info("logs.main.resolution.loadStart");
		const presets = await ipcRenderer.invoke("get-resolution-presets");
		debugLog.info(
			t("main.resolution.loadedCount", {
				count: presets ? presets.length : 0,
			}),
		);

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
			debugLog.info(
				t("main.resolution.renderedCount", {
					count: presets.length,
				}),
			);
		} else {
			debugLog.warn("logs.main.resolution.invalidData");
		}
	} catch (error) {
		debugLog.error("logs.main.resolution.loadFailed", error);
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
		setWindowStatus("main.bookmarks.openWindowStatus", "idle", {
			autoReset: true,
		});
		ipcRenderer.send("open-bookmarks-window");
	};

	exitBtn.onclick = () => ipcRenderer.send("app-exit");

	document.addEventListener("click", (event) => {
		if (event.target && event.target.classList.contains("resolution-item")) {
			event.stopPropagation();
			const width = parseInt(event.target.getAttribute("data-width"), 10);
			const height = parseInt(event.target.getAttribute("data-height"), 10);
			debugLog.info(
				t("main.resolution.applyLog", {
					name: event.target.textContent,
					width,
					height,
				}),
			);
			ipcRenderer.send("set-window-size", { width, height });
			setWindowStatus(
				t("main.resolution.switchedStatus", {
					name: event.target.textContent,
				}),
				"ready",
				{
				autoReset: true,
				},
			);
			showToast(
				t("main.resolution.switchedMessage", {
					name: event.target.textContent,
				}),
				{
				type: "success",
				title: t("main.resolution.appliedTitle"),
				},
			);
			closeMenu();
		}
	});

	ipcRenderer.on("resolution-presets-updated", loadResolutionPresets);
}

module.exports = {
	bindMenuEvents,
	loadResolutionPresets,
};
