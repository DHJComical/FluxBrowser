const { spawn } = require("child_process");
const configManager = require("../main/ConfigManager");
const {
	resolveNativeBinaryPath,
} = require("../main/native/resolveNativeBinaryPath");

const DEFAULT_VIDEO_CONFIG = {
	forwardSeconds: 10,
	backwardSeconds: 10,
	longPressRate: 2.0,
};
const LONG_PRESS_THRESHOLD_MS = 250;
const KEY_POLL_INTERVAL_MS = 15;
const NATIVE_BINARY_NAME =
	process.platform === "win32" ? "flux-native.exe" : "flux-native";

let keyHoldWorker = null;
let keyHoldOutputBuffer = "";
let keyHoldRequestId = 0;
let activeForwardHold = null;
let registeredExitCleanup = false;
let keyHoldWorkerStopping = false;
let nativeWorkerAvailable = process.platform === "win32";
let nativeWorkerFailureLogged = false;

const VIRTUAL_KEY_MAP = {
	BACKSPACE: 0x08,
	TAB: 0x09,
	ENTER: 0x0d,
	RETURN: 0x0d,
	SHIFT: 0x10,
	CTRL: 0x11,
	CONTROL: 0x11,
	ALT: 0x12,
	OPTION: 0x12,
	ESC: 0x1b,
	ESCAPE: 0x1b,
	SPACE: 0x20,
	PAGEUP: 0x21,
	PAGEDOWN: 0x22,
	END: 0x23,
	HOME: 0x24,
	LEFT: 0x25,
	UP: 0x26,
	RIGHT: 0x27,
	DOWN: 0x28,
	INSERT: 0x2d,
	DELETE: 0x2e,
	CMD: 0x5b,
	COMMAND: 0x5b,
	COMMANDORCONTROL: 0x11,
};

function logKeyHold(message) {
	console.info(`[VideoController] ${message}`);
}

function logKeyHoldError(message) {
	console.error(`[VideoController] ${message}`);
}

function markNativeWorkerUnavailable(reason) {
	nativeWorkerAvailable = false;
	if (nativeWorkerFailureLogged) return;
	nativeWorkerFailureLogged = true;
	logKeyHoldError(`Native key-hold worker unavailable. ${reason}`);
}

function clampNumber(value, fallback, min, max) {
	const number = Number(value);
	if (!Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, number));
}

function getVideoConfig() {
	const appConfig = configManager.getAppConfig();
	return {
		forwardSeconds: clampNumber(
			appConfig.videoForwardSeconds,
			DEFAULT_VIDEO_CONFIG.forwardSeconds,
			1,
			600,
		),
		backwardSeconds: clampNumber(
			appConfig.videoBackwardSeconds,
			DEFAULT_VIDEO_CONFIG.backwardSeconds,
			1,
			600,
		),
		longPressRate: clampNumber(
			appConfig.videoLongPressRate,
			DEFAULT_VIDEO_CONFIG.longPressRate,
			0.25,
			16,
		),
	};
}

function getVirtualKeyCode(key) {
	const normalizedKey = String(key).replace(/\s/g, "").toUpperCase();
	if (VIRTUAL_KEY_MAP[normalizedKey]) return VIRTUAL_KEY_MAP[normalizedKey];
	if (/^[A-Z]$/.test(normalizedKey)) return normalizedKey.charCodeAt(0);
	if (/^[0-9]$/.test(normalizedKey)) return normalizedKey.charCodeAt(0);

	const functionKeyMatch = normalizedKey.match(/^F(\d{1,2})$/);
	if (functionKeyMatch) {
		const index = Number(functionKeyMatch[1]);
		if (index >= 1 && index <= 24) {
			return 0x70 + index - 1;
		}
	}

	return null;
}

function getAcceleratorVirtualKeyCodes(accelerator) {
	const codes = String(accelerator || "")
		.split("+")
		.map((part) => getVirtualKeyCode(part))
		.filter((code) => code !== null);

	return [...new Set(codes)];
}

function cleanupForwardHold() {
	if (!activeForwardHold) return;

	const hold = activeForwardHold;
	activeForwardHold = null;
	if (hold.rateActive) {
		restoreLongPressPlaybackRate(hold.core);
	}
}

function handleKeyHoldMessage(message) {
	if (message === "ready") return;
	const [requestId, status] = message.split("|");
	if (!activeForwardHold || activeForwardHold.id !== requestId) return;

	if (status === "short" && !activeForwardHold.handled) {
		activeForwardHold.handled = true;
		seekVideo(activeForwardHold.core, activeForwardHold.config.forwardSeconds);
		cleanupForwardHold();
	} else if (status === "long" && !activeForwardHold.rateActive) {
		activeForwardHold.handled = true;
		activeForwardHold.rateActive = true;
		setLongPressPlaybackRate(
			activeForwardHold.core,
			activeForwardHold.config.longPressRate,
		);
	} else if (status === "released") {
		cleanupForwardHold();
	}
}

function stopKeyHoldWorker() {
	if (keyHoldWorker && !keyHoldWorker.killed) {
		keyHoldWorkerStopping = true;
		keyHoldWorker.kill();
	}
	keyHoldWorker = null;
	keyHoldOutputBuffer = "";
	cleanupForwardHold();
}

