let isImmersion = false;
const TITLE_BAR_HEIGHT = 40; // 与CSS中的#flux-bar高度一致

module.exports = {
	name: "ImmersionMode",
	shortcuts: {
		ImmersionMode: (core) => {
			isImmersion = !isImmersion;

			// 获取主窗口
			const mainWindow = core.windowManager.getMainWindow();
			if (!mainWindow) {
				console.error("无法获取主窗口");
				return;
			}

			if (isImmersion) {
				// 进入沉浸模式前保存当前窗口大小
				const currentBounds = mainWindow.getBounds();

				// 调整窗口大小和位置，减去标题栏的高度以保持webview内容区域不变
				// 同时调整y坐标，确保webview的顶部保持在原来位置
				mainWindow.setBounds({
					x: currentBounds.x,
					y: currentBounds.y + TITLE_BAR_HEIGHT,
					width: currentBounds.width,
					height: currentBounds.height - TITLE_BAR_HEIGHT,
				});

				// 启用沉浸模式特性
				core.setIgnoreMouse(true);
				core.setAlwaysOnTop(true);
			} else {
				// 退出沉浸模式，恢复原来的窗口大小和位置
				const currentBounds = mainWindow.getBounds();

				// 恢复窗口大小和位置，加上标题栏的高度
				// 同时调整y坐标，确保webview回到原来的位置
				mainWindow.setBounds({
					x: currentBounds.x,
					y: currentBounds.y - TITLE_BAR_HEIGHT,
					width: currentBounds.width,
					height: currentBounds.height + TITLE_BAR_HEIGHT,
				});

				// 关闭沉浸模式特性
				core.setIgnoreMouse(false);
				core.setAlwaysOnTop(false);
			}

			// 通知渲染进程更新UI
			core.sendToRenderer("toggle-immersion-ui", isImmersion);
		},
	},
};
