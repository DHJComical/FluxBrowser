const { globalShortcut } = require("electron");
const configManager = require("../ConfigManager");

class ShortcutManager {
	constructor(core, pluginLoader, logger) {
		this.core = core;
		this.pluginLoader = pluginLoader;
		this.logger = logger;
		this.registeredShortcuts = new Map();
	}

	// 重新加载所有快捷键
	reloadShortcuts() {
		// 1. 先注销所有快捷键，防止冲突
		this.unregisterAllShortcuts();

		// 2. 遍历所有插件，注册快捷键
		if (this.pluginLoader && this.pluginLoader.plugins) {
			this.pluginLoader.plugins.forEach((plugin) => {
				if (plugin.shortcuts) {
					this.registerPluginShortcuts(plugin);
				}
			});
		}

		this.logger.debug("快捷键重载完成");
	}

	// 注册单个插件的快捷键
	registerPluginShortcuts(plugin) {
		for (const [actionId, actionFunc] of Object.entries(plugin.shortcuts)) {
			// 从配置获取用户设置的按键
			const userKey = this.getKeyFromConfig(actionId);
			if (userKey) {
				this.registerShortcut(userKey, actionId, actionFunc);
			}
		}
	}

	// 从配置获取快捷键
	getKeyFromConfig(actionId) {
		if (this.core && this.core.getKey) {
			return this.core.getKey(actionId);
		}
		// 备用方案：直接从配置管理器获取
		const keyConfig = configManager.getKeyConfig();
		return keyConfig[actionId];
	}

	// 注册单个快捷键
	registerShortcut(key, actionId, actionFunc) {
		try {
			// 检查快捷键是否已经被注册
			if (this.registeredShortcuts.has(key)) {
				this.logger.debug(`快捷键 ${key} 已被注册，跳过`);
				return false;
			}

			// 注册快捷键
			const success = globalShortcut.register(key, () => {
				try {
					actionFunc(this.core);
				} catch (error) {
					this.logger.error(`执行快捷键 ${key} (${actionId}) 时出错:`, error);
				}
			});

			if (success) {
				this.registeredShortcuts.set(key, actionId);
				this.logger.debug(`注册成功: [${actionId}] -> ${key}`);
				return true;
			} else {
				this.logger.error(`注册失败: ${key} (可能已被其他应用占用)`);
				return false;
			}
		} catch (error) {
			this.logger.error(`注册快捷键 ${key} 时出错:`, error);
			return false;
		}
	}

	// 注销单个快捷键
	unregisterShortcut(key) {
		try {
			if (globalShortcut.isRegistered(key)) {
				globalShortcut.unregister(key);
				this.registeredShortcuts.delete(key);
				this.logger.debug(`注销快捷键: ${key}`);
				return true;
			}
			return false;
		} catch (error) {
			this.logger.error(`注销快捷键 ${key} 时出错:`, error);
			return false;
		}
	}

	// 注销所有快捷键
	unregisterAllShortcuts() {
		try {
			globalShortcut.unregisterAll();
			this.registeredShortcuts.clear();
			this.logger.debug("所有快捷键已注销");
			return true;
		} catch (error) {
			this.logger.error("注销所有快捷键时出错:", error);
			return false;
		}
	}

	// 检查快捷键是否已注册
	isShortcutRegistered(key) {
		return globalShortcut.isRegistered(key);
	}

	// 获取所有已注册的快捷键
	getAllRegisteredShortcuts() {
		const result = {};
		for (const [key, actionId] of this.registeredShortcuts.entries()) {
			result[actionId] = key;
		}
		return result;
	}

	// 暂停所有快捷键（临时禁用）
	suspendShortcuts() {
		this.unregisterAllShortcuts();
		this.logger.debug("快捷键已暂停");
	}

	// 恢复快捷键
	resumeShortcuts() {
		this.reloadShortcuts();
		this.logger.debug("快捷键已恢复");
	}

	// 验证快捷键格式
	validateShortcut(key) {
		if (!key || typeof key !== "string") {
			return false;
		}

		// 简单的格式验证：不能为空，不能包含非法字符
		const invalidChars = /[<>:"|?*]/;
		if (invalidChars.test(key)) {
			return false;
		}

		return true;
	}

	// 格式化快捷键显示
	formatShortcut(key) {
		if (!key) return "";

		// 将常见的修饰键转换为更友好的显示
		return key
			.replace(/Control|Ctrl/gi, "Ctrl")
			.replace(/Alt/gi, "Alt")
			.replace(/Shift/gi, "Shift")
			.replace(/Command|Cmd/gi, "Cmd")
			.replace(/Option/gi, "Opt")
			.replace(/\+/g, " + ")
			.trim();
	}
}

module.exports = ShortcutManager;
