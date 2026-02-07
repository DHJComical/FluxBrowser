const { BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

class FluxCore {
  constructor() {
    this.window = null;
    this.pluginLoader = null;
  }

  // 启动核心
  launch(PluginLoaderClass) {
    this.createWindow();
    
    // 初始化插件加载器，把核心实例传给插件
    this.pluginLoader = new PluginLoaderClass(this);
    this.pluginLoader.loadAll();
  }

  createWindow() {
    this.window = new BrowserWindow({
      width: 600,
      height: 400,
      frame: false,          // 无边框
      transparent: true,     // 透明背景
      alwaysOnTop: true,     // 永远置顶
      hasShadow: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webviewTag: true     // 允许 <webview>
      }
    });

    this.window.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    // 监听前端的鼠标穿透请求（智能穿透）
    ipcMain.on('set-ignore-mouse', (e, ignore) => {
      this.setIgnoreMouse(ignore);
    });
  }

  // --- 开放给插件使用的 API ---

  // 1. 发送指令给前端 (View层)
  sendToRenderer(channel, data) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(channel, data);
    }
  }

  // 2. 控制窗口显隐
  toggleVisibility() {
    if (this.window.isVisible()) this.window.hide();
    else this.window.show();
  }

  // 3. 设置鼠标穿透 (核心技术)
  setIgnoreMouse(ignore) {
    if (this.window) {
      // forward: true 让鼠标事件能穿透到后面的窗口
      this.window.setIgnoreMouseEvents(ignore, { forward: true });
    }
  }

  // 4. 执行网页内的 JS (控制视频用)
  executeOnWebview(jsCode) {
    this.sendToRenderer('execute-webview-js', jsCode);
  }
}

module.exports = new FluxCore(); // 导出单例