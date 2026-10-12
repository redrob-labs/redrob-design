//! The work model for AI work insights, downloaded on first use.
//!
//! The release assets send no CORS headers, so the webview cannot fetch them, and the existing
//! `proxy_http_request` buffers the whole body with a 30 s timeout. `download_verified` streams to
//! disk under the app-local data directory instead; the webview then reads the files with the fs
//! plugin. All the rules live in `download.rs`, which has no Tauri types.

mod download;

use download::{FileRequest, RevisionRequest, RELEASE_POLICY};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager};

/// The event that carries download progress to the webview.
const PROGRESS_EVENT: &str = "insights-model-progress";

static DOWNLOADING: AtomicBool = AtomicBool::new(false);

struct DownloadGuard;

impl Drop for DownloadGuard {
    fn drop(&mut self) {
        DOWNLOADING.store(false, Ordering::SeqCst);
    }
}

#[derive(Deserialize)]
pub struct DownloadFile {
    name: String,
    url: String,
    sha256: String,
}

#[derive(Deserialize)]
pub struct DownloadRequest {
    revision: String,
    files: Vec<DownloadFile>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    revision: String,
    file: String,
    received: u64,
    total: Option<u64>,
}

/// Makes `<app-local-data>/models/insights/<revision>/` hold every requested file, each matching
/// its SHA-256, and returns that folder. Only GitHub release hosts are reachable.
#[tauri::command]
pub async fn download_verified<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    request: DownloadRequest,
) -> Result<String, String> {
    if DOWNLOADING.swap(true, Ordering::SeqCst) {
        return Err("a work model download is already running".into());
    }
    let _guard = DownloadGuard;

    let root = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?
        .join("models")
        .join("insights");
    std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;

    let revision = request.revision.clone();
    let core_request = RevisionRequest {
        revision: request.revision,
        files: request
            .files
            .into_iter()
            .map(|file| FileRequest {
                name: file.name,
                url: file.url,
                sha256: file.sha256.to_ascii_lowercase(),
            })
            .collect(),
    };
    let client = download::client(RELEASE_POLICY).map_err(|error| error.to_string())?;
    let directory = download::download_revision(
        &client,
        &root,
        &core_request,
        RELEASE_POLICY,
        download::available_space,
        |progress| {
            let _ = app.emit(
                PROGRESS_EVENT,
                ProgressEvent {
                    revision: revision.clone(),
                    file: progress.file,
                    received: progress.received,
                    total: progress.total,
                },
            );
        },
    )
    .await
    .map_err(|error| error.to_string())?;
    Ok(directory.to_string_lossy().into_owned())
}
