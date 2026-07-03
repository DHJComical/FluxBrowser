const MAX_RECENT_MATCHES = 100;
const { t } = require("../i18n");

function createDefaultConfig() {
	return {
		enabled: true,
		rules: [],
	};
}

function normalizeRule(rule, index = 0) {
	if (typeof rule === "string") {
		const pattern = rule.trim();
		if (!pattern) return null;
		return {
			id: `rule-${index}-${pattern.toLowerCase()}`,
			pattern,
			enabled: true,
			matchCase: false,
			wholeWord: false,
			isRegex: false,
		};
	}

	if (!rule || typeof rule !== "object") return null;

	const pattern =
		typeof rule.pattern === "string"
			? rule.pattern.trim()
			: typeof rule.keyword === "string"
				? rule.keyword.trim()
				: "";
	if (!pattern) return null;

	return {
		id:
			typeof rule.id === "string" && rule.id.trim()
				? rule.id.trim()
				: `rule-${index}-${pattern.toLowerCase()}`,
		pattern,
		enabled: rule.enabled !== false,
		matchCase: rule.matchCase === true,
		wholeWord: rule.wholeWord === true,
		isRegex: rule.isRegex === true,
	};
}

function normalizeConfig(config = {}) {
	const rules = Array.isArray(config.rules)
		? config.rules.map((rule, index) => normalizeRule(rule, index)).filter(Boolean)
		: [];

	return {
		enabled: config.enabled !== false,
		rules,
	};
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class SubtitleKeywordDetector {
	constructor({ logger, configManager, broadcast }) {
		this.logger = logger;
		this.configManager = configManager;
		this.broadcast = broadcast;
		this.recentMatches = [];
		this.lastSignature = "";
		this.lastMatchAt = 0;
		this.config = this.loadConfig();
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
		if (!this.config.enabled) return [];
		if (!snapshot || snapshot.found !== true) return [];

		const text = typeof snapshot.text === "string" ? snapshot.text.trim() : "";
		if (!text) return [];

		const matches = this.config.rules
			.filter((rule) => rule.enabled !== false)
			.map((rule) => this.matchRule(rule, snapshot))
			.filter(Boolean);

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

	matchRule(rule, snapshot) {
		try {
			const matcher = this.createMatcher(rule);
			if (!matcher) return null;

			const matchedText = matcher(snapshot.text);
			if (!matchedText) return null;

			return {
				id: `match-${Date.now().toString(36)}-${Math.random()
					.toString(36)
					.slice(2, 8)}`,
				ruleId: rule.id,
				pattern: rule.pattern,
				matchedText,
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
			};
		} catch (_error) {
			return null;
		}
	}

	createMatcher(rule) {
		if (rule.isRegex) {
			const flags = rule.matchCase ? "g" : "gi";
			const regex = new RegExp(rule.pattern, flags);
			return (text) => {
				const match = text.match(regex);
				return Array.isArray(match) && match[0] ? match[0] : "";
			};
		}

		const source = rule.wholeWord
			? `\\b${escapeRegExp(rule.pattern)}\\b`
			: escapeRegExp(rule.pattern);
		const flags = rule.matchCase ? "" : "i";
		const regex = new RegExp(source, flags);
		return (text) => {
			const match = text.match(regex);
			return Array.isArray(match) && match[0] ? match[0] : "";
		};
	}

	emitState() {
		this.broadcast("live-subtitle-keyword-state", this.getState());
	}
}

module.exports = SubtitleKeywordDetector;
