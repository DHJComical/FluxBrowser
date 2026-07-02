const { urlInput, pageTitle } = require("./dom");
const { getActiveTab } = require("./state");

function syncActiveTabUi() {
	const activeTab = getActiveTab();
	if (!activeTab) return;

	if (urlInput) {
		urlInput.value = activeTab.url || "";
	}
	if (pageTitle) {
		pageTitle.textContent = activeTab.title || "当前页面";
	}
}

module.exports = {
	syncActiveTabUi,
};
