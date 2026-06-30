const state = {
	isImmersionMode: false,
	debugMode: false,
	lastUrl:
		localStorage.getItem("flux-last-url") ||
		"https://space.bilibili.com/563138217",
};

function setDebugMode(enabled) {
	state.debugMode = enabled === true;
}

function setImmersionMode(enabled) {
	state.isImmersionMode = enabled === true;
}

function setLastUrl(url) {
	state.lastUrl = url;
	localStorage.setItem("flux-last-url", url);
}

module.exports = {
	state,
	setDebugMode,
	setImmersionMode,
	setLastUrl,
};
