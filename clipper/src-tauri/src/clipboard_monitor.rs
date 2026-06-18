use crate::db::Db;
use anyhow::Result;
use arboard::{Clipboard, ImageData};
use base64::Engine;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::watch;

#[derive(Clone)]
pub struct MonitorHandle {
    pub paused_tx: watch::Sender<bool>,
}

pub fn start_monitor(app: AppHandle, db: Arc<Db>, initial_paused: bool) -> MonitorHandle {
    let (tx, mut rx) = watch::channel(initial_paused);
    let handle = MonitorHandle { paused_tx: tx };

    tauri::async_runtime::spawn(async move {
        let mut last_text_hash: Option<String> = None;
        let mut last_image_hash: Option<String> = None;
        let mut last_files_hash: Option<String> = None;
        loop {
            // wait until not paused
            while *rx.borrow() {
                if rx.changed().await.is_err() {
                    return;
                }
            }

            // Poll clipboard
            let res = tokio::task::spawn_blocking(read_clipboard).await;
            if let Ok(Ok(snapshot)) = res {
                match snapshot {
                    ClipSnapshot::Files(paths) => {
                        let joined = paths.join("\n");
                        let h = hash_str(&format!("FILES:{}", joined));
                        if Some(&h) != last_files_hash.as_ref() {
                            last_files_hash = Some(h.clone());
                            if let Err(e) = store_files(&db, &app, &paths, &h).await {
                                log::warn!("store files failed: {e}");
                            }
                        }
                    }
                    ClipSnapshot::Text(text) => {
                        let trimmed = text.trim();
                        if !trimmed.is_empty() {
                            let h = hash_str(&text);
                            if Some(&h) != last_text_hash.as_ref() {
                                last_text_hash = Some(h.clone());
                                if let Err(e) = store_text(&db, &app, &text, &h).await {
                                    log::warn!("store text failed: {e}");
                                }
                            }
                        }
                    }
                    ClipSnapshot::Image(img) => {
                        let h = hash_bytes(&img.bytes);
                        if Some(&h) != last_image_hash.as_ref() {
                            last_image_hash = Some(h.clone());
                            if let Err(e) =
                                store_image(&db, &app, img.width, img.height, &img.bytes_png, &h)
                                    .await
                            {
                                log::warn!("store image failed: {e}");
                            }
                        }
                    }
                    ClipSnapshot::None => {}
                }
            }

            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    });

    handle
}

#[derive(Debug)]
struct ImageSnap {
    width: usize,
    height: usize,
    bytes: Vec<u8>,    // raw RGBA used for hashing
    bytes_png: Vec<u8>, // PNG-encoded bytes
}

enum ClipSnapshot {
    #[allow(dead_code)] // constructed only on Windows via CF_HDROP
    Files(Vec<String>),
    Text(String),
    Image(ImageSnap),
    None,
}

fn read_clipboard() -> Result<ClipSnapshot> {
    // 1) Try files first (Windows Explorer: CF_HDROP)
    #[cfg(windows)]
    if let Some(files) = read_files_windows() {
        if !files.is_empty() {
            return Ok(ClipSnapshot::Files(files));
        }
    }

    let mut cb = match Clipboard::new() {
        Ok(c) => c,
        Err(_) => return Ok(ClipSnapshot::None),
    };
    // 2) Prefer text
    if let Ok(text) = cb.get_text() {
        if !text.is_empty() {
            return Ok(ClipSnapshot::Text(text));
        }
    }
    if let Ok(ImageData { width, height, bytes }) = cb.get_image() {
        // Encode to PNG for storage
        let raw = bytes.to_vec();
        let img = image::RgbaImage::from_raw(width as u32, height as u32, raw.clone())
            .ok_or_else(|| anyhow::anyhow!("invalid image buffer"))?;
        let mut png = Vec::new();
        image::DynamicImage::ImageRgba8(img)
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)?;
        return Ok(ClipSnapshot::Image(ImageSnap {
            width,
            height,
            bytes: raw,
            bytes_png: png,
        }));
    }
    Ok(ClipSnapshot::None)
}

/// Read file paths from the Windows clipboard (CF_HDROP). Returns Some(paths)
/// when at least one file is on the clipboard, otherwise None.
#[cfg(windows)]
fn read_files_windows() -> Option<Vec<String>> {
    use clipboard_win::{formats, get_clipboard};
    // Tries to lock the clipboard a few times to avoid races with other apps.
    match get_clipboard(formats::FileList) {
        Ok(list) if !list.is_empty() => Some(list),
        _ => None,
    }
}

