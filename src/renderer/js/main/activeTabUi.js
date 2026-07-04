const { urlInput, backBtn, forwardBtn, refreshBtn } = require("./dom");
const { getActiveTab } = require("./state");

function syncNavigationButtons(activeTab) {
	const canGoBack = activeTab?.canGoBack === true;
	const canGoForward = activeTab?.canGoForward === true;
	const isLoading = activeTab?.isLoading === true;

	if (backBtn) {
		backBtn.disabled = !canGoBack;
	}
	if (forwardBtn) {
		forwardBtn.disabled = !canGoForward;
	}
	if (refreshBtn) {
		const icon = refreshBtn.querySelector(".material-icons");
		refreshBtn.disabled = !activeTab;
		refreshBtn.dataset.loading = isLoading ? "true" : "false";
		if (icon) {
			icon.textContent = isLoading ? "close" : "refresh";
		}
	}
}

function syncActiveTabUi() {
	const activeTab = getActiveTab();
	if (!activeTab) {
		if (urlInput) {
			urlInput.value = "";
		}
		syncNavigationButtons(null);
		return;
	}

	if (urlInput) {
		urlInput.value = activeTab.url || "";
	}
	syncNavigationButtons(activeTab);
}

module.exports = {
	syncActiveTabUi,
};
