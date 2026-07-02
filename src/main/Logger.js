const log = require("electron-log");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// 全局调试模式标志（需要从 ConfigManager 获取）
let debugMode = false;
let brokenPipeGuardInstalled = false;

function installBrokenPipeGuard(stream) {
	if (!stream || typeof stream.on !== "function") return;

	stream.on("error", (error) => {
		if (error && error.code === "EPIPE") {
			return;
		}
	});
}

/**
 * 设置调试模式
 */
function setDebugMode(enabled) {
	debugMode = enabled;
}

/**
 * 调试日志输出 - 仅在调试模式下输出
 */
const debugLog = {
	log: (...args) => {
		if (debugMode) console.log(...args);
	},
	info: (...args) => {
		if (debugMode) console.log(...args);
	},
	warn: (...args) => {
		if (debugMode) console.warn(...args);
	},
	error: (...args) => {
		if (debugMode) console.error(...args);
	},
};

/**
 * 导出初始化函数
 */
module.exports = function () {
	const isDev = !app.isPackaged;

	// 获取当前环境下的日志路径
	const logFolder = path.join(app.getPath("userData"), "logs");
	const logPath = path.join(logFolder, "main.log");

	// 启动时清理旧日志
	try {
		if (fs.existsSync(logPath)) {
			fs.unlinkSync(logPath);
		}
		if (!fs.existsSync(logFolder)) {
			fs.mkdirSync(logFolder, { recursive: true });
		}
	} catch (err) {
		// 此时 logger 还没好，只能先用原生 console 输出错误
		process.stdout.write("无法清理日志文件: " + err.message + "\n");
	}

	// electron-log
	log.transports.file.resolvePathFn = () => logPath;

	// 开发环境保留控制台日志，配合 EPIPE 防护避免管道断开时崩溃
	log.transports.file.level = isDev ? "debug" : "info";
	log.transports.console.level = isDev ? "debug" : false;

	log.transports.file.format =
		"[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}";

	if (!brokenPipeGuardInstalled) {
		installBrokenPipeGuard(process.stdout);
		installBrokenPipeGuard(process.stderr);
		brokenPipeGuardInstalled = true;
	}

	// 接管全局 console
	Object.assign(console, log.functions);

	// 导出模块
	return {
		log,
		debugLog,
		setDebugMode,
	};
};
