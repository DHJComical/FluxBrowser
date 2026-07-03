const state = {
	isImmersionMode: false,
	debugMode: false,
	tabs: [],
	activeTabId: null,
	webviews: new Map(),
	webviewOpacity: 1,
	pendingScripts: new Map(),
	startupPauseTabIds: new Set(),
	startupBackgroundMutedTabIds: new Set(),
};

function setDebugMode(enabled) {
	state.debugMode = enabled === true;
}

function setImmersionMode(enabled) {
	state.isImmersionMode = enabled === true;
}

function setTabsState(nextState = {}) {
	state.tabs = Array.isArray(nextState.tabs) ? nextState.tabs : [];
	state.activeTabId =
		typeof nextState.activeTabId === "string" ? nextState.activeTabId : null;
}

function setWebview(tabId, webview) {
	state.webviews.set(tabId, webview);
}

function removeWebview(tabId) {
	state.webviews.delete(tabId);
}

function getWebview(tabId = state.activeTabId) {
	if (!tabId) return null;
	return state.webviews.get(tabId) || null;
}

function getActiveTab() {
	return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
}

function setWebviewOpacity(opacity) {
	state.webviewOpacity = opacity;
}

function queuePendingScript(tabId, code) {
	if (!tabId || !code) return;
	state.pendingScripts.set(tabId, code);
}

function takePendingScript(tabId) {
	if (!tabId) return null;
	const code = state.pendingScripts.get(tabId) || null;
	state.pendingScripts.delete(tabId);
	return code;
}

function markStartupPauseTabs(tabIds = []) {
	state.startupPauseTabIds = new Set(
		tabIds.filter((tabId) => typeof tabId === "string" && tabId),
	);
}

function shouldStartupPauseTab(tabId) {
	return state.startupPauseTabIds.has(tabId);
}

function clearStartupPauseTab(tabId) {
	state.startupPauseTabIds.delete(tabId);
}

function markStartupBackgroundMutedTabs(tabIds = []) {
	state.startupBackgroundMutedTabIds = new Set(
		tabIds.filter((tabId) => typeof tabId === "string" && tabId),
	);
}

function shouldStartupBackgroundMuteTab(tabId) {
	return state.startupBackgroundMutedTabIds.has(tabId);
}

function clearStartupBackgroundMutedTab(tabId) {
	state.startupBackgroundMutedTabIds.delete(tabId);
}

module.exports = {
	state,
	setDebugMode,
	setImmersionMode,
	setTabsState,
	setWebview,
	removeWebview,
	getWebview,
	getActiveTab,
	setWebviewOpacity,
	queuePendingScript,
	takePendingScript,
	markStartupPauseTabs,
	shouldStartupPauseTab,
	clearStartupPauseTab,
	markStartupBackgroundMutedTabs,
	shouldStartupBackgroundMuteTab,
	clearStartupBackgroundMutedTab,
};
