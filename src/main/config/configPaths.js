const { app } = require("electron");
const path = require("path");
const {
	CONFIG_FILE_NAMES,
	DEV_CONFIG_PREFIX,
} = require("../../constants/config");

function getConfigPrefix() {
	return app.isPackaged ? "" : DEV_CONFIG_PREFIX;
}

function getConfigPaths() {
	const userDataPath = app.getPath("userData");
	const prefix = getConfigPrefix();

	return {
		keyConfigPath: path.join(
			userDataPath,
			`${prefix}${CONFIG_FILE_NAMES.KEY_CONFIG}`,
		),
		boundsConfigPath: path.join(
			userDataPath,
			`${prefix}${CONFIG_FILE_NAMES.BOUNDS_CONFIG}`,
		),
		appConfigPath: path.join(
			userDataPath,
			`${prefix}${CONFIG_FILE_NAMES.APP_CONFIG}`,
		),
		resolutionPresetPath: path.join(
			userDataPath,
			`${prefix}${CONFIG_FILE_NAMES.RESOLUTION_PRESETS}`,
		),
	};
}

module.exports = {
	getConfigPaths,
	getConfigPrefix,
};
