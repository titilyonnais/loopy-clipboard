use crate::models::{ClipItem, ListParams, Settings, Stats};
use anyhow::{anyhow, Result};
use chrono::Utc;
use parking_lot::Mutex;
use rusqlite::{params, params_from_iter, Connection, OptionalExtension};
use std::path::PathBuf;
use std::sync::Arc;

#[derive(Clone)]
pub struct Db {
    inner: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn open(path: PathBuf) -> Result<Self> {
        if let Some(p) = path.parent() {
            std::fs::create_dir_all(p)?;
        }
        let conn = Connection::open(&path)?;
        conn.pragma_update(None, "journal_mode", "WAL")?;
        conn.pragma_update(None, "synchronous", "NORMAL")?;
        conn.pragma_update(None, "foreign_keys", "ON")?;
        let db = Self {
            inner: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        Ok(db)
    }

    fn migrate(&self) -> Result<()> {
        let c = self.inner.lock();
        c.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS clips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kind TEXT NOT NULL,
                content TEXT NOT NULL,
                preview TEXT NOT NULL,
                language TEXT,
                category TEXT,
                tags TEXT NOT NULL DEFAULT '[]',
                pinned INTEGER NOT NULL DEFAULT 0,
                favorite INTEGER NOT NULL DEFAULT 0,
                source_app TEXT,
                size_bytes INTEGER NOT NULL DEFAULT 0,
                hash TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                used_at TEXT NOT NULL,
                use_count INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_clips_used ON clips(pinned DESC, used_at DESC);
            CREATE INDEX IF NOT EXISTS idx_clips_kind ON clips(kind);
            CREATE INDEX IF NOT EXISTS idx_clips_category ON clips(category);

            CREATE VIRTUAL TABLE IF NOT EXISTS clips_fts USING fts5(
                content, preview, category, tags,
                content='clips', content_rowid='id',
                tokenize='unicode61 remove_diacritics 2'
            );

            CREATE TRIGGER IF NOT EXISTS clips_ai AFTER INSERT ON clips BEGIN
                INSERT INTO clips_fts(rowid, content, preview, category, tags)
                VALUES (new.id, new.content, new.preview, COALESCE(new.category,''), new.tags);
            END;
            CREATE TRIGGER IF NOT EXISTS clips_ad AFTER DELETE ON clips BEGIN
                INSERT INTO clips_fts(clips_fts, rowid, content, preview, category, tags)
                VALUES ('delete', old.id, old.content, old.preview, COALESCE(old.category,''), old.tags);
            END;
            CREATE TRIGGER IF NOT EXISTS clips_au AFTER UPDATE ON clips BEGIN
                INSERT INTO clips_fts(clips_fts, rowid, content, preview, category, tags)
                VALUES ('delete', old.id, old.content, old.preview, COALESCE(old.category,''), old.tags);
                INSERT INTO clips_fts(rowid, content, preview, category, tags)
                VALUES (new.id, new.content, new.preview, COALESCE(new.category,''), new.tags);
            END;

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "#,
        )?;
        Ok(())
    }

    pub fn insert_clip(
        &self,
        kind: &str,
        content: &str,
        preview: &str,
        language: Option<&str>,
        source_app: Option<&str>,
        size_bytes: i64,
        hash: &str,
    ) -> Result<Option<ClipItem>> {
        let now = Utc::now().to_rfc3339();
        let c = self.inner.lock();

        // If hash exists -> bump use_count and used_at, do not duplicate
        if let Some(existing) = c
            .query_row(
                "SELECT id FROM clips WHERE hash = ?1",
                params![hash],
                |r| r.get::<_, i64>(0),
            )
            .optional()?
        {
            c.execute(
                "UPDATE clips SET used_at = ?1, use_count = use_count + 1 WHERE id = ?2",
                params![now, existing],
            )?;
            return Ok(row_by_id(&c, existing)?);
        }

        c.execute(
            "INSERT INTO clips (kind, content, preview, language, source_app, size_bytes, hash, created_at, used_at, use_count, tags)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8, 1, '[]')",
            params![kind, content, preview, language, source_app, size_bytes, hash, now],
        )?;
        let id = c.last_insert_rowid();
        Ok(row_by_id(&c, id)?)
    }

