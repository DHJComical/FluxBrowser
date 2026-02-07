let isImmersion = false;

export const name = "ImmersionMode";
export const shortcuts = {
	"Alt+W": (core) => {
		isImmersion = !isImmersion;
		
		// 1. 设置后端窗口鼠标穿透
		core.setIgnoreMouse(isImmersion);
        
		// 2. 关键：设置窗口置顶状态
        // 沉浸模式 = 置顶 + 穿透
        // 普通模式 = 不置顶 + 不穿透 (可以被覆盖)
		core.setAlwaysOnTop(isImmersion);
        
		// 3. 通知前端隐藏地址栏
		core.sendToRenderer("toggle-immersion-ui", isImmersion);
	},
};