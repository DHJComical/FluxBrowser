# FluxBrowser 项目结构

本文档描述当前版本代码库的实际目录组织，以及各模块的大致职责。

## 顶层目录

```text
FluxBrowser/
├─ resources/                 图标等静态资源
├─ src/                       源代码
├─ dist/                      打包输出目录
├─ README.md                  项目说明
├─ PROJECT_STRUCTURE.md       项目结构说明
├─ LICENSE                    GPL 许可证
├─ package.json               依赖、脚本与打包配置
└─ package-lock.json          依赖锁文件
```

## `src/` 总览

```text
src/
├─ constants/                 共享常量
├─ i18n/                      国际化资源
├─ main/                      Electron 主进程
├─ plugins/                   快捷键 / 行为插件
├─ renderer/                  渲染层页面与交互
└─ utils/                     通用工具函数
```

### 目录职责

- `constants/`：集中放置配置常量、默认值和 IPC channel 名称。
- `i18n/`：放置语言入口与各语言 JSON 文案。
- `main/`：负责窗口、IPC、配置、日志、更新、同步、字幕状态等主进程能力。
- `plugins/`：负责全局快捷键映射后的具体行为实现。
- `renderer/`：负责主界面、设置页、书签页以及对应脚本和样式。
- `utils/`：放置当前仍可复用的辅助工具。

## `src/constants/`

```text
src/constants/
└─ config.js
```

- `config.js`
  - 默认快捷键
  - 默认窗口边界
  - 默认应用配置
  - 默认分辨率预设
  - IPC channel 常量
  - 其他窗口与日志相关常量

## `src/i18n/`

```text
src/i18n/
├─ index.js
└─ locales/
   ├─ en-US.json
   └─ zh-CN.json
```

- `index.js`：i18n 入口。
- `locales/`：各语言文案。

当前主进程日志、渲染层文案、设置页、菜单和提示都通过这里统一管理。

## `src/main/`

```text
src/main/
├─ config/                    配置文件读写底层
├─ core/                      主进程核心协调层
├─ ipc/                       IPC 处理器
├─ plugins/                   主进程侧插件工具
├─ services/                  业务服务
├─ updater/                   更新相关辅助模块
├─ windows/                   各 BrowserWindow 定义
├─ ConfigManager.js
├─ FluxCore.js
├─ GitSyncManager.js
├─ i18n.js
├─ Logger.js
├─ main.js
├─ PluginLoader.js
├─ TabStateManager.js
└─ Updater.js
```

### `src/main/config/`

```text
src/main/config/
├─ configPaths.js
└─ configStore.js
```

- 负责配置文件路径计算与 JSON 读写。

### `src/main/core/`

```text
src/main/core/
├─ bossKeyController.js
├─ coreLogger.js
├─ ipcContextFactory.js
├─ IPCManager.js
├─ ipcWindowOps.js
├─ launchRuntime.js
├─ ShortcutManager.js
├─ shortcutPluginOps.js
├─ shortcutUtils.js
├─ windowCollection.js
├─ windowFocusHelper.js
└─ WindowManager.js
```

这里是主进程基础设施层，主要负责：

- 主窗口 / 设置窗口 / 书签窗口的生命周期管理
- 全局快捷键注册与恢复
- IPC handler 装配
- 窗口聚焦、显示、隐藏、置顶与沉浸切换的基础控制

### `src/main/ipc/handlers/`

```text
src/main/ipc/handlers/
├─ appHandlers.js
├─ bookmarkHandlers.js
├─ configHandlers.js
├─ liveSubtitleHandlers.js
├─ shortcutHandlers.js
├─ syncHandlers.js
├─ tabHandlers.js
└─ windowHandlers.js
```

按领域拆分 IPC：

- `appHandlers.js`：应用级配置与清理相关 IPC。
- `bookmarkHandlers.js`：书签增删改查与继续观看。
- `configHandlers.js`：快捷键、应用配置、分辨率、浮窗位置等配置 IPC。
- `liveSubtitleHandlers.js`：实时字幕采集与关键字检测状态。
- `shortcutHandlers.js`：快捷键暂停/恢复等行为。
- `syncHandlers.js`：Git 同步与书签同步。
- `tabHandlers.js`：标签页创建、关闭、激活、更新、重排。
- `windowHandlers.js`：窗口打开、关闭、尺寸调整等行为。

