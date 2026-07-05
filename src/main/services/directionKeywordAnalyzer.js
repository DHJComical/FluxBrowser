function normalizeSubtitleText(snapshot = {}) {
	if (Array.isArray(snapshot.lines) && snapshot.lines.length > 0) {
		return snapshot.lines
			.map((line) => String(line || "").trim())
			.filter(Boolean)
			.join("\n");
	}

	return typeof snapshot.text === "string" ? snapshot.text.trim() : "";
}

module.exports = {
	normalizeSubtitleText,
};
