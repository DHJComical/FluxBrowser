const { ipcRenderer } = require("electron");
const debugLog = require("./debug");
const {
	directionIndicatorPanel,
	directionIndicatorDial,
	directionIndicatorMarkers,
	directionIndicatorRotateHandle,
} = require("./dom");
const {
	beginFloatingPanelInteraction,
	endFloatingPanelInteraction,
} = require("./floatingPanels");
const { IPC_CHANNELS } = require("../../../constants/config");

const LIVE_SUBTITLE_DIRECTION_MATCHES_CHANNEL =
	"live-subtitle-direction-matches";
const GET_LIVE_SUBTITLE_DIRECTION_STATE = "get-live-subtitle-direction-state";

const DIRECTION_VECTORS = {
	north: { x: 0, y: -1 },
	northeast: { x: Math.SQRT1_2, y: -Math.SQRT1_2 },
	east: { x: 1, y: 0 },
	southeast: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
	south: { x: 0, y: 1 },
	southwest: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
	west: { x: -1, y: 0 },
	northwest: { x: -Math.SQRT1_2, y: -Math.SQRT1_2 },
};

const MARKER_FADE_OUT_MS = 3000;
const ROTATION_SAVE_DELAY_MS = 160;

let currentRotation = 0;
let savedIndicatorConfig = { enabled: true, rotation: 0 };
let rotateState = null;
let saveRotationTimer = null;
let hasBoundEvents = false;
let activeMarkerEntries = [];
let isIndicatorEnabled = true;

function isInteractionLocked() {
	return document.body.classList.contains("immersion");
}