### `src/main/plugins/`

```text
src/main/plugins/
├─ pluginRegistry.js
└─ pluginUtils.js
```

- 插件注册与辅助工具。

### `src/main/services/`

```text
src/main/services/
├─ gitSync/
│  ├─ constants.js
│  ├─ gitRuntime.js
│  ├─ gitSyncUtils.js
│  └─ syncDataStore.js
├─ BookmarkService.js
├─ BookmarkSyncService.js
├─ LiveSubtitleMonitor.js
└─ SubtitleKeywordDetector.js
```

业务服务层负责：

- `BookmarkService.js`：书签存储与继续观看脚本生成。
- `BookmarkSyncService.js`：书签上传/下载协作。
- `LiveSubtitleMonitor.js`：定时拉取网页字幕快照、维护字幕状态。
- `SubtitleKeywordDetector.js`：匹配字幕关键字并广播命中结果。
- `gitSync/`：Git 仓库初始化、远端同步、配置导出导入等。

### `src/main/updater/`

```text
src/main/updater/
├─ updaterEvents.js
└─ updaterLogger.js
```

- 更新事件绑定与日志输出辅助。

### `src/main/windows/`

```text
src/main/windows/
├─ BookmarksWindow.js
├─ MainWindow.js
├─ SettingsWindow.js
└─ windowUtils.js
```

- 对应三个窗口的构建逻辑和通用窗口工具。

### 主进程根文件

- `main.js`：Electron 入口。
- `FluxCore.js`：主进程总协调器。
- `ConfigManager.js`：配置管理统一入口。
- `Logger.js`：日志系统。
- `PluginLoader.js`：插件加载入口。
- `TabStateManager.js`：标签状态持久化与恢复。
- `Updater.js`：自动更新主入口。
- `GitSyncManager.js`：Git 同步协调入口。
- `i18n.js`：主进程国际化桥接。

## `src/plugins/`

```text
src/plugins/
├─ boss-key.js
├─ immersion.js
├─ live-subtitle.js
├─ opacity.js
├─ site-fixes.js
├─ video-ctrl.js
└─ web-nav.js
```

这些插件主要提供“快捷键功能 -> 实际执行逻辑”的映射：

- `boss-key.js`：老板键隐藏/恢复。
- `immersion.js`：沉浸模式切换。
- `live-subtitle.js`：字幕采集开关快捷键。
- `opacity.js`：透明度调节。
- `site-fixes.js`：站点脚本修正或兼容逻辑。
- `video-ctrl.js`：视频播放、快进、快退。
- `web-nav.js`：页面前进/后退。

## `src/renderer/`

```text
src/renderer/
├─ css/
│  ├─ bookmarks.css
│  ├─ settings.css
│  └─ style.css
├─ js/
│  ├─ bookmarks-page/
│  ├─ main/
│  ├─ settings-page/
│  └─ shared/
├─ bookmarks.html
├─ index.html
└─ settings.html
```

这里包含三个渲染页：

- `index.html`：主窗口页面
- `settings.html`：设置窗口
- `bookmarks.html`：书签窗口

### `src/renderer/css/`

- `style.css`：主窗口通用样式、浮窗样式、标签栏、菜单、方向指示器等。
- `settings.css`：设置页样式。
- `bookmarks.css`：书签页样式。

### `src/renderer/js/main/`

```text
src/renderer/js/main/
├─ activeTabUi.js
├─ debug.js
├─ directionIndicator.js
├─ dom.js
├─ floatingPanels.js
├─ immersion.js
├─ index.js
├─ layout.js
├─ menu.js
├─ motion.js
├─ navigation.js
├─ state.js
├─ subtitleCollector.js
├─ tabs.js
└─ webview.js
```

主要职责：

