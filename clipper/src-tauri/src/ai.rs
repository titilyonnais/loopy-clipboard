use crate::db::Db;
use crate::models::{AIResponse, Settings};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;

#[derive(Deserialize)]
struct OllamaGenerate {
    response: String,
}

#[derive(Deserialize)]
struct OllamaTags {
    models: Vec<serde_json::Value>,
}

// ─────────────────────────── Public entry points ───────────────────────────

pub async fn health(db: Arc<Db>) -> AIResponse {
    let s = match db.get_settings() {
        Ok(s) => s,
        Err(e) => return err(&e.to_string()),
    };
    match s.ai_provider.as_str() {
        "openai" => {
            if s.openai_api_key.trim().is_empty() {
                err("Clé API OpenAI manquante (Paramètres → IA).")
            } else {
                AIResponse {
                    ok: true,
                    text: format!("OpenAI · {}", s.openai_model),
                    error: None,
                }
            }
        }
        "anthropic" => {
            if s.anthropic_api_key.trim().is_empty() {
                err("Clé API Anthropic manquante (Paramètres → IA).")
            } else {
                AIResponse {
                    ok: true,
                    text: format!("Claude · {}", s.anthropic_model),
                    error: None,
                }
            }
        }
        _ => ollama_health(&s).await,
    }
}

pub async fn summarize(db: Arc<Db>, id: i64) -> AIResponse {
    run_on_clip(db, id, "Résume le texte suivant en 2-3 phrases en français, sans préambule.").await
}

pub async fn explain(db: Arc<Db>, id: i64) -> AIResponse {
    run_on_clip(db, id, "Explique clairement ce contenu (code ou texte) en français pour un développeur. Sois bref et précis.").await
}

pub async fn rephrase(db: Arc<Db>, id: i64, style: String) -> AIResponse {
    let p = format!(
        "Reformule le texte ci-dessous dans un style {}. Réponds uniquement avec le texte reformulé, sans guillemets ni préambule.",
        style
    );
    run_on_clip(db, id, &p).await
}

async fn run_on_clip(db: Arc<Db>, id: i64, instruction: &str) -> AIResponse {
    let s = match db.get_settings() {
        Ok(s) => s,
        Err(e) => return err(&e.to_string()),
    };
    let clip = match db.get(id) {
        Ok(Some(c)) => c,
        Ok(None) => return err("Clip introuvable"),
        Err(e) => return err(&e.to_string()),
    };
    if clip.kind == "image" {
        return err("Les images ne sont pas prises en charge pour l'IA texte.");
    }
    let mut content = clip.content;
    if content.len() > 6000 {
        content.truncate(6000);
        content.push_str("\n…(tronqué)");
    }
    let prompt = format!("{instruction}\n\n---\n{content}\n---\n\nRéponse:");
    complete(&s, &prompt).await
}

async fn complete(s: &Settings, prompt: &str) -> AIResponse {
    match s.ai_provider.as_str() {
        "openai" => openai_call(s, prompt).await,
        "anthropic" => anthropic_call(s, prompt).await,
        _ => ollama_call(s, prompt).await,
    }
}

// ─────────────────────────── Ollama ───────────────────────────

async fn ollama_health(s: &Settings) -> AIResponse {
    let client = match http_client(2) {
        Ok(c) => c,
        Err(e) => return err(&e),
    };
    let url = format!("{}/api/tags", s.ollama_url.trim_end_matches('/'));
    match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => match r.json::<OllamaTags>().await {
            Ok(t) => AIResponse {
                ok: true,
                text: format!("Ollama · {} modèle(s)", t.models.len()),
                error: None,
            },
            Err(_) => AIResponse { ok: true, text: "Ollama prêt".into(), error: None },
        },
        Ok(r) => err(&format!("HTTP {}", r.status())),
        Err(e) => err(&format!("Ollama injoignable: {}", short_err(&e.to_string()))),
    }
}

