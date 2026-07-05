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

function normalizeSubtitleText(snapshot = {}) {
	if (Array.isArray(snapshot.lines) && snapshot.lines.length > 0) {
		return snapshot.lines
			.map((line) => String(line || "").trim())
			.filter(Boolean)
			.join("\n");
	}

	return typeof snapshot.text === "string" ? snapshot.text.trim() : "";
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

function analyzeDirectionKeywords(text = "") {
	const normalizedText = typeof text === "string" ? text.trim() : "";
	if (!normalizedText) return [];

	const matches = [];
	let workingText = normalizedText;

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

module.exports = {
	analyzeDirectionKeywords,
	normalizeSubtitleText,
};
