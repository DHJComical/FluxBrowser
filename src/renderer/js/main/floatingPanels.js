const { ipcRenderer } = require("electron");

const FLOATING_PANEL_MARGIN = 12;
const INTERACTIVE_SELECTOR = "[data-floating-panel], #dropdown-menu, .feedback-confirm-scrim, .feedback-toast-stack";
let activeDragState = null;
let floatingPanelsConfig = {};
const saveTimers = new Map();
const temporaryPanelBounds = new Map();

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function getPanelBounds(panel) {
	const rect = panel.getBoundingClientRect();
	return {
		x: rect.left,
		y: rect.top,
		width: rect.width,
		height: rect.height,
	};
}

function placePanel(panel, x, y) {
	const maxX = Math.max(
		FLOATING_PANEL_MARGIN,
		window.innerWidth - panel.offsetWidth - FLOATING_PANEL_MARGIN,
	);
	const maxY = Math.max(
		FLOATING_PANEL_MARGIN,
		window.innerHeight - panel.offsetHeight - FLOATING_PANEL_MARGIN,
	);
	panel.style.left = `${Math.round(clamp(x, FLOATING_PANEL_MARGIN, maxX))}px`;
	panel.style.top = `${Math.round(clamp(y, FLOATING_PANEL_MARGIN, maxY))}px`;
	panel.style.right = "auto";
	panel.style.bottom = "auto";
}

function keepPanelInView(panel) {
	const bounds = getPanelBounds(panel);
	placePanel(panel, bounds.x, bounds.y);
}

function getPanelId(panel) {
	return panel.dataset.panelId || "";
}

function getPersistedBounds(panel) {
	const panelId = getPanelId(panel);
	return panelId ? floatingPanelsConfig[panelId] || null : null;
}

function serializePanelBounds(panel) {
	const bounds = getPanelBounds(panel);
	return {
		x: Math.round(bounds.x),
		y: Math.round(bounds.y),
		width: Math.round(bounds.width),
		height: Math.round(bounds.height),
	};
}

function scheduleSavePanelBounds(panel) {
	const panelId = getPanelId(panel);
	if (!panelId) return;

	if (saveTimers.has(panelId)) {
		clearTimeout(saveTimers.get(panelId));
	}

	const timer = setTimeout(() => {
		ipcRenderer.send("save-floating-panel", {
			panelId,
			bounds: serializePanelBounds(panel),
		});
		saveTimers.delete(panelId);
	}, 160);
	saveTimers.set(panelId, timer);
}

function setFloatingPanelSize(panelId, width, height) {
	const panel = document.querySelector(`[data-panel-id="${panelId}"]`);
	if (!panel) return;

	const handle = panel.querySelector("[data-floating-handle]");
	const extraHeight =
		panel.dataset.sizeTarget === "content" && handle ? handle.offsetHeight : 0;

	panel.style.width = `${Math.max(240, Math.round(Number(width) || 0))}px`;
	panel.style.height = `${Math.max(
		180,
		Math.round(Number(height) || 0) + extraHeight,
	)}px`;
	keepPanelInView(panel);
	scheduleSavePanelBounds(panel);
}

function applyTemporaryPanelBounds(panel, bounds) {
	panel.style.width = `${Math.round(bounds.width)}px`;
	panel.style.height = `${Math.round(bounds.height)}px`;
	placePanel(panel, bounds.x, bounds.y);
}

function getContentExtraHeight(panel) {
	const handle = panel.querySelector("[data-floating-handle]");
	return panel.dataset.sizeTarget === "content" && handle ? handle.offsetHeight : 0;
}

function enterImmersionPanelLayout() {
	const panel = document.querySelector('[data-panel-id="webview"]');
	if (!panel) return;

	if (!temporaryPanelBounds.has("webview")) {
		temporaryPanelBounds.set("webview", serializePanelBounds(panel));
	}

	const bounds = serializePanelBounds(panel);
	const contentExtraHeight = getContentExtraHeight(panel);
	if (contentExtraHeight <= 0) return;

	applyTemporaryPanelBounds(panel, {
		x: bounds.x,
		y: bounds.y + contentExtraHeight,
		width: bounds.width,
		height: Math.max(120, bounds.height - contentExtraHeight),
	});
}

