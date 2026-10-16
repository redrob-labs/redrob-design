//! The Redrob Code app bridge.
//!
//! `redrob-app-bridge` serves this app's tools to the shared Redrob Code daemon
//! over MCP on loopback, so the agent in any Redrob surface can drive the open
//! document. The document itself lives in the webview, so every tool handler is
//! a request/reply round trip: the Rust side emits an `app-bridge:call` event
//! `{ id, tool, args }` to the main window and blocks on the reply the webview
//! sends back through the `app_bridge_reply` command. A call that gets no reply
//! within [`REPLY_TIMEOUT`] fails with a message the agent can read.
//!
//! The daemon is optional: when it cannot be reached the failure is logged and
//! the app runs without the bridge.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Mutex};
use std::time::Duration;

use redrob_app_bridge::{AppBridge, AppBridgeConfig, Tool};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager};

/// The name the daemon lists the tools under (`app:design`).
const APP_NAME: &str = "design";
/// Event the webview listens for; its payload is [`CallPayload`].
const CALL_EVENT: &str = "app-bridge:call";
/// How long a tool call waits for the webview before giving up.
const REPLY_TIMEOUT: Duration = Duration::from_secs(30);

type Reply = Result<String, String>;

/// Calls waiting for the webview, by call id.
#[derive(Default)]
pub struct PendingCalls(Mutex<HashMap<String, mpsc::Sender<Reply>>>);

/// The live bridge, kept in managed state so it stays registered until exit.
#[derive(Default)]
pub struct BridgeHandle(Mutex<Option<AppBridge>>);

#[derive(Clone, serde::Serialize)]
struct CallPayload {
    id: String,
    tool: String,
    args: Value,
}

static NEXT_CALL_ID: AtomicU64 = AtomicU64::new(1);

fn next_call_id() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        NEXT_CALL_ID.fetch_add(1, Ordering::Relaxed)
    )
}

/// The webview's answer to one `app-bridge:call` event.
#[tauri::command]
pub fn app_bridge_reply(state: tauri::State<PendingCalls>, id: String, ok: bool, text: String) {
    let sender = state.0.lock().ok().and_then(|mut pending| pending.remove(&id));
    match sender {
        Some(sender) => {
            let _ = sender.send(if ok { Ok(text) } else { Err(text) });
        }
        None => eprintln!("[app-bridge] reply for unknown or expired call {id}"),
    }
}

fn forget_call(app: &AppHandle, id: &str) {
    if let Ok(mut pending) = app.state::<PendingCalls>().0.lock() {
        pending.remove(id);
    }
}

/// Emit one tool call to the main window and block until it answers or times out.
fn call_webview(app: &AppHandle, tool: &str, args: Value) -> Reply {
    if app.get_webview_window("main").is_none() {
        return Err("the Redrob Design window is not open".to_string());
    }
    let id = next_call_id();
    let (sender, receiver) = mpsc::channel();
    app.state::<PendingCalls>()
        .0
        .lock()
        .map_err(|_| "the app bridge call table is poisoned".to_string())?
        .insert(id.clone(), sender);

    let payload = CallPayload {
        id: id.clone(),
        tool: tool.to_string(),
        args,
    };
    if let Err(error) = app.emit_to("main", CALL_EVENT, payload) {
        forget_call(app, &id);
        return Err(format!("could not reach the editor: {error}"));
    }

    match receiver.recv_timeout(REPLY_TIMEOUT) {
        Ok(reply) => reply,
        Err(_) => {
            forget_call(app, &id);
            Err(format!(
                "{tool}: the editor did not answer within {} s",
                REPLY_TIMEOUT.as_secs()
            ))
        }
    }
}

fn tool(app: &AppHandle, name: &'static str, description: &str, schema: Value) -> Tool {
    let app = app.clone();
    Tool::new(name, description, schema, move |args| call_webview(&app, name, args))
}

fn tools(app: &AppHandle) -> Vec<Tool> {
    vec![
        tool(
            app,
            "document_info",
            "Describe the open document: file path (or untitled), canvas size, page count, and what is selected.",
            json!({ "type": "object", "properties": {} }),
        ),
        tool(
            app,
            "list_layers",
            "List the layers of the current page as a tree, one per line: id, type, name, visible, locked.",
            json!({
                "type": "object",
                "properties": {
                    "max": { "type": "integer", "minimum": 1, "description": "Maximum number of lines (default 200)" }
                }
            }),
        ),
        tool(
            app,
            "select",
            "Select the layers with the given ids (replacing the selection); answers how many were selected.",
            json!({
                "type": "object",
                "properties": {
                    "ids": { "type": "array", "items": { "type": "string" }, "description": "Layer ids from list_layers" }
                },
                "required": ["ids"]
            }),
        ),
        tool(
            app,
            "set_text",
            "Replace the content of a text layer.",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Text layer id" },
                    "text": { "type": "string", "description": "New content" }
                },
                "required": ["id", "text"]
            }),
        ),
        tool(
            app,
            "set_visible",
            "Show or hide a layer.",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Layer id" },
                    "visible": { "type": "boolean" }
                },
                "required": ["id", "visible"]
            }),
        ),
        tool(
            app,
            "move_layer",
            "Translate a layer by dx, dy in canvas units; answers its new position.",
            json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string", "description": "Layer id" },
                    "dx": { "type": "number" },
                    "dy": { "type": "number" }
                },
                "required": ["id", "dx", "dy"]
            }),
        ),
        tool(
            app,
            "export",
            "Export the selection (or the whole current page) as png, svg or pdf through the app's export pipeline; answers the written path.",
            json!({
                "type": "object",
                "properties": {
                    "format": { "type": "string", "enum": ["png", "svg", "pdf"] },
                    "path": { "type": "string", "description": "Absolute output path; defaults to the Downloads folder" },
                    "scale": { "type": "number", "minimum": 0.1, "maximum": 4, "description": "Raster scale (png only, default 1)" }
                },
                "required": ["format"]
            }),
        ),
        tool(
            app,
            "save",
            "Save the document to its file; fails with the save-as route when the document is untitled.",
            json!({ "type": "object", "properties": {} }),
        ),
    ]
}

/// Start the bridge on its own thread so a slow or absent daemon never delays
/// the window. The handle lands in [`BridgeHandle`]; `stop` on exit releases it.
pub fn start(app: &AppHandle) {
    let app = app.clone();
    let spawned = std::thread::Builder::new()
        .name("redrob-design-app-bridge".into())
        .spawn(move || {
            let config = AppBridgeConfig {
                version: Some(env!("CARGO_PKG_VERSION").into()),
                ..AppBridgeConfig::new(APP_NAME, tools(&app))
            };
            match AppBridge::start(config) {
                Ok(bridge) => {
                    eprintln!(
                        "[app-bridge] bridged as {} at {}",
                        bridge.id(),
                        bridge.mcp_url()
                    );
                    if let Ok(mut slot) = app.state::<BridgeHandle>().0.lock() {
                        *slot = Some(bridge);
                    }
                }
                Err(error) => eprintln!("[app-bridge] not bridged: {error}"),
            }
        });
    if let Err(error) = spawned {
        eprintln!("[app-bridge] could not start the bridge thread: {error}");
    }
}

/// Unregister from the daemon and stop the MCP server.
pub fn stop(app: &AppHandle) {
    let bridge = app
        .state::<BridgeHandle>()
        .0
        .lock()
        .ok()
        .and_then(|mut slot| slot.take());
    if let Some(bridge) = bridge {
        bridge.stop();
    }
}
