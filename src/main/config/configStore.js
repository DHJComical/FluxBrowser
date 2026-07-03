const fs = require("fs");
const path = require("path");
const { t } = require("../i18n");

function loadConfig(filePath, defaultConfig, debugLog) {
	try {
		if (fs.existsSync(filePath)) {
			const fileContent = fs.readFileSync(filePath, "utf-8");
			const savedConfig = JSON.parse(fileContent);

			if (Array.isArray(defaultConfig) && Array.isArray(savedConfig)) {
				return savedConfig;
			}

			return { ...defaultConfig, ...savedConfig };
		}
	} catch (error) {
		if (debugLog) {
			debugLog(
				t("logs.config.loadFailed", {
					name: path.basename(filePath),
				}),
				error,
			);
		}
	}

	return defaultConfig;
}

function saveConfig(filePath, data, debugLog) {
	try {
		fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
	} catch (error) {
		if (debugLog) {
			debugLog(
				t("logs.config.saveFailed", {
					name: path.basename(filePath),
				}),
				error,
			);
		}
	}
}

module.exports = {
	loadConfig,
	saveConfig,
};