function normalizeAngle(value) {
	const normalized = Math.round(Number(value) || 0) % 360;
	return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeIndicatorConfig(config = {}) {
	return {
		enabled: config.enabled !== false,
		rotation: normalizeAngle(config.rotation),
	};
}

function applyRotation() {
	if (!directionIndicatorDial) return;
	directionIndicatorDial.style.transform = `rotate(${currentRotation}deg)`;
}

function applyVisibility() {
	if (!directionIndicatorPanel) return;
	directionIndicatorPanel.classList.toggle("hidden", !isIndicatorEnabled);
}

function stopRotationInteraction() {
	if (!rotateState) return;
	rotateState = null;
	endFloatingPanelInteraction();
}

function scheduleSaveRotation() {
	if (saveRotationTimer) {
		clearTimeout(saveRotationTimer);
	}

	saveRotationTimer = setTimeout(() => {
		savedIndicatorConfig = {
			...savedIndicatorConfig,
			rotation: currentRotation,
		};
		ipcRenderer.send("save-app-config", {
			directionIndicator: savedIndicatorConfig,
		});
	}, ROTATION_SAVE_DELAY_MS);
}

function getDialRadius() {
	if (!directionIndicatorDial) return 72;
	const rect = directionIndicatorDial.getBoundingClientRect();
	const size = Math.min(rect.width || 0, rect.height || 0);
	return Math.max(32, Math.round(size / 2 - 10));
}

function removeMarkerEntry(entry) {
	if (!entry || !entry.element) return;
	if (entry.removeTimer) {
		clearTimeout(entry.removeTimer);
	}
	entry.element.remove();
}

function clearActiveMarkers() {
	activeMarkerEntries.forEach((entry) => {
		removeMarkerEntry(entry);
	});
	activeMarkerEntries = [];
}

function clearRenderedMarkers() {
	clearActiveMarkers();
	if (!directionIndicatorMarkers) return;
	directionIndicatorMarkers
		.querySelectorAll(".direction-hit-marker")
		.forEach((marker) => marker.remove());
}

function fadeActiveMarkers() {
	if (activeMarkerEntries.length === 0) return;

	const fadingEntries = activeMarkerEntries;
	activeMarkerEntries = [];
	fadingEntries.forEach((entry) => {
		if (!entry || !entry.element) return;
		entry.element.classList.remove("is-active");
		entry.element.classList.add("is-fading");
		entry.removeTimer = window.setTimeout(() => {
			entry.element.remove();
		}, MARKER_FADE_OUT_MS);
	});
}

function createMarker(direction, matchedText) {
	if (!directionIndicatorMarkers) return null;

	const vector = DIRECTION_VECTORS[direction];
	if (!vector) return null;

	const radius = getDialRadius();
	const marker = document.createElement("div");
	marker.className = "direction-hit-marker";
	marker.dataset.direction = direction;
	marker.title = matchedText || direction;
	marker.style.setProperty("--marker-x", Math.round(vector.x * radius));
	marker.style.setProperty("--marker-y", Math.round(vector.y * radius));
	directionIndicatorMarkers.appendChild(marker);
	window.requestAnimationFrame(() => {
		marker.classList.add("is-active");
	});

	return {
		element: marker,
		removeTimer: null,
	};
}

function showMarkers(matches = []) {
	clearActiveMarkers();
	activeMarkerEntries = matches
		.map((match) => createMarker(match.direction, match.matchedText))
		.filter(Boolean);
}

function handleDirectionMatches(payload = {}) {
	if (!isIndicatorEnabled) return;

	const matches = Array.isArray(payload.matches) ? payload.matches : [];
	if (matches.length === 0) {
		fadeActiveMarkers();
		return;
	}

	showMarkers(matches);

	debugLog.info(
		`Direction indicator matched: ${matches
			.map((match) => `${match.direction}:${match.matchedText}`)
			.join(", ")}`,
	);
}

function updateRotationFromPointer(clientX, clientY) {
	if (!directionIndicatorPanel || !isIndicatorEnabled) return;

	const rect = directionIndicatorPanel.getBoundingClientRect();
	const centerX = rect.left + rect.width / 2;
	const centerY = rect.top + rect.height / 2;
	const radians = Math.atan2(clientY - centerY, clientX - centerX);
	currentRotation = normalizeAngle((radians * 180) / Math.PI + 90);
	applyRotation();
}

function bindRotationHandle() {
	if (!directionIndicatorRotateHandle) return;

	directionIndicatorRotateHandle.addEventListener("mousedown", (event) => {
		if (event.button !== 0) return;
		if (isInteractionLocked()) return;
		if (!isIndicatorEnabled) return;

		event.preventDefault();
		event.stopPropagation();
		rotateState = { active: true };
		beginFloatingPanelInteraction("grabbing");
		updateRotationFromPointer(event.clientX, event.clientY);
	});

	window.addEventListener("mousemove", (event) => {
		if (!rotateState) return;
		updateRotationFromPointer(event.clientX, event.clientY);
	});

	window.addEventListener("mouseup", () => {
		if (!rotateState) return;
		stopRotationInteraction();
		scheduleSaveRotation();
	});
}

async function ensureSubtitleCaptureEnabled() {
	try {
		const subtitleState = await ipcRenderer.invoke("get-live-subtitle-state");
		if (!subtitleState || subtitleState.enabled !== true) {
			ipcRenderer.send("start-live-subtitle-capture");
		}
	} catch (_error) {
		ipcRenderer.send("start-live-subtitle-capture");
	}
}

function bindDirectionUpdates() {
	ipcRenderer.on(
		LIVE_SUBTITLE_DIRECTION_MATCHES_CHANNEL,
		(_event, payload = {}) => {
			handleDirectionMatches(payload);
		},
	);
}

async function hydrateDirectionMatches() {
	try {
		const payload = await ipcRenderer.invoke(GET_LIVE_SUBTITLE_DIRECTION_STATE);
		handleDirectionMatches(payload);
	} catch (_error) {
		// Ignore hydration failures and wait for the next broadcast.
	}
}

function applyIndicatorConfig(config = {}) {
	savedIndicatorConfig = {
		...savedIndicatorConfig,
		...normalizeIndicatorConfig(config),
	};
	isIndicatorEnabled = savedIndicatorConfig.enabled !== false;
	currentRotation = normalizeAngle(savedIndicatorConfig.rotation);
	applyRotation();
	applyVisibility();

	if (!isIndicatorEnabled) {
		stopRotationInteraction();
		clearRenderedMarkers();
	}
}

function bindConfigUpdates() {
	ipcRenderer.on(IPC_CHANNELS.APP_CONFIG_UPDATED, (_event, appConfig = {}) => {
		if (!appConfig || !appConfig.directionIndicator) return;

		const wasEnabled = isIndicatorEnabled;
		applyIndicatorConfig(appConfig.directionIndicator);

		if (!wasEnabled && isIndicatorEnabled) {
			ensureSubtitleCaptureEnabled();
			hydrateDirectionMatches();
		}
	});
}

function bindGlobalCleanup() {
	window.addEventListener("blur", () => {
		if (!rotateState) return;
		stopRotationInteraction();
		scheduleSaveRotation();
	});

	window.addEventListener("immersion-mode-change", (event) => {
		if (!event.detail || event.detail.isImmersion !== true || !rotateState) {
			return;
		}

		stopRotationInteraction();
		scheduleSaveRotation();
	});
}

async function bindDirectionIndicatorEvents() {
	if (
		!directionIndicatorPanel ||
		!directionIndicatorDial ||
		!directionIndicatorMarkers
	) {
		return;
	}

	try {
		const appConfig = await ipcRenderer.invoke("get-app-config");
		applyIndicatorConfig(appConfig?.directionIndicator);
	} catch (_error) {
		applyIndicatorConfig();
	}

	if (!hasBoundEvents) {
		hasBoundEvents = true;
		bindRotationHandle();
		bindDirectionUpdates();
		bindConfigUpdates();
		bindGlobalCleanup();
	}

	if (isIndicatorEnabled) {
		await ensureSubtitleCaptureEnabled();
		await hydrateDirectionMatches();
	}
}

module.exports = {
	bindDirectionIndicatorEvents,
};