function attachKeyHoldWorkerListeners(worker) {
	keyHoldWorker = worker;
	keyHoldOutputBuffer = "";

	if (worker.stdout) {
		worker.stdout.on("data", (data) => {
			keyHoldOutputBuffer += data.toString();
			const lines = keyHoldOutputBuffer.split(/\r?\n/);
			keyHoldOutputBuffer = lines.pop() || "";
			lines
				.map((line) => line.trim())
				.filter(Boolean)
				.forEach(handleKeyHoldMessage);
		});
	}

	worker.on("error", (error) => {
		if (!keyHoldWorkerStopping) {
			markNativeWorkerUnavailable(error?.message || "spawn failed");
		}
		keyHoldWorkerStopping = false;
		keyHoldWorker = null;
		keyHoldOutputBuffer = "";
		cleanupForwardHold();
	});

	worker.on("close", (code) => {
		if (!keyHoldWorkerStopping) {
			markNativeWorkerUnavailable(
				`native worker exited with code ${code ?? "unknown"}`,
			);
		}
		keyHoldWorkerStopping = false;
		keyHoldWorker = null;
		keyHoldOutputBuffer = "";
		cleanupForwardHold();
	});

	if (!registeredExitCleanup) {
		registeredExitCleanup = true;
		process.once("exit", stopKeyHoldWorker);
	}

	return worker;
}

function startKeyHoldWorker() {
	if (process.platform !== "win32") return null;
	if (!nativeWorkerAvailable) return null;
	if (keyHoldWorker && !keyHoldWorker.killed) return keyHoldWorker;

	const binaryPath = resolveNativeBinaryPath(NATIVE_BINARY_NAME);
	if (!binaryPath) {
		markNativeWorkerUnavailable("native binary not found");
		return null;
	}

	try {
		const worker = spawn(binaryPath, ["key-hold-worker"], {
			windowsHide: true,
		});
		logKeyHold(`Started key-hold worker via Rust: ${binaryPath}`);
		return attachKeyHoldWorkerListeners(worker);
	} catch (error) {
		markNativeWorkerUnavailable(error?.message || "spawn failed");
		return null;
	}
}

function requestKeyHold(core, config, keyCodes) {
	const worker = startKeyHoldWorker();
	if (!worker || !worker.stdin || worker.stdin.destroyed) {
		logKeyHoldError("Unable to submit key-hold request to native worker.");
		return false;
	}

	const requestId = String(++keyHoldRequestId);
	logKeyHold(`Key-hold request ${requestId} using Rust`);
	activeForwardHold = {
		id: requestId,
		core,
		config,
		handled: false,
		rateActive: false,
	};

	worker.stdin.write(
		`${requestId}|${keyCodes.join(",")}|${LONG_PRESS_THRESHOLD_MS}|${KEY_POLL_INTERVAL_MS}\n`,
		(error) => {
			if (error && activeForwardHold?.id === requestId) {
				logKeyHoldError(
					`Key-hold request ${requestId} write failed: ${error.message}`,
				);
				cleanupForwardHold();
			}
		},
	);

	return true;
}

function seekVideo(core, seconds) {
	core.executeOnWebview(`
		(() => {
			const video = document.querySelector("video");
			if (video) {
				video.currentTime += ${JSON.stringify(seconds)};
			}
		})();
	`);
}

function setLongPressPlaybackRate(core, rate) {
	core.executeOnWebview(`
		(() => {
			const video = document.querySelector("video");
			if (!video) return;
			if (video.dataset.fluxForwardHoldRateActive !== "true") {
				video.dataset.fluxForwardHoldPreviousRate = String(video.playbackRate || 1);
				video.dataset.fluxForwardHoldRateActive = "true";
			}
			video.playbackRate = ${JSON.stringify(rate)};
		})();
	`);
}

function restoreLongPressPlaybackRate(core) {
	core.executeOnWebview(`
		(() => {
			const video = document.querySelector("video");
			if (!video || video.dataset.fluxForwardHoldRateActive !== "true") return;
			const previousRate = Number.parseFloat(video.dataset.fluxForwardHoldPreviousRate);
			delete video.dataset.fluxForwardHoldRateActive;
			delete video.dataset.fluxForwardHoldPreviousRate;
			video.playbackRate = Number.isFinite(previousRate) && previousRate > 0 ? previousRate : 1;
		})();
	`);
}

function handleForward(core) {
	if (activeForwardHold) return;

	const config = getVideoConfig();
	const keyCodes = getAcceleratorVirtualKeyCodes(core.getKey("Video-Forward"));
	if (process.platform !== "win32" || keyCodes.length === 0) {
		seekVideo(core, config.forwardSeconds);
		return;
	}

	if (!requestKeyHold(core, config, keyCodes)) {
		logKeyHoldError("Video forward shortcut aborted because native worker is unavailable.");
	}
}

module.exports = {
	name: "VideoController",
	initialize: () => {
		startKeyHoldWorker();
	},
	shortcuts: {
		"Video-Pause": (core) => {
			core.executeOnWebview(`
                var v = document.querySelector('video');
                if(v) v.paused ? v.play() : v.pause();
            `);
		},
		"Video-Forward": (core) => {
			handleForward(core);
		},
		"Video-Backward": (core) => {
			seekVideo(core, -getVideoConfig().backwardSeconds);
		},
	},
};
