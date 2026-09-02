//! Optional LAN sharing.
//!
//! Turn one form into a page anyone on the school Wi-Fi can open on a phone or
//! laptop. The page is a single self-contained HTML document generated here, so
//! the shared form looks like the desktop app without shipping the whole React
//! bundle over the wire. Submissions land in exactly the same workbook.

use crate::models::ServerStatus;
use crate::storage;
use axum::{
    extract::{DefaultBodyLimit, State},
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

// The institution marks, embedded exactly as they are drawn. There is no
// tracing or recolouring anywhere in this app — whatever PNG sits in
// `src/assets/logos/` is what a parent sees on their phone.
const LOGO_SCHOOL: &[u8] = include_bytes!("../../src/assets/logos/school.png");
const LOGO_PLUS2: &[u8] = include_bytes!("../../src/assets/logos/plus2.png");
const LOGO_COLLEGE: &[u8] = include_bytes!("../../src/assets/logos/college.png");

/// name, tagline, whether the artwork already contains the name, and its
/// width ÷ height. Mirrors `src/lib/brand.ts` — change one, change the other.
fn institution(id: &str) -> (&'static [u8], &'static str, &'static str, bool, f32) {
    match id {
        "plus2" => (
            LOGO_PLUS2,
            "Janapremi World School PLUS 2",
            "Science | Management | Law",
            true,
            1377.0 / 769.0,
        ),
        "college" => (
            LOGO_COLLEGE,
            "Janapremi College",
            "Affiliated to Tribhuwan University",
            true,
            900.0 / 387.0,
        ),
        _ => (
            LOGO_SCHOOL,
            "Janapremi World School",
            "The World Of Learning…",
            false,
            1.0,
        ),
    }
}

const ADDRESS: &str = "Madhyapur Thimi–3, Kaushaltar, Bhaktapur";
const PHONE_LINE: &str = "9744570500  |  9744570501  |  01-5910299";
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

/// A readable path segment made from the form's title.
///
/// The host part of a shared address is not ours to choose — a Cloudflare quick
/// tunnel hands out a random name, and changing that needs a paid domain. What
/// we CAN control is the path, so the link a parent receives reads
/// `…trycloudflare.com/jws-student-registration` rather than ending at a
/// meaningless host. It is cosmetic, and it is most of what people mean when
/// they ask for a link that looks like the form.
pub fn slug(title: &str) -> String {
    let mut out = String::from("jws-");
    let mut last_dash = true;
    for c in title.trim().to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c);
            last_dash = false;
        } else if !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    let out = out.trim_end_matches('-').to_string();
    let out: String = out.chars().take(60).collect();
    if out.len() <= 4 {
        "jws-form".to_string()
    } else {
        out
    }
}

pub fn start(state: &ServerState, form_id: &str, port: u16) -> Result<ServerStatus, String> {
    stop(state);

    let form = storage::load_form(form_id).map_err(|e| e.to_string())?;
    let ip = local_ip_address::local_ip()
        .map(|i| i.to_string())
        .unwrap_or_else(|_| "127.0.0.1".to_string());
    // Served at both `/` and `/<slug>`, so the address can carry the form's
    // name without anything breaking if someone trims it back to the host.
    let path = slug(&form.title);
    let url = format!("http://{ip}:{port}/{path}");

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
        // axum 0.7 wildcard syntax. `/logo.png`, `/f/…` and `/submit` are more
        // specific, so they still win over this.
        .route("/*slug", get(page))
        .route("/logo.png", get(logo))
        .route("/f/archivo.woff2", get(font_display))
        .route("/f/body.woff2", get(font_body))
        .route("/submit", post(submit))
        // A submitted photo arrives base64-encoded inside the JSON body, so the
        // 2 MB default is far too small.
        .layer(DefaultBodyLimit::max(32 * 1024 * 1024))
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

async fn logo(State(st): State<AppState>) -> impl IntoResponse {
    let id = storage::load_form(&st.form_id)
        .map(|f| f.settings.institution)
        .unwrap_or_else(|_| "school".to_string());
    (
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "no-cache"),
        ],
        institution(&id).0,
    )
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

    let (_, name, tagline, has_name, aspect) = institution(&form.settings.institution);
    let brand = serde_json::json!({
        "name": name,
        "tagline": tagline,
        "logoHasName": has_name,
        "aspect": aspect,
        "address": ADDRESS,
        "phones": PHONE_LINE,
    })
    .to_string();

    let html = PUBLIC_HTML
        .replace("__FORM_CSS__", FORM_CSS)
        .replace("__STYLE__", &form.settings.style)
        .replace("\"__BRAND_JSON__\"", &brand)
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


#[cfg(test)]
mod tests {
    use super::slug;

    #[test]
    fn a_title_becomes_a_readable_path() {
        assert_eq!(slug("Student Registration"), "jws-student-registration");
        assert_eq!(slug("Admission Enquiry 2083"), "jws-admission-enquiry-2083");
    }

    #[test]
    fn punctuation_and_spacing_collapse_to_single_dashes() {
        assert_eq!(slug("  +2  Science / Management!! "), "jws-2-science-management");
        assert_eq!(slug("Sports —— Day"), "jws-sports-day");
    }

    #[test]
    fn an_empty_or_symbol_only_title_still_gives_a_usable_path() {
        assert_eq!(slug(""), "jws-form");
        assert_eq!(slug("   "), "jws-form");
        assert_eq!(slug("!!!"), "jws-form");
    }

    #[test]
    fn a_very_long_title_is_trimmed() {
        let long = "a".repeat(200);
        assert!(slug(&long).len() <= 60);
    }
}
