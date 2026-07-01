const { WINDOW_CONSTANTS } = require("../constants/config");

let isImmersion = false;
const TITLE_BAR_HEIGHT = WINDOW_CONSTANTS.TITLE_BAR_HEIGHT;

module.exports = {
	name: "ImmersionMode",
	shortcuts: {
		ImmersionMode: (core) => {
			isImmersion = !isImmersion;

			const mainWindow = core.windowManager.getMainWindow();
			if (!mainWindow) {
				console.error("无法获取主窗口");
				return;
			}

			if (isImmersion) {
				const currentBounds = mainWindow.getBounds();

				mainWindow.setBounds({
					x: currentBounds.x,
					y: currentBounds.y + TITLE_BAR_HEIGHT,
					width: currentBounds.width,
					height: currentBounds.height - TITLE_BAR_HEIGHT,
				});

				core.setIgnoreMouse(true);
				core.setAlwaysOnTop(true);
				core.setFocusable(false);
				core.windowManager.setImmersionMode(true);
				core.focusBorderlessMaximizedApp();
			} else {
				const currentBounds = mainWindow.getBounds();

				mainWindow.setBounds({
					x: currentBounds.x,
					y: currentBounds.y - TITLE_BAR_HEIGHT,
					width: currentBounds.width,
					height: currentBounds.height + TITLE_BAR_HEIGHT,
				});

				core.setFocusable(true);
				core.setIgnoreMouse(false);
				core.setAlwaysOnTop(false);
				core.windowManager.setImmersionMode(false);
			}

			core.sendToRenderer("toggle-immersion-ui", isImmersion);
		},
	},
};
