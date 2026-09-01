//! Direct-to-Excel response storage.
//!
//! Every form owns exactly one .xlsx workbook. A submission is written by
//! read -> merge -> rewrite-atomically, so the file on disk is always a complete,
//! valid workbook: we never leave a half-written file behind, and if the app is
//! killed mid-write the original is untouched.
//!
//! Header drift is handled: if you add a question to a form that already has
//! responses, the new column is appended and older rows keep empty cells there.

use anyhow::{anyhow, Result};
use calamine::{open_workbook_auto, Data, Reader};
use rust_xlsxwriter::{Format, FormatAlign, FormatBorder, Workbook};
use std::path::{Path, PathBuf};

pub const BRAND: u32 = 0xF06522;
const BRAND_TINT: u32 = 0xFFF4ED;
const INK: u32 = 0x2A2118;
const RULE: u32 = 0xEADDD3;

/// Read an existing workbook into (headers, rows). Missing file -> empty table.
pub fn read_table(path: &Path) -> Result<(Vec<String>, Vec<Vec<String>>)> {
    if !path.exists() {
        return Ok((Vec::new(), Vec::new()));
    }
    let mut wb = open_workbook_auto(path).map_err(|e| anyhow!("cannot open workbook: {e}"))?;
    let name = wb
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| anyhow!("workbook has no sheets"))?;
    let range = wb
        .worksheet_range(&name)
        .map_err(|e| anyhow!("cannot read sheet: {e}"))?;

    let mut iter = range.rows();
    let headers: Vec<String> = match iter.next() {
        Some(r) => r.iter().map(cell_to_string).collect(),
        None => return Ok((Vec::new(), Vec::new())),
    };
    let mut rows = Vec::new();
    for r in iter {
        let row: Vec<String> = r.iter().map(cell_to_string).collect();
        if row.iter().all(|c| c.trim().is_empty()) {
            continue;
        }
        rows.push(row);
    }
    Ok((headers, rows))
}

fn cell_to_string(c: &Data) -> String {
    match c {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => {
            if (f.fract()).abs() < f64::EPSILON {
                format!("{}", *f as i64)
            } else {
                format!("{f}")
            }
        }
        Data::Int(i) => i.to_string(),
        Data::Bool(b) => if *b { "Yes" } else { "No" }.to_string(),
        Data::DateTime(d) => d.to_string(),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
        Data::Error(e) => format!("{e:?}"),
    }
}

/// Append one response, merging any new columns in.
pub fn append_row(path: &Path, new_headers: &[String], new_values: &[String]) -> Result<()> {
    let (mut headers, mut rows) = read_table(path)?;

    if headers.is_empty() {
        headers = new_headers.to_vec();
    } else {
        for h in new_headers {
            if !headers.iter().any(|e| e == h) {
                headers.push(h.clone());
            }
        }
    }

    // Pad historic rows out to the (possibly wider) header set.
    for r in rows.iter_mut() {
        while r.len() < headers.len() {
            r.push(String::new());
        }
    }

    // Place the incoming values by header name, not by position.
    let mut row = vec![String::new(); headers.len()];
    for (i, h) in new_headers.iter().enumerate() {
        if let Some(pos) = headers.iter().position(|e| e == h) {
            row[pos] = new_values.get(i).cloned().unwrap_or_default();
        }
    }
    rows.push(row);

    write_table(path, &headers, &rows)
}

