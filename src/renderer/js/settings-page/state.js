const state = {
	tempKeyMap: {},
	language: "zh-CN",
	debugModeState: false,
	bossKeyProtectionState: true,
	alwaysOnTopState: false,
	directionIndicatorEnabledState: true,
	videoForwardSecondsState: 10,
	videoBackwardSecondsState: 10,
	videoLongPressRateState: 2.0,
	tempResolutionPresets: [],
	aspectLocked: false,
	lockedAspectRatio: null,
	cacheClearOptions: {
		clearLogs: false,
		clearKeyConfig: false,
		clearWindowConfig: false,
		clearAppConfig: false,
		clearResolutionPresets: false,
	},
};

module.exports = state;
