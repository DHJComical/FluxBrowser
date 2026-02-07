let isImmersion = false;

export const name = 'ImmersionMode';
export const shortcuts = {
    'Alt+W': (core) => {
        isImmersion = !isImmersion;
        // 设置后端窗口穿透
        core.setIgnoreMouse(isImmersion);
        // 通知前端隐藏地址栏
        core.sendToRenderer('toggle-immersion-ui', isImmersion);
    }
};