use base64::Engine;
use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct FileInfo {
    pub path: String,
    pub exists: bool,
    pub is_dir: bool,
    pub size: u64,
    pub modified: Option<String>,
    pub is_image: bool,
    pub is_text: bool,
}

const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "avif", "svg"];
const TEXT_EXTS: &[&str] = &[
    "txt", "md", "rs", "ts", "tsx", "js", "jsx", "json", "html", "css", "scss",
    "py", "rb", "go", "java", "c", "cpp", "h", "hpp", "sh", "bat", "ps1", "yaml",
    "yml", "toml", "ini", "cfg", "log", "xml", "csv", "sql", "lua",
];

pub fn ext_of(path: &str) -> String {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
}

pub fn info_of(path: &str) -> FileInfo {
    let pb = Path::new(path);
    let exists = pb.exists();
    let (is_dir, size, modified) = if exists {
        match pb.metadata() {
            Ok(m) => {
                let modified = m
                    .modified()
                    .ok()
                    .map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
                (m.is_dir(), m.len(), modified)
            }
            Err(_) => (false, 0, None),
        }
    } else {
        (false, 0, None)
    };
    let ext = ext_of(path);
    FileInfo {
        path: path.to_string(),
        exists,
        is_dir,
        size,
        modified,
        is_image: !is_dir && IMAGE_EXTS.contains(&ext.as_str()),
        is_text: !is_dir && TEXT_EXTS.contains(&ext.as_str()),
    }
}

/// Maximum image size we'll embed (10 MB).
const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;

/// Read an image file and return a base64-encoded data URI suitable for `<img src>`.
pub fn read_image_data_uri(path: &str) -> Result<String, String> {
    let info = info_of(path);
    if !info.exists {
        return Err("Le fichier n'existe plus sur le disque.".into());
    }
    if !info.is_image {
        return Err("Format d'image non supporté.".into());
    }
    if info.size > MAX_IMAGE_BYTES {
        return Err(format!(
            "Image trop volumineuse ({:.1} Mo, max {} Mo).",
            info.size as f64 / 1_048_576.0,
            MAX_IMAGE_BYTES / 1_048_576
        ));
    }
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let ext = ext_of(path);
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    };
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}
