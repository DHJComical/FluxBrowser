const NativeDirectionKeywordWorker = require("../native/NativeDirectionKeywordWorker");
const {
	analyzeDirectionKeywords,
	normalizeSubtitleText,
} = require("./directionKeywordAnalyzer");

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
			this.emitMatches(snapshot, []);
			return [];
		}

		const text = normalizeSubtitleText(snapshot);
		if (!snapshot || snapshot.found !== true || !text) {
			this.emitMatches(snapshot, []);
			return [];
		}

		let matches = [];
		let nativeHandled = false;
		try {
			const nativeResult = await this.nativeWorker.analyze({ text });
			if (nativeResult && Array.isArray(nativeResult.matches)) {
				nativeHandled = true;
				matches = nativeResult.matches;
			}
		} catch (_error) {
			nativeHandled = false;
		}

		if (!nativeHandled) {
			matches = analyzeDirectionKeywords(text);
		}

		const didEmit = this.emitMatches(
			{
				...snapshot,
				text,
			},
			matches,
		);
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
}

module.exports = DirectionKeywordDetector;
