function registerLiveSubtitleHandlers({
	ipcMain,
	liveSubtitleMonitor,
	subtitleKeywordDetector,
	logger,
}) {
	ipcMain.handle("get-live-subtitle-state", () => liveSubtitleMonitor.getState());
	ipcMain.handle("get-live-subtitle-latest", () =>
		liveSubtitleMonitor.getLatestSnapshot(),
	);
	ipcMain.handle("get-live-subtitle-keyword-config", () =>
		subtitleKeywordDetector.getConfig(),
	);
	ipcMain.handle("get-live-subtitle-keyword-state", () =>
		subtitleKeywordDetector.getState(),
	);
	ipcMain.handle("get-live-subtitle-keyword-matches", () =>
		subtitleKeywordDetector.getRecentMatches(),
	);

	ipcMain.on("start-live-subtitle-capture", () => {
		liveSubtitleMonitor.start();
	});

	ipcMain.on("stop-live-subtitle-capture", () => {
		liveSubtitleMonitor.stop();
	});

	ipcMain.on("toggle-live-subtitle-capture", () => {
		const state = liveSubtitleMonitor.toggle();
		logger.debug(
			`实时字幕采集状态已切换: ${state.enabled ? "enabled" : "disabled"}`,
		);
	});

	ipcMain.on("set-live-subtitle-keyword-config", (_event, config = {}) => {
		const nextConfig = subtitleKeywordDetector.saveConfig(config);
		subtitleKeywordDetector.handleSnapshot(
			liveSubtitleMonitor.getLatestSnapshot(),
		);
		logger.debug(
			`字幕关键字规则已更新: ${nextConfig.rules.length} 条`,
		);
	});

	ipcMain.on("clear-live-subtitle-keyword-matches", () => {
		subtitleKeywordDetector.clearRecentMatches();
	});

	ipcMain.on("live-subtitle-snapshot", (_event, payload = {}) => {
		const result = liveSubtitleMonitor.handleSnapshot(payload);
		if (result && result.snapshot) {
			subtitleKeywordDetector.handleSnapshot(result.snapshot);
		}
	});
}

module.exports = registerLiveSubtitleHandlers;
