const { app } = require("electron");
const fluxCore = require("./FluxCore");
const PluginLoader = require("./PluginLoader");

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		// 当用户尝试打开第二个实例时，取消隐藏并聚焦已有窗口
		const wm = fluxCore.getWindowManager();
		if (!wm) return;

		const mw = wm.getMainWindow();
		if (mw) {
			if (mw.isMinimized() || !mw.isVisible()) {
				mw.show();
			}
			mw.focus();
		}
		wm.bringMainWindowToFront();
	});

	app.whenReady().then(() => {
		fluxCore.launch(PluginLoader);
	});
}
