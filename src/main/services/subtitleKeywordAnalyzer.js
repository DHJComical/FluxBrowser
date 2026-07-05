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

function createMatcher(rule) {
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

function getActiveRules(rules = []) {
	return Array.isArray(rules)
		? rules.filter((rule) => rule && rule.enabled !== false)
		: [];
}

function canUseNativeKeywordAnalyzer(rules = []) {
	const activeRules = getActiveRules(rules);
	return activeRules.length > 0 && activeRules.every((rule) => rule.isRegex !== true);
}

function createRuleSignature(rules = []) {
	return JSON.stringify(
		getActiveRules(rules).map((rule) => ({
			id: rule.id,
			pattern: rule.pattern,
			matchCase: rule.matchCase === true,
			wholeWord: rule.wholeWord === true,
			isRegex: rule.isRegex === true,
		})),
	);
}

function analyzeSubtitleKeywords(rules = [], text = "") {
	if (!text) return [];

	return getActiveRules(rules)
		.map((rule) => {
			try {
				const matcher = createMatcher(rule);
				const matchedText = matcher(text);
				if (!matchedText) return null;

				return {
					ruleId: rule.id,
					pattern: rule.pattern,
					matchedText,
				};
			} catch (_error) {
				return null;
			}
		})
		.filter(Boolean);
}

module.exports = {
	normalizeConfig,
	analyzeSubtitleKeywords,
	canUseNativeKeywordAnalyzer,
	createRuleSignature,
	getActiveRules,
};
