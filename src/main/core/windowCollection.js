function collectActiveWindows(windowManager) {
	const windows = [];
	if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
		windows.push(windowManager.mainWindow);
	}
	if (windowManager.settingsWindow && !windowManager.settingsWindow.isDestroyed()) {
		windows.push(windowManager.settingsWindow);
	}
	if (windowManager.bookmarksWindow && !windowManager.bookmarksWindow.isDestroyed()) {
		windows.push(windowManager.bookmarksWindow);
	}
	return windows;
}

module.exports = {
	collectActiveWindows,
};
