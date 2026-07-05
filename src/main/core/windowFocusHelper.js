const { execFile } = require("child_process");
const {
	resolveNativeBinaryPath,
} = require("../native/resolveNativeBinaryPath");

const NATIVE_BINARY_NAME =
	process.platform === "win32" ? "flux-native.exe" : "flux-native";

let nativeFocusHelperAvailable = process.platform === "win32";
let nativeFocusHelperFailureLogged = false;

function logFocusHelper(message) {
	console.info(`[WindowFocusHelper] ${message}`);
}

function logFocusHelperError(message) {
	console.error(`[WindowFocusHelper] ${message}`);
}

function markNativeFocusHelperUnavailable(reason) {
	nativeFocusHelperAvailable = false;
	if (nativeFocusHelperFailureLogged) return;
	nativeFocusHelperFailureLogged = true;
	logFocusHelperError(`Native focus helper unavailable. ${reason}`);
}

function focusBorderlessMaximizedApp() {
	if (process.platform !== "win32") return;
	if (!nativeFocusHelperAvailable) return;

	const nativeBinaryPath = resolveNativeBinaryPath(NATIVE_BINARY_NAME);
	if (!nativeBinaryPath) {
		markNativeFocusHelperUnavailable("native binary not found");
		return;
	}

	logFocusHelper(`Invoking focus helper via Rust: ${nativeBinaryPath}`);
	execFile(
		nativeBinaryPath,
		["focus-borderless-maximized", String(process.pid)],
		{ windowsHide: true },
		(error) => {
			if (!error) return;
			markNativeFocusHelperUnavailable(error.message || "exec failed");
		},
	);
}

function bringWindowToFront(window) {
	if (!window || window.isDestroyed()) return;

	if (window.isMinimized()) {
		window.restore();
	}
	if (!window.isVisible()) {
		window.show();
	}
	if (typeof window.moveTop === "function") {
		window.moveTop();
	}
	if (!window.isAlwaysOnTop()) {
		window.setAlwaysOnTop(true, "screen-saver");
	}
	window.focus();
}

module.exports = {
	focusBorderlessMaximizedApp,
	bringWindowToFront,
};
