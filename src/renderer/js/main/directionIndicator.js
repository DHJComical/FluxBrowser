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

const DIRECTION_DEFINITIONS = [
	{
		key: "northeast",
		patterns: [
			/\u4e1c\u5317(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u89d2)?/u,
			/\u5317\u504f\u4e1c/u,
			/\u4e1c\u504f\u5317/u,
			/\bnorth[\s-]?east\b/i,
			/\bnortheast\b/i,
		],
	},
	{
		key: "southeast",
		patterns: [
			/\u4e1c\u5357(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u89d2)?/u,
			/\u5357\u504f\u4e1c/u,
			/\u4e1c\u504f\u5357/u,
			/\bsouth[\s-]?east\b/i,
			/\bsoutheast\b/i,
		],
	},
	{
		key: "southwest",
		patterns: [
			/\u897f\u5357(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u89d2)?/u,
			/\u5357\u504f\u897f/u,
			/\u897f\u504f\u5357/u,
			/\bsouth[\s-]?west\b/i,
			/\bsouthwest\b/i,
		],
	},
	{
		key: "northwest",
		patterns: [
			/\u897f\u5317(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u89d2)?/u,
			/\u5317\u504f\u897f/u,
			/\u897f\u504f\u5317/u,
			/\bnorth[\s-]?west\b/i,
			/\bnorthwest\b/i,
		],
	},
	{
		key: "north",
		patterns: [
			/(?:\u6b63)?\u5317(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u7aef|\u5934)?/u,
			/\bnorth\b/i,
		],
	},
	{
		key: "east",
		patterns: [
			/(?:\u6b63)?\u4e1c(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u7aef|\u5934)?/u,
			/\beast\b/i,
		],
	},
	{
		key: "south",
		patterns: [
			/(?:\u6b63)?\u5357(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u7aef|\u5934)?/u,
			/\bsouth\b/i,
		],
	},
	{
		key: "west",
		patterns: [
			/(?:\u6b63)?\u897f(?:\u65b9|\u8fb9|\u4fa7|\u9762|\u5411|\u90e8|\u7aef|\u5934)?/u,
			/\bwest\b/i,
		],
	},
];

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

const TRANSIENT_MARKER_LIFETIME_MS = 6000;
const ROTATION_SAVE_DELAY_MS = 160;

let currentRotation = 0;
let savedIndicatorConfig = { rotation: 0 };
let rotateState = null;
let saveRotationTimer = null;
let hasBoundEvents = false;

function normalizeAngle(value) {
	const normalized = Math.round(Number(value) || 0) % 360;
	return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeSubtitleText(snapshot = {}) {
	if (Array.isArray(snapshot.lines) && snapshot.lines.length > 0) {
		return snapshot.lines
			.map((line) => String(line || "").trim())
			.filter(Boolean)
			.join("\n");
	}

	return typeof snapshot.text === "string" ? snapshot.text.trim() : "";
}

function applyRotation() {
	if (!directionIndicatorDial) return;
	directionIndicatorDial.style.transform = `rotate(${currentRotation}deg)`;
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

function findFirstMatch(text, patterns) {
	for (const pattern of patterns) {
		const match = text.match(pattern);
		if (Array.isArray(match) && match[0]) {
			return match[0];
		}
	}

	return "";
}

function detectDirections(snapshot = {}) {
	const originalText = normalizeSubtitleText(snapshot);
	if (!originalText) return [];

	const matches = [];
	let workingText = originalText;

	DIRECTION_DEFINITIONS.forEach((definition) => {
		const matchedText = findFirstMatch(workingText, definition.patterns);
		if (!matchedText) return;

		matches.push({
			direction: definition.key,
			matchedText,
		});

		workingText = workingText.replace(matchedText, " ");
	});

	return matches;
}

function createMarker(direction, matchedText) {
	if (!directionIndicatorMarkers) return;

	const vector = DIRECTION_VECTORS[direction];
	if (!vector) return;

	const radius = getDialRadius();
	const marker = document.createElement("div");
	marker.className = "direction-hit-marker";
	marker.dataset.direction = direction;
	marker.title = matchedText || direction;
	marker.style.setProperty("--marker-x", Math.round(vector.x * radius));
	marker.style.setProperty("--marker-y", Math.round(vector.y * radius));
	directionIndicatorMarkers.appendChild(marker);

	window.setTimeout(() => {
		marker.remove();
	}, TRANSIENT_MARKER_LIFETIME_MS);
}

function handleSubtitleUpdate(snapshot = {}) {
	const matches = detectDirections(snapshot);
	if (matches.length === 0) return;

	matches.forEach((match) => {
		createMarker(match.direction, match.matchedText);
	});

	debugLog.info(
		`Direction indicator matched: ${matches
			.map((match) => `${match.direction}:${match.matchedText}`)
			.join(", ")}`,
	);
}

function updateRotationFromPointer(clientX, clientY) {
	if (!directionIndicatorPanel) return;

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
		rotateState = null;
		endFloatingPanelInteraction();
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

function bindSubtitleUpdates() {
	ipcRenderer.on("live-subtitle-updated", (_event, snapshot = {}) => {
		handleSubtitleUpdate(snapshot);
	});
}

function bindGlobalCleanup() {
	window.addEventListener("blur", () => {
		if (!rotateState) return;
		rotateState = null;
		endFloatingPanelInteraction();
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
		savedIndicatorConfig =
			appConfig && appConfig.directionIndicator
				? { ...appConfig.directionIndicator }
				: { rotation: 0 };
		currentRotation = normalizeAngle(savedIndicatorConfig.rotation);
	} catch (_error) {
		currentRotation = 0;
		savedIndicatorConfig = { rotation: 0 };
	}

	applyRotation();

	if (!hasBoundEvents) {
		hasBoundEvents = true;
		bindRotationHandle();
		bindSubtitleUpdates();
		bindGlobalCleanup();
	}

	await ensureSubtitleCaptureEnabled();
}

module.exports = {
	bindDirectionIndicatorEvents,
};
