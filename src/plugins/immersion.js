module.exports = {
	name: "ImmersionMode",
	shortcuts: {
		ImmersionMode: (core) => {
			const mainWindow = core.windowManager.getMainWindow();
			if (!mainWindow) {
				console.error("Unable to get main window");
				return;
			}

			const isImmersion =
				core.windowManager.toggleImmersionMode();

			if (isImmersion) {
				core.setIgnoreMouse(true, { forward: false });
				core.setAlwaysOnTop(true);
				core.setFocusable(false);
				core.focusBorderlessMaximizedApp();
			} else {
				core.setFocusable(true);
				core.setIgnoreMouse(false);
				core.setAlwaysOnTop(false);
			}

			core.sendToRenderer("toggle-immersion-ui", isImmersion);
		},
	},
};
