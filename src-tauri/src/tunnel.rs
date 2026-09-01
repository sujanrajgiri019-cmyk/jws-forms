//! Public sharing.
//!
//! The local server (server.rs) already answers on the school network. To reach
//! a parent at home we point Cloudflare's `cloudflared` at that same port and
//! it hands back a public https address — no account, no port forwarding, no
//! hosting bill. The address is temporary: it lives as long as the app is
//! running, and a new one is issued each time sharing is restarted.
//!
//! `cloudflared` is a single .exe. We do not ship it (it is ~25 MB and updates
//! on its own schedule); the app fetches it once, on request, into its own data
//! folder.

use anyhow::{anyhow, Result};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(windows)]
use std::os::windows::process::CommandExt;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const DOWNLOAD_URL: &str =
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

#[derive(Default)]
pub struct Inner {
    /// off | installing | starting | live | error
    pub state: String,
    pub public_url: String,
    pub message: String,
    child: Option<Child>,
}

#[derive(Default, Clone)]
pub struct TunnelState(pub Arc<Mutex<Inner>>);

/// Where the helper lives once downloaded.
pub fn helper_path() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("JWSForms")
        .join(if cfg!(windows) { "cloudflared.exe" } else { "cloudflared" })
}

/// Our own copy, or one the user already had on the PATH.
pub fn resolve_helper() -> Option<PathBuf> {
    let own = helper_path();
    if own.exists() {
        return Some(own);
    }
    let name = if cfg!(windows) { "cloudflared.exe" } else { "cloudflared" };
    std::env::var_os("PATH")
        .and_then(|paths| {
            std::env::split_paths(&paths)
                .map(|d| d.join(name))
                .find(|p| p.exists())
        })
}

pub fn is_installed() -> bool {
    resolve_helper().is_some()
}

/// Fetch the helper once. Blocking, so callers run it off the UI thread.
pub fn install() -> Result<PathBuf> {
    let dest = helper_path();
    if let Some(d) = dest.parent() {
        std::fs::create_dir_all(d)?;
    }
    if !cfg!(windows) {
        return Err(anyhow!(
            "Automatic download is only wired up for Windows. Install cloudflared manually and put it on the PATH."
        ));
    }

    let bytes = reqwest::blocking::Client::builder()
        .user_agent("JWSForms")
        .timeout(std::time::Duration::from_secs(600))
        .build()?
        .get(DOWNLOAD_URL)
        .send()?
        .error_for_status()?
        .bytes()?;

    if bytes.len() < 1_000_000 {
        return Err(anyhow!("The download looked wrong ({} bytes). Try again.", bytes.len()));
    }

    let tmp = dest.with_extension("part");
    std::fs::write(&tmp, &bytes)?;
    let _ = std::fs::remove_file(&dest);
    std::fs::rename(&tmp, &dest)?;
    Ok(dest)
}

/// Point a quick tunnel at the already-running local server.
pub fn start(state: &TunnelState, port: u16) -> Result<()> {
    stop(state);

    let exe = resolve_helper()
        .ok_or_else(|| anyhow!("The sharing helper is not installed yet."))?;

    {
        let mut g = state.0.lock().unwrap();
        g.state = "starting".into();
        g.public_url.clear();
        g.message = "Asking Cloudflare for an address…".into();
    }

    let mut cmd = Command::new(exe);
    cmd.args([
        "tunnel",
        "--no-autoupdate",
        "--url",
        &format!("http://127.0.0.1:{port}"),
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(CREATE_NO_WINDOW);

    let mut child = cmd
        .spawn()
        .map_err(|e| anyhow!("Could not start the sharing helper: {e}"))?;

    // cloudflared prints the assigned address on stderr; watch for it.
    if let Some(err) = child.stderr.take() {
        let st = state.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(err);
            for line in reader.lines().map_while(Result::ok) {
                if let Some(url) = find_url(&line) {
                    let mut g = st.0.lock().unwrap();
                    if g.state == "starting" {
                        g.state = "live".into();
                        g.public_url = url;
                        g.message.clear();
                    }
                } else if line.contains("failed to request quick Tunnel")
                    || line.contains("Cannot determine default origin certificate")
                {
                    let mut g = st.0.lock().unwrap();
                    g.state = "error".into();
                    g.message =
                        "Cloudflare refused the request. Check this PC's internet connection and try again."
                            .into();
                }
            }
            // The helper exited. If we never got an address, say so.
            let mut g = st.0.lock().unwrap();
            if g.state == "starting" {
                g.state = "error".into();
                g.message = "The sharing helper stopped before giving out an address.".into();
            }
        });
    }

    state.0.lock().unwrap().child = Some(child);
    Ok(())
}

fn find_url(line: &str) -> Option<String> {
    let i = line.find("https://")?;
    let rest = &line[i..];
    let end = rest
        .find(|c: char| c.is_whitespace() || c == '|' || c == '"')
        .unwrap_or(rest.len());
    let url = rest[..end].trim_end_matches(['.', ',']).to_string();
    if url.contains("trycloudflare.com") {
        Some(url)
    } else {
        None
    }
}

pub fn stop(state: &TunnelState) {
    let mut g = state.0.lock().unwrap();
    if let Some(mut c) = g.child.take() {
        let _ = c.kill();
        let _ = c.wait();
    }
    g.state = "off".into();
    g.public_url.clear();
    g.message.clear();
}

pub fn snapshot(state: &TunnelState) -> (String, String, String) {
    let g = state.0.lock().unwrap();
    let s = if g.state.is_empty() { "off".to_string() } else { g.state.clone() };
    (s, g.public_url.clone(), g.message.clone())
}

pub fn set_state(state: &TunnelState, s: &str, msg: &str) {
    let mut g = state.0.lock().unwrap();
    g.state = s.into();
    g.message = msg.into();
}

/// A QR code for any URL, as inline SVG.
pub fn qr(url: &str) -> String {
    if url.is_empty() {
        return String::new();
    }
    qrcode::QrCode::new(url.as_bytes())
        .map(|c| {
            c.render::<qrcode::render::svg::Color>()
                .min_dimensions(220, 220)
                .dark_color(qrcode::render::svg::Color("#191008"))
                .light_color(qrcode::render::svg::Color("#FFFFFF"))
                .quiet_zone(true)
                .build()
        })
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::find_url;

    #[test]
    fn picks_the_quick_tunnel_address_out_of_a_log_line() {
        let line = "2026-08-31T10:00:00Z INF |  https://odd-lemon-tree-42.trycloudflare.com   |";
        assert_eq!(
            find_url(line).as_deref(),
            Some("https://odd-lemon-tree-42.trycloudflare.com")
        );
    }

    #[test]
    fn ignores_other_https_links_in_the_log() {
        let line = "INF See https://developers.cloudflare.com/argo-tunnel for docs";
        assert_eq!(find_url(line), None);
    }

    #[test]
    fn trims_trailing_punctuation() {
        assert_eq!(
            find_url("INF url=https://a-b-c.trycloudflare.com.").as_deref(),
            Some("https://a-b-c.trycloudflare.com")
        );
    }
}
