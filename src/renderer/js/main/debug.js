const log = require("electron-log");
const { state } = require("./state");

const debugLog = {
	info: (...args) => {
		if (state.debugMode) log.info(...args);
	},
	error: (...args) => {
		if (state.debugMode) log.error(...args);
	},
	warn: (...args) => {
		if (state.debugMode) log.warn(...args);
	},
};

module.exports = debugLog;
