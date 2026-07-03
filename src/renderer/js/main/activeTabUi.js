const { urlInput, pageTitle } = require("./dom");
const { getActiveTab } = require("./state");
const { t } = require("../shared/i18n");

function syncActiveTabUi() {
	const activeTab = getActiveTab();
	if (!activeTab) return;

	if (urlInput) {
		urlInput.value = activeTab.url || "";
	}
	if (pageTitle) {
		pageTitle.textContent = activeTab.title || t("main.tabs.currentPage");
	}
}

module.exports = {
	syncActiveTabUi,
};
