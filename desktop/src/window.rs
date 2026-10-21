use tauri::Manager;

/// Shrinks the main window to the monitor's work area when the configured size does not fit
/// (a 1280x800 window on a 1366x768 laptop is taller than the space above the taskbar) and
/// centres it inside that work area.
pub fn fit_main_window_to_work_area<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let Ok(Some(monitor)) = window.current_monitor() else {
        return;
    };
    let (Ok(outer), Ok(inner)) = (window.outer_size(), window.inner_size()) else {
        return;
    };
    let area = monitor.work_area();
    if outer.width <= area.size.width && outer.height <= area.size.height {
        return;
    }
    // Keep the frame (title bar, borders) inside the work area too.
    let frame_w = outer.width.saturating_sub(inner.width);
    let frame_h = outer.height.saturating_sub(inner.height);
    let width = outer.width.min(area.size.width);
    let height = outer.height.min(area.size.height);
    let _ = window.set_size(tauri::PhysicalSize::new(
        width.saturating_sub(frame_w),
        height.saturating_sub(frame_h),
    ));
    let x = area.position.x + ((area.size.width - width) / 2) as i32;
    let y = area.position.y + ((area.size.height - height) / 2) as i32;
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

#[cfg(target_os = "macos")]
pub fn show_main_window<R: tauri::Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
