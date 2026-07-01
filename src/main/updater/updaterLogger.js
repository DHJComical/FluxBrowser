const configManager = require("../ConfigManager");

function createUpdaterLogger() {
	return {
		info: (...args) => {
			if (configManager.isDebugMode()) console.log("[Updater]", ...args);
		},
		warn: (...args) => {
			if (configManager.isDebugMode()) console.warn("[Updater]", ...args);
		},
		error: (...args) => {
			if (configManager.isDebugMode()) console.error("[Updater]", ...args);
		},
	};
}

function createUpdaterDebugLog() {
	return {
		log: (...args) => {
			if (configManager.isDebugMode()) console.log(...args);
		},
		error: (...args) => {
			if (configManager.isDebugMode()) console.error(...args);
		},
	};
}

module.exports = {
	createUpdaterLogger,
	createUpdaterDebugLog,
};
