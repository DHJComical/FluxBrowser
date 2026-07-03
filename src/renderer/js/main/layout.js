const { ipcRenderer } = require("electron");
const { setFloatingPanelSize } = require("./floatingPanels");

function bindLayoutEvents() {
	ipcRenderer.on("set-webview-panel-size", (_event, payload = {}) => {
		setFloatingPanelSize("webview", payload.width, payload.height);
	});
}

module.exports = {
	bindLayoutEvents,
};
