function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	if (mins > 0) {
		return `${mins}分${secs}秒`;
	}
	return `${secs}秒`;
}

module.exports = {
	formatTime,
};
