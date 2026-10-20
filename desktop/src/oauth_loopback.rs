//! The loopback half of redrob-auth's desktop sign-in (RFC 8252 + PKCE).
//!
//! A webview cannot listen on a port, so this module does it for the renderer: `start`
//! binds `127.0.0.1:<random>` and answers the port, `wait` accepts connections until one
//! `GET /callback` carries the `state` the renderer chose, and answers with the
//! authorization `code` (or the OAuth error). The code is useless without the PKCE
//! verifier, which never leaves the renderer; nothing here logs either.
//!
//! The listener logic follows redrob-cowork `packages/redrob-login/src/index.ts`
//! (`listenForCallback`), rewritten for std::net so no new crate is added.

use std::{
    collections::{HashMap, HashSet},
    io::{Read, Write},
    net::{TcpListener, TcpStream},
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::Serialize;

const LOGIN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const POLL: Duration = Duration::from_millis(100);
const READ_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_REQUEST_BYTES: usize = 16 * 1024;

const PAGE_OK: &str = "<!doctype html><meta charset=utf-8><title>Redrob</title><p>Signed in. You can close this tab and return to Redrob Design.</p>";
const PAGE_FAIL: &str = "<!doctype html><meta charset=utf-8><title>Redrob</title><p>Sign-in did not complete. Return to Redrob Design and try again.</p>";

#[derive(Default)]
pub struct LoopbackListeners {
    open: Mutex<HashMap<u16, TcpListener>>,
    cancelled: Mutex<HashSet<u16>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum LoopbackCallback {
    Code {
        code: String,
    },
    Error {
        error: String,
        description: Option<String>,
    },
}

/// Binds a loopback port for one sign-in; the renderer builds `http://127.0.0.1:<port>/callback`.
#[tauri::command]
pub fn oauth_loopback_start(state: tauri::State<LoopbackListeners>) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| error.to_string())?;
    let port = listener
        .local_addr()
        .map_err(|error| error.to_string())?
        .port();
    listener
        .set_nonblocking(true)
        .map_err(|error| error.to_string())?;
    let mut open = state.open.lock().map_err(|_| "listener state poisoned")?;
    open.insert(port, listener);
    Ok(port)
}

/// Stops a pending `wait` on this port; the port is released when `wait` returns.
#[tauri::command]
pub fn oauth_loopback_cancel(state: tauri::State<LoopbackListeners>, port: u16) {
    if let Ok(mut open) = state.open.lock() {
        open.remove(&port);
    }
    if let Ok(mut cancelled) = state.cancelled.lock() {
        cancelled.insert(port);
    }
}

/// Waits for the browser to come back with `expected_state`; at most five minutes.
#[tauri::command]
pub async fn oauth_loopback_wait(
    state: tauri::State<'_, LoopbackListeners>,
    port: u16,
    expected_state: String,
) -> Result<LoopbackCallback, String> {
    let listener = {
        let mut open = state.open.lock().map_err(|_| "listener state poisoned")?;
        open.remove(&port)
            .ok_or("no sign-in is listening on that port")?
    };
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        if is_cancelled(&state, port) {
            return Err("cancelled".into());
        }
        if Instant::now() >= deadline {
            return Err("timeout".into());
        }
        match listener.accept() {
            Ok((stream, _)) => {
                if let Some(outcome) = answer(stream, &expected_state) {
                    return outcome;
                }
            }
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                tauri::async_runtime::spawn_blocking(|| std::thread::sleep(POLL))
                    .await
                    .map_err(|error| error.to_string())?;
            }
            Err(error) => return Err(error.to_string()),
        }
    }
}

fn is_cancelled(state: &LoopbackListeners, port: u16) -> bool {
    state
        .cancelled
        .lock()
        .map(|mut cancelled| cancelled.remove(&port))
        .unwrap_or(false)
}

/// One request. `None` means "not the callback, keep listening" (a favicon, a stray probe).
fn answer(mut stream: TcpStream, expected_state: &str) -> Option<Result<LoopbackCallback, String>> {
    let _ = stream.set_nonblocking(false);
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let target = request_target(&mut stream)?;
    let url = tauri::Url::parse(&format!("http://127.0.0.1{target}")).ok()?;
    if url.path() != "/callback" {
        respond(&mut stream, "404 Not Found", "");
        return None;
    }
    let mut code = None;
    let mut error = None;
    let mut description = None;
    let mut returned_state = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "code" => code = Some(value.into_owned()),
            "error" => error = Some(value.into_owned()),
            "error_description" => description = Some(value.into_owned()),
            "state" => returned_state = Some(value.into_owned()),
            _ => {}
        }
    }
    if returned_state.as_deref() != Some(expected_state) {
        respond(&mut stream, "400 Bad Request", PAGE_FAIL);
        return Some(Err("state_mismatch".into()));
    }
    match (code, error) {
        (Some(code), None) if !code.is_empty() => {
            respond(&mut stream, "200 OK", PAGE_OK);
            Some(Ok(LoopbackCallback::Code { code }))
        }
        (_, error) => {
            respond(&mut stream, "400 Bad Request", PAGE_FAIL);
            Some(Ok(LoopbackCallback::Error {
                error: error.unwrap_or_else(|| "invalid_request".into()),
                description,
            }))
        }
    }
}

/// The request target of a `GET` request line, or `None` for anything else.
fn request_target(stream: &mut TcpStream) -> Option<String> {
    let mut buffer = Vec::new();
    let mut chunk = [0u8; 2048];
    while !buffer.windows(2).any(|pair| pair == b"\r\n") {
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 || buffer.len() + read > MAX_REQUEST_BYTES {
            return None;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let text = std::str::from_utf8(&buffer).ok()?;
    let line = text.lines().next()?;
    let mut parts = line.split(' ');
    if parts.next()? != "GET" {
        respond(stream, "405 Method Not Allowed", "");
        return None;
    }
    let target = parts.next()?;
    target.starts_with('/').then(|| target.to_owned())
}

fn respond(stream: &mut TcpStream, status: &str, body: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.flush();
}
