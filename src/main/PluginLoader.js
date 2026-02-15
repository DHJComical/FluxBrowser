const { globalShortcut } = require("electron");
const configManager = require("./ConfigManager");

class PluginLoader {
	constructor(core) {
		this.core = core;
		this.plugins = [];
	}

	loadAll() {
		// 使用 require 加载修改后的模块
		this.plugins = [
			require("../plugins/boss-key"),
			require("../plugins/immersion"),
			require("../plugins/video-ctrl"),
			require("../plugins/opacity"),
			require("../plugins/web-nav"),
		];

		this.plugins.forEach((p) => {
			if (p.initialize) p.initialize(this.core);
			else if (p.init) p.init(this.core);
		});

		this.reloadShortcuts();
	}

	reloadShortcuts() {
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

		debugLog.log("正在重载快捷键...");

		// 2. 遍历所有插件，去 Core 里查配置
		this.plugins.forEach((plugin) => {
			if (plugin.shortcuts) {
				// plugin.shortcuts 现在的结构建议改成: { "ID": actionFunc }
				// 或者我们维持原状，但在 keyMap 里做映射。
				// 为了兼容旧代码结构，我们需要做一个映射逻辑。

				// 假设插件依然导出: export const shortcuts = { "Alt+Q": func }
				// 这种结构不利于自定义。我们建议稍微改一下插件结构，或者在这里做个 Hack。

				// 为了最小化改动，我们假设 keyMap 的键就是插件里的功能名
				// 但为了严谨，我们这里硬编码映射关系，或者修改插件文件。

				// 推荐方案：修改插件 shortcuts 对象的 Key 为 "功能ID"
				for (const [actionId, actionFunc] of Object.entries(plugin.shortcuts)) {
					// 从 Core 获取用户设置的按键，比如 "Alt+Q"
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
}

module.exports = PluginLoader;