async fn store_text(db: &Db, app: &AppHandle, text: &str, hash: &str) -> Result<()> {
    let (kind, language) = classify(text);
    let preview = make_preview(text);
    let size = text.len() as i64;

    let kind_s = kind.to_string();
    let lang = language.map(|s| s.to_string());
    let preview_s = preview.clone();
    let hash_s = hash.to_string();
    let text_s = text.to_string();
    let db_c = db.clone();

    let inserted = tokio::task::spawn_blocking(move || {
        db_c.insert_clip(
            &kind_s,
            &text_s,
            &preview_s,
            lang.as_deref(),
            None,
            size,
            &hash_s,
        )
    })
    .await??;

    // Enforce max items
    let settings = db.get_settings()?;
    if settings.max_items > 0 {
        let db_c = db.clone();
        let max = settings.max_items;
        let _ = tokio::task::spawn_blocking(move || db_c.enforce_limit(max)).await;
    }

    if let Some(item) = inserted {
        let _ = app.emit("clip:new", &item);
    }
    Ok(())
}

async fn store_image(
    db: &Db,
    app: &AppHandle,
    w: usize,
    h: usize,
    png_bytes: &[u8],
    hash: &str,
) -> Result<()> {
    let b64 = base64::engine::general_purpose::STANDARD.encode(png_bytes);
    let preview = format!("{}×{} · {} KB", w, h, png_bytes.len() / 1024);
    let size = png_bytes.len() as i64;
    let hash_s = hash.to_string();
    let db_c = db.clone();
    let inserted = tokio::task::spawn_blocking(move || {
        db_c.insert_clip("image", &b64, &preview, None, None, size, &hash_s)
    })
    .await??;
    if let Some(item) = inserted {
        let _ = app.emit("clip:new", &item);
    }
    Ok(())
}

async fn store_files(db: &Db, app: &AppHandle, paths: &[String], hash: &str) -> Result<()> {
    // Store the JSON list of paths as content (so we can re-emit them on copy),
    // and build a friendly multi-line preview.
    let content = serde_json::to_string(paths)?;
    let preview = build_files_preview(paths);
    let size: i64 = paths.iter().map(|p| p.len() as i64).sum::<i64>() + 8;
    let hash_s = hash.to_string();
    let preview_s = preview.clone();
    let content_s = content.clone();
    let db_c = db.clone();
    let inserted = tokio::task::spawn_blocking(move || {
        db_c.insert_clip("file", &content_s, &preview_s, None, None, size, &hash_s)
    })
    .await??;
    if let Some(item) = inserted {
        let _ = app.emit("clip:new", &item);
    }
    Ok(())
}

fn build_files_preview(paths: &[String]) -> String {
    let count = paths.len();
    if count == 0 {
        return "(aucun fichier)".into();
    }
    let head: Vec<&str> = paths
        .iter()
        .take(3)
        .map(|p| {
            std::path::Path::new(p)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(p.as_str())
        })
        .collect();
    if count == 1 {
        format!("📄 {}", head[0])
    } else if count <= 3 {
        format!("📄 {} ({})", head.join(", "), count)
    } else {
        format!("📄 {} … (+{} autres)", head.join(", "), count - 3)
    }
}

fn make_preview(text: &str) -> String {
    let mut s: String = text.chars().take(280).collect();
    if text.chars().count() > 280 {
        s.push('…');
    }
    s
}

/// Classify content: returns (kind, language)
pub fn classify(text: &str) -> (&'static str, Option<&'static str>) {
    let t = text.trim();
    if t.is_empty() {
        return ("text", None);
    }
    // URL
    if (t.starts_with("http://") || t.starts_with("https://") || t.starts_with("ftp://"))
        && !t.contains(char::is_whitespace)
    {
        return ("url", None);
    }
    // file paths (Windows or Unix)
    let lines: Vec<&str> = t.lines().collect();
    if lines.iter().all(|l| {
        let l = l.trim();
        !l.is_empty()
            && (l.starts_with("file://")
                || (l.len() > 2
                    && l.as_bytes().get(1) == Some(&b':')
                    && (l.as_bytes()[2] == b'\\' || l.as_bytes()[2] == b'/'))
                || l.starts_with('/'))
            && !l.contains(' ')
    }) && lines.len() <= 20 && lines.len() >= 1 && t.len() < 2000 && t.contains(['/', '\\'])
    {
        return ("file", None);
    }
    // Code
    let lang = detect_lang(t);
    if let Some(l) = lang {
        return ("code", Some(l));
    }
    ("text", None)
}

