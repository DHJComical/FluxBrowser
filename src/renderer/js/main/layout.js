const { ipcRenderer } = require("electron");
const { webviewStack } = require("./dom");

function measureWebviewStack() {
	if (!webviewStack) {
		return { width: 0, height: 0 };
	}

	const rect = webviewStack.getBoundingClientRect();
	return {
		width: Math.round(rect.width),
		height: Math.round(rect.height),
	};
}

function bindLayoutEvents() {
	ipcRenderer.on("measure-webview-size", (_event, payload = {}) => {
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const size = measureWebviewStack();
				ipcRenderer.send("webview-size-measured", {
					calibrationId: payload.calibrationId,
					targetWidth: payload.targetWidth,
					targetHeight: payload.targetHeight,
					actualWidth: size.width,
					actualHeight: size.height,
					attempt: payload.attempt || 0,
				});
			});
		});
	});
}

module.exports = {
	bindLayoutEvents,
	measureWebviewStack,
};