    pub fn list(&self, p: &ListParams) -> Result<Vec<ClipItem>> {
        let c = self.inner.lock();
        let mut sql = String::from(
            "SELECT id, kind, content, preview, language, category, tags, pinned, favorite, source_app, size_bytes, hash, created_at, used_at, use_count FROM clips",
        );
        let mut conds: Vec<String> = vec![];
        let mut args: Vec<Box<dyn rusqlite::ToSql>> = vec![];

        if let Some(q) = p.query.as_ref().filter(|s| !s.trim().is_empty()) {
            conds.push("id IN (SELECT rowid FROM clips_fts WHERE clips_fts MATCH ?)".into());
            args.push(Box::new(fts_query(q)));
        }
        if let Some(k) = p.kind.as_ref().filter(|s| !s.is_empty()) {
            conds.push("kind = ?".into());
            args.push(Box::new(k.clone()));
        }
        if let Some(cat) = p.category.as_ref().filter(|s| !s.is_empty()) {
            conds.push("category = ?".into());
            args.push(Box::new(cat.clone()));
        }
        if let Some(tag) = p.tag.as_ref().filter(|s| !s.is_empty()) {
            conds.push("tags LIKE ?".into());
            args.push(Box::new(format!("%\"{}\"%", tag.replace('"', ""))));
        }
        if p.pinned_only {
            conds.push("pinned = 1".into());
        }
        if p.favorites_only {
            conds.push("favorite = 1".into());
        }

        // Time range filter — operates on used_at (most recent use)
        if let Some(range) = p.time_range.as_ref().filter(|s| !s.is_empty()) {
            if let Some((from, to)) = time_range_bounds(range) {
                conds.push("used_at >= ? AND used_at < ?".into());
                args.push(Box::new(from));
                args.push(Box::new(to));
            }
        }

        if !conds.is_empty() {
            sql.push_str(" WHERE ");
            sql.push_str(&conds.join(" AND "));
        }

        let sort = p.sort.as_deref().unwrap_or("recent");
        let order = match sort {
            "popular" => " ORDER BY pinned DESC, use_count DESC, used_at DESC",
            "oldest" => " ORDER BY pinned DESC, used_at ASC",
            _ => " ORDER BY pinned DESC, used_at DESC",
        };
        sql.push_str(order);

        let limit = p.limit.unwrap_or(500).max(1);
        let offset = p.offset.unwrap_or(0).max(0);
        sql.push_str(&format!(" LIMIT {} OFFSET {}", limit, offset));

        let mut stmt = c.prepare(&sql)?;
        let rows = stmt.query_map(params_from_iter(args.iter().map(|b| &**b)), row_to_clip)?;
        let mut out = Vec::new();
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn get(&self, id: i64) -> Result<Option<ClipItem>> {
        let c = self.inner.lock();
        row_by_id(&c, id)
    }

    pub fn bump_used(&self, id: i64) -> Result<()> {
        let c = self.inner.lock();
        let now = Utc::now().to_rfc3339();
        c.execute(
            "UPDATE clips SET used_at = ?1, use_count = use_count + 1 WHERE id = ?2",
            params![now, id],
        )?;
        Ok(())
    }

    pub fn toggle_pin(&self, id: i64) -> Result<Option<ClipItem>> {
        let c = self.inner.lock();
        c.execute(
            "UPDATE clips SET pinned = 1 - pinned WHERE id = ?1",
            params![id],
        )?;
        row_by_id(&c, id)
    }

    pub fn toggle_favorite(&self, id: i64) -> Result<Option<ClipItem>> {
        let c = self.inner.lock();
        c.execute(
            "UPDATE clips SET favorite = 1 - favorite WHERE id = ?1",
            params![id],
        )?;
        row_by_id(&c, id)
    }

    pub fn update_tags(&self, id: i64, tags: &[String]) -> Result<Option<ClipItem>> {
        let c = self.inner.lock();
        let json = serde_json::to_string(tags)?;
        c.execute("UPDATE clips SET tags = ?1 WHERE id = ?2", params![json, id])?;
        row_by_id(&c, id)
    }

    pub fn update_category(&self, id: i64, category: Option<&str>) -> Result<Option<ClipItem>> {
        let c = self.inner.lock();
        c.execute(
            "UPDATE clips SET category = ?1 WHERE id = ?2",
            params![category, id],
        )?;
        row_by_id(&c, id)
    }

    pub fn delete(&self, id: i64) -> Result<()> {
        let c = self.inner.lock();
        c.execute("DELETE FROM clips WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn clear_all(&self, keep_pinned: bool) -> Result<usize> {
        let c = self.inner.lock();
        let n = if keep_pinned {
            c.execute("DELETE FROM clips WHERE pinned = 0", [])?
        } else {
            c.execute("DELETE FROM clips", [])?
        };
        Ok(n)
    }

    pub fn enforce_limit(&self, max: i64) -> Result<()> {
        if max <= 0 {
            return Ok(());
        }
        let c = self.inner.lock();
        c.execute(
            "DELETE FROM clips WHERE id IN (
                SELECT id FROM clips WHERE pinned = 0
                ORDER BY used_at DESC
                LIMIT -1 OFFSET ?1
            )",
            params![max],
        )?;
        Ok(())
    }

    /// Delete entries older than `days` based on used_at. Pinned items are
    /// always preserved. Favorites are preserved when `keep_favorites` is true.
    /// Returns the number of deleted rows.
    pub fn cleanup_expired(&self, days: i64, keep_favorites: bool) -> Result<usize> {
        if days <= 0 {
            return Ok(0);
        }
        let cutoff = (Utc::now() - chrono::Duration::days(days)).to_rfc3339();
        let c = self.inner.lock();
        let sql = if keep_favorites {
            "DELETE FROM clips WHERE pinned = 0 AND favorite = 0 AND used_at < ?1"
        } else {
            "DELETE FROM clips WHERE pinned = 0 AND used_at < ?1"
        };
        let n = c.execute(sql, params![cutoff])?;
        Ok(n)
    }

    /// Activity histogram: number of clips used per day for the last `days` days.
    /// Returns a Vec of (YYYY-MM-DD, count) ordered by date ascending.
    pub fn histogram(&self, days: i64) -> Result<Vec<(String, i64)>> {
        let c = self.inner.lock();
        let cutoff = (Utc::now() - chrono::Duration::days(days.max(1))).to_rfc3339();
        let mut stmt = c.prepare(
            "SELECT substr(used_at, 1, 10) AS day, COUNT(*)
             FROM clips WHERE used_at >= ?1
             GROUP BY day ORDER BY day ASC",
        )?;
        let rows = stmt.query_map(params![cutoff], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?))
        })?;
        let mut out = vec![];
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn stats(&self) -> Result<Stats> {
        let c = self.inner.lock();
        let mut s = Stats::default();
        s.total = c.query_row("SELECT COUNT(*) FROM clips", [], |r| r.get(0))?;
        s.text =
            c.query_row("SELECT COUNT(*) FROM clips WHERE kind='text'", [], |r| r.get(0))?;
        s.code =
            c.query_row("SELECT COUNT(*) FROM clips WHERE kind='code'", [], |r| r.get(0))?;
        s.image =
            c.query_row("SELECT COUNT(*) FROM clips WHERE kind='image'", [], |r| r.get(0))?;
        s.url = c.query_row("SELECT COUNT(*) FROM clips WHERE kind='url'", [], |r| r.get(0))?;
        s.file =
            c.query_row("SELECT COUNT(*) FROM clips WHERE kind='file'", [], |r| r.get(0))?;
        s.pinned =
            c.query_row("SELECT COUNT(*) FROM clips WHERE pinned=1", [], |r| r.get(0))?;
        s.favorites = c.query_row(
            "SELECT COUNT(*) FROM clips WHERE favorite=1",
            [],
            |r| r.get(0),
        )?;
        s.bytes = c
            .query_row("SELECT COALESCE(SUM(size_bytes),0) FROM clips", [], |r| {
                r.get(0)
            })
            .unwrap_or(0);
        Ok(s)
    }

    pub fn categories(&self) -> Result<Vec<String>> {
        let c = self.inner.lock();
        let mut stmt = c.prepare(
            "SELECT DISTINCT category FROM clips WHERE category IS NOT NULL AND category <> '' ORDER BY category ASC",
        )?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut out = vec![];
        for r in rows {
            out.push(r?);
        }
        Ok(out)
    }

    pub fn tags(&self) -> Result<Vec<String>> {
        let c = self.inner.lock();
        let mut stmt = c.prepare("SELECT tags FROM clips")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut set = std::collections::BTreeSet::new();
        for r in rows {
            let s = r?;
            if let Ok(v) = serde_json::from_str::<Vec<String>>(&s) {
                for t in v {
                    set.insert(t);
                }
            }
        }
        Ok(set.into_iter().collect())
    }

    // ---- Settings ----
    pub fn get_settings(&self) -> Result<Settings> {
        let c = self.inner.lock();
        let raw: Option<String> = c
            .query_row(
                "SELECT value FROM settings WHERE key = 'app'",
                [],
                |r| r.get(0),
            )
            .optional()?;
        match raw {
            Some(s) => Ok(serde_json::from_str(&s).unwrap_or_default()),
            None => Ok(Settings::default()),
        }
    }

    pub fn set_settings(&self, s: &Settings) -> Result<()> {
        let c = self.inner.lock();
        let json = serde_json::to_string(s)?;
        c.execute(
            "INSERT INTO settings(key, value) VALUES('app', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![json],
        )?;
        Ok(())
    }
}