/// Write the whole table out, styled, via a temp file + rename.
pub fn write_table(path: &Path, headers: &[String], rows: &[Vec<String>]) -> Result<()> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }

    let mut wb = Workbook::new();
    let sheet = wb.add_worksheet();
    sheet.set_name("Responses")?;

    let head = Format::new()
        .set_bold()
        .set_font_color(0xFFFFFF)
        .set_background_color(BRAND)
        .set_align(FormatAlign::Left)
        .set_align(FormatAlign::VerticalCenter)
        .set_text_wrap()
        .set_border(FormatBorder::Thin)
        .set_border_color(BRAND);

    let body = Format::new()
        .set_font_color(INK)
        .set_align(FormatAlign::Top)
        .set_text_wrap()
        .set_border(FormatBorder::Thin)
        .set_border_color(RULE);

    let body_alt = body.clone().set_background_color(BRAND_TINT);

    sheet.set_row_height(0, 30)?;
    for (c, h) in headers.iter().enumerate() {
        sheet.write_string_with_format(0, c as u16, h, &head)?;
    }

    for (r, row) in rows.iter().enumerate() {
        let fmt = if r % 2 == 1 { &body_alt } else { &body };
        for c in 0..headers.len() {
            let v = row.get(c).map(String::as_str).unwrap_or("");
            sheet.write_string_with_format((r + 1) as u32, c as u16, v, fmt)?;
        }
    }

    // Sensible column widths based on the longest cell, clamped so one long
    // paragraph answer doesn't blow the sheet out to 200 characters wide.
    for (c, h) in headers.iter().enumerate() {
        let mut w = h.chars().count();
        for row in rows.iter() {
            if let Some(v) = row.get(c) {
                w = w.max(v.chars().count().min(60));
            }
        }
        let width = (w as f64 + 4.0).clamp(12.0, 52.0);
        sheet.set_column_width(c as u16, width)?;
    }

    if !headers.is_empty() {
        sheet.set_freeze_panes(1, 0)?;
        let last_row = rows.len().max(1) as u32;
        sheet.autofilter(0, 0, last_row, (headers.len() - 1) as u16)?;
    }

    let tmp = temp_sibling(path);
    wb.save(&tmp)?;

    // Replace atomically where the platform allows it.
    if path.exists() {
        let _ = std::fs::remove_file(path);
    }
    std::fs::rename(&tmp, path)?;
    Ok(())
}

fn temp_sibling(path: &Path) -> PathBuf {
    let mut p = path.to_path_buf();
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "responses".into());
    p.set_file_name(format!("~{stem}.tmp.xlsx"));
    p
}

/// Number of data rows (excludes the header) without loading full styling.
pub fn count_rows(path: &Path) -> usize {
    read_table(path).map(|(_, r)| r.len()).unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn tmp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("jws-test-{name}.xlsx"))
    }

    #[test]
    fn round_trips_rows_and_grows_columns() {
        let p = tmp("grow");
        let _ = std::fs::remove_file(&p);

        append_row(&p, &["Timestamp".into(), "Name".into()], &["10:00".into(), "Asha".into()]).unwrap();
        append_row(&p, &["Timestamp".into(), "Name".into()], &["10:05".into(), "Bikash".into()]).unwrap();

        // A question was added to the form: a new column appears.
        append_row(
            &p,
            &["Timestamp".into(), "Name".into(), "Class".into()],
            &["10:09".into(), "Chandra".into(), "8B".into()],
        )
        .unwrap();

        let (h, rows) = read_table(&p).unwrap();
        assert_eq!(h, vec!["Timestamp", "Name", "Class"]);
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0], vec!["10:00", "Asha", ""]);
        assert_eq!(rows[2], vec!["10:09", "Chandra", "8B"]);
        assert_eq!(count_rows(&p), 3);
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn maps_values_by_header_not_position() {
        let p = tmp("order");
        let _ = std::fs::remove_file(&p);

        append_row(&p, &["A".into(), "B".into()], &["a1".into(), "b1".into()]).unwrap();
        // Same columns, opposite order — values must still land under their own headers.
        append_row(&p, &["B".into(), "A".into()], &["b2".into(), "a2".into()]).unwrap();

        let (h, rows) = read_table(&p).unwrap();
        assert_eq!(h, vec!["A", "B"]);
        assert_eq!(rows[1], vec!["a2", "b2"]);
        let _ = std::fs::remove_file(&p);
    }

    #[test]
    fn missing_file_reads_as_empty() {
        let (h, r) = read_table(&tmp("nope-does-not-exist")).unwrap();
        assert!(h.is_empty() && r.is_empty());
    }

    #[test]
    fn preserves_text_that_looks_numeric() {
        let p = tmp("text");
        let _ = std::fs::remove_file(&p);
        append_row(&p, &["Phone".into()], &["0098761234".into()]).unwrap();
        let (_, rows) = read_table(&p).unwrap();
        assert_eq!(rows[0][0], "0098761234", "leading zeros must survive");
        let _ = std::fs::remove_file(&p);
    }
}