fn detect_lang(t: &str) -> Option<&'static str> {
    let lower = t.to_lowercase();
    let has_braces = t.contains('{') && t.contains('}');
    let semis = t.matches(';').count();
    let newlines = t.matches('\n').count();
    let has_indent = t.lines().any(|l| l.starts_with("    ") || l.starts_with('\t'));

    // JSON: starts with { or [, contains ":, and balanced
    let trimmed = t.trim();
    if (trimmed.starts_with('{') || trimmed.starts_with('['))
        && (trimmed.ends_with('}') || trimmed.ends_with(']'))
        && trimmed.contains("\":")
    {
        return Some("json");
    }
    // XML / HTML
    if trimmed.starts_with('<') && trimmed.contains("</") {
        if lower.contains("<!doctype html") || lower.contains("<html") {
            return Some("html");
        }
        return Some("xml");
    }
    // SQL
    if (lower.contains("select ") && lower.contains(" from "))
        || lower.starts_with("create table")
        || lower.starts_with("insert into")
        || lower.starts_with("update ")
    {
        return Some("sql");
    }
    // Shell
    if trimmed.starts_with("#!/")
        || trimmed.starts_with("$ ")
        || lower.contains("\nsudo ")
        || lower.contains("npm install")
        || lower.contains("yarn add")
        || lower.contains("cargo run")
    {
        return Some("bash");
    }
    // Rust
    if lower.contains("fn main(") || lower.contains("let mut ") || lower.contains("impl ") {
        return Some("rust");
    }
    // Python
    if (lower.contains("def ") && lower.contains(":\n"))
        || lower.starts_with("import ")
        || lower.contains("\nimport ")
        || lower.contains("print(")
    {
        return Some("python");
    }
    // TypeScript
    if lower.contains("interface ") || lower.contains(": string") || lower.contains(": number") {
        return Some("typescript");
    }
    // JS
    if lower.contains("function ")
        || lower.contains("const ")
        || lower.contains("=> {")
        || lower.contains("console.log")
    {
        return Some("javascript");
    }
    // CSS
    if has_braces && (lower.contains("color:") || lower.contains("background:") || lower.contains("display:")) {
        return Some("css");
    }
    // Generic code heuristic: many newlines + braces or semicolons + indentation
    if newlines >= 2 && (has_braces || semis >= 3) && has_indent {
        return Some("plaintext");
    }
    None
}

pub fn hash_str(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    format!("t:{:x}", h.finalize())
}

pub fn hash_bytes(b: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(b);
    format!("i:{:x}", h.finalize())
}

/// Programmatically write text to clipboard
pub fn write_text(text: &str) -> Result<()> {
    let mut cb = Clipboard::new()?;
    cb.set_text(text.to_string())?;
    Ok(())
}

/// Write raw PNG (base64) to clipboard as image
pub fn write_image_png_b64(b64: &str) -> Result<()> {
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64)?;
    let img = image::load_from_memory(&bytes)?.to_rgba8();
    let (w, h) = img.dimensions();
    let mut cb = Clipboard::new()?;
    cb.set_image(ImageData {
        width: w as usize,
        height: h as usize,
        bytes: img.into_raw().into(),
    })?;
    Ok(())
}

/// Write a list of file paths back to the Windows clipboard so they can be
/// pasted into Explorer/other apps. Falls back to writing the paths as text
/// on non-Windows platforms.
pub fn write_files(paths: &[String]) -> Result<()> {
    #[cfg(windows)]
    {
        use clipboard_win::{formats, set_clipboard};
        set_clipboard(formats::FileList, paths)
            .map_err(|e| anyhow::anyhow!("clipboard-win set failed: {e:?}"))?;
        return Ok(());
    }
    #[cfg(not(windows))]
    {
        // Fallback for non-Windows builds (mainly used for cargo check on Linux/macOS)
        write_text(&paths.join("\n"))?;
        Ok(())
    }
}
