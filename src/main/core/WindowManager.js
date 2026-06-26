const { BrowserWindow, screen, app } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const configManager = require("../ConfigManager");

const FOCUS_BORDERLESS_MAXIMIZED_WINDOW_SCRIPT = `
$signature = @'
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class NativeWindow {
	[StructLayout(LayoutKind.Sequential)]
	public struct RECT {
		public int Left;
		public int Top;
		public int Right;
		public int Bottom;
	}

	[StructLayout(LayoutKind.Sequential)]
	public class MONITORINFO {
		public int cbSize = Marshal.SizeOf(typeof(MONITORINFO));
		public RECT rcMonitor;
		public RECT rcWork;
		public int dwFlags;
	}

	[DllImport("user32.dll")]
	public static extern IntPtr GetTopWindow(IntPtr hWnd);

	[DllImport("user32.dll")]
	public static extern IntPtr GetWindow(IntPtr hWnd, uint uCmd);

	[DllImport("user32.dll")]
	public static extern bool IsWindowVisible(IntPtr hWnd);

	[DllImport("user32.dll")]
	public static extern bool IsIconic(IntPtr hWnd);

	[DllImport("user32.dll", SetLastError = true)]
	public static extern int GetWindowLong(IntPtr hWnd, int nIndex);

	[DllImport("user32.dll")]
	public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

	[DllImport("user32.dll")]
	public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

	[DllImport("user32.dll")]
	public static extern IntPtr MonitorFromWindow(IntPtr hwnd, uint dwFlags);

	[DllImport("user32.dll", CharSet = CharSet.Auto)]
	public static extern bool GetMonitorInfo(IntPtr hMonitor, MONITORINFO lpmi);

	[DllImport("user32.dll")]
	public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

	[DllImport("user32.dll")]
	public static extern bool SetForegroundWindow(IntPtr hWnd);

	[DllImport("dwmapi.dll")]
	public static extern int DwmGetWindowAttribute(IntPtr hwnd, int dwAttribute, out int pvAttribute, int cbAttribute);
}
'@

Add-Type -TypeDefinition $signature

$fluxProcessId = ${process.pid}
$GW_HWNDNEXT = 2
$GW_OWNER = 4
$GWL_STYLE = -16
$GWL_EXSTYLE = -20
$WS_CAPTION = 0x00C00000
$WS_THICKFRAME = 0x00040000
$WS_EX_TOOLWINDOW = 0x00000080
$WS_EX_APPWINDOW = 0x00040000
$DWMWA_CLOAKED = 14
$MONITOR_DEFAULTTONEAREST = 2
$SW_SHOW = 5
$tolerance = 6

function Test-RectCoversTarget($rect, $target) {
	return (
		[Math]::Abs($rect.Left - $target.Left) -le $tolerance -and
		[Math]::Abs($rect.Top - $target.Top) -le $tolerance -and
		[Math]::Abs($rect.Right - $target.Right) -le $tolerance -and
		[Math]::Abs($rect.Bottom - $target.Bottom) -le $tolerance
	)
}

function Test-WindowIsCloaked($hwnd) {
	$cloaked = 0
	$result = [NativeWindow]::DwmGetWindowAttribute(
		$hwnd,
		$DWMWA_CLOAKED,
		[ref]$cloaked,
		[Runtime.InteropServices.Marshal]::SizeOf([int])
	)
	return $result -eq 0 -and $cloaked -ne 0
}

$hwnd = [NativeWindow]::GetTopWindow([IntPtr]::Zero)

while ($hwnd -ne [IntPtr]::Zero) {
	if ([NativeWindow]::IsWindowVisible($hwnd) -and -not [NativeWindow]::IsIconic($hwnd) -and -not (Test-WindowIsCloaked $hwnd)) {
		[uint32]$windowProcessId = 0
		[void][NativeWindow]::GetWindowThreadProcessId($hwnd, [ref]$windowProcessId)

		if ($windowProcessId -ne $fluxProcessId -and $windowProcessId -ne $PID) {
			$style = [NativeWindow]::GetWindowLong($hwnd, $GWL_STYLE)
			$exStyle = [NativeWindow]::GetWindowLong($hwnd, $GWL_EXSTYLE)
			$owner = [NativeWindow]::GetWindow($hwnd, $GW_OWNER)
			$isToolWindow = ($exStyle -band $WS_EX_TOOLWINDOW) -ne 0
			$isAppWindow = ($exStyle -band $WS_EX_APPWINDOW) -ne 0
			$isTaskbarWindow = -not $isToolWindow -and ($owner -eq [IntPtr]::Zero -or $isAppWindow)
			$isBorderless = ($style -band ($WS_CAPTION -bor $WS_THICKFRAME)) -eq 0

			$rect = New-Object NativeWindow+RECT
			$hasRect = [NativeWindow]::GetWindowRect($hwnd, [ref]$rect)
			$monitor = [NativeWindow]::MonitorFromWindow($hwnd, $MONITOR_DEFAULTTONEAREST)
			$monitorInfo = New-Object NativeWindow+MONITORINFO
			$hasMonitor = $monitor -ne [IntPtr]::Zero -and [NativeWindow]::GetMonitorInfo($monitor, $monitorInfo)

			if ($isTaskbarWindow) {
				if (
					$isBorderless -and
					$hasRect -and
					$hasMonitor -and
					((Test-RectCoversTarget $rect $monitorInfo.rcMonitor) -or (Test-RectCoversTarget $rect $monitorInfo.rcWork))
				) {
					[void][NativeWindow]::ShowWindow($hwnd, $SW_SHOW)
					[void][NativeWindow]::SetForegroundWindow($hwnd)
				}
				exit 0
			}
		}
	}

	$hwnd = [NativeWindow]::GetWindow($hwnd, $GW_HWNDNEXT)
}
`;

