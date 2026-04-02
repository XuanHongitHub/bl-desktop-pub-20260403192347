//! Centralized runtime configuration for all external API endpoints.
//!
//! ## Purpose
//! Replaces hardcoded `.invalid` placeholder domains with real, configurable URLs.
//! This module is the **single source of truth** for all outbound network addresses.
//!
//! ## How to configure (Production)
//! Create a file at `<AppData>/BugLogin/settings/buglogin-config.json`:
//! ```json
//! {
//!   "cloud_api_url": "https://api.buglogin.com",
//!   "cloud_sync_url": "https://sync.buglogin.com",
//!   "update_check_url": "https://api.buglogin.com/v1/app/check-update",
//!   "browser_manifest_url": "https://api.buglogin.com/v1/browsers/manifest",
//!   "auth_api_url": "https://auth.example.com",
//!   "stripe_publishable_key": "pk_live_...",
//!   "stripe_billing_url": "https://billing.example.com"
//! }
//! ```
//!
//! ## Fallback
//! If no config file exists, `AppEndpoints::default()` is used, which already
//! points to the intended production domains. The file is only needed to
//! override endpoints without rebuilding the app (e.g., for staging/testing).

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEndpoints {
  /// Base URL for authentication, user management, and team features.
  /// Used by: `cloud_auth.rs`, `team_lock.rs`
  pub cloud_api_url: String,

  /// Base URL for data synchronization (profiles, proxies, etc.).
  /// Used by: `sync/` module
  pub cloud_sync_url: String,

  /// Full URL for the app auto-update check endpoint.
  /// Expected response: see `docs/update-strategy.md`
  pub update_check_url: String,

  /// Full URL to the browser version manifest JSON.
  /// Controls which browser versions are approved for deployment.
  pub browser_manifest_url: String,

  /// Optional base URL for auth/control-plane API.
  #[serde(default)]
  pub auth_api_url: Option<String>,

  /// Optional Stripe publishable key used by billing UI.
  #[serde(default)]
  pub stripe_publishable_key: Option<String>,

  /// Optional billing portal/checkout endpoint.
  #[serde(default)]
  pub stripe_billing_url: Option<String>,
}

impl Default for AppEndpoints {
  fn default() -> Self {
    Self {
      cloud_api_url: "https://api.buglogin.com".to_string(),
      cloud_sync_url: "https://sync.buglogin.com".to_string(),
      update_check_url: "https://api.buglogin.com/v1/app/check-update".to_string(),
      browser_manifest_url: "https://api.buglogin.com/v1/browsers/manifest".to_string(),
      auth_api_url: None,
      stripe_publishable_key: None,
      stripe_billing_url: None,
    }
  }
}

static CONFIG: OnceLock<AppEndpoints> = OnceLock::new();

/// Returns the active application endpoint configuration.
/// Computed once on first call (reads config file if present), then cached.
pub fn get() -> &'static AppEndpoints {
  CONFIG.get_or_init(|| {
    let base_config = if let Some(config) = load_from_file() {
      log::info!("app_config: loaded runtime endpoint overrides from buglogin-config.json");
      config
    } else {
      log::info!("app_config: using default endpoints (api.buglogin.com)");
      AppEndpoints::default()
    };
    apply_env_overrides(base_config)
  })
}

/// Convenience: returns the cloud API base URL.
pub fn cloud_api_url() -> &'static str {
  &get().cloud_api_url
}

/// Convenience: returns the cloud sync base URL.
pub fn cloud_sync_url() -> &'static str {
  &get().cloud_sync_url
}

fn load_from_file() -> Option<AppEndpoints> {
  let config_path = crate::app_dirs::settings_dir().join("buglogin-config.json");
  if !config_path.exists() {
    return None;
  }
  match std::fs::read_to_string(&config_path) {
    Ok(content) => match serde_json::from_str::<AppEndpoints>(&content) {
      Ok(cfg) => Some(cfg),
      Err(e) => {
        log::warn!(
          "app_config: failed to parse buglogin-config.json, using defaults: {}",
          e
        );
        None
      }
    },
    Err(e) => {
      log::warn!(
        "app_config: failed to read buglogin-config.json, using defaults: {}",
        e
      );
      None
    }
  }
}

fn env_opt(name: &str) -> Option<String> {
  std::env::var(name)
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
}

