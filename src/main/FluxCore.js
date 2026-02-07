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
    this.setupResizeHandler();
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
  setupResizeHandler() {
    let resizeInterval;

    // 1. 开始调整
    ipcMain.on('start-resizing', () => {
      // 获取当前鼠标绝对位置 和 窗口当前大小
      const startMousePos = screen.getCursorScreenPoint();
      const startBounds = this.window.getBounds();

      // 开启一个循环，每10毫秒检查一次鼠标位置
      resizeInterval = setInterval(() => {
        if (!this.window || this.window.isDestroyed()) {
          clearInterval(resizeInterval);
          return;
        }

        const currentMousePos = screen.getCursorScreenPoint();
        
        // 计算偏移量：当前鼠标 - 初始鼠标
        const deltaX = currentMousePos.x - startMousePos.x;
        const deltaY = currentMousePos.y - startMousePos.y;

        // 新宽高 = 初始宽高 + 偏移量
        const newWidth = startBounds.width + deltaX;
        const newHeight = startBounds.height + deltaY;

        // 设置新大小 (限制最小宽度300，最小高度200，防止缩没了)
        this.window.setBounds({
          x: startBounds.x,
          y: startBounds.y,
          width: Math.max(300, newWidth),
          height: Math.max(200, newHeight)
        });
      }, 10); // 10ms 刷新率，非常丝滑
    });

        // 2. 停止调整
        ipcMain.on('stop-resizing', () => {
        if (resizeInterval) clearInterval(resizeInterval);
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