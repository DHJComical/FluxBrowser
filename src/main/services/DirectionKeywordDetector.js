const NativeDirectionKeywordWorker = require("../native/NativeDirectionKeywordWorker");
const { normalizeSubtitleText } = require("./directionKeywordAnalyzer");

const DIRECTION_MATCH_CHANNEL = "live-subtitle-direction-matches";

function createMatchSignature(matches = []) {
	return matches
		.map((match) => `${match.direction || ""}:${match.matchedText || ""}`)
		.join(",");
}

function cloneMatches(matches = []) {
	return Array.isArray(matches)
		? matches
				.map((match) => ({
					direction:
						typeof match.direction === "string" ? match.direction.trim() : "",
					matchedText:
						typeof match.matchedText === "string" ? match.matchedText.trim() : "",
				}))
				.filter((match) => match.direction && match.matchedText)
		: [];
}

function createPayload(snapshot = {}, matches = []) {
	const text = normalizeSubtitleText(snapshot);
	return {
		matches: cloneMatches(matches),
		found: snapshot.found === true && Boolean(text),
		site: typeof snapshot.site === "string" ? snapshot.site : "",
		title: typeof snapshot.title === "string" ? snapshot.title : "",
		url: typeof snapshot.url === "string" ? snapshot.url : "",
		source: typeof snapshot.source === "string" ? snapshot.source : "",
		text,
		updatedAt:
			typeof snapshot.updatedAt === "number" ? snapshot.updatedAt : Date.now(),
	};
}

class DirectionKeywordDetector {
	constructor({ logger, configManager, broadcast }) {
		this.logger = logger;
		this.configManager = configManager;
		this.broadcast = broadcast;
		this.config = this.loadConfig();
		this.lastSignature = "";
		this.latestPayload = createPayload({}, []);
		this.pendingAnalysis = Promise.resolve();
		this.nativeWorker = new NativeDirectionKeywordWorker();
		this.lastBackendMode = "";
	}

	loadConfig() {
		const appConfig = this.configManager.getAppConfig();
		return {
			enabled: appConfig.directionIndicator?.enabled !== false,
		};
	}

	syncConfig() {
		this.config = this.loadConfig();
		return this.config;
	}

	isEnabled() {
		return this.syncConfig().enabled === true;
	}

	getLatestPayload() {
		return {
			...this.latestPayload,
			matches: cloneMatches(this.latestPayload.matches),
		};
	}

	handleSnapshot(snapshot = {}) {
		this.pendingAnalysis = this.pendingAnalysis
			.catch(() => {})
			.then(() => this.analyzeSnapshot(snapshot));
		return this.pendingAnalysis;
	}

	async analyzeSnapshot(snapshot = {}) {
		this.syncConfig();

		if (!this.config.enabled) {
			this.reportBackendMode("");
			this.emitMatches(snapshot, []);
			return [];
		}

		const text = normalizeSubtitleText(snapshot);
		if (!snapshot || snapshot.found !== true || !text) {
			this.reportBackendMode("");
			this.emitMatches(snapshot, []);
			return [];
		}

		try {
			const nativeResult = await this.nativeWorker.analyze({ text });
			return this.handleAnalyzedMatches(
				{
					...snapshot,
					text,
				},
				nativeResult && Array.isArray(nativeResult.matches)
					? nativeResult.matches
					: [],
				"rust",
			);
		} catch (error) {
			this.logger.error(
				`Direction keyword detector native analysis failed: ${error?.message || "unknown error"}`,
			);
			return this.handleAnalyzedMatches(
				{
					...snapshot,
					text,
				},
				[],
				"unavailable",
			);
		}
	}

	async handleAnalyzedMatches(snapshot = {}, matches = [], backendMode = "") {
		this.syncConfig();
		if (!this.config.enabled) {
			this.reportBackendMode("");
			this.emitMatches(snapshot, []);
			return [];
		}

		this.reportBackendMode(backendMode);
		const didEmit = this.emitMatches(snapshot, matches);
		if (didEmit && matches.length > 0) {
			this.logger.debug(
				`Direction indicator matched: ${matches
					.map((match) => `${match.direction}:${match.matchedText}`)
					.join(", ")}`,
			);
		}
		return matches;
	}

	emitMatches(snapshot = {}, matches = []) {
		const payload = createPayload(snapshot, matches);
		const signature = `${this.config.enabled ? "enabled" : "disabled"}::${payload.url}::${payload.text}::${createMatchSignature(payload.matches)}`;
		if (signature === this.lastSignature) {
			return false;
		}

		this.lastSignature = signature;
		this.latestPayload = payload;
		this.broadcast(DIRECTION_MATCH_CHANNEL, this.getLatestPayload());
		return true;
	}

	reportBackendMode(mode) {
		if (!mode || mode === this.lastBackendMode) {
			return;
		}

		this.lastBackendMode = mode;
		this.logger.debug(
			`Direction keyword detector backend: ${mode === "rust" ? "Rust" : "Native unavailable"}`,
		);
	}
}

module.exports = DirectionKeywordDetector;
