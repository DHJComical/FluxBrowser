const { t } = require("../../i18n");

function registerLiveSubtitleHandlers({
	ipcMain,
	liveSubtitleMonitor,
	subtitleKeywordDetector,
	directionKeywordDetector,
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
	ipcMain.handle("get-live-subtitle-direction-state", () =>
		directionKeywordDetector.getLatestPayload(),
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
			t("logs.liveSubtitle.stateToggled", {
				enabled: state.enabled ? "enabled" : "disabled",
			}),
		);
	});

	ipcMain.on("set-live-subtitle-keyword-config", async (_event, config = {}) => {
		const nextConfig = subtitleKeywordDetector.saveConfig(config);
		await subtitleKeywordDetector.handleSnapshot(
			liveSubtitleMonitor.getLatestSnapshot(),
		);
		logger.debug(
			t("logs.liveSubtitle.rulesUpdated", {
				count: nextConfig.rules.length,
			}),
		);
	});

	ipcMain.on("clear-live-subtitle-keyword-matches", () => {
		subtitleKeywordDetector.clearRecentMatches();
	});

	ipcMain.on("live-subtitle-snapshot", async (_event, payload = {}) => {
		const result = liveSubtitleMonitor.handleSnapshot(payload);
		if (result && result.snapshot) {
			await Promise.allSettled([
				subtitleKeywordDetector.handleSnapshot(result.snapshot),
				directionKeywordDetector.handleSnapshot(result.snapshot),
			]);
		}
	});
}

module.exports = registerLiveSubtitleHandlers;
