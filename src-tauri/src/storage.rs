//! Where everything lives on disk.
//!
//! Documents/JWS Forms/
//!   forms/<id>.json                 form definitions
//!   responses/<Title> (<id6>).xlsx  one workbook per form  <-- what people open
//!   responses/.recovery/<id>.jsonl  append-only crash log, written before the xlsx
//!   settings.json                   app preferences (incl. a custom data folder)

use crate::excel;
use crate::models::{FormDef, FormSummary, ResponseTable};
use anyhow::{anyhow, Result};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

const APP_FOLDER: &str = "JWS Forms";

fn config_file() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("JWSForms")
        .join("settings.json")
}

fn default_root() -> PathBuf {
    dirs::document_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
        .join(APP_FOLDER)
}

/// The active data folder — the default, or whatever the user picked in Settings.
pub fn root() -> PathBuf {
    if let Ok(txt) = fs::read_to_string(config_file()) {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&txt) {
            if let Some(p) = v.get("dataDir").and_then(|d| d.as_str()) {
                if !p.trim().is_empty() {
                    return PathBuf::from(p);
                }
            }
        }
    }
    default_root()
}

pub fn set_root(path: &str) -> Result<()> {
    let cf = config_file();
    if let Some(d) = cf.parent() {
        fs::create_dir_all(d)?;
    }
    let body = serde_json::json!({ "dataDir": path });
    fs::write(cf, serde_json::to_string_pretty(&body)?)?;
    ensure_dirs()?;
    Ok(())
}

pub fn forms_dir() -> PathBuf {
    root().join("forms")
}
pub fn responses_dir() -> PathBuf {
    root().join("responses")
}
pub fn recovery_dir() -> PathBuf {
    responses_dir().join(".recovery")
}

pub fn ensure_dirs() -> Result<()> {
    fs::create_dir_all(forms_dir())?;
    fs::create_dir_all(responses_dir())?;
    fs::create_dir_all(recovery_dir())?;
    Ok(())
}

fn form_path(id: &str) -> PathBuf {
    forms_dir().join(format!("{}.json", sanitize(id)))
}

/// Strip anything Windows refuses in a filename, and trim to a sane length.
pub fn sanitize(s: &str) -> String {
    let cleaned: String = s
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            c if (c as u32) < 32 => '-',
            c => c,
        })
        .collect();
    let cleaned = cleaned.trim().trim_end_matches('.').to_string();
    let cleaned: String = cleaned.chars().take(80).collect();
    if cleaned.is_empty() {
        "Untitled".to_string()
    } else {
        cleaned
    }
}

/// Where one form's workbook belongs: its own folder if the user picked one on
/// the Settings tab, otherwise the app-wide responses folder.
pub fn form_dir(form: &FormDef) -> PathBuf {
    let custom = form.settings.data_folder.trim();
    if custom.is_empty() {
        responses_dir()
    } else {
        // Deliberately not created here — this is called for every form on the
        // home screen, and listing forms should not conjure folders. `submit`
        // creates it, and a folder on an unplugged drive surfaces as a plain
        // "could not write" message rather than failing silently.
        PathBuf::from(custom)
    }
}

/// Stable workbook name: readable title + a short id so two forms named the
/// same never collide, and renaming a form doesn't orphan its responses.
pub fn excel_path(form: &FormDef) -> PathBuf {
    let short: String = form.id.chars().take(6).collect();
    let title = if form.title.trim().is_empty() {
        "Untitled form".to_string()
    } else {
        form.title.clone()
    };
    form_dir(form).join(format!("{} ({}).xlsx", sanitize(&title), short))
}

/// Where uploaded photos for one form are filed, beside its workbook.
pub fn photos_dir(form: &FormDef) -> PathBuf {
    let short: String = form.id.chars().take(6).collect();
    let title = if form.title.trim().is_empty() {
        "Untitled form".to_string()
    } else {
        form.title.clone()
    };
    form_dir(form).join(format!("{} ({}) photos", sanitize(&title), short))
}

