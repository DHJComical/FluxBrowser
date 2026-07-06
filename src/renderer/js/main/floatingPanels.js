const { ipcRenderer } = require("electron");

const FLOATING_PANEL_MARGIN = 12;
const INTERACTIVE_SELECTOR = "[data-floating-panel], #dropdown-menu, .feedback-confirm-scrim, .feedback-toast-stack";
let activeDragState = null;
let activeResizeState = null;
let floatingPanelsConfig = {};
const saveTimers = new Map();
const temporaryPanelBounds = new Map();
let interactionShield = null;
let lastMousePassthroughState = null;

function parsePixelValue(value) {
	if (typeof value !== "string" || !value.endsWith("px")) {
		return null;
	}

	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : null;
}

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

function getPanelStyleBounds(panel) {
	const left = parsePixelValue(panel.style.left);
	const top = parsePixelValue(panel.style.top);
	const width = parsePixelValue(panel.style.width);
	const height = parsePixelValue(panel.style.height);

	if (
		left === null ||
		top === null ||
		width === null ||
		height === null
	) {
		return null;
	}

	return {
		x: left,
		y: top,
		width,
		height,
	};
}

function suspendPanelTransitions(panel, callback) {
	if (!panel || typeof callback !== "function") return;

	panel.classList.add("is-positioning");
	callback();
	void panel.offsetWidth;
	window.requestAnimationFrame(() => {
		panel.classList.remove("is-positioning");
	});
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

function ensureInteractionShield() {
	if (interactionShield) return interactionShield;

	interactionShield = document.createElement("div");
	interactionShield.className = "floating-panel-interaction-shield";
	interactionShield.setAttribute("aria-hidden", "true");
	document.body.appendChild(interactionShield);
	return interactionShield;
}

function setInteractionShield(active, cursor = "") {
	if (!active && !interactionShield) return;

	const shield = ensureInteractionShield();
	shield.classList.toggle("is-active", active);
	shield.style.cursor = cursor || "";
}

function getPanelMinWidth(panel) {
	return Math.max(120, Math.round(Number(panel.dataset.minWidth) || 240));
}

function getPanelMinHeight(panel) {
	return Math.max(120, Math.round(Number(panel.dataset.minHeight) || 120));
}

function getPanelResizeMode(panel) {
	return panel.dataset.resizeMode || "free";
}

function isPanelInteractionLocked(panel) {
	return (
		panel &&
		panel.dataset.panelId === "direction-indicator" &&
		document.body.classList.contains("immersion")
	);
}

function getResizeCursor(direction) {
	switch (direction) {
		case "north":
		case "south":
			return "ns-resize";
		case "east":
		case "west":
			return "ew-resize";
		case "northeast":
		case "southwest":
			return "nesw-resize";
		case "northwest":
		case "southeast":
		default:
			return "nwse-resize";
	}
}

function getSquareResizePointerSize(resizeState, event) {
	switch (resizeState.direction) {
		case "east":
			return event.clientX - resizeState.anchorX;
		case "west":
			return resizeState.anchorX - event.clientX;
		case "south":
			return event.clientY - resizeState.anchorY;
		case "north":
			return resizeState.anchorY - event.clientY;
		case "northeast":
			return Math.max(
				event.clientX - resizeState.anchorX,
				resizeState.anchorY - event.clientY,
			);
		case "northwest":
			return Math.max(
				resizeState.anchorX - event.clientX,
				resizeState.anchorY - event.clientY,
			);
		case "southwest":
			return Math.max(
				resizeState.anchorX - event.clientX,
				event.clientY - resizeState.anchorY,
			);
		case "southeast":
		default:
			return Math.max(
				event.clientX - resizeState.anchorX,
				event.clientY - resizeState.anchorY,
			);
	}
}

function getSquareResizeMaxSize(resizeState, minSize) {
	const horizontalHalfSpan =
		Math.min(
			resizeState.centerX - FLOATING_PANEL_MARGIN,
			window.innerWidth - resizeState.centerX - FLOATING_PANEL_MARGIN,
		) * 2;
	const verticalHalfSpan =
		Math.min(
			resizeState.centerY - FLOATING_PANEL_MARGIN,
			window.innerHeight - resizeState.centerY - FLOATING_PANEL_MARGIN,
		) * 2;

	switch (resizeState.direction) {
		case "east":
			return Math.max(
				minSize,
				Math.min(
					window.innerWidth - resizeState.anchorX - FLOATING_PANEL_MARGIN,
					verticalHalfSpan,
				),
			);
		case "west":
			return Math.max(
				minSize,
				Math.min(
					resizeState.anchorX - FLOATING_PANEL_MARGIN,
					verticalHalfSpan,
				),
			);
		case "south":
			return Math.max(
				minSize,
				Math.min(
					window.innerHeight - resizeState.anchorY - FLOATING_PANEL_MARGIN,
					horizontalHalfSpan,
				),
			);
		case "north":
			return Math.max(
				minSize,
				Math.min(
					resizeState.anchorY - FLOATING_PANEL_MARGIN,
					horizontalHalfSpan,
				),
			);
		case "northeast":
			return Math.max(
				minSize,
				Math.min(
					window.innerWidth - resizeState.anchorX - FLOATING_PANEL_MARGIN,
					resizeState.anchorY - FLOATING_PANEL_MARGIN,
				),
			);
		case "northwest":
			return Math.max(
				minSize,
				Math.min(
					resizeState.anchorX - FLOATING_PANEL_MARGIN,
					resizeState.anchorY - FLOATING_PANEL_MARGIN,
				),
			);
		case "southwest":
			return Math.max(
				minSize,
				Math.min(
					resizeState.anchorX - FLOATING_PANEL_MARGIN,
					window.innerHeight - resizeState.anchorY - FLOATING_PANEL_MARGIN,
				),
			);
		case "southeast":
		default:
			return Math.max(
				minSize,
				Math.min(
					window.innerWidth - resizeState.anchorX - FLOATING_PANEL_MARGIN,
					window.innerHeight - resizeState.anchorY - FLOATING_PANEL_MARGIN,
				),
			);
	}
}

function getSquareResizeBoundsFromSize(resizeState, size) {
	switch (resizeState.direction) {
		case "east":
			return {
				x: resizeState.anchorX,
				y: resizeState.centerY - size / 2,
				width: size,
				height: size,
			};
		case "west":
			return {
				x: resizeState.anchorX - size,
				y: resizeState.centerY - size / 2,
				width: size,
				height: size,
			};
		case "south":
			return {
				x: resizeState.centerX - size / 2,
				y: resizeState.anchorY,
				width: size,
				height: size,
			};
		case "north":
			return {
				x: resizeState.centerX - size / 2,
				y: resizeState.anchorY - size,
				width: size,
				height: size,
			};
		case "northeast":
			return {
				x: resizeState.anchorX,
				y: resizeState.anchorY - size,
				width: size,
				height: size,
			};
		case "northwest":
			return {
				x: resizeState.anchorX - size,
				y: resizeState.anchorY - size,
				width: size,
				height: size,
			};
		case "southwest":
			return {
				x: resizeState.anchorX - size,
				y: resizeState.anchorY,
				width: size,
				height: size,
			};
		case "southeast":
		default:
			return {
				x: resizeState.anchorX,
				y: resizeState.anchorY,
				width: size,
				height: size,
			};
	}
}

function getSquareResizeBounds(panel, resizeState, event) {
	const minWidth = getPanelMinWidth(panel);
	const minHeight = getPanelMinHeight(panel);
	const minSize = Math.max(minWidth, minHeight);
	const nextSize = clamp(
		getSquareResizePointerSize(resizeState, event),
		minSize,
		getSquareResizeMaxSize(resizeState, minSize),
	);
	const nextBounds = getSquareResizeBoundsFromSize(resizeState, nextSize);

	return {
		x: Math.round(nextBounds.x),
		y: Math.round(nextBounds.y),
		width: Math.round(nextBounds.width),
		height: Math.round(nextBounds.height),
	};
}

function createResizeState(bounds, direction, event) {
	const right = bounds.x + bounds.width;
	const bottom = bounds.y + bounds.height;
	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;
	let anchorX = bounds.x;
	let anchorY = bounds.y;

	switch (direction) {
		case "east":
			anchorX = bounds.x;
			anchorY = centerY;
			break;
		case "west":
			anchorX = right;
			anchorY = centerY;
			break;
		case "south":
			anchorX = centerX;
			anchorY = bounds.y;
			break;
		case "north":
			anchorX = centerX;
			anchorY = bottom;
			break;
		case "northeast":
			anchorX = bounds.x;
			anchorY = bottom;
			break;
		case "northwest":
			anchorX = right;
			anchorY = bottom;
			break;
		case "southwest":
			anchorX = right;
			anchorY = bounds.y;
			break;
		case "southeast":
		default:
			anchorX = bounds.x;
			anchorY = bounds.y;
			break;
	}

	return {
		direction,
		pointerX: event.clientX,
		pointerY: event.clientY,
		width: bounds.width,
		height: bounds.height,
		x: bounds.x,
		y: bounds.y,
		centerX,
		centerY,
		anchorX,
		anchorY,
	};
}

function resizePanel(panel, nextWidth, nextHeight) {
	const minWidth = getPanelMinWidth(panel);
	const minHeight = getPanelMinHeight(panel);
	let width = Math.max(minWidth, Math.round(nextWidth));
	let height = Math.max(minHeight, Math.round(nextHeight));

	if (getPanelResizeMode(panel) === "square") {
		const squareSize = Math.max(width, height, minWidth, minHeight);
		width = squareSize;
		height = squareSize;
	}

	panel.style.width = `${width}px`;
	panel.style.height = `${height}px`;
}

function getPanelId(panel) {
	return panel.dataset.panelId || "";
}

function getPersistedBounds(panel) {
	const panelId = getPanelId(panel);
	return panelId ? floatingPanelsConfig[panelId] || null : null;
}

function serializePanelBounds(panel) {
	const bounds = getPanelStyleBounds(panel) || getPanelBounds(panel);
	return {
		x: Math.round(bounds.x),
		y: Math.round(bounds.y),
		width: Math.round(bounds.width),
		height: Math.round(bounds.height),
	};
}

function areBoundsEqual(left, right) {
	if (!left || !right) return false;

	return (
		Math.round(left.x) === Math.round(right.x) &&
		Math.round(left.y) === Math.round(right.y) &&
		Math.round(left.width) === Math.round(right.width) &&
		Math.round(left.height) === Math.round(right.height)
	);
}

function scheduleSavePanelBounds(panel) {
	const panelId = getPanelId(panel);
	if (!panelId) return;

	if (saveTimers.has(panelId)) {
		clearTimeout(saveTimers.get(panelId));
	}

	const timer = setTimeout(() => {
		const bounds = serializePanelBounds(panel);
		if (areBoundsEqual(floatingPanelsConfig[panelId], bounds)) {
			saveTimers.delete(panelId);
			return;
		}

		floatingPanelsConfig = {
			...floatingPanelsConfig,
			[panelId]: bounds,
		};
		ipcRenderer.send("save-floating-panel", {
			panelId,
			bounds,
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

	suspendPanelTransitions(panel, () => {
		panel.style.width = `${Math.max(240, Math.round(Number(width) || 0))}px`;
		panel.style.height = `${Math.max(
			180,
			Math.round(Number(height) || 0) + extraHeight,
		)}px`;
		keepPanelInView(panel);
	});
	scheduleSavePanelBounds(panel);
}

function applyTemporaryPanelBounds(panel, bounds) {
	suspendPanelTransitions(panel, () => {
		panel.style.width = `${Math.round(bounds.width)}px`;
		panel.style.height = `${Math.round(bounds.height)}px`;
		placePanel(panel, bounds.x, bounds.y);
	});
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
		suspendPanelTransitions(panel, () => {
			resizePanel(panel, persistedBounds.width || 0, persistedBounds.height || 0);
			placePanel(panel, persistedBounds.x || 0, persistedBounds.y || 0);
		});
		panel.dataset.positioned = "true";
		return;
	}

	const panelWidth = panel.offsetWidth || Math.min(960, window.innerWidth - 48);
	let x = Math.max(FLOATING_PANEL_MARGIN, (window.innerWidth - panelWidth) / 2);
	let y = FLOATING_PANEL_MARGIN;

	if (panel.dataset.panelId !== "mainbar") {
		const mainbar = document.getElementById("flux-bar");
		const mainbarRect = mainbar ? mainbar.getBoundingClientRect() : { bottom: 72 };
		y = Math.min(
			window.innerHeight - FLOATING_PANEL_MARGIN,
			mainbarRect.bottom + 18,
		);

		if (panel.dataset.panelId === "direction-indicator") {
			x = Math.max(
				FLOATING_PANEL_MARGIN,
				window.innerWidth - panelWidth - FLOATING_PANEL_MARGIN * 2,
			);
		}
	}

	suspendPanelTransitions(panel, () => {
		placePanel(panel, x, y);
	});
	panel.dataset.positioned = "true";
}

function bindPanelDrag(panel) {
	const handle = panel.querySelector("[data-floating-handle]");
	if (!handle) return;

	let dragState = null;

	handle.addEventListener("mousedown", (event) => {
		if (event.button !== 0) return;
		if (isPanelInteractionLocked(panel)) return;
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
		setInteractionShield(true, "move");
		panel.classList.add("is-dragging");
	});

	window.addEventListener("mousemove", (event) => {
		if (!dragState || activeDragState !== dragState) return;

		const deltaX = event.clientX - dragState.pointerX;
		const deltaY = event.clientY - dragState.pointerY;
		placePanel(panel, dragState.panelX + deltaX, dragState.panelY + deltaY);
	});

	window.addEventListener("mouseup", () => {
		if (!dragState || activeDragState !== dragState) return;
		dragState = null;
		activeDragState = null;
		setInteractionShield(false);
		panel.classList.remove("is-dragging");
		scheduleSavePanelBounds(panel);
	});
}

function bindPanelResize(panel) {
	const handles = Array.from(panel.querySelectorAll("[data-resize-handle]"));
	if (handles.length === 0) return;
	let resizeState = null;

	handles.forEach((handle) => {
		handle.addEventListener("mousedown", (event) => {
			if (event.button !== 0) return;
			if (
				(document.body.classList.contains("immersion") &&
					panel.dataset.panelId !== "webview") ||
				isPanelInteractionLocked(panel)
			) {
				return;
			}
			event.preventDefault();
			event.stopPropagation();

			const direction = handle.dataset.resizeHandle;
			const bounds = getPanelBounds(panel);
			resizeState = createResizeState(bounds, direction, event);
			activeResizeState = resizeState;
			setMousePassthrough(false);
			setInteractionShield(true, getResizeCursor(direction));
			panel.classList.add("is-dragging");
		});
	});

	window.addEventListener("mousemove", (event) => {
		if (!resizeState || activeResizeState !== resizeState) return;
		if (getPanelResizeMode(panel) === "square") {
			const nextBounds = getSquareResizeBounds(panel, resizeState, event);
			panel.style.width = `${nextBounds.width}px`;
			panel.style.height = `${nextBounds.height}px`;
			placePanel(panel, nextBounds.x, nextBounds.y);
			return;
		}
		if (resizeState.direction === "east") {
			resizePanel(
				panel,
				resizeState.width + (event.clientX - resizeState.pointerX),
				resizeState.height,
			);
		}
		if (resizeState.direction === "south") {
			resizePanel(
				panel,
				resizeState.width,
				resizeState.height + (event.clientY - resizeState.pointerY),
			);
		}
		if (resizeState.direction === "southeast") {
			resizePanel(
				panel,
				resizeState.width + (event.clientX - resizeState.pointerX),
				resizeState.height + (event.clientY - resizeState.pointerY),
			);
		}
		keepPanelInView(panel);
	});

	window.addEventListener("mouseup", () => {
		if (!resizeState || activeResizeState !== resizeState) return;
		resizeState = null;
		activeResizeState = null;
		setInteractionShield(false);
		panel.classList.remove("is-dragging");
		scheduleSavePanelBounds(panel);
	});
}

function stopActiveInteractions() {
	document
		.querySelectorAll("[data-floating-panel].is-dragging")
		.forEach((panel) => panel.classList.remove("is-dragging"));
	activeDragState = null;
	activeResizeState = null;
	setInteractionShield(false);
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
		bindPanelResize(panel);
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

	window.addEventListener("blur", stopActiveInteractions);
	window.addEventListener("immersion-mode-change", () => {
		stopActiveInteractions();
	});
}

function isInteractivePoint(x, y) {
	const element = document.elementFromPoint(x, y);
	if (!element) return false;

	const webviewPanel = element.closest('[data-panel-id="webview"]');
	if (webviewPanel && document.body.classList.contains("immersion")) {
		return false;
	}

	const lockedPanel = element.closest('[data-panel-id="direction-indicator"]');
	if (lockedPanel && isPanelInteractionLocked(lockedPanel)) {
		return false;
	}

	return Boolean(element.closest(INTERACTIVE_SELECTOR));
}

function setMousePassthrough(enabled, options = {}) {
	const shouldIgnore = enabled === true;
	const forward =
		typeof options.forward === "boolean" ? options.forward : shouldIgnore;
	const nextState = `${shouldIgnore}:${forward}`;
	if (lastMousePassthroughState === nextState) return;
	lastMousePassthroughState = nextState;
	ipcRenderer.send("set-ignore-mouse", {
		ignore: shouldIgnore,
		forward,
	});
}

function beginFloatingPanelInteraction(cursor = "") {
	setMousePassthrough(false);
	setInteractionShield(true, cursor);
}

function endFloatingPanelInteraction() {
	setInteractionShield(false);
}

function bindMousePassthrough() {
	setMousePassthrough(true);

	window.addEventListener("mousemove", (event) => {
		if (document.body.classList.contains("immersion")) {
			setMousePassthrough(true, { forward: false });
			return;
		}

		if (activeDragState || activeResizeState) {
			setMousePassthrough(false);
			return;
		}
		setMousePassthrough(!isInteractivePoint(event.clientX, event.clientY));
	});

	window.addEventListener("mouseleave", () => {
		setMousePassthrough(true, {
			forward: !document.body.classList.contains("immersion"),
		});
	});
}

module.exports = {
	bindFloatingPanels,
	setFloatingPanelSize,
	enterImmersionPanelLayout,
	exitImmersionPanelLayout,
	setMousePassthrough,
	beginFloatingPanelInteraction,
	endFloatingPanelInteraction,
};
