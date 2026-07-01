function forEachPluginShortcut(pluginLoader, callback) {
	if (!pluginLoader || !pluginLoader.plugins) return;

	pluginLoader.plugins.forEach((plugin) => {
		if (!plugin.shortcuts) return;
		Object.entries(plugin.shortcuts).forEach(([actionId, actionFunc]) => {
			callback(plugin, actionId, actionFunc);
		});
	});
}

module.exports = {
	forEachPluginShortcut,
};