class WindowManager {
	constructor() {
		this.mainWindow = null;
		this.settingsWindow = null;
		this.bookmarksWindow = null;
		this.shouldFocusMainWindowAfterSettingsClose = false;
		this.savedBounds = configManager.getBoundsConfig();
		this.userAlwaysOnTop = configManager.getAppConfig().alwaysOnTop === true;
		this.temporaryAlwaysOnTop = false;
		this.currentOpacity = this.savedBounds.opacity || 1.0;
	}

	// 创建主窗口
	createMainWindow() {
		let { x, y, width, height } = this.savedBounds;

		// 获取应用根目录
		const appPath = app.getAppPath();
		const iconPath = path.join(appPath, "resources/image/FluxBrowser-icon.ico");

		this.mainWindow = new BrowserWindow({
			x: x,
			y: y,
			width: width || 800,
			height: height || 600,
			minWidth: 40, // 最小宽度（整个窗口）
			minHeight: 80, // 最小高度：40px标题栏 + 40px Webview区域
			frame: false,
			transparent: true,
			alwaysOnTop: this.userAlwaysOnTop,
			hasShadow: false,
			icon: iconPath,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
				webviewTag: true,
				javascript: true,
			},
		});

		this.mainWindow.setMenu(null);
		this.mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));

		this.mainWindow.on("close", () => {
			this.saveWindowBounds();
			if (this.settingsWindow) this.settingsWindow.close();
		});

		// 拦截新窗口跳转
		this.mainWindow.webContents.on("did-attach-webview", (event, wc) => {
			wc.setWindowOpenHandler(({ url }) => {
				wc.loadURL(url);
				return { action: "deny" };
			});
		});

		return this.mainWindow;
	}

	// 创建设置窗口
	createSettingsWindow(parentWindow) {
		if (this.settingsWindow) {
			this.settingsWindow.focus();
			return this.settingsWindow;
		}

		// 获取应用根目录
		const appPath = app.getAppPath();
		const iconPath = path.join(appPath, "resources/image/FluxBrowser-icon.ico");

		// 获取屏幕尺寸
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width: screenWidth, height: screenHeight } =
			primaryDisplay.workAreaSize;

		// 计算窗口居中位置
		const windowWidth = 800;
		const windowHeight = 600;
		const x = Math.round((screenWidth - windowWidth) / 2);
		const y = Math.round((screenHeight - windowHeight) / 2);

		this.settingsWindow = new BrowserWindow({
			x: x,
			y: y,
			width: windowWidth,
			height: windowHeight,
			minWidth: 700,
			minHeight: 500,
			parent: parentWindow,
			title: "FluxBrowser 设置",
			icon: iconPath,
			backgroundColor: "#1e1e1e",
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		this.settingsWindow.setMenu(null);
		this.settingsWindow.loadFile(
			path.join(__dirname, "../../renderer/settings.html"),
		);

		this.settingsWindow.on("closed", () => {
			this.settingsWindow = null;
			if (this.shouldFocusMainWindowAfterSettingsClose) {
				this.shouldFocusMainWindowAfterSettingsClose = false;
				setTimeout(() => this.bringMainWindowToFront(), 0);
			}
		});

		return this.settingsWindow;
	}

	// 保存窗口尺寸和位置
	saveWindowBounds() {
		if (this.mainWindow) {
			const bounds = this.mainWindow.getBounds();
			configManager.saveBoundsConfig(bounds);
		}
	}

	// 获取主窗口
	getMainWindow() {
		return this.mainWindow;
	}

	// 获取设置窗口
	getSettingsWindow() {
		return this.settingsWindow;
	}

	// 切换窗口显示状态
	toggleVisibility() {
		if (!this.mainWindow) return;
		this.mainWindow.isVisible()
			? this.mainWindow.hide()
			: this.mainWindow.show();
	}

	// 设置窗口置顶状态
	setAlwaysOnTop(flag) {
		this.temporaryAlwaysOnTop = flag === true;
		this.applyAlwaysOnTop();
	}

	// 设置用户配置的窗口置顶状态
	setUserAlwaysOnTop(flag) {
		this.userAlwaysOnTop = flag === true;
		this.applyAlwaysOnTop();
	}

	// 应用最终置顶状态
	applyAlwaysOnTop() {
		if (this.mainWindow) {
			const shouldAlwaysOnTop = this.userAlwaysOnTop || this.temporaryAlwaysOnTop;
			this.mainWindow.setAlwaysOnTop(shouldAlwaysOnTop, "screen-saver");
		}
	}

	// 设置鼠标穿透
	setIgnoreMouseEvents(ignore) {
		if (this.mainWindow) {
			this.mainWindow.setIgnoreMouseEvents(ignore, { forward: ignore });
		}
	}

	// 设置主窗口是否可聚焦
	setFocusable(focusable) {
		if (this.mainWindow) {
			this.mainWindow.setFocusable(focusable);
		}
	}

	// 聚焦前台可见、任务栏可选、无边框最大化的应用窗口
	focusBorderlessMaximizedApp() {
		if (process.platform !== "win32") return;

		execFile(
			"powershell.exe",
			[
				"-NoProfile",
				"-ExecutionPolicy",
				"Bypass",
				"-Command",
				FOCUS_BORDERLESS_MAXIMIZED_WINDOW_SCRIPT,
			],
			{ windowsHide: true },
			() => {},
		);
	}

	// 设置窗口大小
	setWindowSize(width, height, titleBarHeight = 40) {
		if (this.mainWindow) {
			const currentBounds = this.mainWindow.getBounds();
			this.mainWindow.setBounds({
				x: currentBounds.x,
				y: currentBounds.y,
				width: width,
				height: height + titleBarHeight,
			});
		}
	}

	// 获取所有窗口
	getAllWindows() {
		const windows = [];
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			windows.push(this.mainWindow);
		}
		if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
			windows.push(this.settingsWindow);
		}
		return windows;
	}

	// 关闭设置窗口
	closeSettingsWindow() {
		if (this.settingsWindow) {
			this.settingsWindow.close();
			this.settingsWindow = null;
		}
	}

	// 标记设置窗口保存关闭后需要聚焦主窗口
	focusMainWindowAfterSettingsClose() {
		this.shouldFocusMainWindowAfterSettingsClose = true;
	}

	// 将主窗口带到前台
	bringMainWindowToFront() {
		if (!this.mainWindow || this.mainWindow.isDestroyed()) return;

		if (this.mainWindow.isMinimized()) {
			this.mainWindow.restore();
		}
		if (!this.mainWindow.isVisible()) {
			this.mainWindow.show();
		}

		if (typeof this.mainWindow.moveTop === "function") {
			this.mainWindow.moveTop();
		}

		if (!this.mainWindow.isAlwaysOnTop()) {
			this.mainWindow.setAlwaysOnTop(true, "screen-saver");
			this.applyAlwaysOnTop();
		}

		this.mainWindow.focus();
	}

	// 创建书签窗口
	createBookmarksWindow(parentWindow) {
		if (this.bookmarksWindow) {
			this.bookmarksWindow.focus();
			return this.bookmarksWindow;
		}

		const appPath = app.getAppPath();
		const iconPath = path.join(appPath, "resources/image/FluxBrowser-icon.ico");

		// 获取屏幕尺寸
		const primaryDisplay = screen.getPrimaryDisplay();
		const { width: screenWidth, height: screenHeight } =
			primaryDisplay.workAreaSize;

		// 计算窗口居中位置
		const windowWidth = 600;
		const windowHeight = 400;
		const x = Math.round((screenWidth - windowWidth) / 2);
		const y = Math.round((screenHeight - windowHeight) / 2);

		this.bookmarksWindow = new BrowserWindow({
			x: x,
			y: y,
			width: windowWidth,
			height: windowHeight,
			parent: parentWindow,
			title: "书签管理",
			icon: iconPath,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		this.bookmarksWindow.setMenu(null);
		this.bookmarksWindow.loadFile(
			path.join(__dirname, "../../renderer/bookmarks.html"),
		);

		this.bookmarksWindow.on("closed", () => {
			this.bookmarksWindow = null;
		});

		return this.bookmarksWindow;
	}
}

module.exports = WindowManager;
