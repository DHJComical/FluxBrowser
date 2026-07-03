const { translateLogArgs } = require("../shared/i18n");

module.exports = {
	info: (...args) => {
		console.log(...translateLogArgs(args));
	},
	error: (...args) => {
		console.error(...translateLogArgs(args));
	},
	warn: (...args) => {
		console.warn(...translateLogArgs(args));
	},
};
