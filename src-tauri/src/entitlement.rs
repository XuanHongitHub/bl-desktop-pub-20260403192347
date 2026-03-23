use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::settings_manager::SettingsManager;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EntitlementState {
  Active,
  GraceActive,
  ReadOnly,
}

impl Default for EntitlementState {
  fn default() -> Self {
    Self::Active
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitlementSnapshot {
  pub state: EntitlementState,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FeatureConfigStatus {
  Ready,
  PendingConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfigStatus {
  pub stripe: FeatureConfigStatus,
  pub s3_sync: FeatureConfigStatus,
  pub auth: FeatureConfigStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureAccessSnapshot {
  pub pro_features: bool,
  pub extension_management: bool,
  pub cookie_management: bool,
  pub fingerprint_editing: bool,
  pub cross_os_spoofing: bool,
  pub sync_encryption: bool,
  pub read_only: bool,
}

fn now_iso() -> String {
  Utc::now().to_rfc3339()
}

fn entitlement_file_path() -> PathBuf {
  crate::app_dirs::settings_dir().join("entitlement_state.json")
}

fn default_snapshot() -> EntitlementSnapshot {
  EntitlementSnapshot {
    state: EntitlementState::Active,
    updated_at: now_iso(),
  }
}

fn load_snapshot_from_path(path: &Path) -> Result<EntitlementSnapshot, String> {
  if !path.exists() {
    return Ok(default_snapshot());
  }

  let content = fs::read_to_string(path)
    .map_err(|e| format!("Failed to read entitlement state file: {e}"))?;
  serde_json::from_str::<EntitlementSnapshot>(&content)
    .map_err(|e| format!("Failed to parse entitlement state: {e}"))
}

fn save_snapshot_to_path(
  path: &Path,
  state: EntitlementState,
) -> Result<EntitlementSnapshot, String> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|e| format!("Failed to create entitlement state directory: {e}"))?;
  }

  let snapshot = EntitlementSnapshot {
    state,
    updated_at: now_iso(),
  };
  let json = serde_json::to_string_pretty(&snapshot)
    .map_err(|e| format!("Failed to serialize entitlement state: {e}"))?;
  fs::write(path, json).map_err(|e| format!("Failed to write entitlement state: {e}"))?;
  Ok(snapshot)
}

fn is_set(value: &Option<String>) -> bool {
  value
    .as_ref()
    .map(|raw| !raw.trim().is_empty())
    .unwrap_or(false)
}

#[tauri::command]
pub async fn get_entitlement_state() -> Result<EntitlementSnapshot, String> {
  load_snapshot_from_path(&entitlement_file_path())
}

#[tauri::command]
pub async fn set_entitlement_state(
  state: EntitlementState,
  reason: Option<String>,
) -> Result<EntitlementSnapshot, String> {
  let reason = reason
    .unwrap_or_else(|| "manual_update".to_string())
    .trim()
    .to_string();
  if reason.is_empty() {
    return Err("reason_required".to_string());
  }

  let snapshot = save_snapshot_to_path(&entitlement_file_path(), state)?;
  let _ = crate::events::emit_audit_event(
    "entitlement.set",
    "workspace",
    None,
    "success",
    Some(&reason),
  );
  let _ = crate::events::emit("entitlement-state-changed", &snapshot);
  Ok(snapshot)
}

#[tauri::command]
pub async fn is_entitlement_read_only() -> Result<bool, String> {
  let snapshot = load_snapshot_from_path(&entitlement_file_path())?;
  Ok(snapshot.state == EntitlementState::ReadOnly)
}

#[tauri::command]
pub async fn get_feature_access_snapshot() -> Result<FeatureAccessSnapshot, String> {
  let entitlement_snapshot = load_snapshot_from_path(&entitlement_file_path())?;
  let pro_features = crate::cloud_auth::CLOUD_AUTH
    .has_active_paid_subscription()
    .await;
  let sync_encryption = crate::cloud_auth::CLOUD_AUTH.has_pro_or_owner_access().await;

  Ok(FeatureAccessSnapshot {
    pro_features,
    extension_management: pro_features,
    cookie_management: pro_features,
    fingerprint_editing: pro_features,
    cross_os_spoofing: pro_features,
    sync_encryption,
    read_only: entitlement_snapshot.state == EntitlementState::ReadOnly,
  })
}

#[tauri::command]
pub async fn get_runtime_config_status(
  app_handle: tauri::AppHandle,
) -> Result<RuntimeConfigStatus, String> {
  let endpoints = crate::app_config::get();
  let settings = SettingsManager::instance()
    .load_settings()
    .map_err(|e| format!("Failed to load app settings: {e}"))?;
  let sync_token = SettingsManager::instance()
    .get_sync_token(&app_handle)
    .await
    .map_err(|e| format!("Failed to read sync token: {e}"))?;

  let s3_sync_ready = settings
    .sync_server_url
    .as_ref()
    .map(|url| !url.trim().is_empty())
    .unwrap_or(false)
    && sync_token
      .as_ref()
      .map(|token| !token.trim().is_empty())
      .unwrap_or(false);

  let stripe_ready =
    is_set(&endpoints.stripe_publishable_key) && is_set(&endpoints.stripe_billing_url);
  let auth_ready = is_set(&endpoints.auth_api_url);

  Ok(RuntimeConfigStatus {
    stripe: if stripe_ready {
      FeatureConfigStatus::Ready
    } else {
      FeatureConfigStatus::PendingConfig
    },
    s3_sync: if s3_sync_ready {
      FeatureConfigStatus::Ready
    } else {
      FeatureConfigStatus::PendingConfig
    },
    auth: if auth_ready {
      FeatureConfigStatus::Ready
    } else {
      FeatureConfigStatus::PendingConfig
    },
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn default_snapshot_is_active() {
    let snapshot = default_snapshot();
    assert_eq!(snapshot.state, EntitlementState::Active);
    assert!(!snapshot.updated_at.is_empty());
  }

  #[test]
  fn save_and_load_snapshot_round_trip() {
    let mut temp_path = std::env::temp_dir();
    temp_path.push(format!("buglogin-entitlement-test-{}.json", uuid::Uuid::new_v4()));

    let saved = save_snapshot_to_path(&temp_path, EntitlementState::GraceActive)
      .expect("failed to save snapshot");
    assert_eq!(saved.state, EntitlementState::GraceActive);

    let loaded = load_snapshot_from_path(&temp_path).expect("failed to load snapshot");
    assert_eq!(loaded.state, EntitlementState::GraceActive);

    let _ = fs::remove_file(temp_path);
  }

  #[test]
  fn is_set_checks_whitespace_and_none() {
    assert!(!is_set(&None));
    assert!(!is_set(&Some(String::new())));
    assert!(!is_set(&Some("   ".to_string())));
    assert!(is_set(&Some("configured".to_string())));
  }
}
