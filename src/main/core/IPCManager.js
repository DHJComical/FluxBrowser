const { ipcMain, globalShortcut, app } = require("electron");
const configManager = require("../ConfigManager");

class IPCManager {
	constructor(windowManager, pluginLoader, logger) {
		this.windowManager = windowManager;
		this.pluginLoader = pluginLoader;
		this.logger = logger;
		// 从配置加载透明度
		const boundsConfig = configManager.getBoundsConfig();
		this.currentOpacity = boundsConfig.opacity || 1.0;
	}

	// 初始化所有IPC处理器
	setupAllHandlers() {
		this.setupWindowHandlers();
		this.setupConfigHandlers();
		this.setupShortcutHandlers();
		this.setupAppHandlers();
		this.setupResizeHandlers();
		this.setupMoveHandlers();
		this.setupBookmarkHandlers();
	}

	// 窗口相关处理器
	setupWindowHandlers() {
		// 打开设置窗口
		ipcMain.on("open-settings", () => {
			const mainWindow = this.windowManager.getMainWindow();
			if (mainWindow) {
				this.windowManager.createSettingsWindow(mainWindow);
			}
		});

		// 设置鼠标穿透
		ipcMain.on("set-ignore-mouse", (e, ignore) => {
			this.windowManager.setIgnoreMouseEvents(ignore);
		});

		// 设置窗口大小
		ipcMain.on("set-window-size", (e, { width, height }) => {
			this.windowManager.setWindowSize(width, height);
			this.logger.debug(
				`窗口分辨率已设置为: ${width} × ${height} (webview区域)`,
			);
		});

		// 退出应用
		ipcMain.on("app-exit", () => {
			this.windowManager.saveWindowBounds();
			app.quit();
		});
	}

	// 配置相关处理器
	setupConfigHandlers() {
		// 获取快捷键配置
		ipcMain.handle("get-shortcuts", () => configManager.getKeyConfig());

		// 保存快捷键配置
		ipcMain.on("save-shortcuts", (e, map) => {
			configManager.saveKeyConfig(map);
			if (this.pluginLoader) {
				this.pluginLoader.reloadShortcuts();
			}
		});

		// 获取分辨率预设
		ipcMain.handle("get-resolution-presets", () => {
			const presets = configManager.getResolutionPresets();
			this.logger.debug(`IPC: 返回分辨率预设，数量: ${presets.length}`);
			return presets;
		});

		// 保存分辨率预设
		ipcMain.on("save-resolution-presets", (e, presets) => {
			this.logger.debug(`IPC: 收到保存分辨率预设请求，数量: ${presets.length}`);
			configManager.saveResolutionPresets(presets);
			this.broadcast("resolution-presets-updated");
		});

		// 获取当前透明度
		ipcMain.handle("get-opacity", () => {
			return this.currentOpacity;
		});

		// 获取应用版本号
		ipcMain.handle("get-app-version", () => {
			return app.getVersion();
		});

		// 获取调试模式状态
		ipcMain.handle("get-debug-mode", () => {
			return configManager.isDebugMode();
		});

		// 设置调试模式状态
		ipcMain.on("set-debug-mode", (e, enabled) => {
			configManager.saveAppConfig({ debugMode: enabled });
			if (this.logger && this.logger.setDebugMode) {
				this.logger.setDebugMode(enabled);
			}
		});

		ipcMain.on("save-app-config", (e, config) => {
			configManager.saveAppConfig(config);
		});

		ipcMain.handle("get-app-config", () => {
			return configManager.getAppConfig();
		});
	}

	// 快捷键相关处理器
	setupShortcutHandlers() {
		// 暂停快捷键
		ipcMain.on("suspend-shortcuts", () => globalShortcut.unregisterAll());

		// 恢复快捷键
		ipcMain.on("resume-shortcuts", () => {
			if (this.pluginLoader) {
				this.pluginLoader.reloadShortcuts();
			}
		});
	}

