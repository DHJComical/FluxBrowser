const configManager = require("../ConfigManager");

const BOSS_KEY_MIN_TOGGLE_INTERVAL_MS = 300;
const BOSS_KEY_ACTION_ID = "BossKey";

function isBossKeyProtectionEnabled() {
	return configManager.getAppConfig().bossKeyProtection !== false;
}

function pausePlayingVideosForBossKey(core) {
	core.executeOnWebview(`
		(() => {
			document.querySelectorAll("video").forEach((video) => {
				if (!video.paused && !video.ended) {
					video.dataset.fluxBossKeyPaused = "true";
					video.pause();
				}
			});
		})();
	`);
}

function resumeBossKeyPausedVideos(core) {
	core.executeOnWebview(`
		(() => {
			document.querySelectorAll("video").forEach((video) => {
				if (video.dataset.fluxBossKeyPaused === "true") {
					delete video.dataset.fluxBossKeyPaused;
					if (video.paused && !video.ended) {
						const playPromise = video.play();
						if (playPromise && typeof playPromise.catch === "function") {
							playPromise.catch(() => {});
						}
					}
				}
			});
		})();
	`);
}

function suspendShortcutsExceptBossKey(shortcutManager) {
	if (shortcutManager) {
		shortcutManager.suspendShortcutsExcept([BOSS_KEY_ACTION_ID]);
	}
}

function resumeShortcutsExceptBossKey(shortcutManager) {
	if (shortcutManager) {
		shortcutManager.resumeShortcutsExcept([BOSS_KEY_ACTION_ID]);
	}
}

function toggleBossKey(core) {
	const now = Date.now();
	if (now - core.lastBossKeyToggleAt < BOSS_KEY_MIN_TOGGLE_INTERVAL_MS) return;
	core.lastBossKeyToggleAt = now;

	const mainWindow = core.windowManager.getMainWindow();
	if (!mainWindow) return;

	const willHide = mainWindow.isVisible();
	if (willHide && isBossKeyProtectionEnabled()) {
		pausePlayingVideosForBossKey(core);
	}

	core.windowManager.toggleVisibility();

	if (!isBossKeyProtectionEnabled()) return;

	if (willHide) {
		suspendShortcutsExceptBossKey(core.shortcutManager);
	} else {
		resumeShortcutsExceptBossKey(core.shortcutManager);
		resumeBossKeyPausedVideos(core);
	}
}

module.exports = {
	toggleBossKey,
	isBossKeyProtectionEnabled,
	pausePlayingVideosForBossKey,
	resumeBossKeyPausedVideos,
	suspendShortcutsExceptBossKey,
	resumeShortcutsExceptBossKey,
};
