const POLL_INTERVAL_MS = 450;
const { t } = require("../i18n");

function createEmptySnapshot(overrides = {}) {
	return {
		requestId: "",
		found: false,
		site: "",
		title: "",
		url: "",
		text: "",
		lines: [],
		source: "",
		updatedAt: 0,
		...overrides,
	};
}

class LiveSubtitleMonitor {
	constructor({ logger, sendToMainWindow, broadcast }) {
		this.logger = logger;
		this.sendToMainWindow = sendToMainWindow;
		this.broadcast = broadcast;
		this.enabled = false;
		this.pollTimer = null;
		this.inFlightRequestId = null;
		this.requestSerial = 0;
		this.latestSnapshot = createEmptySnapshot();
	}

	getState() {
		return {
			enabled: this.enabled,
			pollIntervalMs: POLL_INTERVAL_MS,
			inFlight: Boolean(this.inFlightRequestId),
			hasSubtitle: this.latestSnapshot.found === true,
			lastUpdatedAt: this.latestSnapshot.updatedAt || 0,
			latestText: this.latestSnapshot.text || "",
			site: this.latestSnapshot.site || "",
			source: this.latestSnapshot.source || "",
		};
	}

	getLatestSnapshot() {
		return {
			...this.latestSnapshot,
			lines: Array.isArray(this.latestSnapshot.lines)
				? [...this.latestSnapshot.lines]
				: [],
		};
	}

	start() {
		if (this.enabled) return this.getState();

		this.enabled = true;
		this.emitState();
		this.requestSnapshot();
		this.pollTimer = setInterval(() => {
			this.requestSnapshot();
		}, POLL_INTERVAL_MS);
		this.logger.debug("logs.liveSubtitle.captureStarted");
		return this.getState();
	}

	stop() {
		if (!this.enabled) return this.getState();

		this.enabled = false;
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		this.inFlightRequestId = null;
		this.emitState();
		this.logger.debug("logs.liveSubtitle.captureStopped");
		return this.getState();
	}

	toggle() {
		return this.enabled ? this.stop() : this.start();
	}

	requestSnapshot() {
		if (!this.enabled || this.inFlightRequestId) return;

		const requestId = `subtitle-${Date.now().toString(36)}-${(++this.requestSerial).toString(36)}`;
		this.inFlightRequestId = requestId;
		this.sendToMainWindow("collect-live-subtitle-snapshot", { requestId });
	}

	handleSnapshot(payload = {}) {
		const requestId =
			typeof payload.requestId === "string" ? payload.requestId : "";
		if (this.inFlightRequestId && requestId && requestId !== this.inFlightRequestId) {
			return { snapshot: null, changed: false };
		}

		this.inFlightRequestId = null;
		const nextSnapshot = this.normalizeSnapshot(payload);
		const changed =
			nextSnapshot.text !== this.latestSnapshot.text ||
			nextSnapshot.url !== this.latestSnapshot.url ||
			nextSnapshot.title !== this.latestSnapshot.title ||
			nextSnapshot.found !== this.latestSnapshot.found ||
			nextSnapshot.source !== this.latestSnapshot.source;

		this.latestSnapshot = nextSnapshot;
		if (changed) {
			this.broadcast("live-subtitle-updated", this.getLatestSnapshot());
		}
		this.emitState();
		return {
			snapshot: this.getLatestSnapshot(),
			changed,
		};
	}

	normalizeSnapshot(payload = {}) {
		const lines = Array.isArray(payload.lines)
			? payload.lines
					.map((line) => String(line || "").trim())
					.filter(Boolean)
			: [];
		const text = typeof payload.text === "string" ? payload.text.trim() : "";

		return createEmptySnapshot({
			requestId:
				typeof payload.requestId === "string" ? payload.requestId.trim() : "",
			found: payload.found === true && (lines.length > 0 || text.length > 0),
			site: typeof payload.site === "string" ? payload.site.trim() : "",
			title: typeof payload.title === "string" ? payload.title.trim() : "",
			url: typeof payload.url === "string" ? payload.url.trim() : "",
			text,
			lines,
			source: typeof payload.source === "string" ? payload.source.trim() : "",
			updatedAt:
				typeof payload.updatedAt === "number" ? payload.updatedAt : Date.now(),
		});
	}

	emitState() {
		this.broadcast("live-subtitle-state", this.getState());
	}
}

module.exports = LiveSubtitleMonitor;
