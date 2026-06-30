function registerMoveHandlers({ ipcMain, windowManager, logger }) {
	let moveInterval = null;
	let startWindowBounds = null;

	ipcMain.on("start-moving", () => {
		if (moveInterval) clearInterval(moveInterval);

		const { screen } = require("electron");
		const mainWindow = windowManager.getMainWindow();
		if (!mainWindow) return;

		const startMousePos = screen.getCursorScreenPoint();
		startWindowBounds = mainWindow.getBounds();

		moveInterval = setInterval(() => {
			if (!mainWindow || mainWindow.isDestroyed()) {
				clearInterval(moveInterval);
				return;
			}

			const currentMousePos = screen.getCursorScreenPoint();
			const deltaX = currentMousePos.x - startMousePos.x;
			const deltaY = currentMousePos.y - startMousePos.y;

			mainWindow.setBounds({
				x: startWindowBounds.x + deltaX,
				y: startWindowBounds.y + deltaY,
				width: startWindowBounds.width,
				height: startWindowBounds.height,
			});
		}, 10);
	});

	ipcMain.on("stop-moving", () => {
		if (moveInterval) {
			clearInterval(moveInterval);
			moveInterval = null;
		}

		const mainWindow = windowManager.getMainWindow();
		if (mainWindow) {
			const bounds = mainWindow.getBounds();
			logger.debug(`窗口位置已移动: X=${bounds.x}, Y=${bounds.y}`);
		}
	});
}

module.exports = registerMoveHandlers;