fn row_by_id(c: &Connection, id: i64) -> Result<Option<ClipItem>> {
    let mut stmt = c.prepare(
        "SELECT id, kind, content, preview, language, category, tags, pinned, favorite, source_app, size_bytes, hash, created_at, used_at, use_count FROM clips WHERE id = ?1",
    )?;
    let item = stmt
        .query_row(params![id], row_to_clip)
        .optional()
        .map_err(|e| anyhow!(e))?;
    Ok(item)
}

fn row_to_clip(r: &rusqlite::Row) -> rusqlite::Result<ClipItem> {
    let tags_raw: String = r.get(6)?;
    let tags: Vec<String> = serde_json::from_str(&tags_raw).unwrap_or_default();
    Ok(ClipItem {
        id: r.get(0)?,
        kind: r.get(1)?,
        content: r.get(2)?,
        preview: r.get(3)?,
        language: r.get(4)?,
        category: r.get(5)?,
        tags,
        pinned: r.get::<_, i64>(7)? != 0,
        favorite: r.get::<_, i64>(8)? != 0,
        source_app: r.get(9)?,
        size_bytes: r.get(10)?,
        hash: r.get(11)?,
        created_at: r.get(12)?,
        used_at: r.get(13)?,
        use_count: r.get(14)?,
    })
}