async fn ollama_call(s: &Settings, prompt: &str) -> AIResponse {
    let client = match http_client(120) {
        Ok(c) => c,
        Err(e) => return err(&e),
    };
    let url = format!("{}/api/generate", s.ollama_url.trim_end_matches('/'));
    let body = json!({
        "model": s.ollama_model,
        "prompt": prompt,
        "stream": false,
        "options": { "temperature": 0.4 }
    });
    match client.post(&url).json(&body).send().await {
        Ok(r) if r.status().is_success() => match r.json::<OllamaGenerate>().await {
            Ok(g) => AIResponse {
                ok: true,
                text: g.response.trim().to_string(),
                error: None,
            },
            Err(e) => err(&e.to_string()),
        },
        Ok(r) => {
            let st = r.status();
            let body = r.text().await.unwrap_or_default();
            err(&format!("Ollama HTTP {} — {}", st, short_err(&body)))
        }
        Err(e) => err(&format!(
            "Ollama injoignable: {}. Avez-vous lancé `ollama serve` ?",
            short_err(&e.to_string())
        )),
    }
}

// ─────────────────────────── OpenAI ───────────────────────────

async fn openai_call(s: &Settings, prompt: &str) -> AIResponse {
    if s.openai_api_key.trim().is_empty() {
        return err("Clé API OpenAI manquante (Paramètres → IA).");
    }
    let client = match http_client(120) {
        Ok(c) => c,
        Err(e) => return err(&e),
    };
    let url = format!(
        "{}/v1/chat/completions",
        s.openai_base_url.trim_end_matches('/')
    );
    let body = json!({
        "model": s.openai_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
    });
    match client
        .post(&url)
        .bearer_auth(&s.openai_api_key)
        .json(&body)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => match r.json::<Value>().await {
            Ok(v) => {
                let text = v["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if text.is_empty() {
                    err("OpenAI: réponse vide.")
                } else {
                    AIResponse { ok: true, text, error: None }
                }
            }
            Err(e) => err(&e.to_string()),
        },
        Ok(r) => {
            let st = r.status();
            let body = r.text().await.unwrap_or_default();
            err(&format!("OpenAI HTTP {} — {}", st, short_err(&body)))
        }
        Err(e) => err(&format!("OpenAI: {}", short_err(&e.to_string()))),
    }
}

// ─────────────────────────── Anthropic (Claude) ───────────────────────────

async fn anthropic_call(s: &Settings, prompt: &str) -> AIResponse {
    if s.anthropic_api_key.trim().is_empty() {
        return err("Clé API Anthropic manquante (Paramètres → IA).");
    }
    let client = match http_client(120) {
        Ok(c) => c,
        Err(e) => return err(&e),
    };
    let body = json!({
        "model": s.anthropic_model,
        "max_tokens": 1024,
        "messages": [{"role": "user", "content": prompt}],
    });
    match client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &s.anthropic_api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
    {
        Ok(r) if r.status().is_success() => match r.json::<Value>().await {
            Ok(v) => {
                let text = v["content"][0]["text"]
                    .as_str()
                    .unwrap_or("")
                    .trim()
                    .to_string();
                if text.is_empty() {
                    err("Claude: réponse vide.")
                } else {
                    AIResponse { ok: true, text, error: None }
                }
            }
            Err(e) => err(&e.to_string()),
        },
        Ok(r) => {
            let st = r.status();
            let body = r.text().await.unwrap_or_default();
            err(&format!("Claude HTTP {} — {}", st, short_err(&body)))
        }
        Err(e) => err(&format!("Claude: {}", short_err(&e.to_string()))),
    }
}

// ─────────────────────────── Helpers ───────────────────────────

fn http_client(timeout_s: u64) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_s))
        .build()
        .map_err(|e| e.to_string())
}

fn err(msg: &str) -> AIResponse {
    AIResponse {
        ok: false,
        text: String::new(),
        error: Some(msg.to_string()),
    }
}

fn short_err(s: &str) -> String {
    let s = s.trim();
    if s.len() > 280 {
        format!("{}…", &s[..280])
    } else {
        s.to_string()
    }
}
