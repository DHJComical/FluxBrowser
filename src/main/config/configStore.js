const fs = require("fs");
const path = require("path");

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
				`加载配置文件 [${path.basename(filePath)}] 失败:`,
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
				`保存配置文件 [${path.basename(filePath)}] 失败:`,
				error,
			);
		}
	}
}

module.exports = {
	loadConfig,
	saveConfig,
};
