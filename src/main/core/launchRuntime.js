const Updater = require("../Updater");
const PluginLoader = require("../PluginLoader");
const IPCManager = require("./IPCManager");
const ShortcutManager = require("./ShortcutManager");
const { createCoreLogger } = require("./coreLogger");

function launchRuntime(core, PluginLoaderClass = PluginLoader) {
	core.windowManager.createMainWindow();

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
	);

	core.ipcManager.setupAllHandlers();
	core.shortcutManager.reloadShortcuts();
	new Updater(core);
}

module.exports = launchRuntime;
