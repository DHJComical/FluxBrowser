const { ipcMain } = require("electron");

// 跟踪当前是否处于沉浸模式
let isImmersionMode = false;

module.exports = {
	name: "WebNavigation",
	initialize: (core) => {
		// 监听来自渲染进程的消息，获取沉浸模式状态
		ipcMain.on("immersion-mode-changed", (e, immersionState) => {
			isImmersionMode = immersionState;
		});
	},
	shortcuts: {
		// 键盘快捷键
		GoBack: (core) => {
			if (!isImmersionMode) {
				core.sendToRenderer("web-go-back");
			}
		},
		GoForward: (core) => {
			if (!isImmersionMode) {
				core.sendToRenderer("web-go-forward");
			}
		},
	},
};
