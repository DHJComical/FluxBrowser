function initializePlugin(plugin, core) {
	if (!plugin) return;

	if (plugin.initialize) {
		plugin.initialize(core);
		return;
	}

	if (plugin.init) {
		plugin.init(core);
	}
}

function collectPluginShortcuts(plugins) {
	const shortcuts = {};
	plugins.forEach((plugin) => {
		if (plugin && plugin.shortcuts) {
			Object.assign(shortcuts, plugin.shortcuts);
		}
	});
	return shortcuts;
}

module.exports = {
	initializePlugin,
	collectPluginShortcuts,
};
