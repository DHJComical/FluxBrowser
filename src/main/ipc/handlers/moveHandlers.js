function registerMoveHandlers({ ipcMain, windowManager, logger }) {
	let moveInterval = null;
	let isMovingWindow = false;

	function startMovingWindow(window) {
		if (moveInterval) clearInterval(moveInterval);
		if (!window) return;
		isMovingWindow = true;

		const { screen } = require("electron");
		const startMousePos = screen.getCursorScreenPoint();
		const startWindowBounds = window.getBounds();
		const startMainBounds =
			window === windowManager.getTabBarWindow()
				? windowManager.getMainWindow()?.getBounds() || null
				: null;

		moveInterval = setInterval(() => {
			if (!window || window.isDestroyed()) {
				clearInterval(moveInterval);
				return;
			}

			const currentMousePos = screen.getCursorScreenPoint();
			const deltaX = currentMousePos.x - startMousePos.x;
			const deltaY = currentMousePos.y - startMousePos.y;

			window.setBounds({
				x: startWindowBounds.x + deltaX,
				y: startWindowBounds.y + deltaY,
				width: startWindowBounds.width,
				height: startWindowBounds.height,
			});
			if (window === windowManager.getTabBarWindow()) {
				const mainWindow = windowManager.getMainWindow();
				if (mainWindow && !mainWindow.isDestroyed() && startMainBounds) {
					mainWindow.setBounds({
						x: startMainBounds.x + deltaX,
						y: startMainBounds.y + deltaY,
						width: startMainBounds.width,
						height: startMainBounds.height,
					});
				}
			}
		}, 10);
	}

	ipcMain.on("start-moving", () => {
		const mainWindow = windowManager.getMainWindow();
		startMovingWindow(mainWindow);
	});

	ipcMain.on("start-moving-tab-bar", () => {
		const tabBarWindow = windowManager.getTabBarWindow();
		startMovingWindow(tabBarWindow);
	});

	ipcMain.on("stop-moving", () => {
		const wasMovingWindow = isMovingWindow;
		if (moveInterval) {
			clearInterval(moveInterval);
			moveInterval = null;
		}
		isMovingWindow = false;
		if (!wasMovingWindow) return;

		const mainWindow = windowManager.getMainWindow();
		if (mainWindow) {
			const bounds = mainWindow.getBounds();
			logger.debug(`窗口位置已移动: X=${bounds.x}, Y=${bounds.y}`);
		}
	});
}

module.exports = registerMoveHandlers;