	// 应用相关处理器
	setupAppHandlers() {
		// 清理缓存
		ipcMain.on("clear-cache", (e, options) => {
			this.logger.debug("开始清理缓存...");
			this.logger.debug(`清理选项: ${JSON.stringify(options)}`);

			// 清理日志文件
			if (options.clearLogs && this.logger.clearLogFiles) {
				this.logger.debug("正在清理日志文件...");
				this.logger.clearLogFiles();
			}

			// 重置配置文件
			if (options.clearKeyConfig) {
				this.logger.debug("正在重置快捷键配置...");
				configManager.saveKeyConfig(configManager.DEFAULT_KEY_CONFIG);
			}

			if (options.clearWindowConfig) {
				this.logger.debug("正在重置窗口配置...");
				configManager.saveBoundsConfig(configManager.DEFAULT_BOUNDS_CONFIG);
			}

			if (options.clearAppConfig) {
				this.logger.debug("正在重置应用配置...");
				configManager.saveAppConfig(configManager.DEFAULT_APP_CONFIG);
			}

			if (options.clearResolutionPresets) {
				this.logger.debug("正在重置分辨率预设为默认值...");
				configManager.saveResolutionPresets(
					configManager.DEFAULT_RESOLUTION_PRESETS,
				);
			}

			this.logger.debug("缓存清理完成");

			// 发送清理完成消息
			this.broadcast("cache-cleared", {
				success: true,
				message: "缓存清理完成",
			});
		});

		// 重启应用
		ipcMain.on("restart-after-save", () => {
			this.logger.debug("收到重启请求，准备重启应用...");
			app.relaunch();
			app.exit(0);
		});
	}

	// 调整大小处理器
	setupResizeHandlers() {
		let resizeInterval = null;
		let isResizing = false;

		ipcMain.on("start-resizing", (event, direction) => {
			isResizing = true;
			if (resizeInterval) clearInterval(resizeInterval);

			const { screen } = require("electron");
			const mainWindow = this.windowManager.getMainWindow();
			if (!mainWindow) return;

			const startMousePos = screen.getCursorScreenPoint();
			const startBounds = mainWindow.getBounds();

			resizeInterval = setInterval(() => {
				if (!mainWindow || mainWindow.isDestroyed()) {
					clearInterval(resizeInterval);
					return;
				}

				const currentMousePos = screen.getCursorScreenPoint();
				const deltaX = currentMousePos.x - startMousePos.x;
				const deltaY = currentMousePos.y - startMousePos.y;

				let newWidth = startBounds.width;
				let newHeight = startBounds.height;

				if (direction === "right" || direction === "both") {
					newWidth = Math.max(40, startBounds.width + deltaX); // 最小宽度40
				}
				if (direction === "bottom" || direction === "both") {
					newHeight = Math.max(80, startBounds.height + deltaY); // 最小高度80（40px标题栏 + 40px Webview区域）
				}

				mainWindow.setBounds({
					x: startBounds.x,
					y: startBounds.y,
					width: newWidth,
					height: newHeight,
				});
			}, 10);
		});

		ipcMain.on("stop-resizing", () => {
			if (resizeInterval) {
				clearInterval(resizeInterval);
				resizeInterval = null;
			}

			const mainWindow = this.windowManager.getMainWindow();
			if (isResizing && mainWindow) {
				const bounds = mainWindow.getBounds();
				this.logger.debug(
					`窗口大小已调整: Width=${bounds.width}, Height=${bounds.height}`,
				);
			}
			isResizing = false;
		});
	}

