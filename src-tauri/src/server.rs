//! Optional LAN sharing.
//!
//! Turn one form into a page anyone on the school Wi-Fi can open on a phone or
//! laptop. The page is a single self-contained HTML document generated here, so
//! the shared form looks like the desktop app without shipping the whole React
//! bundle over the wire. Submissions land in exactly the same workbook.

use crate::models::ServerStatus;
use crate::storage;
use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{Html, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use std::sync::{Arc, Mutex};
use tokio::sync::oneshot;
use tower_http::cors::CorsLayer;

const PUBLIC_HTML: &str = include_str!("../public_form.html");
const LOGO_SVG: &str = include_str!("../../src/assets/shield.svg");
// Bundled so a phone on the school Wi-Fi gets the real typefaces without
// touching the internet.
// The form stylesheet is the *same file* the desktop app uses, so the shared
// page and the app can never drift apart.
const FORM_CSS: &str = include_str!("../../src/form-styles.css");
const FONT_ARCHIVO: &[u8] = include_bytes!("../fonts/archivo.woff2");
const FONT_BODY: &[u8] = include_bytes!("../fonts/public-sans.woff2");

pub struct Running {
    pub form_id: String,
    pub form_title: String,
    pub url: String,
    pub port: u16,
    pub qr_svg: String,
    stop: Option<oneshot::Sender<()>>,
}

#[derive(Default)]
pub struct ServerState(pub Mutex<Option<Running>>);

#[derive(Clone)]
struct AppState {
    form_id: Arc<String>,
}

#[derive(Deserialize)]
struct SubmitBody {
    headers: Vec<String>,
    values: Vec<String>,
}

pub fn status(state: &ServerState) -> ServerStatus {
    let guard = state.0.lock().unwrap();
    match guard.as_ref() {
        Some(r) => ServerStatus {
            running: true,
            form_id: r.form_id.clone(),
            form_title: r.form_title.clone(),
            url: r.url.clone(),
            port: r.port,
            qr_svg: r.qr_svg.clone(),
        },
        None => ServerStatus::default(),
    }
}

pub fn stop(state: &ServerState) {
    let mut guard = state.0.lock().unwrap();
    if let Some(mut r) = guard.take() {
        if let Some(tx) = r.stop.take() {
            let _ = tx.send(());
        }
    }
}

pub fn start(state: &ServerState, form_id: &str, port: u16) -> Result<ServerStatus, String> {
    stop(state);

    let form = storage::load_form(form_id).map_err(|e| e.to_string())?;
    let ip = local_ip_address::local_ip()
        .map(|i| i.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    let url = format!("http://{ip}:{port}");

    let qr_svg = qrcode::QrCode::new(url.as_bytes())
        .map(|c| {
            c.render::<qrcode::render::svg::Color>()
                .min_dimensions(200, 200)
                .dark_color(qrcode::render::svg::Color("#2A2118"))
                .light_color(qrcode::render::svg::Color("#FFFFFF"))
                .quiet_zone(true)
                .build()
        })
        .unwrap_or_default();

    let app_state = AppState {
        form_id: Arc::new(form_id.to_string()),
    };

    let router = Router::new()
        .route("/", get(page))
        .route("/logo.svg", get(logo))
        .route("/f/archivo.woff2", get(font_display))
        .route("/f/body.woff2", get(font_body))
        .route("/submit", post(submit))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let (tx, rx) = oneshot::channel::<()>();
    let bind = format!("0.0.0.0:{port}");

    // Bind synchronously so a port clash surfaces as an error the user can see.
    let listener = std::net::TcpListener::bind(&bind)
        .map_err(|e| format!("Could not start on port {port}: {e}"))?;
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("Could not configure the listener: {e}"))?;

    tauri::async_runtime::spawn(async move {
        let Ok(listener) = tokio::net::TcpListener::from_std(listener) else {
            return;
        };
        let _ = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = rx.await;
            })
            .await;
    });

    let running = Running {
        form_id: form_id.to_string(),
        form_title: form.title.clone(),
        url,
        port,
        qr_svg,
        stop: Some(tx),
    };
    let out = ServerStatus {
        running: true,
        form_id: running.form_id.clone(),
        form_title: running.form_title.clone(),
        url: running.url.clone(),
        port: running.port,
        qr_svg: running.qr_svg.clone(),
    };
    *state.0.lock().unwrap() = Some(running);
    Ok(out)
}

async fn logo() -> impl IntoResponse {
    ([(header::CONTENT_TYPE, "image/svg+xml")], LOGO_SVG)
}

async fn font_display() -> impl IntoResponse {
    (
        [
            (header::CONTENT_TYPE, "font/woff2"),
            (header::CACHE_CONTROL, "public, max-age=604800"),
        ],
        FONT_ARCHIVO,
    )
}

async fn font_body() -> impl IntoResponse {
    (
        [
            (header::CONTENT_TYPE, "font/woff2"),
            (header::CACHE_CONTROL, "public, max-age=604800"),
        ],
        FONT_BODY,
    )
}

async fn page(State(st): State<AppState>) -> impl IntoResponse {
    let raw = match storage::load_form_raw(&st.form_id) {
        Ok(v) => v,
        Err(e) => {
            return Html(format!(
                "<h1>Form unavailable</h1><p>{}</p>",
                html_escape(&e.to_string())
            ))
        }
    };
    let form = storage::load_form(&st.form_id).unwrap_or_default();
    let json = serde_json::to_string(&raw).unwrap_or_else(|_| "null".into());

    // The mark is injected into a single-quoted JS string, so it must be one
    // line and must not carry an apostrophe.
    let logo_js = LOGO_SVG.replace('\n', " ").replace('\'', "&#39;");

    let html = PUBLIC_HTML
        .replace("__FORM_CSS__", FORM_CSS)
        .replace("__STYLE__", &form.settings.style)
        .replace("__LOGO_SVG__", &logo_js)
        .replace(
            "__TITLE__",
            &html_escape(if form.title.trim().is_empty() {
                "JWS Form"
            } else {
                &form.title
            }),
        )
        // JSON goes in last so nothing inside it is treated as another placeholder.
        .replace("\"__FORM_JSON__\"", &json.replace("</", "<\\/"));

    Html(html)
}

async fn submit(State(st): State<AppState>, Json(body): Json<SubmitBody>) -> impl IntoResponse {
    match storage::submit(&st.form_id, &body.headers, &body.values) {
        Ok(n) => (StatusCode::OK, Json(serde_json::json!({ "ok": true, "count": n }))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "ok": false, "error": e.to_string() })),
        ),
    }
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}
