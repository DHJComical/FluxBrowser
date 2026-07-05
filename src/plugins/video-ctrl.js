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
const KEY_HOLD_BACKENDS = {
	NATIVE: "native",
	POWERSHELL: "powershell",
};
const NATIVE_BINARY_NAME =
	process.platform === "win32" ? "flux-native.exe" : "flux-native";

let keyHoldWorker = null;
let keyHoldOutputBuffer = "";
let keyHoldRequestId = 0;
let activeForwardHold = null;
let registeredExitCleanup = false;
let keyHoldWorkerStopping = false;
let keyHoldBackend =
	process.platform === "win32"
		? KEY_HOLD_BACKENDS.NATIVE
		: KEY_HOLD_BACKENDS.POWERSHELL;
let nativeFallbackWarningShown = false;

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

function showNativeFallbackWarning(reason) {
	if (nativeFallbackWarningShown) return;
	nativeFallbackWarningShown = true;
	console.warn(
		`FluxBrowser native key-hold worker unavailable, falling back to PowerShell. ${reason}`,
	);
}

function logKeyHoldBackend(message) {
	console.info(`[VideoController] ${message}`);
}

function switchKeyHoldBackend(nextBackend, reason) {
	if (keyHoldBackend === nextBackend) return;
	keyHoldBackend = nextBackend;
	if (nextBackend === KEY_HOLD_BACKENDS.POWERSHELL && reason) {
		showNativeFallbackWarning(reason);
	}
}

function resolveNativeKeyHoldBinaryPath() {
	return resolveNativeBinaryPath(NATIVE_BINARY_NAME);
}

function buildKeyHoldWorkerScript() {
	return `
$signature = @'
using System.Runtime.InteropServices;

public static class KeyboardState {
	[DllImport("user32.dll")]
	public static extern short GetAsyncKeyState(int vKey);
}
'@

Add-Type -TypeDefinition $signature

function Test-AllKeysDown([int[]]$keyCodes) {
	foreach ($keyCode in $keyCodes) {
		if (([KeyboardState]::GetAsyncKeyState($keyCode) -band 0x8000) -eq 0) {
			return $false
		}
	}
	return $true
}

Write-Output "ready"

while ($true) {
	$line = [Console]::In.ReadLine()
	if ($null -eq $line -or $line -eq "exit") {
		break
	}

	$parts = $line -split "\\|"
	if ($parts.Length -lt 4) {
		continue
	}

	$requestId = $parts[0]
	$keyCodes = @(
		$parts[1].Split(",") |
			Where-Object { $_ -match "^\\d+$" } |
			ForEach-Object { [int]$_ }
	)
	$thresholdMs = [int]$parts[2]
	$pollMs = [int]$parts[3]

	if ($keyCodes.Count -eq 0) {
		Write-Output "$requestId|short"
		continue
	}

	$elapsedMs = 0
	$isShort = $false

	while ($elapsedMs -lt $thresholdMs) {
		if (-not (Test-AllKeysDown $keyCodes)) {
			Write-Output "$requestId|short"
			$isShort = $true
			break
		}

		Start-Sleep -Milliseconds $pollMs
		$elapsedMs += $pollMs
	}

	if ($isShort) {
		continue
	}

	Write-Output "$requestId|long"

	while (Test-AllKeysDown $keyCodes) {
		Start-Sleep -Milliseconds $pollMs
	}

	Write-Output "$requestId|released"
}
`;
}

function cleanupForwardHold(shouldSeekOnUnhandled = false) {
	if (!activeForwardHold) return;

	const hold = activeForwardHold;
	activeForwardHold = null;

	if (shouldSeekOnUnhandled && !hold.handled) {
		seekVideo(hold.core, hold.config.forwardSeconds);
	}

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
	cleanupForwardHold(true);
}

function attachKeyHoldWorkerListeners(worker, backend) {
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
		if (!keyHoldWorkerStopping && backend === KEY_HOLD_BACKENDS.NATIVE) {
			switchKeyHoldBackend(
				KEY_HOLD_BACKENDS.POWERSHELL,
				error?.message || "spawn failed",
			);
		}
		keyHoldWorkerStopping = false;
		keyHoldWorker = null;
		keyHoldOutputBuffer = "";
		cleanupForwardHold(true);
	});

	worker.on("close", (code) => {
		if (!keyHoldWorkerStopping && backend === KEY_HOLD_BACKENDS.NATIVE) {
			switchKeyHoldBackend(
				KEY_HOLD_BACKENDS.POWERSHELL,
				`native worker exited with code ${code ?? "unknown"}`,
			);
		}
		keyHoldWorkerStopping = false;
		keyHoldWorker = null;
		keyHoldOutputBuffer = "";
		cleanupForwardHold(true);
	});

	if (!registeredExitCleanup) {
		registeredExitCleanup = true;
		process.once("exit", stopKeyHoldWorker);
	}

	return worker;
}

function startNativeKeyHoldWorker() {
	if (process.platform !== "win32") return null;
	if (keyHoldWorker && !keyHoldWorker.killed) return keyHoldWorker;

	const binaryPath = resolveNativeKeyHoldBinaryPath();
	if (!binaryPath) {
		switchKeyHoldBackend(
			KEY_HOLD_BACKENDS.POWERSHELL,
			"native binary not found",
		);
		return null;
	}

	const worker = spawn(binaryPath, ["key-hold-worker"], {
		windowsHide: true,
	});
	logKeyHoldBackend(`Started key-hold worker via Rust: ${binaryPath}`);

	return attachKeyHoldWorkerListeners(worker, KEY_HOLD_BACKENDS.NATIVE);
}

function startPowerShellKeyHoldWorker() {
	if (process.platform !== "win32") return null;
	if (keyHoldWorker && !keyHoldWorker.killed) return keyHoldWorker;

	const worker = spawn(
		"powershell.exe",
		[
			"-NoProfile",
			"-ExecutionPolicy",
			"Bypass",
			"-Command",
			buildKeyHoldWorkerScript(),
		],
		{ windowsHide: true },
	);
	logKeyHoldBackend("Started key-hold worker via PowerShell");

	return attachKeyHoldWorkerListeners(worker, KEY_HOLD_BACKENDS.POWERSHELL);
}

function startKeyHoldWorker() {
	if (process.platform !== "win32") return null;
	if (keyHoldWorker && !keyHoldWorker.killed) return keyHoldWorker;

	if (keyHoldBackend === KEY_HOLD_BACKENDS.NATIVE) {
		const nativeWorker = startNativeKeyHoldWorker();
		if (nativeWorker) {
			return nativeWorker;
		}
	}

	return startPowerShellKeyHoldWorker();
}

function requestKeyHold(core, config, keyCodes) {
	const worker = startKeyHoldWorker();
	if (!worker || !worker.stdin || worker.stdin.destroyed) {
		return false;
	}

	const requestId = String(++keyHoldRequestId);
	logKeyHoldBackend(`Key-hold request ${requestId} using ${keyHoldBackend}`);
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
				cleanupForwardHold(true);
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

function handleFallbackForward(core, forwardSeconds) {
	seekVideo(core, forwardSeconds);
}

function handleForward(core) {
	if (activeForwardHold) return;

	const config = getVideoConfig();
	const keyCodes = getAcceleratorVirtualKeyCodes(core.getKey("Video-Forward"));
	if (process.platform !== "win32" || keyCodes.length === 0) {
		handleFallbackForward(core, config.forwardSeconds);
		return;
	}

	if (!requestKeyHold(core, config, keyCodes)) {
		handleFallbackForward(core, config.forwardSeconds);
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
