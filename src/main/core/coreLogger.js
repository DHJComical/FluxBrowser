const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const configManager = require("../ConfigManager");

function debugLog(...args) {
	if (configManager.isDebugMode()) {
		console.log(...args);
	}
}

function logStartupInfo() {
	debugLog("--- FluxCore 启动 (重构版) ---");
	debugLog(`运行环境: ${app.isPackaged ? "生产" : "开发"}`);
	debugLog(`存储路径: ${app.getPath("userData")}`);

	const savedBounds = configManager.getBoundsConfig();
	debugLog(`启动窗口位置: X=${savedBounds.x}, Y=${savedBounds.y}`);
	debugLog(`启动窗口大小: Width=${savedBounds.width}, Height=${savedBounds.height}`);
}

function clearLogFiles() {
	try {
		const logFolder = path.join(app.getPath("userData"), "logs");
		const logPath = path.join(logFolder, "main.log");

		if (fs.existsSync(logPath)) {
			fs.unlinkSync(logPath);
			debugLog("日志文件已删除");
		}

		if (!fs.existsSync(logFolder)) {
			fs.mkdirSync(logFolder, { recursive: true });
			debugLog("日志文件夹已创建");
		}

		debugLog("日志清理完成");
	} catch (error) {
		debugLog("清理日志文件时出错:", error.message);
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
