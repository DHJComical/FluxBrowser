const { globalShortcut } = require("electron");

class PluginLoader {
	constructor(core) {
		this.core = core;
		this.plugins = [];
	}

	loadAll() {
		// 注册所有插件
		this.register(require("../plugins/boss-key"));
		this.register(require("../plugins/immersion"));
		this.register(require("../plugins/video-ctrl"));

		console.log(`[FluxBrowser] ${this.plugins.length} plugins loaded.`);
	}

	register(pluginModule) {
		// 1. 执行插件初始化
		if (pluginModule.init) {
			pluginModule.init(this.core);
		}

		// 2. 注册快捷键
		if (pluginModule.shortcuts) {
			for (const [key, action] of Object.entries(pluginModule.shortcuts)) {
				globalShortcut.register(key, () => action(this.core));
			}
		}

		this.plugins.push(pluginModule);
	}
}

module.exports = PluginLoader;
