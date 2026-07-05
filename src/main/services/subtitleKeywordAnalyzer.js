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

function getActiveRules(rules = []) {
	return Array.isArray(rules)
		? rules.filter((rule) => rule && rule.enabled !== false)
		: [];
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

module.exports = {
	normalizeConfig,
	createRuleSignature,
	getActiveRules,
};
