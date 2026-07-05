use std::ffi::c_void;
use std::mem::{size_of, zeroed};
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::{HWND, RECT};
use windows_sys::Win32::Graphics::Dwm::{DWMWA_CLOAKED, DwmGetWindowAttribute};
use windows_sys::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MONITOR_DEFAULTTONEAREST, MONITORINFO, MonitorFromWindow,
};
use windows_sys::Win32::UI::WindowsAndMessaging::{
    GW_HWNDNEXT, GW_OWNER, GWL_EXSTYLE, GWL_STYLE, GetTopWindow, GetWindow, GetWindowLongW,
    GetWindowRect, GetWindowThreadProcessId, IsIconic, IsWindowVisible, SW_SHOW,
    SetForegroundWindow, ShowWindow, WS_CAPTION, WS_EX_APPWINDOW, WS_EX_TOOLWINDOW, WS_THICKFRAME,
};

const WINDOW_RECT_TOLERANCE: i32 = 6;

pub fn run(flux_process_id: u32) {
    let current_process_id = std::process::id();
    let mut hwnd = unsafe { GetTopWindow(null_mut()) };

    while !hwnd.is_null() {
        if is_taskbar_candidate(hwnd, flux_process_id, current_process_id) {
            if is_borderless(hwnd) && covers_monitor(hwnd) {
                unsafe {
                    ShowWindow(hwnd, SW_SHOW);
                    SetForegroundWindow(hwnd);
                }
            }
            break;
        }

        hwnd = unsafe { GetWindow(hwnd, GW_HWNDNEXT) };
    }
}

fn is_taskbar_candidate(hwnd: HWND, flux_process_id: u32, current_process_id: u32) -> bool {
    if !is_window_eligible(hwnd) {
        return false;
    }

    let window_process_id = get_window_process_id(hwnd);
    if window_process_id == 0
        || window_process_id == flux_process_id
        || window_process_id == current_process_id
    {
        return false;
    }

    is_taskbar_window(hwnd)
}

fn is_window_eligible(hwnd: HWND) -> bool {
    unsafe { IsWindowVisible(hwnd) != 0 && IsIconic(hwnd) == 0 && !is_window_cloaked(hwnd) }
}

fn is_window_cloaked(hwnd: HWND) -> bool {
    let mut cloaked: u32 = 0;
    let result = unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED as u32,
            &mut cloaked as *mut u32 as *mut c_void,
            size_of::<u32>() as u32,
        )
    };

    result == 0 && cloaked != 0
}

fn get_window_process_id(hwnd: HWND) -> u32 {
    let mut process_id = 0_u32;
    unsafe {
        GetWindowThreadProcessId(hwnd, &mut process_id);
    }
    process_id
}

fn is_taskbar_window(hwnd: HWND) -> bool {
    let ex_style = unsafe { GetWindowLongW(hwnd, GWL_EXSTYLE) as u32 };
    let owner = unsafe { GetWindow(hwnd, GW_OWNER) };
    let is_tool_window = (ex_style & WS_EX_TOOLWINDOW) != 0;
    let is_app_window = (ex_style & WS_EX_APPWINDOW) != 0;

    !is_tool_window && (owner.is_null() || is_app_window)
}

fn is_borderless(hwnd: HWND) -> bool {
    let style = unsafe { GetWindowLongW(hwnd, GWL_STYLE) as u32 };
    (style & (WS_CAPTION | WS_THICKFRAME)) == 0
}

fn covers_monitor(hwnd: HWND) -> bool {
    let mut window_rect: RECT = unsafe { zeroed() };
    let has_rect = unsafe { GetWindowRect(hwnd, &mut window_rect) != 0 };
    if !has_rect {
        return false;
    }

    let monitor = unsafe { MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_null() {
        return false;
    }

    let mut monitor_info: MONITORINFO = unsafe { zeroed() };
    monitor_info.cbSize = size_of::<MONITORINFO>() as u32;
    let has_monitor = unsafe { GetMonitorInfoW(monitor, &mut monitor_info) != 0 };
    if !has_monitor {
        return false;
    }

    rect_covers_target(&window_rect, &monitor_info.rcMonitor)
        || rect_covers_target(&window_rect, &monitor_info.rcWork)
}

fn rect_covers_target(rect: &RECT, target: &RECT) -> bool {
    (rect.left - target.left).abs() <= WINDOW_RECT_TOLERANCE
        && (rect.top - target.top).abs() <= WINDOW_RECT_TOLERANCE
        && (rect.right - target.right).abs() <= WINDOW_RECT_TOLERANCE
        && (rect.bottom - target.bottom).abs() <= WINDOW_RECT_TOLERANCE
}
