const { ipcRenderer } = require("electron");
const { fluxBar, webviewPanel } = require("./dom");
const { state, setImmersionMode } = require("./state");
const { getActiveWebview } = require("./tabs");
const { setTemporaryWebviewOpacity } = require("./webview");
const {
	enterImmersionPanelLayout,
	exitImmersionPanelLayout,
	setMousePassthrough,
} = require("./floatingPanels");

const IMMERSION_POINTER_OPACITY = 0.2;
const IMMERSION_POINTER_POLL_MS = 80;
let immersionPointerOpacityTimer = null;
let immersionPointerOpacityRequestPending = false;
let isImmersionPointerDimmed = false;

function setImmersionPointerDimmed(dimmed) {
	if (isImmersionPointerDimmed === dimmed) return;
	isImmersionPointerDimmed = dimmed;
	setTemporaryWebviewOpacity(dimmed ? IMMERSION_POINTER_OPACITY : null);
}

function isPointInsideRect(point, rect) {
	return (
		point.x >= rect.left &&
		point.x <= rect.right &&
		point.y >= rect.top &&
		point.y <= rect.bottom
	);
}

function getWebviewPanelScreenRect(windowBounds) {
	if (!webviewPanel || !windowBounds) return null;

	const rect = webviewPanel.getBoundingClientRect();
	return {
		left: windowBounds.x + rect.left,
		top: windowBounds.y + rect.top,
		right: windowBounds.x + rect.right,
		bottom: windowBounds.y + rect.bottom,
	};
}

async function updateImmersionPointerOpacity() {
	if (!state.isImmersionMode || immersionPointerOpacityRequestPending) return;

	immersionPointerOpacityRequestPending = true;
	try {
		const pointerState = await ipcRenderer.invoke("get-pointer-screen-state");
		if (!state.isImmersionMode) return;

		const panelRect = getWebviewPanelScreenRect(pointerState?.windowBounds);
		const cursor = pointerState?.cursor;
		const isInsideWebview =
			panelRect && cursor ? isPointInsideRect(cursor, panelRect) : false;
		setImmersionPointerDimmed(isInsideWebview);
	} catch (_error) {
		setImmersionPointerDimmed(false);
	} finally {
		immersionPointerOpacityRequestPending = false;
	}
}

function startImmersionPointerOpacityWatch() {
	if (immersionPointerOpacityTimer) return;

	updateImmersionPointerOpacity();
	immersionPointerOpacityTimer = window.setInterval(
		updateImmersionPointerOpacity,
		IMMERSION_POINTER_POLL_MS,
	);
}

function stopImmersionPointerOpacityWatch() {
	if (immersionPointerOpacityTimer) {
		window.clearInterval(immersionPointerOpacityTimer);
		immersionPointerOpacityTimer = null;
	}
	setImmersionPointerDimmed(false);
}

function bindImmersionEvents() {
	ipcRenderer.on("toggle-immersion-ui", (_event, isImmersion) => {
		if (isImmersion) {
			enterImmersionPanelLayout();
			document.body.classList.add("immersion");
			startImmersionPointerOpacityWatch();
		} else {
			exitImmersionPanelLayout();
			document.body.classList.remove("immersion");
			stopImmersionPointerOpacityWatch();
		}
		setImmersionMode(isImmersion);
		window.dispatchEvent(
			new CustomEvent("immersion-mode-change", {
				detail: { isImmersion },
			}),
		);
		if (!isImmersion) setMousePassthrough(false);
		if (isImmersion) setMousePassthrough(true, { forward: false });
		ipcRenderer.send("immersion-mode-changed", isImmersion);
	});

	if (fluxBar) {
		fluxBar.onmouseenter = () => setMousePassthrough(false);
	}

	document.addEventListener("mouseover", (event) => {
		const activeWebview = getActiveWebview();
		if (!activeWebview) return;
		if (event.target === activeWebview && state.isImmersionMode) {
			setMousePassthrough(true, { forward: false });
		}
	});
}

module.exports = {
	bindImmersionEvents,
};
