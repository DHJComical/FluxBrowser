const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const configManager = require("../ConfigManager");
const { t } = require("../i18n");

function debugLog(...args) {
	if (configManager.isDebugMode()) {
		console.log(...args);
	}
}

function logStartupInfo() {
	debugLog("logs.core.startupBanner");
	debugLog(
		t("logs.core.runtimeEnvironment", {
			mode: t(
				app.isPackaged ? "common.env.production" : "common.env.development",
			),
		}),
	);
	debugLog(
		t("logs.core.storagePath", {
			path: app.getPath("userData"),
		}),
	);

	const savedBounds = configManager.getBoundsConfig();
	debugLog(
		t("logs.core.startupWindowPosition", {
			x: savedBounds.x,
			y: savedBounds.y,
		}),
	);
	debugLog(
		t("logs.core.startupWindowSize", {
			width: savedBounds.width,
			height: savedBounds.height,
		}),
	);
}

function clearLogFiles() {
	try {
		const logFolder = path.join(app.getPath("userData"), "logs");
		const logPath = path.join(logFolder, "main.log");

		if (fs.existsSync(logPath)) {
			fs.unlinkSync(logPath);
			debugLog("logs.core.logFileDeleted");
		}

		if (!fs.existsSync(logFolder)) {
			fs.mkdirSync(logFolder, { recursive: true });
			debugLog("logs.core.logFolderCreated");
		}

		debugLog("logs.core.logCleanupCompleted");
	} catch (error) {
		debugLog(
			t("logs.core.logCleanupFailed", {
				message: error.message,
			}),
		);
	}
}

function createCoreLogger(logger) {
	return {
		debug: (...args) => debugLog(...args),
		error: (...args) => debugLog(...args),
		clearLogFiles,
		setDebugMode: (enabled) => {
			if (logger && logger.setDebugMode) {
				logger.setDebugMode(enabled);
			}
		},
	};
}

module.exports = {
	debugLog,
	logStartupInfo,
	clearLogFiles,
	createCoreLogger,
};