	// 书签处理器
	setupBookmarkHandlers() {
		const fs = require("fs");
		const path = require("path");
		const { exec } = require("child_process");

		const getBookmarksDir = () => {
			const userDataDir = path.join(app.getPath("userData"), "bookmarks");
			if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
			return userDataDir;
		};

		const getBookmarksFileName = () => (!app.isPackaged ? "bookmarks-dev.json" : "bookmarks.json");
		const getBookmarksPath = () => path.join(getBookmarksDir(), getBookmarksFileName());

		// 执行 Git 命令的辅助函数
		// 使用 --git-dir 和 --work-tree 确保 Git 操作在指定目录下进行
		const runGitCommand = (cwd, subCmd) => {
			return new Promise((resolve, reject) => {
				const gitCmd = `git --git-dir="${path.join(cwd, ".git")}" --work-tree="${cwd}" ${subCmd}`;
				this.logger.debug(`执行 Git 命令: ${subCmd}`);
				exec(gitCmd, { cwd }, (err, stdout, stderr) => {
					if (err) {
						this.logger.debug(`Git 命令失败: ${subCmd}, 错误: ${stderr || err.message}`);
						reject(err);
					} else {
						resolve(stdout);
					}
				});
			});
		};

		// 初始化 Git 仓库
		const initGitRepo = async (cwd, config) => {
			const gitDir = path.join(cwd, ".git");
			const isNewRepo = !fs.existsSync(gitDir);

			if (isNewRepo) {
				await runGitCommand(cwd, "init");
			}

			// 设置用户信息
			await runGitCommand(cwd, `config user.name "${config.gitName || "FluxBrowser"}"`);
			await runGitCommand(cwd, `config user.email "${config.gitEmail || "fluxbrowser@example.com"}"`);
			await runGitCommand(cwd, "config credential.helper store");

			return isNewRepo;
		};

		// 设置远程仓库
		const setupRemote = async (cwd, remoteUrl) => {
			try {
				await runGitCommand(cwd, "remote remove origin");
			} catch (e) {
				// 忽略 "remote 不存在" 的错误
			}
			await runGitCommand(cwd, `remote add origin ${remoteUrl}`);
		};

		// 获取远程默认分支名（在 fetch 之后调用）
		const getRemoteDefaultBranch = async (cwd) => {
			try {
				// 首先尝试获取 main 分支
				await runGitCommand(cwd, "rev-parse --verify origin/main");
				return "main";
			} catch (e1) {
				try {
					// 如果 main 不存在，尝试 master
					await runGitCommand(cwd, "rev-parse --verify origin/master");
					return "master";
				} catch (e2) {
					// 如果都失败，尝试获取 HEAD 引用
					try {
						const output = await runGitCommand(cwd, "symbolic-ref refs/remotes/origin/HEAD");
						const match = output.match(/origin\/(\S+)/);
						if (match) return match[1];
					} catch (e3) {
						this.logger.debug("无法确定远程默认分支");
					}
					// 默认返回 main
					return "main";
				}
			}
		};

		ipcMain.on("add-bookmark", (e, bookmark) => {
			const localBookmarksPath = getBookmarksPath();
			let bookmarks = [];
			if (fs.existsSync(localBookmarksPath)) {
				try {
					bookmarks = JSON.parse(fs.readFileSync(localBookmarksPath, "utf8"));
				} catch (parseErr) {
					this.logger.debug(`解析书签文件失败: ${parseErr.message}`);
					bookmarks = [];
				}
			}
			bookmarks.push(bookmark);
			fs.writeFileSync(localBookmarksPath, JSON.stringify(bookmarks, null, 2));
			this.logger.debug("书签已保存:", bookmark.title);
		});

		ipcMain.on("sync-bookmarks", () => {
			const config = configManager.getAppConfig();
			if (!config.gitPat || !config.gitRemote) {
				this.logger.debug("Git 配置不完整，无法同步");
				this.broadcast("bookmark-sync-status", { success: false, message: "请先配置 Git 设置" });
				return;
			}

			const cwd = getBookmarksDir();
			const fileName = getBookmarksFileName();
			const bookmarksFile = path.join(cwd, fileName);

			// 检查书签文件是否存在
			if (!fs.existsSync(bookmarksFile)) {
				this.logger.debug("书签文件不存在，无法同步");
				this.broadcast("bookmark-sync-status", { success: false, message: "书签文件不存在" });
				return;
			}

			// 构建远程 URL
			const remoteUrl = `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;

			// 广播开始状态
			this.broadcast("bookmark-sync-status", { status: "syncing", message: "正在同步..." });

			(async () => {
				try {
					// 初始化 Git 仓库
					await initGitRepo(cwd, config);

					// 设置远程仓库
					await setupRemote(cwd, remoteUrl);

					// 添加文件到暂存区
					await runGitCommand(cwd, `add -f "${fileName}"`);

					// 检查是否有变更需要提交
					const status = await runGitCommand(cwd, "status --porcelain");
					if (status.trim()) {
						// 有变更，提交并推送
						await runGitCommand(cwd, 'commit -m "Update bookmarks"');
						await runGitCommand(cwd, "push -u origin HEAD");
						this.logger.debug("Git 同步成功");
						this.broadcast("bookmark-sync-status", { success: true, message: "同步成功" });
					} else {
						this.logger.debug("没有变更需要同步");
						this.broadcast("bookmark-sync-status", { success: true, message: "没有变更需要同步" });
					}
				} catch (err) {
					this.logger.debug(`Git 同步失败: ${err.message}`);
					this.broadcast("bookmark-sync-status", { success: false, message: `同步失败: ${err.message}` });
				}
			})();
		});

		ipcMain.on("pull-bookmarks", () => {
			const config = configManager.getAppConfig();
			if (!config.gitPat || !config.gitRemote) {
				this.logger.debug("Git 配置不完整，无法拉取");
				this.broadcast("bookmark-sync-status", { success: false, message: "请先配置 Git 设置" });
				return;
			}

			const cwd = getBookmarksDir();
			const remoteUrl = `https://${config.gitPat}@${config.gitRemote.replace(/^https:\/\//, "")}`;

			// 广播开始状态
			this.broadcast("bookmark-sync-status", { status: "pulling", message: "正在拉取..." });

			(async () => {
				try {
					// 初始化 Git 仓库
					await initGitRepo(cwd, config);

					// 设置远程仓库
					await setupRemote(cwd, remoteUrl);

					// 先 fetch 获取远程引用
					this.logger.debug("正在获取远程分支信息...");
					await runGitCommand(cwd, "fetch origin");

					// fetch 之后获取远程默认分支
					const defaultBranch = await getRemoteDefaultBranch(cwd);
					this.logger.debug(`远程默认分支: ${defaultBranch}`);

					// 重置到远程分支
					await runGitCommand(cwd, `reset --hard origin/${defaultBranch}`);

					this.logger.debug("Git 拉取成功");
					this.broadcast("bookmark-sync-status", { success: true, message: "拉取成功" });

					// 通知书签窗口刷新数据
					this.broadcast("bookmarks-data", (() => {
						const localBookmarksPath = path.join(cwd, getBookmarksFileName());
						if (fs.existsSync(localBookmarksPath)) {
							try {
								return JSON.parse(fs.readFileSync(localBookmarksPath, "utf8"));
							} catch (e) {
								return [];
							}
						}
						return [];
					})());
				} catch (err) {
					this.logger.debug(`Git 拉取失败: ${err.message}`);
					// 检查是否是网络错误
					if (err.message.includes("Couldn") || err.message.includes("connection") || err.message.includes("connect")) {
						this.broadcast("bookmark-sync-status", { success: false, message: "网络连接失败，请检查网络或代理设置" });
					} else {
						this.broadcast("bookmark-sync-status", { success: false, message: `拉取失败: ${err.message}` });
					}
				}
			})();
		});

		ipcMain.on("open-bookmarks-window", () => {
			this.windowManager.createBookmarksWindow(this.windowManager.getMainWindow());
		});

		ipcMain.on("get-bookmarks", (e) => {
			const localBookmarksPath = getBookmarksPath();
			let bookmarks = [];
			if (fs.existsSync(localBookmarksPath)) {
				try {
					bookmarks = JSON.parse(fs.readFileSync(localBookmarksPath, "utf8"));
				} catch (parseErr) {
					this.logger.debug(`解析书签文件失败: ${parseErr.message}`);
					bookmarks = [];
				}
			}
			// 始终发送响应，即使是空数组
			e.sender.send("bookmarks-data", bookmarks);
		});

		ipcMain.on("delete-bookmark", (e, index) => {
			const localBookmarksPath = getBookmarksPath();
			if (fs.existsSync(localBookmarksPath)) {
				let bookmarks = [];
				try {
					bookmarks = JSON.parse(fs.readFileSync(localBookmarksPath, "utf8"));
					bookmarks.splice(index, 1);
					fs.writeFileSync(localBookmarksPath, JSON.stringify(bookmarks, null, 2));
				} catch (parseErr) {
					this.logger.debug(`解析书签文件失败: ${parseErr.message}`);
				}
				e.sender.send("bookmarks-data", bookmarks);
			} else {
				e.sender.send("bookmarks-data", []);
			}
		});

		ipcMain.on("open-bookmark", (e, bookmark) => {
			const mainWindow = this.windowManager.getMainWindow();
			if (mainWindow) {
				// 转义单引号防止 XSS
				const escapedUrl = bookmark.url.replace(/'/g, "\\'");
				const escapedTime = parseFloat(bookmark.time) || 0;
				mainWindow.webContents.send("execute-webview-js", `window.location.href = '${escapedUrl}'; setTimeout(() => { const v = document.querySelector('video'); if(v) v.currentTime = ${escapedTime}; }, 2000);`);
			}
		});
	}

	// 移动处理器
	setupMoveHandlers() {
		let moveInterval = null;
		let startWindowBounds = null;

		ipcMain.on("start-moving", (event) => {
			if (moveInterval) clearInterval(moveInterval);

			const mainWindow = this.windowManager.getMainWindow();
			if (!mainWindow) return;

			const { screen } = require("electron");
			const startMousePos = screen.getCursorScreenPoint();
			startWindowBounds = mainWindow.getBounds();

			moveInterval = setInterval(() => {
				if (!mainWindow || mainWindow.isDestroyed()) {
					clearInterval(moveInterval);
					return;
				}

				const currentMousePos = screen.getCursorScreenPoint();
				const deltaX = currentMousePos.x - startMousePos.x;
				const deltaY = currentMousePos.y - startMousePos.y;

				mainWindow.setBounds({
					x: startWindowBounds.x + deltaX,
					y: startWindowBounds.y + deltaY,
					width: startWindowBounds.width,
					height: startWindowBounds.height,
				});
			}, 10);
		});

		ipcMain.on("stop-moving", () => {
			if (moveInterval) {
				clearInterval(moveInterval);
				moveInterval = null;
			}

			const mainWindow = this.windowManager.getMainWindow();
			if (mainWindow) {
				const bounds = mainWindow.getBounds();
				this.logger.debug(`窗口位置已移动: X=${bounds.x}, Y=${bounds.y}`);
			}
		});
	}

	// 广播消息到所有窗口
	broadcast(channel, data) {
		const windows = this.windowManager.getAllWindows();
		windows.forEach((win) => {
			if (win && !win.isDestroyed()) {
				win.webContents.send(channel, data);
			}
		});
	}

	// 发送消息到渲染进程
	sendToRenderer(channel, data) {
		this.broadcast(channel, data);
	}

	// 设置当前透明度
	setCurrentOpacity(opacity) {
		this.currentOpacity = opacity;
	}

	// 获取当前透明度
	getCurrentOpacity() {
		return this.currentOpacity;
	}

	// 调整透明度
	adjustOpacity(delta) {
		let newOp = parseFloat((this.currentOpacity + delta).toFixed(1));
		if (newOp > 1.0) newOp = 1.0;
		if (newOp < 0.2) newOp = 0.2;
		this.currentOpacity = newOp;
		this.broadcast("set-opacity", newOp);
		configManager.saveBoundsConfig({ opacity: newOp });
	}
}

module.exports = IPCManager;
