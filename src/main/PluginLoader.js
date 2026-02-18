const configManager = require("./ConfigManager");

class PluginLoader {
	constructor(core) {
		this.core = core;
		this.plugins = [];
	}

	loadAll() {
		// 使用 require 加载插件模块
		this.plugins = [
			require("../plugins/boss-key"),
			require("../plugins/immersion"),
			require("../plugins/video-ctrl"),
			require("../plugins/opacity"),
			require("../plugins/web-nav"),
		];

		// 初始化所有插件
		this.plugins.forEach((p) => {
			if (p.initialize) p.initialize(this.core);
			else if (p.init) p.init(this.core);
		});

		// 注意：现在快捷键的注册由ShortcutManager处理
		// 我们不再在这里直接调用reloadShortcuts()
		// 而是由FluxCore通过ShortcutManager来管理
	}

	reloadShortcuts() {
		// 这个方法现在只是一个兼容性包装
		// 实际的快捷键重载由ShortcutManager处理
		if (this.core.getShortcutManager) {
			const shortcutManager = this.core.getShortcutManager();
			if (shortcutManager) {
				shortcutManager.reloadShortcuts();
				return;
			}
		}

		// 备用方案：如果没有ShortcutManager，使用旧逻辑
		this._legacyReloadShortcuts();
	}

	// 旧版快捷键重载逻辑（兼容性）
	_legacyReloadShortcuts() {
		const { globalShortcut } = require("electron");

		// 1. 先注销所有，防止冲突
		globalShortcut.unregisterAll();

		// 调试日志辅助函数
		const debugLog = {
			log: (...args) => {
				if (configManager.isDebugMode()) console.log(...args);
			},
			error: (...args) => {
				if (configManager.isDebugMode()) console.error(...args);
			},
		};

		debugLog.log("正在重载快捷键（旧版逻辑）...");

		// 2. 遍历所有插件，去 Core 里查配置
		this.plugins.forEach((plugin) => {
			if (plugin.shortcuts) {
				for (const [actionId, actionFunc] of Object.entries(plugin.shortcuts)) {
					// 从 Core 获取用户设置的按键
					const userKey = this.core.getKey(actionId);
					if (userKey) {
						try {
							globalShortcut.register(userKey, () => actionFunc(this.core));
							debugLog.log(`注册成功: [${actionId}] -> ${userKey}`);
						} catch (e) {
							debugLog.error(`注册失败: ${userKey}`, e);
						}
					}
				}
			}
		});
	}

	// 获取所有插件
	getPlugins() {
		return this.plugins;
	}

	// 获取特定插件
	getPlugin(name) {
		return this.plugins.find((p) => p.name === name);
	}

	// 添加新插件（动态加载）
	addPlugin(pluginModule) {
		if (pluginModule) {
			this.plugins.push(pluginModule);

			// 初始化新插件
			if (pluginModule.initialize) pluginModule.initialize(this.core);
			else if (pluginModule.init) pluginModule.init(this.core);

			return true;
		}
		return false;
	}

	// 移除插件
	removePlugin(name) {
		const index = this.plugins.findIndex((p) => p.name === name);
		if (index !== -1) {
			this.plugins.splice(index, 1);
			return true;
		}
		return false;
	}

	// 获取所有插件的快捷键配置
	getAllPluginShortcuts() {
		const shortcuts = {};
		this.plugins.forEach((plugin) => {
			if (plugin.shortcuts) {
				Object.assign(shortcuts, plugin.shortcuts);
			}
		});
		return shortcuts;
	}

	// 验证插件结构
	validatePlugin(plugin) {
		if (!plugin) return false;

		// 插件必须有name属性
		if (!plugin.name || typeof plugin.name !== "string") {
			return false;
		}

		// 插件应该有shortcuts属性（可选，但推荐）
		if (plugin.shortcuts && typeof plugin.shortcuts !== "object") {
			return false;
		}

		return true;
	}
}

module.exports = PluginLoader;
