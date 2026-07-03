module.exports = {
	name: "LiveSubtitle",
	shortcuts: {
		"Subtitle-Capture-Toggle": (core) => {
			core.sendToRenderer("toggle-live-subtitle-capture");
		},
	},
};