/// Convert a free-text query into a safe FTS5 query, supporting prefix search.
fn fts_query(q: &str) -> String {
    let mut tokens: Vec<String> = Vec::new();
    for raw in q.split_whitespace() {
        // Sanitize: keep alphanumerics and a few symbols; drop quotes/special FTS chars.
        let cleaned: String = raw
            .chars()
            .filter(|c| {
                c.is_alphanumeric()
                    || matches!(*c, '-' | '_' | '.' | '@' | '/' | '+' | '#')
            })
            .collect();
        if cleaned.is_empty() {
            continue;
        }
        tokens.push(format!("\"{}\"*", cleaned));
    }
    if tokens.is_empty() {
        "*".into()
    } else {
        tokens.join(" AND ")
    }
}


/// Resolve a time range token to a (from_iso, to_iso) pair (UTC, half-open).
/// Supported tokens: today, yesterday, week, month, year, or YYYY-MM-DD.
fn time_range_bounds(range: &str) -> Option<(String, String)> {
    use chrono::{Datelike, Duration, NaiveDate, TimeZone};
    let now = Utc::now();
    let today = now.date_naive();
    let start_of_day = |d: NaiveDate| chrono::Utc.from_utc_datetime(&d.and_hms_opt(0, 0, 0).unwrap());

    let (from, to) = match range {
        "today" => (start_of_day(today), start_of_day(today + Duration::days(1))),
        "yesterday" => (
            start_of_day(today - Duration::days(1)),
            start_of_day(today),
        ),
        "week" => (start_of_day(today - Duration::days(6)), start_of_day(today + Duration::days(1))),
        "month" => (start_of_day(today - Duration::days(29)), start_of_day(today + Duration::days(1))),
        "year" => (start_of_day(today - Duration::days(364)), start_of_day(today + Duration::days(1))),
        other => {
            // Treat as explicit YYYY-MM-DD day
            let parsed = NaiveDate::parse_from_str(other, "%Y-%m-%d").ok()?;
            (start_of_day(parsed), start_of_day(parsed + Duration::days(1)))
        }
    };
    let _ = today.month(); // silence unused import on certain configs
    Some((from.to_rfc3339(), to.to_rfc3339()))
}
