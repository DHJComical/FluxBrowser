const Updater = require("../Updater");
const PluginLoader = require("../PluginLoader");
const IPCManager = require("./IPCManager");
const ShortcutManager = require("./ShortcutManager");
const { createCoreLogger } = require("./coreLogger");

function launchRuntime(core, PluginLoaderClass = PluginLoader) {
	core.windowManager.createMainWindow({
		onRequestNewTab: (url) => {
			const tab = core.tabStateManager.createTab({ url });
			core.broadcast("tabs-state-changed", core.tabStateManager.getState());
			core.sendToRenderer("focus-active-tab");
			core.ipcManager?.sendToMainWindow("active-tab-navigation", {
				tabId: tab.id,
				url: tab.url,
			});
		},
	});

	core.pluginLoader = new PluginLoaderClass(core);
	core.pluginLoader.loadAll();

	const coreLogger = createCoreLogger(core.logger);

	core.shortcutManager = new ShortcutManager(
		core,
		core.pluginLoader,
		coreLogger,
	);

	core.ipcManager = new IPCManager(
		core.windowManager,
		core.pluginLoader,
		coreLogger,
		core.tabStateManager,
	);

	core.ipcManager.setupAllHandlers();
	core.shortcutManager.reloadShortcuts();
	new Updater(core);
}

module.exports = launchRuntime;
