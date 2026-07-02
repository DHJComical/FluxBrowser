function collectActiveWindows(windowManager) {
	const windows = [];
	if (windowManager.mainWindow && !windowManager.mainWindow.isDestroyed()) {
		windows.push(windowManager.mainWindow);
	}
	if (windowManager.tabBarWindow && !windowManager.tabBarWindow.isDestroyed()) {
		windows.push(windowManager.tabBarWindow);
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
