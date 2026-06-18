use crate::db::Db;
use crate::models::AIResponse;
use serde::Deserialize;
use serde_json::json;
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

pub async fn health(db: Arc<Db>) -> AIResponse {
    let settings = match db.get_settings() {
        Ok(s) => s,
        Err(e) => return err(&e.to_string()),
    };
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(e) => return err(&e.to_string()),
    };
    let url = format!("{}/api/tags", settings.ollama_url.trim_end_matches('/'));
    match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => match r.json::<OllamaTags>().await {
            Ok(t) => AIResponse {
                ok: true,
                text: format!("{} modèles disponibles", t.models.len()),
                error: None,
            },
            Err(_) => AIResponse {
                ok: true,
                text: "Ollama prêt".into(),
                error: None,
            },
        },
        Ok(r) => err(&format!("HTTP {}", r.status())),
        Err(e) => err(&format!("Ollama injoignable: {}", short_err(&e.to_string()))),
    }
}

pub async fn summarize(db: Arc<Db>, id: i64) -> AIResponse {
    let prompt = "Résume le texte suivant en 2-3 phrases en français, sans préambule.";
    run_on_clip(db, id, prompt).await
}

pub async fn explain(db: Arc<Db>, id: i64) -> AIResponse {
    let prompt = "Explique clairement ce contenu (code ou texte) en français pour un développeur. Sois bref et précis.";
    run_on_clip(db, id, prompt).await
}

pub async fn rephrase(db: Arc<Db>, id: i64, style: String) -> AIResponse {
    let prompt = format!(
        "Reformule le texte ci-dessous dans un style {}. Réponds uniquement avec le texte reformulé, sans guillemets ni préambule.",
        style
    );
    run_on_clip(db, id, &prompt).await
}

async fn run_on_clip(db: Arc<Db>, id: i64, instruction: &str) -> AIResponse {
    let settings = match db.get_settings() {
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

    // Truncate big content to avoid huge prompts (~ 6k chars)
    let mut content = clip.content;
    if content.len() > 6000 {
        content.truncate(6000);
        content.push_str("\n…(tronqué)");
    }
    let prompt = format!(
        "{instruction}\n\n---\n{content}\n---\n\nRéponse:"
    );

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .build()
    {
        Ok(c) => c,
        Err(e) => return err(&e.to_string()),
    };

    let url = format!("{}/api/generate", settings.ollama_url.trim_end_matches('/'));
    let body = json!({
        "model": settings.ollama_model,
        "prompt": prompt,
        "stream": false,
        "options": { "temperature": 0.4 }
    });

    match client.post(&url).json(&body).send().await {
        Ok(resp) if resp.status().is_success() => match resp.json::<OllamaGenerate>().await {
            Ok(r) => AIResponse {
                ok: true,
                text: r.response.trim().to_string(),
                error: None,
            },
            Err(e) => err(&e.to_string()),
        },
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            err(&format!("HTTP {} — {}", status, short_err(&body)))
        }
        Err(e) => err(&format!(
            "Ollama injoignable: {}. Avez-vous lancé `ollama serve` ?",
            short_err(&e.to_string())
        )),
    }
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
    if s.len() > 220 {
        format!("{}…", &s[..220])
    } else {
        s.to_string()
    }
}
