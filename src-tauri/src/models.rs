use serde::{Deserialize, Serialize};

/// A single selectable option, grid row, or grid column.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Choice {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Scale {
    #[serde(default = "one")]
    pub min: i64,
    #[serde(default = "five")]
    pub max: i64,
    #[serde(default)]
    pub min_label: String,
    #[serde(default)]
    pub max_label: String,
}

fn one() -> i64 {
    1
}
fn five() -> i64 {
    5
}

/// Deliberately permissive: unknown fields coming from a newer frontend are ignored
/// rather than failing the whole load.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Question {
    #[serde(default)]
    pub id: String,
    #[serde(rename = "type", default)]
    pub kind: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub placeholder: String,
    #[serde(default)]
    pub options: Vec<Choice>,
    #[serde(default)]
    pub rows: Vec<Choice>,
    #[serde(default)]
    pub columns: Vec<Choice>,
    #[serde(default)]
    pub has_other: bool,
    #[serde(default)]
    pub scale: Scale,
    #[serde(default = "five")]
    pub rating_max: i64,
    /// A picture block's artwork, held as a data URL.
    #[serde(default)]
    pub image: String,
    #[serde(default)]
    pub image_caption: String,
    #[serde(default)]
    pub image_width: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormSettings {
    #[serde(default = "default_style")]
    pub style: String,
    /// "school" | "plus2" | "college" — decides the logo on the form.
    #[serde(default = "default_institution")]
    pub institution: String,
    /// Where this form's workbook is written. Empty = the app-wide folder.
    #[serde(default)]
    pub data_folder: String,
    #[serde(default = "default_thanks")]
    pub confirmation_message: String,
    #[serde(default = "yes")]
    pub allow_multiple: bool,
    #[serde(default = "yes")]
    pub show_progress: bool,
    #[serde(default)]
    pub collect_timestamp: bool,
    #[serde(default = "default_accent")]
    pub accent: String,
    #[serde(default)]
    pub accepting_responses: bool,
}

fn default_thanks() -> String {
    "Your response has been recorded. Thank you!".to_string()
}
fn yes() -> bool {
    true
}
fn default_accent() -> String {
    "#F06522".to_string()
}
fn default_style() -> String {
    "panel".to_string()
}
fn default_institution() -> String {
    "school".to_string()
}

impl Default for FormSettings {
    fn default() -> Self {
        Self {
            style: default_style(),
            institution: default_institution(),
            data_folder: String::new(),
            confirmation_message: default_thanks(),
            allow_multiple: true,
            show_progress: true,
            collect_timestamp: true,
            accent: default_accent(),
            accepting_responses: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FormDef {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub questions: Vec<Question>,
    #[serde(default)]
    pub settings: FormSettings,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

/// Lightweight row shown on the home screen so we never load every form in full.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormSummary {
    pub id: String,
    pub title: String,
    pub style: String,
    pub institution: String,
    pub description: String,
    pub question_count: usize,
    pub response_count: usize,
    pub updated_at: String,
    pub created_at: String,
    pub accepting_responses: bool,
    pub excel_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseTable {
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub running: bool,
    pub form_id: String,
    pub form_title: String,
    pub url: String,
    pub port: u16,
    pub qr_svg: String,
}
