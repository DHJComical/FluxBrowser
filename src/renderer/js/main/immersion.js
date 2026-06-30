const { ipcRenderer } = require("electron");
const { fluxBar, resizeHandles, webview, dragRegion } = require("./dom");
const { state, setImmersionMode } = require("./state");

function bindImmersionEvents() {
	ipcRenderer.on("toggle-immersion-ui", (_event, isImmersion) => {
		setImmersionMode(isImmersion);
		document.body.classList.toggle("immersion", isImmersion);
		if (!isImmersion) ipcRenderer.send("set-ignore-mouse", false);
		ipcRenderer.send("immersion-mode-changed", isImmersion);
	});

	[fluxBar, ...resizeHandles].forEach((element) => {
		element.onmouseenter = () => ipcRenderer.send("set-ignore-mouse", false);
	});

	webview.onmouseenter = () => {
		if (state.isImmersionMode) {
			ipcRenderer.send("set-ignore-mouse", true);
		}
	};

	resizeHandles.forEach((handle) => {
		handle.onmousedown = () => {
			if (state.isImmersionMode) return;
			ipcRenderer.send("start-resizing", handle.getAttribute("data-direction"));
		};
	});

	if (dragRegion) {
		dragRegion.onmousedown = (event) => {
			if (state.isImmersionMode) return;
			event.preventDefault();
			ipcRenderer.send("start-moving");
		};
	}

	window.onmouseup = () => {
		ipcRenderer.send("stop-moving");
		ipcRenderer.send("stop-resizing");
	};
}

module.exports = {
	bindImmersionEvents,
};