/// Pull a `data:image/...;base64,...` cell out to a real file and leave the
/// file name in the sheet instead.
///
/// Base64 of a phone photo is hundreds of kilobytes; dropping that into a cell
/// would make the workbook unopenable within a term. A file on disk next to the
/// workbook is also what a school actually wants — you can print it.
fn extract_photos(form: &FormDef, headers: &[String], values: &[String]) -> Vec<String> {
    use base64::Engine;

    let mut out: Vec<String> = Vec::with_capacity(values.len());
    let mut made_dir = false;
    let dir = photos_dir(form);
    let stamp = chrono::Local::now().format("%Y-%m-%d %H%M%S").to_string();

    for (i, v) in values.iter().enumerate() {
        let Some(rest) = v.strip_prefix("data:") else {
            out.push(v.clone());
            continue;
        };
        let Some((meta, b64)) = rest.split_once(";base64,") else {
            out.push(v.clone());
            continue;
        };
        if !meta.starts_with("image/") {
            out.push(v.clone());
            continue;
        }
        let ext = match meta {
            "image/png" => "png",
            "image/webp" => "webp",
            "image/gif" => "gif",
            _ => "jpg",
        };
        let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()) else {
            out.push(String::new());
            continue;
        };
        if !made_dir {
            if fs::create_dir_all(&dir).is_err() {
                out.push(v.clone());
                continue;
            }
            made_dir = true;
        }
        let label = headers.get(i).map(|h| sanitize(h)).unwrap_or_else(|| "Photo".into());
        let mut name = format!("{stamp} — {label}.{ext}");
        let mut n = 2;
        while dir.join(&name).exists() {
            name = format!("{stamp} — {label} ({n}).{ext}");
            n += 1;
        }
        match fs::write(dir.join(&name), &bytes) {
            Ok(_) => out.push(name),
            // Keep the data URL rather than silently dropping the answer.
            Err(_) => out.push(v.clone()),
        }
    }
    out
}

pub fn load_form(id: &str) -> Result<FormDef> {
    let p = form_path(id);
    let txt = fs::read_to_string(&p).map_err(|e| anyhow!("form {id} not found: {e}"))?;
    Ok(serde_json::from_str(&txt)?)
}

/// Raw JSON, so the frontend gets back every field it wrote even if Rust
/// doesn't model it yet.
pub fn load_form_raw(id: &str) -> Result<serde_json::Value> {
    let txt = fs::read_to_string(form_path(id))?;
    Ok(serde_json::from_str(&txt)?)
}

pub fn save_form(value: &serde_json::Value) -> Result<()> {
    ensure_dirs()?;
    let id = value
        .get("id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("form is missing an id"))?;

    // If the title changed, carry the existing workbook over to the new name so
    // responses stay attached to the form.
    if let Ok(old) = load_form(id) {
        let old_path = excel_path(&old);
        let new: FormDef = serde_json::from_value(value.clone())?;
        let new_path = excel_path(&new);
        if old_path != new_path && old_path.exists() {
            let _ = fs::rename(&old_path, &new_path);
        }
    }

    let tmp = form_path(id).with_extension("json.tmp");
    fs::write(&tmp, serde_json::to_string_pretty(value)?)?;
    let _ = fs::remove_file(form_path(id));
    fs::rename(&tmp, form_path(id))?;
    Ok(())
}

pub fn delete_form(id: &str, delete_responses: bool) -> Result<()> {
    if delete_responses {
        if let Ok(f) = load_form(id) {
            let _ = fs::remove_file(excel_path(&f));
        }
        let _ = fs::remove_file(recovery_dir().join(format!("{}.jsonl", sanitize(id))));
    }
    fs::remove_file(form_path(id))?;
    Ok(())
}

pub fn list_forms() -> Result<Vec<FormSummary>> {
    ensure_dirs()?;
    let mut out = Vec::new();
    for entry in fs::read_dir(forms_dir())? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(txt) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(form) = serde_json::from_str::<FormDef>(&txt) else {
            continue;
        };
        let xp = excel_path(&form);
        out.push(FormSummary {
            id: form.id.clone(),
            style: form.settings.style.clone(),
            title: if form.title.trim().is_empty() {
                "Untitled form".into()
            } else {
                form.title.clone()
            },
            description: form.description.clone(),
            institution: form.settings.institution.clone(),
            question_count: form
                .questions
                .iter()
                .filter(|q| q.kind != "section" && q.kind != "image")
                .count(),
            response_count: excel::count_rows(&xp),
            updated_at: form.updated_at.clone(),
            created_at: form.created_at.clone(),
            accepting_responses: form.settings.accepting_responses,
            excel_path: xp.to_string_lossy().to_string(),
        });
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(out)
}

/// Append-only safety net written *before* the workbook is rewritten. If a
/// rewrite ever fails, nothing is lost — the line is already on disk.
fn write_recovery(form_id: &str, headers: &[String], values: &[String]) {
    let _ = fs::create_dir_all(recovery_dir());
    let path = recovery_dir().join(format!("{}.jsonl", sanitize(form_id)));
    let rec = serde_json::json!({
        "at": chrono::Local::now().to_rfc3339(),
        "headers": headers,
        "values": values,
    });
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{rec}");
    }
}

