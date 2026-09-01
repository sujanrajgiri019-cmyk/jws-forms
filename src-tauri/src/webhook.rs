//! Optional copy of a response, sent somewhere else.
//!
//! The rule this file exists to enforce: **the disk write is the submission.**
//! A response is safely in the workbook and the recovery log before anything is
//! sent anywhere, and the send happens on a detached thread whose result nobody
//! waits for. A school's internet dropping out, a portal being down, or a
//! misspelt address must never make a parent standing at the counter watch a
//! spinner — or worse, be told their form failed when it did not.
//!
//! What that costs: no delivery guarantee. A failed POST is dropped. The
//! workbook and `.recovery/<id>.jsonl` remain the record of truth, so nothing is
//! lost — it just isn't mirrored. That trade is the right way round for a form
//! at an admission desk.

use std::collections::HashMap;
use std::time::Duration;

/// How long a single attempt may take before it is abandoned.
const TIMEOUT: Duration = Duration::from_secs(12);

/// Reject anything that isn't a plain http(s) URL.
///
/// Without this a typo — or a pasted `file://` path — would hand a local path to
/// the HTTP client. Cheap to check, and it keeps the endpoint to the one thing
/// this feature is for.
pub fn is_valid_endpoint(url: &str) -> bool {
    let u = url.trim();
    if u.len() < 11 || u.len() > 2048 {
        return false;
    }
    let lower = u.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return false;
    }
    // Something has to follow the scheme, and a space means it isn't a URL.
    let rest = &lower[lower.find("://").map(|i| i + 3).unwrap_or(0)..];
    !rest.is_empty() && !u.contains(char::is_whitespace)
}

/// The JSON body an endpoint receives.
pub fn payload(
    form_id: &str,
    form_title: &str,
    headers: &[String],
    values: &[String],
    row_number: usize,
) -> serde_json::Value {
    let mut answers = HashMap::new();
    for (h, v) in headers.iter().zip(values.iter()) {
        answers.insert(h.clone(), v.clone());
    }
    serde_json::json!({
        "source": "JWS Forms",
        "formId": form_id,
        "formTitle": form_title,
        "receivedAt": chrono::Local::now().to_rfc3339(),
        "rowNumber": row_number,
        "headers": headers,
        "values": values,
        "answers": answers,
    })
}

/// Fire and forget. Returns immediately; the caller never learns the outcome.
pub fn send(url: &str, body: serde_json::Value) {
    if !is_valid_endpoint(url) {
        return;
    }
    let url = url.trim().to_string();
    // Serialised once, here, so the worker thread carries plain bytes.
    let bytes = match serde_json::to_vec(&body) {
        Ok(b) => b,
        Err(_) => return,
    };
    std::thread::spawn(move || {
        let client = match reqwest::blocking::Client::builder().timeout(TIMEOUT).build() {
            Ok(c) => c,
            Err(_) => return,
        };
        // One retry, because the common failure is a laptop that has just woken
        // up and hasn't reassociated with the Wi-Fi yet.
        for attempt in 0..2 {
            let ok = client
                .post(&url)
                .header("content-type", "application/json")
                .header("user-agent", "JWS-Forms")
                .body(bytes.clone())
                .send()
                .map(|r| r.status().is_success())
                .unwrap_or(false);
            if ok {
                return;
            }
            if attempt == 0 {
                std::thread::sleep(Duration::from_secs(4));
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_http_endpoints_are_accepted() {
        assert!(is_valid_endpoint("https://example.com/hook"));
        assert!(is_valid_endpoint("http://192.168.1.9:3000/in"));
        assert!(!is_valid_endpoint(""));
        assert!(!is_valid_endpoint("   "));
        assert!(!is_valid_endpoint("example.com/hook"));
        assert!(!is_valid_endpoint("file:///C:/secrets.txt"));
        assert!(!is_valid_endpoint("https://"));
        assert!(!is_valid_endpoint("https://exa mple.com"));
    }

    #[test]
    fn the_payload_pairs_headers_with_values() {
        let p = payload(
            "f1",
            "Admission 2083",
            &["Timestamp".into(), "Name".into()],
            &["2026-09-01".into(), "Asha".into()],
            7,
        );
        assert_eq!(p["formTitle"], "Admission 2083");
        assert_eq!(p["rowNumber"], 7);
        assert_eq!(p["answers"]["Name"], "Asha");
        assert_eq!(p["values"][0], "2026-09-01");
    }

    #[test]
    fn an_invalid_endpoint_sends_nothing_and_does_not_panic() {
        // The point is that this returns rather than spawning anything.
        send("not-a-url", serde_json::json!({}));
        send("", serde_json::json!({}));
    }
}