fn normalize_env_value(raw: &str) -> Option<String> {
  let mut value = raw.trim().to_string();
  if value.len() >= 2
    && ((value.starts_with('"') && value.ends_with('"'))
      || (value.starts_with('\'') && value.ends_with('\'')))
  {
    value = value[1..value.len() - 1].to_string();
  }
  let normalized = value.trim().to_string();
  if normalized.is_empty() {
    None
  } else {
    Some(normalized)
  }
}

fn parse_env_file(path: &Path) -> HashMap<String, String> {
  if !path.exists() {
    return HashMap::new();
  }

  let content = match std::fs::read_to_string(path) {
    Ok(content) => content,
    Err(error) => {
      log::debug!(
        "app_config: failed to read env file {}: {}",
        path.display(),
        error
      );
      return HashMap::new();
    }
  };

  let mut values = HashMap::new();
  for raw_line in content.lines() {
    let line = raw_line.trim();
    if line.is_empty() || line.starts_with('#') {
      continue;
    }
    let line = line.strip_prefix("export ").unwrap_or(line);
    let Some(separator_index) = line.find('=') else {
      continue;
    };
    if separator_index == 0 {
      continue;
    }

    let key = line[..separator_index].trim();
    if !key.starts_with("BUGLOGIN_") {
      continue;
    }
    if !key
      .chars()
      .all(|character| character == '_' || character.is_ascii_alphanumeric())
    {
      continue;
    }

    if let Some(value) = normalize_env_value(&line[separator_index + 1..]) {
      values.insert(key.to_string(), value);
    }
  }

  values
}

fn candidate_env_files() -> Vec<PathBuf> {
  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let project_root = manifest_dir
    .parent()
    .map(Path::to_path_buf)
    .unwrap_or_else(|| manifest_dir.clone());

  let mut candidates = vec![
    project_root.join(".env"),
    project_root.join(".env.local"),
    manifest_dir.join(".env"),
    manifest_dir.join(".env.local"),
  ];

  if let Ok(current_dir) = std::env::current_dir() {
    candidates.push(current_dir.join(".env"));
    candidates.push(current_dir.join(".env.local"));
  }

  let mut deduped = Vec::with_capacity(candidates.len());
  for candidate in candidates {
    if deduped.iter().any(|existing| existing == &candidate) {
      continue;
    }
    deduped.push(candidate);
  }
  deduped
}

fn load_file_overrides() -> HashMap<String, String> {
  let mut merged = HashMap::new();
  for file in candidate_env_files() {
    let parsed = parse_env_file(&file);
    if parsed.is_empty() {
      continue;
    }
    log::info!(
      "app_config: loaded BUGLOGIN_* overrides from {}",
      file.display()
    );
    merged.extend(parsed);
  }
  merged
}

fn env_override(name: &str, file_overrides: &HashMap<String, String>) -> Option<String> {
  if let Some(value) = env_opt(name) {
    return Some(value);
  }
  file_overrides.get(name).cloned()
}

fn apply_env_overrides(mut config: AppEndpoints) -> AppEndpoints {
  let file_overrides = load_file_overrides();

  if let Some(value) = env_override("BUGLOGIN_CLOUD_API_URL", &file_overrides) {
    config.cloud_api_url = value;
  }
  if let Some(value) = env_override("BUGLOGIN_CLOUD_SYNC_URL", &file_overrides) {
    config.cloud_sync_url = value;
  }
  if let Some(value) = env_override("BUGLOGIN_UPDATE_CHECK_URL", &file_overrides) {
    config.update_check_url = value;
  }
  if let Some(value) = env_override("BUGLOGIN_BROWSER_MANIFEST_URL", &file_overrides) {
    config.browser_manifest_url = value;
  }
  if let Some(value) = env_override("BUGLOGIN_AUTH_API_URL", &file_overrides) {
    config.auth_api_url = Some(value);
  }
  if let Some(value) = env_override("BUGLOGIN_STRIPE_PUBLISHABLE_KEY", &file_overrides) {
    config.stripe_publishable_key = Some(value);
  }
  if let Some(value) = env_override("BUGLOGIN_STRIPE_BILLING_URL", &file_overrides) {
    config.stripe_billing_url = Some(value);
  }
  config
}
