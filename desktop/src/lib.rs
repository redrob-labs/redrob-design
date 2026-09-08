mod credentials;
mod fig_container;
mod fonts;
mod http;
mod menu;
mod menu_events;
#[cfg(target_os = "macos")]
mod window;

use credentials::{
    credential_read, credential_remove, credential_status, credential_store_availability,
    credential_write,
};
use fig_container::build_fig_file;
use fonts::{list_system_fonts, load_system_font};
use http::proxy_http_request;
use menu::{install_app_menu, native_menu_checked, set_native_menu_checked};
use menu_events::handle_menu_event;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;
#[cfg(target_os = "macos")]
use window::show_main_window;

#[derive(Clone, serde::Serialize)]
struct PendingOpenFile {
    path: String,
}

struct PendingOpen(Mutex<Vec<PendingOpenFile>>);

#[tauri::command]
fn take_pending_open(state: tauri::State<PendingOpen>) -> Vec<PendingOpenFile> {
    state
        .0
        .lock()
        .map(|mut pending| pending.drain(..).collect())
        .unwrap_or_default()
}

#[tauri::command]
fn set_recent_files(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    install_app_menu(&app, &paths).map_err(|error| error.to_string())
}

#[tauri::command]
fn mcp_executable_available() -> bool {
    which::which("redrob-design-mcp-http").is_ok()
}

fn file_association_path(path: PathBuf) -> Option<PathBuf> {
    let path = path.canonicalize().ok()?;
    if !path.is_file() {
        return None;
    }
    let ext = path.extension()?.to_string_lossy().to_lowercase();
    matches!(ext.as_str(), "fig" | "pen").then_some(path)
}

fn path_from_arg(arg: String, cwd: &Path) -> Option<PathBuf> {
    if arg.starts_with('-') {
        return None;
    }

    if let Ok(url) = tauri::Url::parse(&arg) {
        if let Ok(path) = url.to_file_path() {
            return Some(path);
        }
    }

    let path = PathBuf::from(arg);
    Some(if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    })
}

fn open_paths_from_args(args: Vec<String>, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .filter_map(|arg| path_from_arg(arg, cwd))
        .filter_map(file_association_path)
        .collect()
}

fn queue_open_paths<R: tauri::Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
    let files = paths
        .into_iter()
        .filter_map(|path| {
            let _ = app.fs_scope().allow_file(&path);
            Some(PendingOpenFile {
                path: path.to_string_lossy().into_owned(),
            })
        })
        .collect::<Vec<_>>();

    if files.is_empty() {
        return;
    }

    if let Ok(mut pending) = app.state::<PendingOpen>().0.lock() {
        pending.extend(files);
    }

    let _ = app.emit("open-associated-files", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

fn startup_open_paths() -> Vec<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    open_paths_from_args(std::env::args().skip(1).collect(), &cwd)
}

/// Whether the bundled configuration carries a `plugins.updater` section.
///
/// `tauri_plugin_updater` deserializes that section while it initializes and
/// aborts app startup when it is missing, so registration and configuration have
/// to agree. Keeping the decision in one place means adding the section is the
/// only step needed to turn in-app updates back on.
fn updater_configured(config: &tauri::Config) -> bool {
    config.plugins.0.contains_key("updater")
}

/// Lets the frontend tell "no update feed in this build" apart from a failed
/// update check, without parsing IPC error strings.
#[tauri::command]
fn updater_available(app: tauri::AppHandle) -> bool {
    updater_configured(app.config())
}

/// Imports the login shell's `PATH` so GUI launches can find user-installed CLIs
/// (agent binaries, the MCP server) that a desktop session does not inherit.
///
/// `fix_path_env::fix()` shells out to an interactive login shell. When the app is
/// started from a terminal that shell competes for the controlling TTY and
/// SIGTTIN/SIGTTOU stops the whole process group before the window ever opens. A
/// terminal launch already inherits the shell `PATH`, so the fix is only needed
/// — and only safe — when no standard stream is a TTY.
fn import_login_shell_path() {
    #[cfg(unix)]
    {
        use std::io::IsTerminal;

        if std::io::stdin().is_terminal()
            || std::io::stdout().is_terminal()
            || std::io::stderr().is_terminal()
        {
            return;
        }
    }

    let _ = fix_path_env::fix();
}

fn env_nonempty(name: &str) -> bool {
    std::env::var_os(name)
        .map(|value| !value.is_empty())
        .unwrap_or(false)
}

/// Cloud / host shells often export `REDROB_KEY` while Redrob Code only reads
/// `REDROB_API_KEY`. Copy the alias into the canonical name once at startup so
/// ACP children that inherit the host environment can authenticate.
fn propagate_redrob_api_key_from_alias() {
    if env_nonempty("REDROB_API_KEY") {
        return;
    }
    let Some(key) = std::env::var_os("REDROB_KEY").filter(|value| !value.is_empty()) else {
        return;
    };
    // SAFETY: process startup, before the Tauri runtime spawns worker threads that
    // read auth env for ACP. We only set when the canonical key is absent.
    unsafe { std::env::set_var("REDROB_API_KEY", key) };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    import_login_shell_path();
    propagate_redrob_api_key_from_alias();

    let context = tauri::generate_context!();
    let mut builder = tauri::Builder::default();

    #[cfg(feature = "native-test")]
    {
        builder = builder.plugin(tauri_plugin_wdio_webdriver::init());
    }

    #[cfg(all(
        any(target_os = "macos", windows, target_os = "linux"),
        not(feature = "native-test")
    ))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            queue_open_paths(app, open_paths_from_args(args, Path::new(&cwd)));
        }));
    }

    if updater_configured(context.config()) {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .manage(PendingOpen(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            build_fig_file,
            credential_read,
            credential_remove,
            credential_status,
            credential_store_availability,
            credential_write,
            mcp_executable_available,
            list_system_fonts,
            load_system_font,
            proxy_http_request,
            set_recent_files,
            native_menu_checked,
            set_native_menu_checked,
            take_pending_open,
            updater_available
        ])
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id().0.as_str());
        })
        .setup(|app| {
            queue_open_paths(app.handle(), startup_open_paths());
            Ok(install_app_menu(app.handle(), &[])?)
        })
        .build(context)
        .expect("error while building tauri application")
        .run(|_app, event| match event {
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(file_association_path)
                    .collect();
                queue_open_paths(_app, paths);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                if !has_visible_windows {
                    show_main_window(_app);
                }
            }
            _ => {}
        });
}
