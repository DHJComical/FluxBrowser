function registerResizeHandlers({ ipcMain, windowManager, logger }) {
	let resizeInterval = null;
	let isResizing = false;

	ipcMain.on("start-resizing", (_event, direction) => {
		isResizing = true;
		if (resizeInterval) clearInterval(resizeInterval);

		const { screen } = require("electron");
		const mainWindow = windowManager.getMainWindow();
		if (!mainWindow) return;

		const startMousePos = screen.getCursorScreenPoint();
		const startBounds = mainWindow.getBounds();

		resizeInterval = setInterval(() => {
			if (!mainWindow || mainWindow.isDestroyed()) {
				clearInterval(resizeInterval);
				return;
			}

			const currentMousePos = screen.getCursorScreenPoint();
			const deltaX = currentMousePos.x - startMousePos.x;
			const deltaY = currentMousePos.y - startMousePos.y;

			let newWidth = startBounds.width;
			let newHeight = startBounds.height;

			if (direction === "right" || direction === "both") {
				newWidth = Math.max(40, startBounds.width + deltaX);
			}
			if (direction === "bottom" || direction === "both") {
				newHeight = Math.max(80, startBounds.height + deltaY);
			}

			mainWindow.setBounds({
				x: startBounds.x,
				y: startBounds.y,
				width: newWidth,
				height: newHeight,
			});
		}, 10);
	});

	ipcMain.on("stop-resizing", () => {
		if (resizeInterval) {
			clearInterval(resizeInterval);
			resizeInterval = null;
		}

		const mainWindow = windowManager.getMainWindow();
		if (isResizing && mainWindow) {
			const bounds = mainWindow.getBounds();
			logger.debug(
				`窗口大小已调整: Width=${bounds.width}, Height=${bounds.height}`,
			);
		}
		isResizing = false;
	});
}

module.exports = registerResizeHandlers;
