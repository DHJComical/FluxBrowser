const { globalShortcut } = require("electron");

function registerShortcutHandlers({ ipcMain, pluginLoader }) {
	ipcMain.on("suspend-shortcuts", () => globalShortcut.unregisterAll());

	ipcMain.on("resume-shortcuts", () => {
		if (pluginLoader) {
			pluginLoader.reloadShortcuts();
		}
	});
}

module.exports = registerShortcutHandlers;