pub fn submit(form_id: &str, headers: &[String], values: &[String]) -> Result<usize> {
    ensure_dirs()?;
    let form = load_form(form_id)?;
    if !form.settings.accepting_responses {
        return Err(anyhow!("This form is closed and is not accepting responses."));
    }
    // The recovery line is written first and keeps the full data URL, so a
    // photo survives even if the workbook write fails.
    write_recovery(form_id, headers, values);

    let path = excel_path(&form);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            anyhow!(
                "Could not use the folder {}. Check it still exists.\n\n{e}",
                parent.display()
            )
        })?;
    }

    let values = extract_photos(&form, headers, values);
    let values: &[String] = &values;

    excel::append_row(&path, headers, values).map_err(|e| {
        anyhow!(
            "Could not write to {}. If the workbook is open in Excel, close it and try again.\n\n{e}",
            path.display()
        )
    })?;
    Ok(excel::count_rows(&path))
}

pub fn responses(form_id: &str) -> Result<ResponseTable> {
    let form = load_form(form_id)?;
    let path = excel_path(&form);
    let (headers, rows) = excel::read_table(&path)?;
    Ok(ResponseTable {
        headers,
        rows,
        path: path.to_string_lossy().to_string(),
    })
}

pub fn clear_responses(form_id: &str) -> Result<()> {
    let form = load_form(form_id)?;
    let path = excel_path(&form);
    if path.exists() {
        fs::remove_file(&path)?;
    }
    Ok(())
}

pub fn path_exists(p: &str) -> bool {
    Path::new(p).exists()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::FormDef;

    fn form_in(dir: &Path) -> FormDef {
        let mut f = FormDef::default();
        f.id = "abcdef123456".into();
        f.title = "Admission 2083".into();
        f.settings.data_folder = dir.to_string_lossy().to_string();
        f
    }

    #[test]
    fn a_custom_folder_wins_over_the_default() {
        let tmp = std::env::temp_dir().join("jws-test-folder");
        let form = form_in(&tmp);
        let p = excel_path(&form);
        assert!(p.starts_with(&tmp), "{p:?} should sit in the chosen folder");
        assert_eq!(
            p.file_name().unwrap().to_string_lossy(),
            "Admission 2083 (abcdef).xlsx"
        );
    }

    #[test]
    fn an_empty_folder_falls_back_to_the_app_default() {
        let mut form = FormDef::default();
        form.id = "abcdef123456".into();
        form.settings.data_folder = "   ".into();
        assert_eq!(form_dir(&form), responses_dir());
    }

    #[test]
    fn a_photo_answer_becomes_a_file_and_leaves_its_name_in_the_cell() {
        let tmp = std::env::temp_dir().join(format!("jws-photo-{}", std::process::id()));
        let _ = fs::remove_dir_all(&tmp);
        let form = form_in(&tmp);

        // 1×1 red PNG.
        let png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
        let headers = vec!["Timestamp".to_string(), "Photo of the birth certificate".to_string()];
        let values = vec!["2026-09-01".to_string(), png.to_string()];

        let out = extract_photos(&form, &headers, &values);
        assert_eq!(out[0], "2026-09-01", "plain cells are untouched");
        assert!(out[1].ends_with(".png"), "got {}", out[1]);
        assert!(
            !out[1].starts_with("data:"),
            "the data URL must not reach the sheet"
        );
        assert!(photos_dir(&form).join(&out[1]).exists(), "the file should be on disk");

        // A second photo in the same second must not overwrite the first.
        let again = extract_photos(&form, &headers, &values);
        assert_ne!(again[1], out[1]);
        assert!(photos_dir(&form).join(&again[1]).exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn a_non_image_data_url_is_left_alone() {
        let tmp = std::env::temp_dir().join("jws-test-nonimage");
        let form = form_in(&tmp);
        let headers = vec!["Note".to_string()];
        let values = vec!["data:text/plain;base64,aGVsbG8=".to_string()];
        assert_eq!(extract_photos(&form, &headers, &values), values);
        assert!(!photos_dir(&form).exists());
    }
}
