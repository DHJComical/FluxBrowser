function formatTime(seconds) {
	const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
	const hours = Math.floor(safeSeconds / 3600);
	const mins = Math.floor((safeSeconds % 3600) / 60);
	const secs = safeSeconds % 60;

	if (hours > 0) {
		return `${hours}小时 ${mins}分 ${secs}秒`;
	}
	if (mins > 0) {
		return `${mins}分 ${secs}秒`;
	}
	return `${secs}秒`;
}

function formatDurationLabel(totalSeconds) {
	const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
	if (safeSeconds >= 3600) {
		return `${(safeSeconds / 3600).toFixed(1)} 小时`;
	}
	if (safeSeconds >= 60) {
		return `${Math.floor(safeSeconds / 60)} 分钟`;
	}
	return `${safeSeconds} 秒`;
}

function formatBookmarkDate(timestamp) {
	if (!timestamp) {
		return "时间未知";
	}

	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return "时间未知";
	}

	return new Intl.DateTimeFormat("zh-CN", {
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
