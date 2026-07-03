const { getLocale, t } = require("../shared/i18n");

function formatTime(seconds) {
	const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
	const hours = Math.floor(safeSeconds / 3600);
	const mins = Math.floor((safeSeconds % 3600) / 60);
	const secs = safeSeconds % 60;

	if (hours > 0) {
		return t("bookmarks.time.hms", { hours, mins, secs });
	}
	if (mins > 0) {
		return t("bookmarks.time.ms", { mins, secs });
	}
	return t("bookmarks.time.s", { secs });
}

function formatDurationLabel(totalSeconds) {
	const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
	if (safeSeconds >= 3600) {
		return t("bookmarks.duration.hours", {
			value: (safeSeconds / 3600).toFixed(1),
		});
	}
	if (safeSeconds >= 60) {
		return t("bookmarks.duration.minutes", {
			value: Math.floor(safeSeconds / 60),
		});
	}
	return t("bookmarks.duration.seconds", { value: safeSeconds });
}

function formatBookmarkDate(timestamp) {
	if (!timestamp) {
		return t("bookmarks.time.unknown");
	}

	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return t("bookmarks.time.unknown");
	}

	return new Intl.DateTimeFormat(getLocale(), {
		month: "numeric",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	}).format(date);
}

function isWithinRecentDays(timestamp, days = 7) {
	if (!timestamp) return false;
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) return false;
	return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000;
}

module.exports = {
	formatTime,
	formatDurationLabel,
	formatBookmarkDate,
	isWithinRecentDays,
};
