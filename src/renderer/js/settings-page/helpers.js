function normalizeNumber(value, fallback, min, max) {
	const number = Number(value);
	if (!Number.isFinite(number)) return fallback;
	return Math.min(max, Math.max(min, number));
}

module.exports = {
	normalizeNumber,
};
