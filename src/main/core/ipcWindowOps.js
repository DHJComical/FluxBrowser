const configManager = require("../ConfigManager");
const { OPACITY_CONSTANTS } = require("../../constants/config");

function broadcastToWindows(windowManager, channel, data) {
	const windows = windowManager.getAllWindows();
	windows.forEach((win) => {
		if (win && !win.isDestroyed()) {
			win.webContents.send(channel, data);
		}
	});
}

function sendToWindow(window, channel, data) {
	if (!window || window.isDestroyed()) return;
	window.webContents.send(channel, data);
}

function adjustWindowOpacity(ipcManager, delta) {
	let newOpacity = parseFloat(
		(ipcManager.currentOpacity + delta).toFixed(1),
	);

	if (newOpacity > OPACITY_CONSTANTS.MAX) {
		newOpacity = OPACITY_CONSTANTS.MAX;
	}
	if (newOpacity < OPACITY_CONSTANTS.MIN) {
		newOpacity = OPACITY_CONSTANTS.MIN;
	}

	ipcManager.currentOpacity = newOpacity;
	broadcastToWindows(ipcManager.windowManager, "set-opacity", newOpacity);
	configManager.saveBoundsConfig({ opacity: newOpacity });
}

module.exports = {
	broadcastToWindows,
	sendToWindow,
	adjustWindowOpacity,
};
