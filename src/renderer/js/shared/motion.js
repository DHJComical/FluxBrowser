function applyMotionPreference(enabled = true) {
	document.body.classList.toggle("animations-disabled", enabled === false);
}

module.exports = {
	applyMotionPreference,
};