- `index.js`：主窗口渲染入口。
- `dom.js`：主窗口 DOM 引用集中管理。
- `state.js`：主窗口运行时状态。
- `navigation.js`：地址栏、前进后退刷新等导航动作。
- `menu.js`：主栏菜单与分辨率子菜单。
- `tabs.js`：WebView 标签管理、恢复、静音与启动暂停逻辑。
- `floatingPanels.js`：主栏、WebView、方向指示器的浮窗拖动/缩放/位置记忆。
- `immersion.js`：沉浸模式切换后的渲染层行为。
- `layout.js`：布局尺寸和相关联动。
- `webview.js`：WebView 事件和注入相关行为。
- `subtitleCollector.js`：从活动网页抓取字幕快照。
- `directionIndicator.js`：方向指示器渲染、控制、方向词打点。
- `motion.js`：界面动画开关的渲染层应用。
- `debug.js`：主窗口调试日志辅助。
- `activeTabUi.js`：活动标签对应 UI 状态同步。

### `src/renderer/js/settings-page/`

```text
src/renderer/js/settings-page/
├─ appConfigUtils.js
├─ constants.js
├─ debugLog.js
├─ dom.js
├─ experienceSection.js
├─ helpers.js
├─ index.js
├─ listeners.js
├─ renderers.js
├─ state.js
├─ syncSection.js
└─ systemSection.js
```

主要职责：

- `index.js`：设置页入口。
- `dom.js`：设置页 DOM 引用。
- `state.js`：设置页临时状态。
- `renderers.js`：按钮、语言下拉、预设列表等渲染。
- `listeners.js`：大部分设置页交互绑定。
- `experienceSection.js`：播放与窗口相关初始化。
- `syncSection.js`：同步区域逻辑。
- `systemSection.js`：更新、缓存清理、调试等系统项逻辑。
- `appConfigUtils.js`：应用配置读取和回填。
- `debugLog.js`：设置页日志辅助。
- `constants.js` / `helpers.js`：辅助常量和工具。

### `src/renderer/js/bookmarks-page/`

```text
src/renderer/js/bookmarks-page/
├─ dom.js
├─ helpers.js
├─ index.js
└─ renderers.js
```

- 独立处理书签窗口的 DOM、渲染、筛选、排序和交互。

### `src/renderer/js/shared/`

```text
src/renderer/js/shared/
├─ feedback.js
├─ i18n.js
└─ motion.js
```

- `feedback.js`：Toast、确认框等通用反馈 UI。
- `i18n.js`：渲染层国际化工具。
- `motion.js`：渲染层动画开关的统一应用。

### 渲染层根脚本

- `client.js`：主窗口脚本入口包装。
- `settings.js`：设置页脚本入口包装。
- `bookmarks.js`：书签页脚本入口包装。
- `tabbar.js`：独立的标签栏渲染与拖拽排序逻辑。

## `src/utils/`

```text
src/utils/
└─ helpers.js
```

- 当前主要存放通用辅助方法，例如快捷键校验等。

## 当前架构特点

### 1. 主进程与渲染层职责分离

- 主进程负责状态、窗口、快捷键、配置、同步和更新。
- 渲染层负责界面、拖拽、视觉反馈和页面内交互。

### 2. 多窗口结构清晰

- 主窗口：浏览与浮窗交互
- 设置窗口：配置与维护
- 书签窗口：继续观看与记录管理

### 3. 浮窗模型统一

主栏、WebView、方向指示器都走统一的浮窗交互模型，便于后续继续扩展新的浮动组件。

### 4. 插件式快捷键行为

快捷键注册与具体行为解耦，后续增加新的快捷键功能时，优先考虑在 `src/plugins/` 内扩展。

### 5. 文案与日志统一走 i18n

界面文案、提示和大部分日志已经统一接入国际化资源，后续新增文本应优先补语言键，而不是直接写死原文。

## 开发建议

### 新增主进程功能

- 优先判断属于 `core`、`services`、`ipc/handlers` 还是 `windows`。
- 不要把业务逻辑直接堆进 `main.js`。

### 新增渲染层功能

- 主窗口放在 `src/renderer/js/main/`
- 设置页放在 `src/renderer/js/settings-page/`
- 书签页放在 `src/renderer/js/bookmarks-page/`
- 多页面复用逻辑放在 `src/renderer/js/shared/`

### 新增文本

- 先加 i18n key
- 再在 `zh-CN.json` 和 `en-US.json` 中补文案
- 避免直接依赖原文匹配

### 新增快捷键能力

- 常量与默认键位更新到 `src/constants/config.js`
- 执行逻辑优先放到 `src/plugins/`
- IPC 或主渲染联动按需要分别接入
