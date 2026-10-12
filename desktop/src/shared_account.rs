//! Redrob Launcher's shared sign-in, read by this app as a fallback.
//!
//! The launcher signs a computer in once and writes the workspace key to one file every
//! Redrob app may read (see redrob-launcher `docs/shared-account.md`). This module only
//! ever reads that file: it never writes or deletes it, and the app's own "Clear key"
//! leaves it alone. The renderer cannot see environment variables, so the path is
//! resolved here, where `REDROB_SHARED_DIR` and `XDG_CONFIG_HOME` are visible.
//!
//! The file is read every time the command is called -- the person may sign in or out of
//! the launcher while this app runs -- and the key is returned to the renderer only;
//! nothing here logs or prints it.

use std::{
    env,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

const ACCOUNT_FILE: &str = "account.json";

/// What the launcher wrote, in the renderer's `DeviceKey` spelling.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedAccount {
    pub api_key: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub api_key_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub account_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "apiBaseURL")]
    pub api_base_url: Option<String>,
}

/// The launcher's file, as written. Every field is optional at the boundary.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SharedAccountFile {
    api_key: Option<String>,
    api_key_name: Option<String>,
    account_name: Option<String>,
    api_base_url: Option<String>,
}

fn env_dir(name: &str) -> Option<PathBuf> {
    env::var_os(name)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
}

/// Where the launcher keeps the shared account, or `None` when no home can be found.
///
/// `REDROB_SHARED_DIR` replaces the directory on every platform (the file name stays
/// `account.json`); tests point it at a scratch directory so the real one is never read.
pub fn shared_account_path() -> Option<PathBuf> {
    if let Some(dir) = env_dir("REDROB_SHARED_DIR") {
        return Some(dir.join(ACCOUNT_FILE));
    }
    platform_shared_dir().map(|dir| dir.join(ACCOUNT_FILE))
}

#[cfg(target_os = "windows")]
fn platform_shared_dir() -> Option<PathBuf> {
    env_dir("APPDATA").map(|dir| dir.join("Redrob").join("Shared"))
}

#[cfg(target_os = "macos")]
fn platform_shared_dir() -> Option<PathBuf> {
    env_dir("HOME").map(|home| {
        home.join("Library")
            .join("Application Support")
            .join("ai.redrob.shared")
    })
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn platform_shared_dir() -> Option<PathBuf> {
    if let Some(dir) = env_dir("XDG_CONFIG_HOME") {
        return Some(dir.join("redrob-shared"));
    }
    env_dir("HOME").map(|home| home.join(".config").join("redrob-shared"))
}

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|text| !text.trim().is_empty())
}

/// Parses the launcher's JSON. A missing or empty `apiKey` means "not signed in", and
/// so does anything that is not the expected object -- a half-written file is not a key.
pub fn parse_shared_account(text: &str) -> Option<SharedAccount> {
    let file: SharedAccountFile = serde_json::from_str(text).ok()?;
    let api_key = non_empty(file.api_key)?;
    Some(SharedAccount {
        api_key,
        api_key_name: non_empty(file.api_key_name),
        account_name: non_empty(file.account_name),
        api_base_url: non_empty(file.api_base_url),
    })
}

fn read_shared_account_at(path: &Path) -> Option<SharedAccount> {
    let text = std::fs::read_to_string(path).ok()?;
    parse_shared_account(&text)
}

/// The launcher's sign-in right now, or `None` when there is none. Read-only.
pub fn read_shared_account() -> Option<SharedAccount> {
    shared_account_path()
        .as_deref()
        .and_then(read_shared_account_at)
}

/// Tauri command: the renderer asks at the moment it needs a key, never at startup.
#[tauri::command]
pub fn shared_account_read() -> Option<SharedAccount> {
    read_shared_account()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_the_launcher_file_and_treats_an_empty_key_as_signed_out() {
        let account = parse_shared_account(
            r#"{"apiKey":"rrk_test_value","apiKeyName":"laptop","accountName":"Redrob","apiBaseUrl":"https://console.redrob.ai/api/backend/v1"}"#,
        )
        .expect("a full file parses");
        assert_eq!(account.api_key, "rrk_test_value");
        assert_eq!(account.api_key_name.as_deref(), Some("laptop"));
        assert_eq!(account.account_name.as_deref(), Some("Redrob"));
        assert_eq!(
            account.api_base_url.as_deref(),
            Some("https://console.redrob.ai/api/backend/v1")
        );

        assert!(parse_shared_account(r#"{"apiKey":""}"#).is_none());
        assert!(parse_shared_account(r#"{"accountName":"Redrob"}"#).is_none());
        assert!(parse_shared_account("not json").is_none());
        assert!(parse_shared_account("[]").is_none());
    }

    #[test]
    fn the_env_override_replaces_the_directory_but_not_the_file_name() {
        let dir = std::env::temp_dir().join(format!(
            "redrob-design-shared-account-{}",
            std::process::id()
        ));
        std::fs::create_dir_all(&dir).unwrap();
        let path = {
            env::set_var("REDROB_SHARED_DIR", &dir);
            let path = shared_account_path().expect("override resolves");
            env::remove_var("REDROB_SHARED_DIR");
            path
        };
        assert_eq!(path, dir.join("account.json"));

        assert!(read_shared_account_at(&path).is_none());
        std::fs::write(&path, r#"{"apiKey":"rrk_from_launcher"}"#).unwrap();
        let account = read_shared_account_at(&path).expect("the written file is read");
        assert_eq!(account.api_key, "rrk_from_launcher");
        assert!(account.account_name.is_none());

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
