use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipItem {
    pub id: i64,
    pub kind: String,           // text | image | code | url | file
    pub content: String,
    pub preview: String,
    pub language: Option<String>,
    pub category: Option<String>,
    pub tags: Vec<String>,
    pub pinned: bool,
    pub favorite: bool,
    pub source_app: Option<String>,
    pub size_bytes: i64,
    pub hash: String,
    pub created_at: String,
    pub used_at: String,
    pub use_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Stats {
    pub total: i64,
    pub text: i64,
    pub image: i64,
    pub code: i64,
    pub url: i64,
    pub file: i64,
    pub pinned: i64,
    pub favorites: i64,
    pub bytes: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String, // dark | light | auto
    pub max_items: i64,
    pub shortcut: String,
    pub launch_at_startup: bool,
    pub monitor_paused: bool,
    pub ignore_apps: Vec<String>,
    pub ollama_url: String,
    pub ollama_model: String,
    /// Auto-delete items older than N days. 0 = never auto-delete.
    #[serde(default)]
    pub auto_delete_days: i64,
    /// When auto-deleting, keep favorites too (pinned items are always kept).
    #[serde(default = "default_true")]
    pub keep_favorites: bool,
}

fn default_true() -> bool {
    true
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "auto".into(),
            max_items: 0,
            shortcut: "Ctrl+Shift+V".into(),
            launch_at_startup: false,
            monitor_paused: false,
            ignore_apps: vec![],
            ollama_url: "http://localhost:11434".into(),
            ollama_model: "llama3.2:3b".into(),
            auto_delete_days: 0,
            keep_favorites: true,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ListParams {
    pub query: Option<String>,
    pub kind: Option<String>,
    pub category: Option<String>,
    pub tag: Option<String>,
    pub pinned_only: bool,
    pub favorites_only: bool,
    /// "today" | "yesterday" | "week" | "month" | "year" | "YYYY-MM-DD"
    pub time_range: Option<String>,
    /// "recent" (default) | "popular" | "oldest"
    pub sort: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AIResponse {
    pub ok: bool,
    pub text: String,
    pub error: Option<String>,
}
