mod excel;
mod models;
mod server;
mod storage;
mod tunnel;
mod webhook;

use models::{FormSummary, ResponseTable, ServerStatus};
use server::ServerState;
use tunnel::TunnelState;

type R<T> = Result<T, String>;

fn e<T>(r: anyhow::Result<T>) -> R<T> {
    r.map_err(|err| err.to_string())
}

/* ---------------------------------------------------------------- forms --- */

#[tauri::command]
fn list_forms() -> R<Vec<FormSummary>> {
    e(storage::list_forms())
}

#[tauri::command]
fn get_form(id: String) -> R<serde_json::Value> {
    e(storage::load_form_raw(&id))
}

#[tauri::command]
fn save_form(form: serde_json::Value) -> R<()> {
    e(storage::save_form(&form))
}

#[tauri::command]
fn delete_form(id: String, delete_responses: bool) -> R<()> {
    e(storage::delete_form(&id, delete_responses))
}

#[tauri::command]
fn duplicate_form(id: String) -> R<serde_json::Value> {
    let mut v = e(storage::load_form_raw(&id))?;
    let new_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now().to_rfc3339();
    if let Some(o) = v.as_object_mut() {
        o.insert("id".into(), serde_json::Value::String(new_id));
        o.insert("createdAt".into(), serde_json::Value::String(now.clone()));
        o.insert("updatedAt".into(), serde_json::Value::String(now));
        let title = o
            .get("title")
            .and_then(|t| t.as_str())
            .unwrap_or("Untitled form")
            .to_string();
        o.insert(
            "title".into(),
            serde_json::Value::String(format!("{title} (copy)")),
        );
    }
    e(storage::save_form(&v))?;
    Ok(v)
}

/* ------------------------------------------------------------ responses --- */

#[tauri::command]
fn submit_response(form_id: String, headers: Vec<String>, values: Vec<String>) -> R<usize> {
    e(storage::submit(&form_id, &headers, &values))
}

#[tauri::command]
fn get_responses(form_id: String) -> R<ResponseTable> {
    e(storage::responses(&form_id))
}

#[tauri::command]
fn clear_responses(form_id: String) -> R<()> {
    e(storage::clear_responses(&form_id))
}

/* ----------------------------------------------------------------- disk --- */

#[tauri::command]
fn data_dir() -> String {
    storage::root().to_string_lossy().to_string()
}

#[tauri::command]
fn set_data_dir(path: String) -> R<()> {
    e(storage::set_root(&path))
}

#[tauri::command]
fn path_exists(path: String) -> bool {
    storage::path_exists(&path)
}

/* --------------------------------------------------------------- server --- */

#[tauri::command]
fn server_start(
    state: tauri::State<'_, ServerState>,
    form_id: String,
    port: u16,
) -> R<ServerStatus> {
    server::start(&state, &form_id, port)
}

#[tauri::command]
fn server_stop(state: tauri::State<'_, ServerState>) -> ServerStatus {
    server::stop(&state);
    ServerStatus::default()
}

#[tauri::command]
fn server_status(state: tauri::State<'_, ServerState>) -> ServerStatus {
    server::status(&state)
}

/* --------------------------------------------------------------- tunnel --- */

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelStatus {
    state: String,
    public_url: String,
    local_url: String,
    form_id: String,
    form_title: String,
    qr_svg: String,
    message: String,
    helper_installed: bool,
}

fn tunnel_snapshot(srv: &ServerState, tun: &TunnelState) -> TunnelStatus {
    let s = server::status(srv);
    let (state, public_url, message) = tunnel::snapshot(tun);
    // The tunnel hands back a bare host; give it the same readable path the LAN
    // link carries, so a parent sees the form's name in the address.
    let public_url = if public_url.is_empty() {
        public_url
    } else {
        let path = server::slug(&s.form_title);
        format!("{}/{}", public_url.trim_end_matches('/'), path)
    };
    // Prefer the public address for the QR — that is the one people scan.
    let qr_target = if public_url.is_empty() { s.url.clone() } else { public_url.clone() };
    TunnelStatus {
        state,
        public_url,
        local_url: s.url,
        form_id: s.form_id,
        form_title: s.form_title,
        qr_svg: tunnel::qr(&qr_target),
        message,
        helper_installed: tunnel::is_installed(),
    }
}

#[tauri::command]
fn tunnel_status(srv: tauri::State<'_, ServerState>, tun: tauri::State<'_, TunnelState>) -> TunnelStatus {
    tunnel_snapshot(&srv, &tun)
}

/// Download the sharing helper. Blocking work runs off the UI thread.
#[tauri::command]
async fn tunnel_install(tun: tauri::State<'_, TunnelState>) -> R<TunnelStatus> {
    let state = TunnelState(tun.0.clone());
    tunnel::set_state(&state, "installing", "Downloading the sharing helper (about 25 MB)…");
    let handle = state.clone();
    let done = tauri::async_runtime::spawn_blocking(move || {
        let r = tunnel::install();
        match &r {
            Ok(_) => tunnel::set_state(&handle, "off", ""),
            Err(e) => tunnel::set_state(&handle, "error", &e.to_string()),
        }
        r
    })
    .await
    .map_err(|e| e.to_string())?;
    done.map_err(|e| e.to_string())?;

    let (st, url, msg) = tunnel::snapshot(&state);
    Ok(TunnelStatus {
        state: st,
        public_url: url,
        local_url: String::new(),
        form_id: String::new(),
        form_title: String::new(),
        qr_svg: String::new(),
        message: msg,
        helper_installed: tunnel::is_installed(),
    })
}

/// Start the local server for this form, then point a public tunnel at it.
#[tauri::command]
fn tunnel_start(
    srv: tauri::State<'_, ServerState>,
    tun: tauri::State<'_, TunnelState>,
    form_id: String,
    port: u16,
) -> R<TunnelStatus> {
    server::start(&srv, &form_id, port)?;
    let state = TunnelState(tun.0.clone());
    tunnel::start(&state, port).map_err(|e| e.to_string())?;
    Ok(tunnel_snapshot(&srv, &tun))
}

#[tauri::command]
fn tunnel_stop(srv: tauri::State<'_, ServerState>, tun: tauri::State<'_, TunnelState>) -> TunnelStatus {
    let state = TunnelState(tun.0.clone());
    tunnel::stop(&state);
    server::stop(&srv);
    tunnel_snapshot(&srv, &tun)
}

/* ------------------------------------------------------------------ run --- */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .manage(ServerState::default())
        .manage(TunnelState::default())
        .setup(|_app| {
            let _ = storage::ensure_dirs();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_forms,
            get_form,
            save_form,
            delete_form,
            duplicate_form,
            submit_response,
            get_responses,
            clear_responses,
            data_dir,
            set_data_dir,
            path_exists,
            server_start,
            server_stop,
            server_status,
            tunnel_status,
            tunnel_install,
            tunnel_start,
            tunnel_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running JWS Forms");
}
