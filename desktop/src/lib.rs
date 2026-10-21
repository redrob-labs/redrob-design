mod app_bridge;
mod credentials;
mod fig_container;
mod fonts;
mod http;
mod menu;
mod menu_events;
mod oauth_loopback;
mod shared_account;
mod window;

use app_bridge::app_bridge_reply;
use credentials::{
    credential_read, credential_remove, credential_status, credential_store_availability,
    credential_write,
};
use fig_container::build_fig_file;
use fonts::{list_system_fonts, load_system_font};
use http::proxy_http_request;
use menu::{install_app_menu, native_menu_checked, set_native_menu_checked};
use menu_events::handle_menu_event;
use oauth_loopback::{
    oauth_loopback_cancel, oauth_loopback_start, oauth_loopback_wait, LoopbackListeners,
};
use shared_account::shared_account_read;
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;
use window::fit_main_window_to_work_area;
#[cfg(target_os = "macos")]
use window::show_main_window;

#[derive(Clone, serde::Serialize)]
struct PendingOpenFile {
    path: String,
}

struct PendingOpen(Mutex<Vec<PendingOpenFile>>);

/// A cloud file the launcher asked for: `--open-file <dfl_id>` and, for a view link,
/// `--open-link <fragment>`. The frontend opens it through the same path as a pasted link.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PendingCloudOpenFile {
    file_id: String,
    link: Option<String>,
}

struct PendingCloudOpen(Mutex<Vec<PendingCloudOpenFile>>);

const OPEN_FILE_FLAG: &str = "--open-file";
const OPEN_LINK_FLAG: &str = "--open-link";
const MAX_LINK_LEN: usize = 512;

fn is_cloud_file_id(value: &str) -> bool {
    value
        .strip_prefix("dfl_")
        .map(|hex| {
            hex.len() == 32
                && hex
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        })
        .unwrap_or(false)
}

fn is_link_fragment(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_LINK_LEN
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'~' | b'-'))
}

/// The value following `flag`, if any.
fn flag_value<'a>(args: &'a [String], flag: &str) -> Option<&'a str> {
    args.iter()
        .position(|arg| arg == flag)
        .and_then(|index| args.get(index + 1))
        .map(String::as_str)
}

/// `None` unless `--open-file` names a valid id. A malformed `--open-link` drops the link (the
/// file then opens with the member's own access, or not at all) rather than the whole request.
fn cloud_open_from_args(args: &[String]) -> Option<PendingCloudOpenFile> {
    let file_id = flag_value(args, OPEN_FILE_FLAG).filter(|id| is_cloud_file_id(id))?;
    let link = flag_value(args, OPEN_LINK_FLAG)
        .filter(|link| is_link_fragment(link))
        .map(str::to_owned);
    Some(PendingCloudOpenFile {
        file_id: file_id.to_owned(),
        link,
    })
}

#[tauri::command]
fn take_pending_cloud_open(state: tauri::State<PendingCloudOpen>) -> Vec<PendingCloudOpenFile> {
    state
        .0
        .lock()
        .map(|mut pending| pending.drain(..).collect())
        .unwrap_or_default()
}

fn queue_cloud_open<R: tauri::Runtime>(app: &tauri::AppHandle<R>, args: &[String]) {
    let Some(target) = cloud_open_from_args(args) else {
        return;
    };
    if let Ok(mut pending) = app.state::<PendingCloudOpen>().0.lock() {
        pending.push(target);
    }
    let _ = app.emit("open-cloud-files", ());
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_focus();
    }
}

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
    let mut skip_next = false;
    args.into_iter()
        .filter(|arg| {
            let skip = std::mem::replace(
                &mut skip_next,
                arg == OPEN_FILE_FLAG || arg == OPEN_LINK_FLAG,
            );
            !skip
        })
        .filter_map(|arg| path_from_arg(arg, cwd))
        .filter_map(file_association_path)
        .collect()
}

fn queue_open_paths<R: tauri::Runtime>(app: &tauri::AppHandle<R>, paths: Vec<PathBuf>) {
    let files = paths
        .into_iter()
        .map(|path| {
            let _ = app.fs_scope().allow_file(&path);
            PendingOpenFile {
                path: path.to_string_lossy().into_owned(),
            }
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
            queue_cloud_open(app, &args);
            queue_open_paths(app, open_paths_from_args(args, Path::new(&cwd)));
        }));
    }

    if updater_configured(context.config()) {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .manage(PendingOpen(Mutex::new(Vec::new())))
        .manage(PendingCloudOpen(Mutex::new(Vec::new())))
        .manage(app_bridge::PendingCalls::default())
        .manage(app_bridge::BridgeHandle::default())
        .manage(LoopbackListeners::default())
        .invoke_handler(tauri::generate_handler![
            app_bridge_reply,
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
            oauth_loopback_cancel,
            oauth_loopback_start,
            oauth_loopback_wait,
            set_native_menu_checked,
            shared_account_read,
            take_pending_cloud_open,
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
            queue_cloud_open(app.handle(), &std::env::args().skip(1).collect::<Vec<_>>());
            install_app_menu(app.handle(), &[])?;
            fit_main_window_to_work_area(app.handle());
            // The main window is created from the config before setup runs; the
            // bridge starts on its own thread so a missing daemon never delays it.
            app_bridge::start(app.handle());
            Ok(())
        })
        .build(context)
        .expect("error while building tauri application")
        .run(|app, event| match event {
            tauri::RunEvent::Exit => app_bridge::stop(app),
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Opened { urls } => {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .filter_map(file_association_path)
                    .collect();
                queue_open_paths(app, paths);
            }
            #[cfg(target_os = "macos")]
            tauri::RunEvent::Reopen {
                has_visible_windows,
                ..
            } => {
                if !has_visible_windows {
                    show_main_window(app);
                }
            }
            _ => {}
        });
}
