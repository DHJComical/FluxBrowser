const { ipcRenderer } = require("electron");
const { webviewStack } = require("./dom");
const debugLog = require("./debug");
const {
	state,
	setTabsState,
	setWebview,
	removeWebview,
	getWebview,
	getActiveTab,
	takePendingScript,
	markStartupPauseTabs,
	shouldStartupPauseTab,
	clearStartupPauseTab,
} = require("./state");
const { syncActiveTabUi } = require("./activeTabUi");
const { setWindowStatus } = require("./status");

const USER_AGENT =
	"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const STARTUP_PAUSE_VIDEO_SCRIPT = `
	(() => {
		let pausedCount = 0;
		document.querySelectorAll("video").forEach((video) => {
			video.autoplay = false;
			video.removeAttribute("autoplay");
			if (!video.paused && !video.ended) {
				video.dataset.fluxStartupPaused = "true";
				video.pause();
				pausedCount += 1;
			}
		});
		return pausedCount;
	})();
`;

const STARTUP_PAUSE_DELAYS = [0, 500, 1500, 3000];
const startupMutedWebviews = new WeakMap();
const startupPauseScheduledWebviews = new WeakSet();

function muteUntilStartupPauseCompletes(webview, tabId) {
	if (!shouldStartupPauseTab(tabId)) return;
	if (!webview || startupMutedWebviews.has(webview)) return;

	try {
		const wasMuted =
			typeof webview.isAudioMuted === "function"
				? webview.isAudioMuted()
				: false;
		startupMutedWebviews.set(webview, wasMuted);
		if (!wasMuted && typeof webview.setAudioMuted === "function") {
			webview.setAudioMuted(true);
		}
	} catch (_error) {
		startupMutedWebviews.delete(webview);
	}
}

function restoreStartupMute(webview) {
	if (!webview || !startupMutedWebviews.has(webview)) return;

	const wasMuted = startupMutedWebviews.get(webview);
	startupMutedWebviews.delete(webview);
	try {
		if (!wasMuted && typeof webview.setAudioMuted === "function") {
			webview.setAudioMuted(false);
		}
	} catch (_error) {
		// Audio state restoration must never block tab loading.
	}
}

function scheduleStartupVideoPause(webview, tabId) {
	if (!shouldStartupPauseTab(tabId)) return;
	muteUntilStartupPauseCompletes(webview, tabId);
	if (startupPauseScheduledWebviews.has(webview)) return;
	startupPauseScheduledWebviews.add(webview);

	STARTUP_PAUSE_DELAYS.forEach((delay, index) => {
		setTimeout(() => {
			if (!shouldStartupPauseTab(tabId)) return;
			if (!webview || !webview.isConnected) {
				restoreStartupMute(webview);
				clearStartupPauseTab(tabId);
				return;
			}

			const pausePromise =
				typeof webview.executeJavaScript === "function"
					? webview
						.executeJavaScript(STARTUP_PAUSE_VIDEO_SCRIPT)
						.catch(() => {})
					: Promise.resolve();
			if (index === STARTUP_PAUSE_DELAYS.length - 1) {
				pausePromise.then(() => {
					restoreStartupMute(webview);
					clearStartupPauseTab(tabId);
				});
			}
		}, delay);
	});
}

function createWebview(tab) {
	const webview = document.createElement("webview");
	webview.className = "browser-webview";
	webview.setAttribute("allowpopups", "true");
	webview.dataset.tabId = tab.id;
	webview.src = tab.url;
	webview.style.opacity = String(state.webviewOpacity);

	webview.addEventListener("dom-ready", () => {
		webview.setUserAgent(USER_AGENT);
		scheduleStartupVideoPause(webview, tab.id);
		const pendingScript = takePendingScript(tab.id);
		if (pendingScript) {
			webview.executeJavaScript(pendingScript);
		}
		if (tab.id === state.activeTabId) {
			webview.focus();
		}
		ipcRenderer.send("update-tab", {
			tabId: tab.id,
			patch: {
				title: webview.getTitle() || tab.title,
				url: webview.getURL() || tab.url,
				isLoading: false,
				canGoBack: webview.canGoBack(),
				canGoForward: webview.canGoForward(),
			},
		});
	});

	webview.addEventListener("page-title-updated", () => {
		ipcRenderer.send("update-tab", {
			tabId: tab.id,
			patch: {
				title: webview.getTitle() || "当前页面",
			},
		});
	});

	webview.addEventListener("page-favicon-updated", (event) => {
		const favicon = Array.isArray(event.favicons) ? event.favicons[0] : "";
		if (!favicon) return;

		ipcRenderer.send("update-tab", {
			tabId: tab.id,
			patch: {
				favicon,
			},
		});
	});

	webview.addEventListener("did-start-loading", () => {
		ipcRenderer.send("update-tab", {
			tabId: tab.id,
			patch: {
				isLoading: true,
			},
		});
		if (tab.id === state.activeTabId) {
			setWindowStatus("页面加载中", "loading");
		}
	});

	const persistNavigationState = () => {
		scheduleStartupVideoPause(webview, tab.id);
		ipcRenderer.send("update-tab", {
			tabId: tab.id,
			patch: {
				title: webview.getTitle() || "当前页面",
				url: webview.getURL() || tab.url,
				isLoading: false,
				canGoBack: webview.canGoBack(),
				canGoForward: webview.canGoForward(),
			},
		});
		if (tab.id === state.activeTabId) {
			syncActiveTabUi();
			setWindowStatus("页面已就绪", "ready", { autoReset: true });
		}
	};

	webview.addEventListener("did-stop-loading", persistNavigationState);
	webview.addEventListener("did-navigate", persistNavigationState);
	webview.addEventListener("did-navigate-in-page", persistNavigationState);

	webview.addEventListener("did-fail-load", () => {
		ipcRenderer.send("update-tab", {
			tabId: tab.id,
			patch: {
				isLoading: false,
				canGoBack: webview.canGoBack(),
				canGoForward: webview.canGoForward(),
			},
		});
		if (tab.id === state.activeTabId) {
			setWindowStatus("页面加载失败", "error", {
				autoReset: true,
				resetDelay: 2200,
			});
		}
	});

	return webview;
}

function ensureWebview(tab) {
	let webview = getWebview(tab.id);
	if (webview) {
		return webview;
	}

	webview = createWebview(tab);
	setWebview(tab.id, webview);
	webviewStack.appendChild(webview);
	muteUntilStartupPauseCompletes(webview, tab.id);
	return webview;
}

function renderTabsState(nextState) {
	setTabsState(nextState);
	const activeIds = new Set(state.tabs.map((tab) => tab.id));

	state.tabs.forEach((tab) => {
		const webview = ensureWebview(tab);
		const isActive = tab.id === state.activeTabId;
		webview.classList.toggle("is-active", isActive);
		webview.classList.toggle("is-hidden", !isActive);
	});

	Array.from(state.webviews.keys()).forEach((tabId) => {
		if (activeIds.has(tabId)) return;
		const orphanWebview = state.webviews.get(tabId);
		if (orphanWebview) {
			orphanWebview.remove();
		}
		removeWebview(tabId);
	});

	syncActiveTabUi();
}

async function hydrateTabsState() {
	const tabsState = await ipcRenderer.invoke("get-tabs-state");
	markStartupPauseTabs((tabsState.tabs || []).map((tab) => tab.id));
	renderTabsState(tabsState);
}

function bindTabsEvents() {
	ipcRenderer.on("tabs-state-changed", (_event, tabsState) => {
		renderTabsState(tabsState);
	});

	ipcRenderer.on("active-tab-navigation", (_event, payload = {}) => {
		if (!payload.tabId || !payload.url) return;
		const tab = state.tabs.find((item) => item.id === payload.tabId);
		if (!tab) return;

		const webview = ensureWebview(tab);

		if (webview.src !== payload.url) {
			webview.src = payload.url;
		}
	});

	ipcRenderer.on("focus-active-tab", () => {
		const webview = getWebview();
		if (webview) {
			webview.focus();
		}
	});
}

module.exports = {
	bindTabsEvents,
	hydrateTabsState,
	getActiveTab,
	getActiveWebview: getWebview,
};
