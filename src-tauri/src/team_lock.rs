use lazy_static::lazy_static;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use tokio::sync::{Mutex, RwLock};
use tokio::task::JoinHandle;

use crate::cloud_auth::{CloudAuthManager, CLOUD_API_URL, CLOUD_AUTH};

const DEFAULT_LOCK_LEASE_SECONDS: i64 = 120;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileLockInfo {
  #[serde(rename = "profileId")]
  pub profile_id: String,
  #[serde(rename = "lockedBy")]
  pub locked_by: String,
  #[serde(rename = "lockedByEmail")]
  pub locked_by_email: String,
  #[serde(rename = "lockedAt")]
  pub locked_at: String,
  #[serde(rename = "expiresAt", default)]
  pub expires_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AcquireLockResponse {
  success: bool,
  #[serde(rename = "lockedBy")]
  locked_by: Option<String>,
  #[serde(rename = "lockedByEmail")]
  locked_by_email: Option<String>,
  #[serde(rename = "expiresAt", default)]
  expires_at: Option<String>,
}

pub struct TeamLockManager {
  locks: RwLock<HashMap<String, ProfileLockInfo>>,
  heartbeat_handle: Mutex<Option<JoinHandle<()>>>,
  connected_team_id: Mutex<Option<String>>,
}

lazy_static! {
  pub static ref TEAM_LOCK: TeamLockManager = TeamLockManager::new();
}

fn parse_datetime_utc(raw: &str) -> Option<DateTime<Utc>> {
  DateTime::parse_from_rfc3339(raw)
    .ok()
    .map(|dt| dt.with_timezone(&Utc))
}

fn is_lock_stale(lock: &ProfileLockInfo) -> bool {
  let now = Utc::now();

  if let Some(expires_at) = lock.expires_at.as_deref().and_then(parse_datetime_utc) {
    return expires_at <= now;
  }

  if let Some(locked_at) = parse_datetime_utc(&lock.locked_at) {
    return locked_at + ChronoDuration::seconds(DEFAULT_LOCK_LEASE_SECONDS) <= now;
  }

  false
}

impl TeamLockManager {
  fn new() -> Self {
    Self {
      locks: RwLock::new(HashMap::new()),
      heartbeat_handle: Mutex::new(None),
      connected_team_id: Mutex::new(None),
    }
  }

  pub async fn connect(&self, team_id: &str) {
    log::info!("Connecting team lock manager for team: {team_id}");

    {
      let mut tid = self.connected_team_id.lock().await;
      *tid = Some(team_id.to_string());
    }

    if let Err(e) = self.fetch_initial_locks(team_id).await {
      log::warn!("Failed to fetch initial locks: {e}");
    }

    self.start_heartbeat_loop().await;
  }

  pub async fn disconnect(&self) {
    log::info!("Disconnecting team lock manager");

    {
      let mut handle = self.heartbeat_handle.lock().await;
      if let Some(h) = handle.take() {
        h.abort();
      }
    }

    {
      let mut locks = self.locks.write().await;
      locks.clear();
    }

    {
      let mut tid = self.connected_team_id.lock().await;
      *tid = None;
    }
  }

  pub async fn acquire_lock(&self, profile_id: &str) -> Result<(), String> {
    let team_id = self.get_team_id().await?;
    let client = Client::new();

    let access_token =
      CloudAuthManager::load_access_token()?.ok_or_else(|| "Not logged in".to_string())?;

    let url = format!("{}/api/teams/{}/locks", *CLOUD_API_URL, team_id);
    let response = client
      .post(&url)
      .header("Authorization", format!("Bearer {access_token}"))
      .json(&serde_json::json!({ "profileId": profile_id }))
      .send()
      .await
      .map_err(|e| format!("Failed to acquire lock: {e}"))?;

    if !response.status().is_success() {
      let status = response.status();
      let body = response.text().await.unwrap_or_default();
      return Err(format!("Lock acquisition failed ({status}): {body}"));
    }

    let result: AcquireLockResponse = response
      .json()
      .await
      .map_err(|e| format!("Failed to parse lock response: {e}"))?;

    if !result.success {
      let email = result
        .locked_by_email
        .unwrap_or_else(|| "another user".to_string());
      return Err(format!("Profile is in use by {email}"));
    }

    // Update local cache
    if let Some(user) = CLOUD_AUTH.get_user().await {
      let mut locks = self.locks.write().await;
      locks.insert(
        profile_id.to_string(),
        ProfileLockInfo {
          profile_id: profile_id.to_string(),
          locked_by: user.user.id.clone(),
          locked_by_email: user.user.email.clone(),
          locked_at: chrono::Utc::now().to_rfc3339(),
          expires_at: result.expires_at,
        },
      );
    }

    let _ = crate::events::emit(
      "team-lock-acquired",
      serde_json::json!({ "profileId": profile_id }),
    );

    Ok(())
  }

  pub async fn release_lock(&self, profile_id: &str) -> Result<(), String> {
    let team_id = self.get_team_id().await?;
    let client = Client::new();

    let access_token =
      CloudAuthManager::load_access_token()?.ok_or_else(|| "Not logged in".to_string())?;

    let url = format!(
      "{}/api/teams/{}/locks/{}",
      *CLOUD_API_URL, team_id, profile_id
    );
    let response = client
      .delete(&url)
      .header("Authorization", format!("Bearer {access_token}"))
      .send()
      .await
      .map_err(|e| format!("Failed to release lock: {e}"))?;

    if !response.status().is_success() && response.status() != reqwest::StatusCode::NOT_FOUND {
      let status = response.status();
      let body = response.text().await.unwrap_or_default();
      return Err(format!("Lock release failed ({status}): {body}"));
    }

    {
      let mut locks = self.locks.write().await;
      locks.remove(profile_id);
    }

    let _ = crate::events::emit(
      "team-lock-released",
      serde_json::json!({ "profileId": profile_id }),
    );

    Ok(())
  }

  pub async fn get_locks(&self) -> Vec<ProfileLockInfo> {
    let locks = self.locks.read().await;
    locks.values().cloned().collect()
  }

  pub async fn get_lock_status(&self, profile_id: &str) -> Option<ProfileLockInfo> {
    let lock = {
      let locks = self.locks.read().await;
      locks.get(profile_id).cloned()
    };

    if let Some(lock_info) = lock {
      if is_lock_stale(&lock_info) {
        let mut locks = self.locks.write().await;
        locks.remove(profile_id);
        return None;
      }
      return Some(lock_info);
    }

    None
  }

  async fn fetch_initial_locks(&self, team_id: &str) -> Result<(), String> {
    let client = Client::new();
    let access_token =
      CloudAuthManager::load_access_token()?.ok_or_else(|| "Not logged in".to_string())?;

    let url = format!("{}/api/teams/{}/locks", *CLOUD_API_URL, team_id);
    let response = client
      .get(&url)
      .header("Authorization", format!("Bearer {access_token}"))
      .send()
      .await
      .map_err(|e| format!("Failed to fetch locks: {e}"))?;

    if !response.status().is_success() {
      return Err("Failed to fetch locks".to_string());
    }

    let lock_list: Vec<ProfileLockInfo> = response
      .json()
      .await
      .map_err(|e| format!("Failed to parse locks: {e}"))?;

    let mut locks = self.locks.write().await;
    locks.clear();
    for lock in lock_list {
      if !is_lock_stale(&lock) {
        locks.insert(lock.profile_id.clone(), lock);
      }
    }

    Ok(())
  }

  async fn start_heartbeat_loop(&self) {
    let mut handle = self.heartbeat_handle.lock().await;
    if let Some(h) = handle.take() {
      h.abort();
    }

    let h = tokio::spawn(async move {
      loop {
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;

        let team_id = match TEAM_LOCK.get_team_id().await {
          Ok(id) => id,
          Err(_) => break,
        };

        let held_locks: Vec<String> = {
          let locks = TEAM_LOCK.locks.read().await;
          if let Some(user) = CLOUD_AUTH.get_user().await {
            locks
              .values()
              .filter(|l| l.locked_by == user.user.id)
              .map(|l| l.profile_id.clone())
              .collect()
          } else {
            vec![]
          }
        };

        for profile_id in held_locks {
          let client = Client::new();
          if let Ok(Some(token)) = CloudAuthManager::load_access_token() {
            let url = format!(
              "{}/api/teams/{}/locks/{}/heartbeat",
              *CLOUD_API_URL, team_id, profile_id
            );
            match client
              .post(&url)
              .header("Authorization", format!("Bearer {token}"))
              .send()
              .await
            {
              Ok(response) if response.status().is_success() => {}
              Ok(response) if response.status() == reqwest::StatusCode::NOT_FOUND => {
                let mut locks = TEAM_LOCK.locks.write().await;
                locks.remove(&profile_id);
              }
              Ok(response) => {
                log::debug!(
                  "Heartbeat failed for profile {} with status {}",
                  profile_id,
                  response.status()
                );
              }
              Err(e) => {
                log::debug!("Heartbeat request failed for profile {}: {}", profile_id, e);
              }
            }
          }
        }

        // Refresh lock state from server
        if let Err(e) = TEAM_LOCK.fetch_initial_locks(&team_id).await {
          log::debug!("Failed to refresh locks: {e}");
        }
      }
    });

    *handle = Some(h);
  }

  async fn get_team_id(&self) -> Result<String, String> {
    let tid = self.connected_team_id.lock().await;
    tid
      .clone()
      .ok_or_else(|| "Not connected to a team".to_string())
  }
}

/// Acquire team lock if profile is sync-enabled and user is on a team.
/// Returns Ok(()) if lock acquired or not applicable, Err with message if locked by another.
pub async fn acquire_team_lock_if_needed(
  profile: &crate::profile::BrowserProfile,
) -> Result<(), String> {
  if !profile.is_sync_enabled() {
    return Ok(());
  }
  if !CLOUD_AUTH.is_on_team_plan().await {
    return Ok(());
  }

  TEAM_LOCK.acquire_lock(&profile.id.to_string()).await
}

/// Release team lock if profile is sync-enabled and user is on a team.
/// Logs warnings on failure but does not return errors.
pub async fn release_team_lock_if_needed(profile: &crate::profile::BrowserProfile) {
  if !profile.is_sync_enabled() {
    return;
  }
  if !CLOUD_AUTH.is_on_team_plan().await {
    return;
  }

  if let Err(e) = TEAM_LOCK.release_lock(&profile.id.to_string()).await {
    log::warn!(
      "Failed to release team lock for profile {}: {e}",
      profile.id
    );
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  fn sample_lock(locked_at: DateTime<Utc>, expires_at: Option<DateTime<Utc>>) -> ProfileLockInfo {
    ProfileLockInfo {
      profile_id: "profile-1".to_string(),
      locked_by: "user-1".to_string(),
      locked_by_email: "user@example.com".to_string(),
      locked_at: locked_at.to_rfc3339(),
      expires_at: expires_at.map(|value| value.to_rfc3339()),
    }
  }

  #[test]
  fn lock_with_expired_explicit_lease_is_stale() {
    let lock = sample_lock(
      Utc::now() - ChronoDuration::seconds(10),
      Some(Utc::now() - ChronoDuration::seconds(1)),
    );
    assert!(is_lock_stale(&lock));
  }

  #[test]
  fn lock_without_explicit_expiry_uses_default_lease_window() {
    let lock = sample_lock(
      Utc::now() - ChronoDuration::seconds(DEFAULT_LOCK_LEASE_SECONDS + 10),
      None,
    );
    assert!(is_lock_stale(&lock));
  }

  #[test]
  fn recent_lock_without_expiry_is_not_stale() {
    let lock = sample_lock(Utc::now() - ChronoDuration::seconds(5), None);
    assert!(!is_lock_stale(&lock));
  }
}

// --- Tauri commands ---

#[tauri::command]
pub async fn get_team_locks() -> Result<Vec<ProfileLockInfo>, String> {
  Ok(TEAM_LOCK.get_locks().await)
}

#[tauri::command]
pub async fn get_team_lock_status(profile_id: String) -> Result<Option<ProfileLockInfo>, String> {
  Ok(TEAM_LOCK.get_lock_status(&profile_id).await)
}
