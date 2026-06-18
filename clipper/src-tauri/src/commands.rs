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
pub fn clear_all(keep_pinned: bool, state: State<'_, AppState>) -> Result<usize, String> {
    state.db.clear_all(keep_pinned).map_err(|e| e.to_string())
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
pub fn get_settings(state: State<'_, AppState>) -> Result<Settings, String> {
    state.db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_settings(settings: Settings, state: State<'_, AppState>) -> Result<Settings, String> {
    state.db.set_settings(&settings).map_err(|e| e.to_string())?;
    // Apply paused state immediately
    let _ = state.monitor.paused_tx.send(settings.monitor_paused);
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
