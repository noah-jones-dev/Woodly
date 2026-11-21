//! Woodly desktop shell.
//!
//! Native responsibilities:
//!   * SQLite storage (tauri-plugin-sql) with versioned schema migrations.
//!   * API keys in the OS credential manager (never on disk, never in JS).
//!   * `ai_fetch`: the only way the UI can reach an AI provider. It attaches
//!     the key and refuses any URL that isn't that provider's official host,
//!     so a key can't be sent anywhere else.

use std::collections::HashMap;
use std::time::Duration;

use serde::Serialize;
use tauri_plugin_sql::{Migration, MigrationKind};

const KEYRING_SERVICE: &str = "com.woodly.app";

/// The one host each provider's key may be sent to.
fn provider_host(provider: &str) -> Result<&'static str, String> {
    match provider {
        "anthropic" => Ok("api.anthropic.com"),
        "openai" => Ok("api.openai.com"),
        "gemini" => Ok("generativelanguage.googleapis.com"),
        _ => Err(format!("Unknown AI provider \"{provider}\"")),
    }
}

fn key_entry(provider: &str) -> Result<keyring::Entry, String> {
    provider_host(provider)?;
    keyring::Entry::new(KEYRING_SERVICE, provider).map_err(|e| format!("Credential store unavailable: {e}"))
}

#[tauri::command]
fn set_api_key(provider: String, key: String) -> Result<(), String> {
    let key = key.trim();
    if key.is_empty() || key.len() > 1024 || key.chars().any(|c| c.is_control()) {
        return Err("That doesn't look like a valid API key.".into());
    }
    key_entry(&provider)?
        .set_password(key)
        .map_err(|e| format!("Couldn't save the key to the system credential store: {e}"))
}

#[tauri::command]
fn has_api_key(provider: String) -> Result<bool, String> {
    match key_entry(&provider)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("Credential store error: {e}")),
    }
}

#[tauri::command]
fn delete_api_key(provider: String) -> Result<(), String> {
    match key_entry(&provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Credential store error: {e}")),
    }
}

#[derive(Serialize, Debug)]
struct ProxyResponse {
    status: u16,
    headers: HashMap<String, String>,
    body: String,
}

/// Headers the UI may not set: credentials are added here, and transport
/// headers are managed by the HTTP client.
const BLOCKED_REQUEST_HEADERS: &[&str] = &["authorization", "x-api-key", "x-goog-api-key", "host", "content-length", "cookie"];
/// The body is returned already decoded, so these would be wrong.
const DROPPED_RESPONSE_HEADERS: &[&str] = &["content-encoding", "content-length", "transfer-encoding", "set-cookie"];

#[tauri::command]
async fn ai_fetch(
    provider: String,
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: Option<String>,
) -> Result<ProxyResponse, String> {
    let host = provider_host(&provider)?;
    let parsed = reqwest::Url::parse(&url).map_err(|_| "Invalid request URL".to_string())?;
    if parsed.scheme() != "https" || parsed.host_str() != Some(host) || parsed.port().is_some() {
        return Err(format!("Blocked: {provider} keys may only be sent to https://{host}"));
    }
    let key = match key_entry(&provider)?.get_password() {
        Ok(k) => k,
        Err(keyring::Error::NoEntry) => return Err("No API key saved for this provider. Add one in Settings.".into()),
        Err(e) => return Err(format!("Credential store error: {e}")),
    };
    let method = reqwest::Method::from_bytes(method.to_ascii_uppercase().as_bytes()).map_err(|_| "Invalid HTTP method".to_string())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(600))
        .build()
        .map_err(|e| e.to_string())?;
    let mut req = client.request(method, parsed);
    for (k, v) in headers {
        if !BLOCKED_REQUEST_HEADERS.contains(&k.to_ascii_lowercase().as_str()) {
            req = req.header(k, v);
        }
    }
    req = match provider.as_str() {
        "anthropic" => req.header("x-api-key", key),
        "openai" => req.bearer_auth(key),
        _ => req.header("x-goog-api-key", key),
    };
    if let Some(b) = body {
        req = req.body(b);
    }

    // `without_url` keeps request details out of error messages.
    let res = req.send().await.map_err(|e| format!("Network error: {}", e.without_url()))?;
    let status = res.status().as_u16();
    let headers = res
        .headers()
        .iter()
        .filter(|(k, _)| !DROPPED_RESPONSE_HEADERS.contains(&k.as_str()))
        .filter_map(|(k, v)| v.to_str().ok().map(|v| (k.to_string(), v.to_string())))
        .collect();
    let body = res.text().await.map_err(|e| format!("Network error: {}", e.without_url()))?;
    Ok(ProxyResponse { status, headers, body })
}

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial schema",
        sql: r#"
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT NOT NULL,
                data TEXT NOT NULL,          -- full ProjectRecord JSON (spec has its own schemaVersion)
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS project_versions (
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                version INTEGER NOT NULL,
                note TEXT NOT NULL,
                spec TEXT NOT NULL,
                created_at TEXT NOT NULL,
                PRIMARY KEY (project_id, version)
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS learning_progress (
                lesson_key TEXT PRIMARY KEY,
                status TEXT NOT NULL,
                progress INTEGER NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at);
        "#,
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().add_migrations("sqlite:woodly.db", migrations()).build())
        .invoke_handler(tauri::generate_handler![set_api_key, has_api_key, delete_api_key, ai_fetch])
        .run(tauri::generate_context!())
        .expect("error while running Woodly");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_providers_have_hosts() {
        assert_eq!(provider_host("anthropic").unwrap(), "api.anthropic.com");
        assert!(provider_host("evil").is_err());
    }

    #[tokio::test]
    async fn blocks_foreign_hosts_before_touching_the_keychain() {
        for url in ["https://evil.example.com/v1/messages", "http://api.anthropic.com/v1/messages", "https://api.anthropic.com:8443/x", "https://api.anthropic.com.evil.com/"] {
            let r = ai_fetch("anthropic".into(), url.into(), "POST".into(), HashMap::new(), None).await;
            assert!(r.unwrap_err().starts_with("Blocked"), "{url} should be blocked");
        }
    }
}
