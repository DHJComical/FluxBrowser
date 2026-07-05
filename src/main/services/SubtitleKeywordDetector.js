const MAX_RECENT_MATCHES = 100;
const { t } = require("../i18n");
const NativeSubtitleKeywordWorker = require("../native/NativeSubtitleKeywordWorker");
const {
	normalizeConfig,
	analyzeSubtitleKeywords,
	canUseNativeKeywordAnalyzer,
	createRuleSignature,
	getActiveRules,
} = require("./subtitleKeywordAnalyzer");

class SubtitleKeywordDetector {
	constructor({ logger, configManager, broadcast }) {
		this.logger = logger;
		this.configManager = configManager;
		this.broadcast = broadcast;
		this.recentMatches = [];
		this.lastSignature = "";
		this.lastMatchAt = 0;
		this.config = this.loadConfig();
		this.pendingAnalysis = Promise.resolve();
		this.nativeWorker = new NativeSubtitleKeywordWorker();
	}

	loadConfig() {
		const appConfig = this.configManager.getAppConfig();
		return normalizeConfig(appConfig.liveSubtitleKeywordDetection || {});
	}

	saveConfig(config) {
		this.config = normalizeConfig(config);
		const appConfig = this.configManager.getAppConfig();
		this.configManager.saveAppConfig({
			liveSubtitleKeywordDetection: {
				...(appConfig.liveSubtitleKeywordDetection || {}),
				...this.config,
			},
		});
		this.emitState();
		return this.getConfig();
	}

	getConfig() {
		return {
			enabled: this.config.enabled,
			rules: this.config.rules.map((rule) => ({ ...rule })),
		};
	}

	getState() {
		const activeRuleCount = this.config.rules.filter(
			(rule) => rule.enabled !== false,
		).length;

		return {
			enabled: this.config.enabled,
			ruleCount: this.config.rules.length,
			activeRuleCount,
			matchCount: this.recentMatches.length,
			lastMatchAt: this.lastMatchAt,
		};
	}

	getRecentMatches() {
		return this.recentMatches.map((match) => ({
			...match,
			lines: Array.isArray(match.lines) ? [...match.lines] : [],
		}));
	}

	clearRecentMatches() {
		this.recentMatches = [];
		this.lastSignature = "";
		this.lastMatchAt = 0;
		this.emitState();
	}

	handleSnapshot(snapshot = {}) {
		this.pendingAnalysis = this.pendingAnalysis
			.catch(() => {})
			.then(() => this.analyzeSnapshot(snapshot));
		return this.pendingAnalysis;
	}

	async analyzeSnapshot(snapshot = {}) {
		if (!this.config.enabled) return [];
		if (!snapshot || snapshot.found !== true) return [];

		const text = typeof snapshot.text === "string" ? snapshot.text.trim() : "";
		if (!text) return [];

		const matches = await this.matchSnapshotRules(snapshot, text);

		if (matches.length === 0) return [];

		const signature = `${snapshot.url}::${snapshot.text}::${matches
			.map((match) => match.ruleId)
			.join(",")}`;
		if (signature === this.lastSignature) return [];

		this.lastSignature = signature;
		this.lastMatchAt = Date.now();
		this.recentMatches.unshift(...matches);
		this.recentMatches = this.recentMatches.slice(0, MAX_RECENT_MATCHES);
		this.broadcast("live-subtitle-keyword-match", matches);
		this.emitState();
		this.logger.debug(
			t("logs.liveSubtitle.keywordMatched", {
				patterns: matches.map((match) => match.pattern).join(", "),
			}),
		);
		return matches;
	}

	async matchSnapshotRules(snapshot, text) {
		const activeRules = getActiveRules(this.config.rules);
		if (activeRules.length === 0) {
			return [];
		}

		let matches = [];
		let nativeHandled = false;
		if (canUseNativeKeywordAnalyzer(activeRules)) {
			try {
				const nativeResult = await this.nativeWorker.analyze({
					text,
					rules: activeRules,
					rulesSignature: createRuleSignature(activeRules),
				});
				if (nativeResult && Array.isArray(nativeResult.matches)) {
					nativeHandled = true;
					matches = nativeResult.matches;
				}
			} catch (_error) {
				nativeHandled = false;
			}
		}

		if (!nativeHandled) {
			matches = analyzeSubtitleKeywords(activeRules, text);
		}

		return matches.map((match) => ({
			id: `match-${Date.now().toString(36)}-${Math.random()
				.toString(36)
				.slice(2, 8)}`,
			ruleId: match.ruleId,
			pattern: match.pattern,
			matchedText: match.matchedText,
			site: snapshot.site || "",
			title: snapshot.title || "",
			url: snapshot.url || "",
			source: snapshot.source || "",
			text: snapshot.text || "",
			lines: Array.isArray(snapshot.lines) ? [...snapshot.lines] : [],
			updatedAt:
				typeof snapshot.updatedAt === "number"
					? snapshot.updatedAt
					: Date.now(),
			detectedAt: Date.now(),
		}));
	}

	emitState() {
		this.broadcast("live-subtitle-keyword-state", this.getState());
	}
}

module.exports = SubtitleKeywordDetector;
