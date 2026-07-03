const { sanitizeUrl } = require("../../TabStateManager");
const { t } = require("../../i18n");

function broadcastTabs(tabStateManager, broadcast) {
	broadcast("tabs-state-changed", tabStateManager.getState());
}

function sendActiveTabNavigation(tabStateManager, sendToMainWindow) {
	const activeTab = tabStateManager.getActiveTab();
	if (!activeTab) return;

	sendToMainWindow("active-tab-navigation", {
		tabId: activeTab.id,
		url: activeTab.url,
	});
}

function registerTabHandlers({
	ipcMain,
	tabStateManager,
	broadcast,
	sendToMainWindow,
	logger,
}) {
	ipcMain.handle("get-tabs-state", () => tabStateManager.getState());

	ipcMain.on("create-tab", (_event, input = {}) => {
		const tab = tabStateManager.createTab({
			url: sanitizeUrl(input.url),
			title: input.title,
		});
		logger.debug(
			t("logs.tabs.create", {
				tabId: tab.id,
				url: tab.url,
			}),
		);
		broadcastTabs(tabStateManager, broadcast);
		sendActiveTabNavigation(tabStateManager, sendToMainWindow);
		sendToMainWindow("focus-active-tab");
	});

	ipcMain.on("close-tab", (_event, tabId) => {
		tabStateManager.closeTab(tabId);
		logger.debug(
			t("logs.tabs.close", {
				tabId,
			}),
		);
		broadcastTabs(tabStateManager, broadcast);
		sendActiveTabNavigation(tabStateManager, sendToMainWindow);
	});

	ipcMain.on("activate-tab", (_event, tabId) => {
		tabStateManager.activateTab(tabId);
		logger.debug(
			t("logs.tabs.activate", {
				tabId,
			}),
		);
		broadcastTabs(tabStateManager, broadcast);
		sendActiveTabNavigation(tabStateManager, sendToMainWindow);
	});

	ipcMain.on("update-tab", (_event, payload = {}) => {
		if (!payload.tabId) return;

		const patch = { ...payload.patch };
		if (Object.hasOwn(patch, "url")) {
			patch.url = sanitizeUrl(patch.url) || patch.url;
		}
		const tab = tabStateManager.updateTab(payload.tabId, patch);
		if (!tab) return;

		broadcastTabs(tabStateManager, broadcast);
	});

	ipcMain.on("navigate-tab", (_event, payload = {}) => {
		const tabId = payload.tabId || tabStateManager.getActiveTabId();
		const url = sanitizeUrl(payload.url);
		if (!tabId || !url) return;

		tabStateManager.activateTab(tabId);
		tabStateManager.updateTab(tabId, { url, isLoading: true });
		broadcastTabs(tabStateManager, broadcast);
		sendActiveTabNavigation(tabStateManager, sendToMainWindow);
	});

	ipcMain.on("go-back-active-tab", () => {
		sendToMainWindow("web-go-back");
	});

	ipcMain.on("go-forward-active-tab", () => {
		sendToMainWindow("web-go-forward");
	});

	ipcMain.on("execute-active-tab-js", (_event, code) => {
		sendToMainWindow("execute-active-tab-js", code);
	});

	ipcMain.on("focus-active-tab", () => {
		sendToMainWindow("focus-active-tab");
	});

	ipcMain.on("open-bookmark-in-tab", (_event, payload = {}) => {
		const url = sanitizeUrl(payload.url);
		if (!url) return;

		const tab = tabStateManager.createTab({
			url,
			title: payload.title,
		});
		broadcastTabs(tabStateManager, broadcast);
		sendActiveTabNavigation(tabStateManager, sendToMainWindow);
		sendToMainWindow("execute-active-tab-js", {
			tabId: tab.id,
			code: payload.script,
		});
		sendToMainWindow("focus-active-tab");
		logger.debug(
			t("logs.tabs.openBookmark", {
				tabId: tab.id,
			}),
		);
	});
}

module.exports = registerTabHandlers;
