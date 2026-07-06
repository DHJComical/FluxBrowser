const { ipcRenderer } = require("electron");
const { fluxBar } = require("./dom");
const { state, setImmersionMode } = require("./state");
const { getActiveWebview } = require("./tabs");
const {
	enterImmersionPanelLayout,
	exitImmersionPanelLayout,
	setMousePassthrough,
} = require("./floatingPanels");

function bindImmersionEvents() {
	ipcRenderer.on("toggle-immersion-ui", (_event, isImmersion) => {
		if (isImmersion) {
			enterImmersionPanelLayout();
			document.body.classList.add("immersion");
		} else {
			exitImmersionPanelLayout();
			document.body.classList.remove("immersion");
		}
		setImmersionMode(isImmersion);
		window.dispatchEvent(
			new CustomEvent("immersion-mode-change", {
				detail: { isImmersion },
			}),
		);
		if (!isImmersion) setMousePassthrough(false);
		if (isImmersion) setMousePassthrough(true);
		ipcRenderer.send("immersion-mode-changed", isImmersion);
	});

	if (fluxBar) {
		fluxBar.onmouseenter = () => setMousePassthrough(false);
	}

	document.addEventListener("mouseover", (event) => {
		const activeWebview = getActiveWebview();
		if (!activeWebview) return;
		if (event.target === activeWebview && state.isImmersionMode) {
			setMousePassthrough(true);
		}
	});
}

module.exports = {
	bindImmersionEvents,
};
