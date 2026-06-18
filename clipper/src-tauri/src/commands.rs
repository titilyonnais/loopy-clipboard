use crate::ai;
use crate::clipboard_monitor::{write_files, write_image_png_b64, write_text, MonitorHandle};
use crate::db::Db;
use crate::files::{info_of, read_image_data_uri, FileInfo};
use crate::models::{AIResponse, ClipItem, ListParams, Settings, Stats};
use base64::Engine;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};

pub struct AppState {
    pub db: Arc<Db>,
    pub monitor: MonitorHandle,
}

#[tauri::command]
pub fn list_clips(params: ListParams, state: State<'_, AppState>) -> Result<Vec<ClipItem>, String> {
    state.db.list(&params).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_clip(id: i64, state: State<'_, AppState>) -> Result<Option<ClipItem>, String> {
    state.db.get(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(
    id: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<(), String> {
    let clip = state
        .db
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Clip introuvable".to_string())?;
    if clip.kind == "image" {
        write_image_png_b64(&clip.content).map_err(|e| e.to_string())?;
    } else if clip.kind == "file" {
        let paths: Vec<String> = serde_json::from_str(&clip.content).unwrap_or_default();
        write_files(&paths).map_err(|e| e.to_string())?;
    } else {
        write_text(&clip.content).map_err(|e| e.to_string())?;
    }
    state.db.bump_used(id).map_err(|e| e.to_string())?;
    let _ = app.emit("clip:updated", serde_json::json!({ "id": id }));
    Ok(())
}

#[tauri::command]
pub fn copy_as(
    id: i64,
    format: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<String, String> {
    let clip = state
        .db
        .get(id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Clip introuvable".to_string())?;
    if clip.kind == "image" {
        return Err("Format non supporté pour les images".into());
    }
    let transformed = match format.as_str() {
        "plain" => clip.content.clone(),
        "lowercase" => clip.content.to_lowercase(),
        "uppercase" => clip.content.to_uppercase(),
        "trim" => clip.content.trim().to_string(),
        "json_escape" => serde_json::to_string(&clip.content).unwrap_or_default(),
        "url_encode" => url_encode(&clip.content),
        "base64" => base64::engine::general_purpose::STANDARD.encode(clip.content.as_bytes()),
        _ => return Err(format!("Format inconnu: {}", format)),
    };
    write_text(&transformed).map_err(|e| e.to_string())?;
    state.db.bump_used(id).map_err(|e| e.to_string())?;
    let _ = app.emit("clip:updated", serde_json::json!({ "id": id }));
    Ok(transformed)
}

#[tauri::command]
pub fn toggle_pin(id: i64, state: State<'_, AppState>) -> Result<Option<ClipItem>, String> {
    state.db.toggle_pin(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_favorite(id: i64, state: State<'_, AppState>) -> Result<Option<ClipItem>, String> {
    state.db.toggle_favorite(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_tags(
    id: i64,
    tags: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Option<ClipItem>, String> {
    state.db.update_tags(id, &tags).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_category(
    id: i64,
    category: Option<String>,
    state: State<'_, AppState>,
) -> Result<Option<ClipItem>, String> {
    state
        .db
        .update_category(id, category.as_deref())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_clip(id: i64, state: State<'_, AppState>) -> Result<(), String> {
    state.db.delete(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_all(
    keep_pinned: bool,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<usize, String> {
    let n = state.db.clear_all(keep_pinned).map_err(|e| e.to_string())?;
    // Notify the UI so the main list refreshes immediately, even when the
    // Settings modal is open on top of it.
    let _ = app.emit("clip:cleared", n);
    Ok(n)
}

#[tauri::command]
pub fn cleanup_now(state: State<'_, AppState>) -> Result<usize, String> {
    let s = state.db.get_settings().map_err(|e| e.to_string())?;
    state
        .db
        .cleanup_expired(s.auto_delete_days, s.keep_favorites, s.keep_pinned)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn check_paths(paths: Vec<String>) -> Vec<FileInfo> {
    paths.iter().map(|p| info_of(p)).collect()
}

#[tauri::command]
pub fn read_image_b64(path: String) -> Result<String, String> {
    read_image_data_uri(&path)
}

#[tauri::command]
pub fn get_histogram(
    days: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<(String, i64)>, String> {
    state
        .db
        .histogram(days.unwrap_or(30))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_stats(state: State<'_, AppState>) -> Result<Stats, String> {
    state.db.stats().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_categories(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.categories().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_tags(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.tags().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_languages(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.db.languages().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn category_counts(state: State<'_, AppState>) -> Result<Vec<(String, i64)>, String> {
    state.db.category_counts().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn tag_counts(state: State<'_, AppState>) -> Result<Vec<(String, i64)>, String> {
    state.db.tag_counts().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_category(
    old: String,
    new: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<usize, String> {
    let n = state.db.rename_category(&old, &new).map_err(|e| e.to_string())?;
    let _ = app.emit("clip:updated", serde_json::json!({ "id": 0 }));
    Ok(n)
}

#[tauri::command]
pub fn delete_category(
    name: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<usize, String> {
    let n = state.db.delete_category(&name).map_err(|e| e.to_string())?;
    let _ = app.emit("clip:updated", serde_json::json!({ "id": 0 }));
    Ok(n)
}

#[tauri::command]
pub fn rename_tag(
    old: String,
    new: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<usize, String> {
    let n = state.db.rename_tag(&old, &new).map_err(|e| e.to_string())?;
    let _ = app.emit("clip:updated", serde_json::json!({ "id": 0 }));
    Ok(n)
}

#[tauri::command]
pub fn delete_tag(
    name: String,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<usize, String> {
    let n = state.db.delete_tag(&name).map_err(|e| e.to_string())?;
    let _ = app.emit("clip:updated", serde_json::json!({ "id": 0 }));
    Ok(n)
}

#[tauri::command]
pub async fn ai_translate(
    id: i64,
    target_lang: String,
    state: State<'_, AppState>,
) -> Result<AIResponse, String> {
    Ok(ai::translate(state.db.clone(), id, target_lang).await)
}

#[tauri::command]
pub async fn ai_fix_grammar(
    id: i64,
    state: State<'_, AppState>,
) -> Result<AIResponse, String> {
    Ok(ai::fix_grammar(state.db.clone(), id).await)
}

#[tauri::command]
pub async fn ai_smart_tag(
    id: i64,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<AIResponse, String> {
    let res = ai::smart_tag(state.db.clone(), id).await;
    if res.ok {
        let _ = app.emit("clip:updated", serde_json::json!({ "id": id }));
    }
    Ok(res)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("Fichier introuvable.".into());
    }
    if let Ok(meta) = p.metadata() {
        // Hard cap at 50 MB to avoid hanging on huge files.
        if meta.len() > 50 * 1024 * 1024 {
            return Err("Fichier trop volumineux (max 50 Mo).".into());
        }
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("Le fichier n'existe plus à cet emplacement.".into());
    }
    spawn_open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("Le fichier n'existe plus à cet emplacement.".into());
    }
    spawn_reveal(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_clips(state: State<'_, AppState>) -> Result<String, String> {
    let params = crate::models::ListParams {
        limit: Some(i64::MAX),
        ..Default::default()
    };
    let clips = state.db.list(&params).map_err(|e| e.to_string())?;
    let payload = serde_json::json!({
        "app": "clipper",
        "version": 1,
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "count": clips.len(),
        "clips": clips,
    });
    serde_json::to_string_pretty(&payload).map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct ImportResult {
    pub imported: usize,
    pub skipped: usize,
    pub total: usize,
}

#[tauri::command]
pub fn import_clips(json: String, state: State<'_, AppState>) -> Result<ImportResult, String> {
    let v: serde_json::Value = serde_json::from_str(&json)
        .map_err(|e| format!("JSON invalide: {}", e))?;
    let clips = v
        .get("clips")
        .and_then(|c| c.as_array())
        .ok_or_else(|| "Format invalide : clé 'clips' absente.".to_string())?;
    let total = clips.len();
    let mut imported = 0usize;
    let mut skipped = 0usize;
    for c in clips {
        let hash = c.get("hash").and_then(|v| v.as_str()).unwrap_or("");
        let content = c.get("content").and_then(|v| v.as_str()).unwrap_or("");
        if hash.is_empty() || content.is_empty() {
            skipped += 1;
            continue;
        }
        let kind = c.get("kind").and_then(|v| v.as_str()).unwrap_or("text");
        let preview = c.get("preview").and_then(|v| v.as_str()).unwrap_or(content);
        let language = c.get("language").and_then(|v| v.as_str());
        let category = c.get("category").and_then(|v| v.as_str());
        let tags_arr = c.get("tags").cloned().unwrap_or_else(|| serde_json::json!([]));
        let tags_json = serde_json::to_string(&tags_arr).unwrap_or_else(|_| "[]".into());
        let pinned = c.get("pinned").and_then(|v| v.as_bool()).unwrap_or(false);
        let favorite = c.get("favorite").and_then(|v| v.as_bool()).unwrap_or(false);
        let source_app = c.get("source_app").and_then(|v| v.as_str());
        let size_bytes = c.get("size_bytes").and_then(|v| v.as_i64()).unwrap_or(content.len() as i64);
        let now = chrono::Utc::now().to_rfc3339();
        let created_at = c.get("created_at").and_then(|v| v.as_str()).unwrap_or(&now);
        let used_at = c.get("used_at").and_then(|v| v.as_str()).unwrap_or(created_at);
        let use_count = c.get("use_count").and_then(|v| v.as_i64()).unwrap_or(1);
        match state.db.import_clip(
            kind, content, preview, language, category, &tags_json,
            pinned, favorite, source_app, size_bytes, hash,
            created_at, used_at, use_count,
        ) {
            Ok(true) => imported += 1,
            _ => skipped += 1,
        }
    }
    Ok(ImportResult { imported, skipped, total })
}

// ─── Platform-specific file actions ───

#[cfg(windows)]
fn spawn_open(path: &str) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("cmd")
        .args(["/C", "start", "", path])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map(|_| ())
}

#[cfg(windows)]
fn spawn_reveal(path: &str) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    // /select, requires the comma immediately followed by the (possibly quoted) path
    // in a SINGLE command-line argument. Use raw_arg to bypass Rust's automatic
    // quoting, which would otherwise produce `"/select," "C:\..."` and make
    // Explorer open the default folder instead.
    let arg = format!("/select,\"{}\"", path);
    std::process::Command::new("explorer.exe")
        .raw_arg(&arg)
        .creation_flags(0x08000000)
        .spawn()
        .map(|_| ())
}

#[cfg(target_os = "macos")]
fn spawn_open(path: &str) -> std::io::Result<()> {
    std::process::Command::new("open").arg(path).spawn().map(|_| ())
}

#[cfg(target_os = "macos")]
fn spawn_reveal(path: &str) -> std::io::Result<()> {
    std::process::Command::new("open").args(["-R", path]).spawn().map(|_| ())
}

#[cfg(target_os = "linux")]
fn spawn_open(path: &str) -> std::io::Result<()> {
    std::process::Command::new("xdg-open").arg(path).spawn().map(|_| ())
}

#[cfg(target_os = "linux")]
fn spawn_reveal(path: &str) -> std::io::Result<()> {
    let p = std::path::Path::new(path);
    let parent = p.parent().unwrap_or(p);
    std::process::Command::new("xdg-open").arg(parent).spawn().map(|_| ())
}

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    state.db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_settings(
    settings: Settings,
    state: State<'_, AppState>,
    app: AppHandle,
) -> Result<Settings, String> {
    state.db.set_settings(&settings).map_err(|e| e.to_string())?;
    // Apply paused state immediately
    let _ = state.monitor.paused_tx.send(settings.monitor_paused);
    // Re-register global shortcut (handles empty = disabled)
    crate::register_shortcut(&app, &settings.shortcut);
    Ok(settings)
}

#[tauri::command]
pub fn pause_monitor(paused: bool, state: State<'_, AppState>) -> Result<(), String> {
    let mut s = state.db.get_settings().map_err(|e| e.to_string())?;
    s.monitor_paused = paused;
    state.db.set_settings(&s).map_err(|e| e.to_string())?;
    let _ = state.monitor.paused_tx.send(paused);
    Ok(())
}

#[tauri::command]
pub fn hide_window(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    Ok(())
}

#[tauri::command]
pub async fn ai_health(state: State<'_, AppState>) -> Result<AIResponse, String> {
    Ok(ai::health(state.db.clone()).await)
}

#[tauri::command]
pub async fn ai_summarize(id: i64, state: State<'_, AppState>) -> Result<AIResponse, String> {
    Ok(ai::summarize(state.db.clone(), id).await)
}

#[tauri::command]
pub async fn ai_explain(id: i64, state: State<'_, AppState>) -> Result<AIResponse, String> {
    Ok(ai::explain(state.db.clone(), id).await)
}

#[tauri::command]
pub async fn ai_rephrase(
    id: i64,
    style: String,
    state: State<'_, AppState>,
) -> Result<AIResponse, String> {
    Ok(ai::rephrase(state.db.clone(), id, style).await)
}

fn url_encode(s: &str) -> String {
    const SAFE: &[u8] = b"-_.~";
    let mut out = String::with_capacity(s.len());
    for b in s.as_bytes() {
        if b.is_ascii_alphanumeric() || SAFE.contains(b) {
            out.push(*b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}
