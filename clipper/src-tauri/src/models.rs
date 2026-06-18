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
    pub theme: String,
    pub max_items: i64,
    pub shortcut: String,
    pub launch_at_startup: bool,
    pub monitor_paused: bool,
    pub ignore_apps: Vec<String>,

    // Retention
    #[serde(default)]
    pub auto_delete_days: i64,
    #[serde(default = "default_true")]
    pub keep_favorites: bool,
    #[serde(default = "default_true")]
    pub keep_pinned: bool,

    // AI providers
    #[serde(default = "default_provider")]
    pub ai_provider: String, // "ollama" | "openai" | "anthropic"
    pub ollama_url: String,
    pub ollama_model: String,
    #[serde(default)]
    pub openai_api_key: String,
    #[serde(default = "default_openai_base")]
    pub openai_base_url: String,
    #[serde(default = "default_openai_model")]
    pub openai_model: String,
    #[serde(default)]
    pub anthropic_api_key: String,
    #[serde(default = "default_anthropic_model")]
    pub anthropic_model: String,

    // Customization
    #[serde(default = "default_accent")]
    pub accent_color: String, // hex "#a3e635"
    #[serde(default = "default_font")]
    pub font_family: String, // "geist" | "inter" | "jetbrains" | "ibm-plex" | "system"
    #[serde(default = "default_density")]
    pub density: String, // "comfortable" | "compact"
    #[serde(default = "default_true")]
    pub show_grain: bool,
}

fn default_true() -> bool { true }
fn default_provider() -> String { "ollama".into() }
fn default_openai_base() -> String { "https://api.openai.com".into() }
fn default_openai_model() -> String { "gpt-4o-mini".into() }
fn default_anthropic_model() -> String { "claude-haiku-4-5-20251001".into() }
fn default_accent() -> String { "#a3e635".into() }
fn default_font() -> String { "geist".into() }
fn default_density() -> String { "comfortable".into() }

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "auto".into(),
            max_items: 0,
            shortcut: "Ctrl+Shift+V".into(),
            launch_at_startup: false,
            monitor_paused: false,
            ignore_apps: vec![],
            auto_delete_days: 0,
            keep_favorites: true,
            keep_pinned: true,
            ai_provider: default_provider(),
            ollama_url: "http://localhost:11434".into(),
            ollama_model: "llama3.2:3b".into(),
            openai_api_key: String::new(),
            openai_base_url: default_openai_base(),
            openai_model: default_openai_model(),
            anthropic_api_key: String::new(),
            anthropic_model: default_anthropic_model(),
            accent_color: default_accent(),
            font_family: default_font(),
            density: default_density(),
            show_grain: true,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct ListParams {
    pub query: Option<String>,
    pub kind: Option<String>,
    pub kinds: Option<Vec<String>>,
    pub category: Option<String>,
    pub tag: Option<String>,
    pub tags: Option<Vec<String>>,
    pub pinned_only: bool,
    pub favorites_only: bool,
    pub has_category: Option<bool>,
    pub has_tags: Option<bool>,
    pub language: Option<String>,
    pub size_min: Option<i64>,
    pub size_max: Option<i64>,
    pub use_count_min: Option<i64>,
    pub created_from: Option<String>,
    pub created_to: Option<String>,
    pub time_range: Option<String>,
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
