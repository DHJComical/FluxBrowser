const { execFile } = require("child_process");
const {
	resolveNativeBinaryPath,
} = require("../native/resolveNativeBinaryPath");

const NATIVE_BINARY_NAME =
	process.platform === "win32" ? "flux-native.exe" : "flux-native";
let nativeFallbackWarningShown = false;

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

function showNativeFallbackWarning(reason) {
	if (nativeFallbackWarningShown) return;
	nativeFallbackWarningShown = true;
	console.warn(
		`FluxBrowser native focus helper unavailable, falling back to PowerShell. ${reason}`,
	);
}

function logFocusHelperBackend(message) {
	console.info(`[WindowFocusHelper] ${message}`);
}

function runPowerShellFocusScript() {
	logFocusHelperBackend("Invoking focus helper via PowerShell");
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

function focusBorderlessMaximizedApp() {
	if (process.platform !== "win32") return;

	const nativeBinaryPath = resolveNativeBinaryPath(NATIVE_BINARY_NAME);
	if (!nativeBinaryPath) {
		runPowerShellFocusScript();
		return;
	}

	logFocusHelperBackend(`Invoking focus helper via Rust: ${nativeBinaryPath}`);
	execFile(
		nativeBinaryPath,
		["focus-borderless-maximized", String(process.pid)],
		{ windowsHide: true },
		(error) => {
			if (!error) return;
			showNativeFallbackWarning(error.message);
			runPowerShellFocusScript();
		},
	);
}

function bringWindowToFront(window) {
	if (!window || window.isDestroyed()) return;

	if (window.isMinimized()) {
		window.restore();
	}
	if (!window.isVisible()) {
		window.show();
	}
	if (typeof window.moveTop === "function") {
		window.moveTop();
	}
	if (!window.isAlwaysOnTop()) {
		window.setAlwaysOnTop(true, "screen-saver");
	}
	window.focus();
}

module.exports = {
	focusBorderlessMaximizedApp,
	bringWindowToFront,
};