function exitImmersionPanelLayout() {
	const panel = document.querySelector('[data-panel-id="webview"]');
	const bounds = temporaryPanelBounds.get("webview");
	if (!panel || !bounds) return;

	applyTemporaryPanelBounds(panel, bounds);
	temporaryPanelBounds.delete("webview");
}

function initializePanelPosition(panel) {
	if (panel.dataset.positioned === "true") return;

	const persistedBounds = getPersistedBounds(panel);
	if (persistedBounds) {
		panel.style.width = `${Math.max(240, Math.round(persistedBounds.width || 0))}px`;
		panel.style.height = `${Math.max(120, Math.round(persistedBounds.height || 0))}px`;
		placePanel(panel, persistedBounds.x || 0, persistedBounds.y || 0);
		panel.dataset.positioned = "true";
		return;
	}

	const panelWidth = panel.offsetWidth || Math.min(960, window.innerWidth - 48);
	const x = Math.max(FLOATING_PANEL_MARGIN, (window.innerWidth - panelWidth) / 2);
	let y = FLOATING_PANEL_MARGIN;

	if (panel.dataset.panelId !== "mainbar") {
		const mainbar = document.getElementById("flux-bar");
		const mainbarRect = mainbar ? mainbar.getBoundingClientRect() : { bottom: 72 };
		y = Math.min(
			window.innerHeight - FLOATING_PANEL_MARGIN,
			mainbarRect.bottom + 18,
		);
	}

	placePanel(panel, x, y);
	panel.dataset.positioned = "true";
}

function bindPanelDrag(panel) {
	const handle = panel.querySelector("[data-floating-handle]");
	if (!handle) return;

	let dragState = null;

	handle.addEventListener("mousedown", (event) => {
		if (event.button !== 0) return;
		event.preventDefault();

		const bounds = getPanelBounds(panel);
		dragState = {
			pointerX: event.clientX,
			pointerY: event.clientY,
			panelX: bounds.x,
			panelY: bounds.y,
		};
		activeDragState = dragState;
		setMousePassthrough(false);
		panel.classList.add("is-dragging");
	});

	window.addEventListener("mousemove", (event) => {
		if (!dragState) return;

		const deltaX = event.clientX - dragState.pointerX;
		const deltaY = event.clientY - dragState.pointerY;
		placePanel(panel, dragState.panelX + deltaX, dragState.panelY + deltaY);
	});

	window.addEventListener("mouseup", () => {
		if (!dragState) return;
		dragState = null;
		activeDragState = null;
		panel.classList.remove("is-dragging");
		scheduleSavePanelBounds(panel);
	});
}

async function bindFloatingPanels() {
	try {
		floatingPanelsConfig = await ipcRenderer.invoke("get-floating-panels");
	} catch (_error) {
		floatingPanelsConfig = {};
	}

	const panels = Array.from(document.querySelectorAll("[data-floating-panel]"));
	panels.forEach((panel) => {
		initializePanelPosition(panel);
		bindPanelDrag(panel);
	});
	bindMousePassthrough();

	window.addEventListener("resize", () => {
		if (document.body.classList.contains("immersion")) {
			const webviewPanel = document.querySelector('[data-panel-id="webview"]');
			if (webviewPanel) {
				keepPanelInView(webviewPanel);
			}
			return;
		}

		panels.forEach((panel) => {
			keepPanelInView(panel);
			scheduleSavePanelBounds(panel);
		});
	});
}

function isInteractivePoint(x, y) {
	const element = document.elementFromPoint(x, y);
	return Boolean(element && element.closest(INTERACTIVE_SELECTOR));
}

function setMousePassthrough(enabled) {
	ipcRenderer.send("set-ignore-mouse", enabled);
}

function bindMousePassthrough() {
	setMousePassthrough(true);

	window.addEventListener("mousemove", (event) => {
		if (activeDragState) {
			setMousePassthrough(false);
			return;
		}
		setMousePassthrough(!isInteractivePoint(event.clientX, event.clientY));
	});

	window.addEventListener("mouseleave", () => {
		setMousePassthrough(true);
	});
}

module.exports = {
	bindFloatingPanels,
	setFloatingPanelSize,
	enterImmersionPanelLayout,
	exitImmersionPanelLayout,
};
