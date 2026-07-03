const log = require("electron-log");
const { state } = require("./state");
const { translateLogArgs } = require("../shared/i18n");

const debugLog = {
	info: (...args) => {
		if (state.debugMode) log.info(...translateLogArgs(args));
	},
	error: (...args) => {
		if (state.debugMode) log.error(...translateLogArgs(args));
	},
	warn: (...args) => {
		if (state.debugMode) log.warn(...translateLogArgs(args));
	},
};

module.exports = debugLog;
