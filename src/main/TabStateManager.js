const configManager = require("./ConfigManager");

const DEFAULT_URL = "https://space.bilibili.com/563138217";

function createDefaultTab() {
	return {
		id: `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
		title: "新标签页",
		url: DEFAULT_URL,
		isLoading: false,
		canGoBack: false,
		canGoForward: false,
		lastUpdatedAt: Date.now(),
	};
}

function sanitizeUrl(url) {
	const value = String(url || "").trim();
	if (!value) return "";
	if (/^[a-zA-Z]+:\/\//.test(value)) {
		return value;
	}
	return `https://${value}`;
}

function sanitizeTab(tab = {}) {
	const url = sanitizeUrl(tab.url) || DEFAULT_URL;
	return {
		id:
			typeof tab.id === "string" && tab.id.trim()
				? tab.id.trim()
				: createDefaultTab().id,
		title:
			typeof tab.title === "string" && tab.title.trim()
				? tab.title.trim()
				: "新标签页",
		url,
		isLoading: tab.isLoading === true,
		canGoBack: tab.canGoBack === true,
		canGoForward: tab.canGoForward === true,
		favicon:
			typeof tab.favicon === "string" && tab.favicon.trim()
				? tab.favicon.trim()
				: "",
		lastUpdatedAt:
			typeof tab.lastUpdatedAt === "number" ? tab.lastUpdatedAt : Date.now(),
	};
}

function normalizeTabsState(savedState = {}) {
	const savedTabs = Array.isArray(savedState.tabs) ? savedState.tabs : [];
	const tabs = savedTabs.map(sanitizeTab);
	const ensuredTabs = tabs.length > 0 ? tabs : [createDefaultTab()];
	const activeTabId = ensuredTabs.some((tab) => tab.id === savedState.activeTabId)
		? savedState.activeTabId
		: ensuredTabs[0].id;

	return {
		tabs: ensuredTabs,
		activeTabId,
	};
}

class TabStateManager {
	constructor() {
		this.state = normalizeTabsState(configManager.getTabsState());
	}

	getState() {
		return {
			tabs: this.state.tabs.map((tab) => ({ ...tab })),
			activeTabId: this.state.activeTabId,
		};
	}

	getTabs() {
		return this.state.tabs;
	}

	getActiveTabId() {
		return this.state.activeTabId;
	}

	getActiveTab() {
		return this.state.tabs.find((tab) => tab.id === this.state.activeTabId) || null;
	}

	getTabById(tabId) {
		return this.state.tabs.find((tab) => tab.id === tabId) || null;
	}

	setState(nextState) {
		this.state = normalizeTabsState(nextState);
		this.persist();
		return this.getState();
	}

	persist() {
		configManager.saveTabsState(this.state);
	}

	createTab(input = {}) {
		const tab = sanitizeTab({
			...createDefaultTab(),
			...input,
			lastUpdatedAt: Date.now(),
		});

		this.state.tabs.push(tab);
		this.state.activeTabId = tab.id;
		this.persist();
		return { ...tab };
	}

	activateTab(tabId) {
		if (!this.getTabById(tabId)) {
			return this.getState();
		}

		this.state.activeTabId = tabId;
		this.persist();
		return this.getState();
	}

	updateTab(tabId, patch = {}) {
		const index = this.state.tabs.findIndex((tab) => tab.id === tabId);
		if (index === -1) return null;

		const currentTab = this.state.tabs[index];
		const nextUrl = Object.hasOwn(patch, "url")
			? sanitizeUrl(patch.url) || currentTab.url
			: currentTab.url;
		const nextTitle =
			typeof patch.title === "string" && patch.title.trim()
				? patch.title.trim()
				: currentTab.title;

		const nextTab = {
			...currentTab,
			...patch,
			url: nextUrl,
			title: nextTitle,
			lastUpdatedAt: Date.now(),
		};

		this.state.tabs[index] = nextTab;
		this.persist();
		return { ...nextTab };
	}

	closeTab(tabId) {
		const index = this.state.tabs.findIndex((tab) => tab.id === tabId);
		if (index === -1) {
			return this.getState();
		}

		this.state.tabs.splice(index, 1);
		if (this.state.tabs.length === 0) {
			const fallbackTab = createDefaultTab();
			this.state.tabs.push(fallbackTab);
			this.state.activeTabId = fallbackTab.id;
		} else if (this.state.activeTabId === tabId) {
			const nextIndex = Math.max(0, index - 1);
			this.state.activeTabId = this.state.tabs[nextIndex].id;
		}

		this.persist();
		return this.getState();
	}
}

module.exports = {
	DEFAULT_URL,
	TabStateManager,
	sanitizeUrl,
};
