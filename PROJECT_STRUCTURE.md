# FluxBrowser 项目结构（优化后）

## 目录结构

```
FluxBrowser/
├── package.json              # 项目配置和依赖
├── package-lock.json         # 依赖锁文件
├── README.md                 # 项目说明文档
├── LICENSE                   # 许可证文件
├── .gitignore               # Git忽略文件
├── .npmrc                   # NPM配置
├── .gitattributes           # Git属性配置
├── PROJECT_STRUCTURE.md     # 项目结构文档（本文件）
│
├── resources/               # 静态资源
│   └── image/              # 图片资源
│       ├── FluxBrowser-icon.ico
│       └── FluxBrowser-icon.psd
│
├── src/                     # 源代码
│   ├── main/               # 主进程代码
│   │   ├── core/           # 核心模块（重构后）
│   │   │   ├── WindowManager.js    # 窗口管理
│   │   │   ├── IPCManager.js       # IPC通信管理
│   │   │   └── ShortcutManager.js  # 快捷键管理
│   │   │
│   │   ├── ConfigManager.js        # 配置管理
│   │   ├── FluxCore.js             # 核心入口（重构后）
│   │   ├── Logger.js               # 日志系统
│   │   ├── main.js                 # 应用入口
│   │   ├── PluginLoader.js         # 插件加载器
│   │   └── Updater.js              # 更新器
│   │
│   ├── plugins/            # 插件系统
│   │   ├── boss-key.js     # 老板键插件
│   │   ├── immersion.js    # 沉浸模式插件
│   │   ├── opacity.js      # 透明度控制插件
│   │   ├── video-ctrl.js   # 视频控制插件
│   │   └── web-nav.js      # 网页导航插件
│   │
│   ├── renderer/           # 渲染进程代码
│   │   ├── css/           # 样式文件
│   │   │   ├── style.css          # 主样式
│   │   │   └── settings.css       # 设置页面样式
│   │   │
│   │   ├── js/            # JavaScript文件
│   │   │   ├── client.js          # 主页面逻辑
│   │   │   └── settings.js        # 设置页面逻辑
│   │   │
│   │   ├── assets/        # 渲染进程静态资源
│   │   │
│   │   ├── index.html     # 主页面
│   │   └── settings.html  # 设置页面
│   │
│   ├── assets/            # 通用静态资源（新）
│   ├── utils/             # 工具函数（新）
│   └── constants/         # 常量定义（新）
│
└── dist/                  # 构建输出目录（由electron-builder生成）
```

## 架构说明

### 1. 主进程架构（重构后）

**核心模块化设计：**
- **WindowManager**: 负责窗口的创建、管理和生命周期
- **IPCManager**: 处理所有IPC通信，模块化处理器
- **ShortcutManager**: 管理全局快捷键的注册和注销
- **FluxCore**: 协调各个管理器，提供统一接口

**优势：**
- 单一职责原则：每个模块只负责一个功能
- 更好的可测试性：模块之间解耦
- 易于维护：代码更清晰，逻辑更简单

### 2. 插件系统

插件位于 `src/plugins/` 目录，每个插件导出：
- `name`: 插件名称
- `shortcuts`: 快捷键映射（功能ID → 处理函数）
- 可选的 `initialize` 或 `init` 方法

### 3. 渲染进程结构

**优化后的组织：**
- `css/`: 所有样式文件
- `js/`: 所有JavaScript文件
- `assets/`: 渲染进程专用的静态资源
- HTML文件保持在根目录，引用子目录中的资源

### 4. 新增目录

- `src/assets/`: 用于存放项目通用的静态资源
- `src/utils/`: 工具函数库，可共享的辅助函数
- `src/constants/`: 常量定义，如配置键名、默认值等

## 开发指南

### 添加新插件

1. 在 `src/plugins/` 目录下创建新的插件文件
2. 遵循插件接口规范：
   ```javascript
   module.exports = {
     name: "插件名称",
     shortcuts: {
       "功能ID": (core) => {
         // 处理函数
       }
     },
     initialize(core) {
       // 可选的初始化逻辑
     }
   };
   ```
3. 在 `PluginLoader.js` 的 `loadAll()` 方法中添加对新插件的引用

### 添加新工具函数

1. 在 `src/utils/` 目录下创建工具模块
2. 导出可重用的函数
3. 在主进程或渲染进程中按需引入

### 添加新常量

1. 在 `src/constants/` 目录下创建常量文件
2. 导出项目中使用到的常量
3. 避免在代码中硬编码字符串或数字

## 构建和运行

```bash
# 安装依赖
npm install

# 开发模式运行
npm start

# 构建应用
npm run build
```

## 代码规范

1. 使用 CommonJS 模块系统（require/exports）
2. 遵循现有的代码风格（2空格缩进）
3. 添加适当的注释，特别是复杂逻辑
4. 保持模块的单一职责

## 后续优化建议

1. 添加 TypeScript 支持以获得更好的类型安全
2. 引入单元测试框架（如 Jest）
3. 添加代码格式化工具（如 Prettier）
4. 添加代码检查工具（如 ESLint）
5. 考虑将插件系统改为动态加载，支持热插拔
