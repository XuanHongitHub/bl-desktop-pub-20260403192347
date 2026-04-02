use super::engine::SyncEngine;
use super::subscription::SyncWorkItem;
use crate::events;
use crate::profile::ProfileManager;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::sync::mpsc;
use tokio::sync::Mutex;
use tokio::time::sleep;

static GLOBAL_SCHEDULER: std::sync::Mutex<Option<Arc<SyncScheduler>>> = std::sync::Mutex::new(None);

pub fn get_global_scheduler() -> Option<Arc<SyncScheduler>> {
  GLOBAL_SCHEDULER.lock().ok().and_then(|g| g.clone())
}

pub fn set_global_scheduler(scheduler: Arc<SyncScheduler>) {
  if let Ok(mut g) = GLOBAL_SCHEDULER.lock() {
    *g = Some(scheduler);
  }
}

fn now_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis() as u64
}

fn is_expected_sync_engine_config_error(error: &str) -> bool {
  let normalized = error.to_ascii_lowercase();
  normalized.contains("not logged in")
    || normalized.contains("cloud sync token not available")
    || normalized.contains("sync server url not configured")
    || normalized.contains("sync token not configured")
}

fn profile_outbox_path() -> PathBuf {
  crate::app_dirs::profiles_dir().join(".sync_profile_outbox.json")
}

fn compute_retry_delay_ms(attempts: u32) -> u64 {
  let exp = attempts.saturating_sub(1).min(10);
  let delay = PROFILE_SYNC_INITIAL_RETRY_MS.saturating_mul(1u64 << exp);
  delay.min(PROFILE_SYNC_MAX_RETRY_MS)
}

#[derive(Debug, Clone)]
struct ProfileStopTime {
  idempotency_key: String,
  attempts: u32,
  next_attempt_at_ms: u64,
  reason: String,
  queued: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedProfileOutbox {
  idempotency_key: String,
  attempts: u32,
  next_attempt_at_ms: u64,
  reason: String,
  queued: bool,
}

const PROFILE_SYNC_CONCURRENCY_LIMIT: usize = 4;
const PROFILE_SYNC_INITIAL_RETRY_MS: u64 = 1_000;
const PROFILE_SYNC_MAX_RETRY_MS: u64 = 60_000;
const PROFILE_OUTBOX_PERSIST_DEBOUNCE_MS: u64 = 250;

pub struct SyncScheduler {
  running: Arc<AtomicBool>,
  pending_profiles: Arc<Mutex<HashMap<String, ProfileStopTime>>>,
  pending_proxies: Arc<Mutex<HashSet<String>>>,
  pending_groups: Arc<Mutex<HashSet<String>>>,
  pending_vpns: Arc<Mutex<HashSet<String>>>,
  pending_extensions: Arc<Mutex<HashSet<String>>>,
  pending_extension_groups: Arc<Mutex<HashSet<String>>>,
  pending_tombstones: Arc<Mutex<Vec<(String, String)>>>,
  running_profiles: Arc<Mutex<HashSet<String>>>,
  in_flight_profiles: Arc<Mutex<HashSet<String>>>,
  profile_outbox_dirty: Arc<AtomicBool>,
  profile_outbox_last_flush_ms: Arc<AtomicU64>,
}

impl Default for SyncScheduler {
  fn default() -> Self {
    Self::new()
  }
}

impl SyncScheduler {
  pub fn new() -> Self {
    Self {
      running: Arc::new(AtomicBool::new(false)),
      pending_profiles: Arc::new(Mutex::new(HashMap::new())),
      pending_proxies: Arc::new(Mutex::new(HashSet::new())),
      pending_groups: Arc::new(Mutex::new(HashSet::new())),
      pending_vpns: Arc::new(Mutex::new(HashSet::new())),
      pending_extensions: Arc::new(Mutex::new(HashSet::new())),
      pending_extension_groups: Arc::new(Mutex::new(HashSet::new())),
      pending_tombstones: Arc::new(Mutex::new(Vec::new())),
      running_profiles: Arc::new(Mutex::new(HashSet::new())),
      in_flight_profiles: Arc::new(Mutex::new(HashSet::new())),
      profile_outbox_dirty: Arc::new(AtomicBool::new(false)),
      profile_outbox_last_flush_ms: Arc::new(AtomicU64::new(0)),
    }
  }

  pub fn is_running(&self) -> bool {
    self.running.load(Ordering::SeqCst)
  }

  pub fn stop(&self) {
    self.running.store(false, Ordering::SeqCst);
  }

  async fn persist_profile_outbox(&self) -> bool {
    let pending = self.pending_profiles.lock().await;
    let serializable: HashMap<String, PersistedProfileOutbox> = pending
      .iter()
      .map(|(id, item)| {
        (
          id.clone(),
          PersistedProfileOutbox {
            idempotency_key: item.idempotency_key.clone(),
            attempts: item.attempts,
            next_attempt_at_ms: item.next_attempt_at_ms,
            reason: item.reason.clone(),
            queued: item.queued,
          },
        )
      })
      .collect();
    drop(pending);

    let outbox_path = profile_outbox_path();
    if let Some(parent) = outbox_path.parent() {
      if let Err(e) = fs::create_dir_all(parent) {
        log::warn!(
          "Failed to ensure sync profile outbox parent directory {}: {}",
          parent.display(),
          e
        );
        return false;
      }
    }

    match serde_json::to_string_pretty(&serializable) {
      Ok(json) => {
        if let Err(e) = fs::write(&outbox_path, json) {
          log::warn!(
            "Failed to persist sync profile outbox at {}: {}",
            outbox_path.display(),
            e
          );
          return false;
        }
        true
      }
      Err(e) => {
        log::warn!("Failed to serialize sync profile outbox: {e}");
        false
      }
    }
  }

  fn mark_profile_outbox_dirty(&self) {
    self.profile_outbox_dirty.store(true, Ordering::SeqCst);
  }

  async fn maybe_persist_profile_outbox(&self, force: bool) {
    if !self.profile_outbox_dirty.load(Ordering::SeqCst) {
      return;
    }

    let now = now_ms();
    let last_flush = self.profile_outbox_last_flush_ms.load(Ordering::SeqCst);
    if !force && now.saturating_sub(last_flush) < PROFILE_OUTBOX_PERSIST_DEBOUNCE_MS {
      return;
    }

    if !self.profile_outbox_dirty.swap(false, Ordering::SeqCst) {
      return;
    }

    if self.persist_profile_outbox().await {
      self
        .profile_outbox_last_flush_ms
        .store(now_ms(), Ordering::SeqCst);
    } else {
      self.profile_outbox_dirty.store(true, Ordering::SeqCst);
    }
  }

  async fn replay_profile_outbox(&self) {
    let outbox_path = profile_outbox_path();
    let content = match fs::read_to_string(&outbox_path) {
      Ok(content) => content,
      Err(_) => return,
    };

    let persisted: HashMap<String, PersistedProfileOutbox> = match serde_json::from_str(&content) {
      Ok(data) => data,
      Err(e) => {
        log::warn!(
          "Failed to parse sync profile outbox {}: {}",
          outbox_path.display(),
          e
        );
        return;
      }
    };

    if persisted.is_empty() {
      return;
    }

    let mut pending = self.pending_profiles.lock().await;
    for (profile_id, item) in persisted {
      pending.insert(
        profile_id,
        ProfileStopTime {
          idempotency_key: item.idempotency_key,
          attempts: item.attempts,
          next_attempt_at_ms: item.next_attempt_at_ms,
          reason: item.reason,
          queued: item.queued,
        },
      );
    }
    drop(pending);

    log::info!(
      "Replayed {} profile sync entries from outbox",
      self.pending_profiles.lock().await.len()
    );
  }

  /// Check if any sync operation is currently in progress
  pub async fn is_sync_in_progress(&self) -> bool {
    let in_flight = self.in_flight_profiles.lock().await;
    if !in_flight.is_empty() {
      return true;
    }
    drop(in_flight);

    let pending_profiles = self.pending_profiles.lock().await;
    if !pending_profiles.is_empty() {
      return true;
    }
    drop(pending_profiles);

    let pending_proxies = self.pending_proxies.lock().await;
    if !pending_proxies.is_empty() {
      return true;
    }
    drop(pending_proxies);

    let pending_groups = self.pending_groups.lock().await;
    if !pending_groups.is_empty() {
      return true;
    }
    drop(pending_groups);

    let pending_vpns = self.pending_vpns.lock().await;
    if !pending_vpns.is_empty() {
      return true;
    }
    drop(pending_vpns);

    let pending_extensions = self.pending_extensions.lock().await;
    if !pending_extensions.is_empty() {
      return true;
    }
    drop(pending_extensions);

    let pending_extension_groups = self.pending_extension_groups.lock().await;
    if !pending_extension_groups.is_empty() {
      return true;
    }
    drop(pending_extension_groups);

    let pending_tombstones = self.pending_tombstones.lock().await;
    if !pending_tombstones.is_empty() {
      return true;
    }

    false
  }

  pub async fn mark_profile_running(&self, profile_id: &str) {
    let mut running = self.running_profiles.lock().await;
    running.insert(profile_id.to_string());
    log::debug!("Marked profile {} as running", profile_id);
  }

  pub async fn mark_profile_stopped(&self, profile_id: &str) {
    let mut running = self.running_profiles.lock().await;
    running.remove(profile_id);
    log::debug!("Marked profile {} as stopped", profile_id);

    let mut pending = self.pending_profiles.lock().await;
    if let Some(item) = pending.get_mut(profile_id) {
      item.queued = true;
      item.next_attempt_at_ms = now_ms();
      item.reason = "stopped".to_string();
      log::debug!(
        "Profile {} has pending sync, will execute immediately",
        profile_id
      );
    }
    drop(pending);
    self.mark_profile_outbox_dirty();
    if !self.running.load(Ordering::SeqCst) {
      self.maybe_persist_profile_outbox(true).await;
    }
  }

  pub async fn is_profile_running(&self, profile_id: &str) -> bool {
    // First check our internal tracking
    let running = self.running_profiles.lock().await;
    if running.contains(profile_id) {
      return true;
    }
    drop(running);

    // Also check the actual profile state from ProfileManager
    let profile_manager = ProfileManager::instance();
    if let Ok(Some(profile)) = profile_manager.get_profile_by_id_str(profile_id) {
      return profile.process_id.is_some();
    }

    false
  }

  pub async fn queue_profile_sync(&self, profile_id: String) {
    self
      .queue_profile_sync_internal(profile_id, "queued".to_string(), false)
      .await;
  }

  pub async fn queue_profile_sync_immediate(&self, profile_id: String) {
    self
      .queue_profile_sync_internal(profile_id, "immediate".to_string(), true)
      .await;
  }

  async fn queue_profile_sync_internal(
    &self,
    profile_id: String,
    reason: String,
    force_immediate: bool,
  ) {
    let is_running = self.is_profile_running(&profile_id).await;
    let mut pending = self.pending_profiles.lock().await;
    let entry = pending
      .entry(profile_id.clone())
      .or_insert_with(|| ProfileStopTime {
        idempotency_key: uuid::Uuid::new_v4().to_string(),
        attempts: 0,
        next_attempt_at_ms: now_ms(),
        reason: reason.clone(),
        queued: true,
      });
    entry.attempts = 0;

    if is_running {
      // Profile is running - queue for after it stops.
      entry.queued = true;
      entry.reason = reason;
      entry.next_attempt_at_ms = now_ms();
      log::debug!(
        "Profile {} is running, queued sync for after stop",
        profile_id
      );
    } else {
      // Profile is not running - sync now unless caller explicitly wants delayed retry semantics.
      entry.queued = true;
      entry.reason = reason;
      if force_immediate {
        entry.next_attempt_at_ms = now_ms();
      } else {
        entry.next_attempt_at_ms = entry.next_attempt_at_ms.min(now_ms());
      }
      log::debug!(
        "Profile {} queued for sync with idempotency key {}",
        profile_id,
        entry.idempotency_key
      );
    }
    drop(pending);
    self.mark_profile_outbox_dirty();
    if !self.running.load(Ordering::SeqCst) {
      self.maybe_persist_profile_outbox(true).await;
    }
  }

  pub async fn queue_proxy_sync(&self, proxy_id: String) {
    let mut pending = self.pending_proxies.lock().await;
    pending.insert(proxy_id);
  }

  pub async fn queue_vpn_sync(&self, vpn_id: String) {
    let mut pending = self.pending_vpns.lock().await;
    pending.insert(vpn_id);
  }

  pub async fn queue_group_sync(&self, group_id: String) {
    let mut pending = self.pending_groups.lock().await;
    pending.insert(group_id);
  }

  pub async fn queue_extension_sync(&self, extension_id: String) {
    let mut pending = self.pending_extensions.lock().await;
    pending.insert(extension_id);
  }

  pub async fn queue_extension_group_sync(&self, extension_group_id: String) {
    let mut pending = self.pending_extension_groups.lock().await;
    pending.insert(extension_group_id);
  }

  pub async fn queue_tombstone(&self, entity_type: String, entity_id: String) {
    let mut pending = self.pending_tombstones.lock().await;
    if !pending
      .iter()
      .any(|(t, i)| t == &entity_type && i == &entity_id)
    {
      pending.push((entity_type, entity_id));
    }
  }

  pub async fn sync_all_enabled_profiles(&self, _app_handle: &tauri::AppHandle) {
    log::info!("Starting initial sync for all enabled profiles...");

    let profiles = {
      let profile_manager = ProfileManager::instance();
      match profile_manager.list_profiles() {
        Ok(p) => p,
        Err(e) => {
          log::error!("Failed to list profiles for initial sync: {e}");
          return;
        }
      }
    };

    let sync_enabled_profiles: Vec<_> = profiles
      .into_iter()
      .filter(|p| p.is_sync_enabled() && !p.is_cross_os())
      .collect();

    if sync_enabled_profiles.is_empty() {
      log::debug!("No sync-enabled profiles found");
      return;
    }

    log::info!(
      "Found {} sync-enabled profiles, queueing for sync",
      sync_enabled_profiles.len()
    );

    for profile in sync_enabled_profiles {
      let profile_id = profile.id.to_string();
      let is_running = profile.process_id.is_some();

      // Emit initial status
      let _ = events::emit(
        "profile-sync-status",
        serde_json::json!({
          "profile_id": profile_id,
          "status": if is_running { "waiting" } else { "syncing" }
        }),
      );

      let mut pending = self.pending_profiles.lock().await;
      let entry = pending
        .entry(profile_id.clone())
        .or_insert_with(|| ProfileStopTime {
          idempotency_key: uuid::Uuid::new_v4().to_string(),
          attempts: 0,
          next_attempt_at_ms: now_ms(),
          reason: "initial".to_string(),
          queued: true,
        });
      entry.attempts = 0;
      entry.queued = true;
      entry.reason = if is_running {
        "initial-wait-running".to_string()
      } else {
        "initial".to_string()
      };
      entry.next_attempt_at_ms = now_ms();
    }

    self.mark_profile_outbox_dirty();
    if !self.running.load(Ordering::SeqCst) {
      self.maybe_persist_profile_outbox(true).await;
    }
  }

  pub async fn start(
    self: Arc<Self>,
    app_handle: tauri::AppHandle,
    mut work_rx: mpsc::UnboundedReceiver<SyncWorkItem>,
  ) {
    if self.running.swap(true, Ordering::SeqCst) {
      return;
    }

    self.replay_profile_outbox().await;

    let scheduler = self.clone();
    let app_handle_clone = app_handle.clone();

    tokio::spawn(async move {
      while scheduler.running.load(Ordering::SeqCst) {
        tokio::select! {
          Some(work_item) = work_rx.recv() => {
            match work_item {
              SyncWorkItem::Profile(id) => scheduler.queue_profile_sync(id).await,
              SyncWorkItem::Proxy(id) => scheduler.queue_proxy_sync(id).await,
              SyncWorkItem::Group(id) => scheduler.queue_group_sync(id).await,
              SyncWorkItem::Vpn(id) => scheduler.queue_vpn_sync(id).await,
              SyncWorkItem::Extension(id) => scheduler.queue_extension_sync(id).await,
              SyncWorkItem::ExtensionGroup(id) => scheduler.queue_extension_group_sync(id).await,
              SyncWorkItem::Tombstone(entity_type, entity_id) => {
                scheduler.queue_tombstone(entity_type, entity_id).await
              }
            }
            scheduler.maybe_persist_profile_outbox(false).await;
          }
          _ = sleep(Duration::from_millis(500)) => {
            scheduler.process_pending(&app_handle_clone).await;
            scheduler.maybe_persist_profile_outbox(false).await;
          }
        }
      }

      log::info!("Sync scheduler stopped");
    });
  }

  async fn process_pending(&self, app_handle: &tauri::AppHandle) {
    self.process_pending_profiles(app_handle).await;
    self.process_pending_proxies(app_handle).await;
    self.process_pending_groups(app_handle).await;
    self.process_pending_vpns(app_handle).await;
    self.process_pending_extensions(app_handle).await;
    self.process_pending_extension_groups(app_handle).await;
    self.process_pending_tombstones(app_handle).await;
  }

  async fn process_pending_profiles(&self, app_handle: &tauri::AppHandle) {
    let now = now_ms();
    let profiles_to_sync: Vec<(String, String)> = {
      let pending = self.pending_profiles.lock().await;
      let running = self.running_profiles.lock().await;
      let in_flight = self.in_flight_profiles.lock().await;

      let mut ready: Vec<(String, String)> = pending
        .iter()
        .filter(|(id, item)| {
          item.queued
            && item.next_attempt_at_ms <= now
            && !running.contains(*id)
            && !in_flight.contains(*id)
        })
        .map(|(id, item)| (id.clone(), item.idempotency_key.clone()))
        .collect();
      ready.sort_by(|a, b| a.0.cmp(&b.0));
      ready.truncate(PROFILE_SYNC_CONCURRENCY_LIMIT);
      ready
    };

    if profiles_to_sync.is_empty() {
      return;
    }

    {
      let mut in_flight = self.in_flight_profiles.lock().await;
      for (profile_id, _) in &profiles_to_sync {
        in_flight.insert(profile_id.clone());
      }
    }

    for (profile_id, idempotency_key) in &profiles_to_sync {
      log::info!(
        "Executing queued sync for profile {} (idempotency={})",
        profile_id,
        idempotency_key
      );
      let _ = events::emit(
        "profile-sync-status",
        serde_json::json!({
          "profile_id": profile_id,
          "status": "syncing",
          "idempotency_key": idempotency_key
        }),
      );
    }

    let profiles_snapshot = Arc::new({
      let profile_manager = ProfileManager::instance();
      profile_manager
        .list_profiles()
        .unwrap_or_default()
        .into_iter()
        .filter(|profile| profile.is_sync_enabled() && !profile.is_cross_os())
        .map(|profile| (profile.id.to_string(), profile))
        .collect::<HashMap<_, _>>()
    });

    let app_handle_owned = app_handle.clone();
    let shared_engine = match SyncEngine::create_from_settings(&app_handle_owned).await {
      Ok(engine) => Some(Arc::new(engine)),
      Err(e) => {
        if is_expected_sync_engine_config_error(&e) {
          log::debug!("Sync engine not configured for profile batch: {e}");
        } else {
          log::error!("Failed to create sync engine for profile batch: {e}");
        }
        None
      }
    };

    let sync_tasks = profiles_to_sync
      .iter()
      .map(|(profile_id, idempotency_key)| {
        let profile_id = profile_id.clone();
        let idempotency_key = idempotency_key.clone();
        let app_handle = app_handle_owned.clone();
        let profiles_snapshot = Arc::clone(&profiles_snapshot);
        let shared_engine = shared_engine.clone();
        async move {
          let profile_to_sync = profiles_snapshot.get(&profile_id).cloned();

          let result = if let Some(mut profile) = profile_to_sync {
            profile.runtime_state = crate::profile::types::RuntimeState::Syncing;
            let _ = ProfileManager::instance().save_profile(&profile);
            let _ = events::emit("profile-updated", &profile);

            let sync_result = if let Some(engine) = shared_engine.as_ref() {
              engine.sync_profile(&app_handle, &profile).await
            } else {
              Err(super::types::SyncError::NotConfigured)
            };

            profile.runtime_state = if sync_result.is_ok() {
              crate::profile::types::RuntimeState::Stopped
            } else {
              crate::profile::types::RuntimeState::Error
            };
            let _ = ProfileManager::instance().save_profile(&profile);
            let _ = events::emit("profile-updated", &profile);

            sync_result
          } else {
            Ok(())
          };

          (profile_id, idempotency_key, result)
        }
      });

    let results = futures_util::future::join_all(sync_tasks).await;
    let mut outbox_changed = false;

    for (profile_id, idempotency_key, result) in results {
      {
        let mut in_flight = self.in_flight_profiles.lock().await;
        in_flight.remove(&profile_id);
      }

      match result {
        Ok(()) => {
          {
            let mut pending = self.pending_profiles.lock().await;
            if pending.remove(&profile_id).is_some() {
              outbox_changed = true;
            }
          }

          log::info!(
            "Profile {} synced successfully (idempotency={})",
            profile_id,
            idempotency_key
          );
          let _ = events::emit(
            "profile-sync-status",
            serde_json::json!({
              "profile_id": profile_id,
              "status": "synced",
              "idempotency_key": idempotency_key
            }),
          );
        }
        Err(e) => {
          let (attempts, retry_in_ms) = {
            let mut pending = self.pending_profiles.lock().await;
            if let Some(item) = pending.get_mut(&profile_id) {
              item.attempts = item.attempts.saturating_add(1);
              let delay_ms = compute_retry_delay_ms(item.attempts);
              item.next_attempt_at_ms = now_ms().saturating_add(delay_ms);
              item.reason = "retry".to_string();
              outbox_changed = true;
              (item.attempts, delay_ms)
            } else {
              (0, PROFILE_SYNC_INITIAL_RETRY_MS)
            }
          };

          log::error!(
            "Failed to sync profile {} (attempt {}, retry in {}ms): {}",
            profile_id,
            attempts,
            retry_in_ms,
            e
          );
          let _ = events::emit(
            "profile-sync-status",
            serde_json::json!({
              "profile_id": profile_id,
              "status": "error",
              "error": e.to_string(),
              "idempotency_key": idempotency_key,
              "attempt": attempts,
              "retry_in_ms": retry_in_ms
            }),
          );
        }
      }
    }

    if outbox_changed {
      self.mark_profile_outbox_dirty();
    }

    if !self.is_sync_in_progress().await {
      log::debug!("All profile syncs completed, triggering cleanup");
      let registry = crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
      if let Err(e) = registry.cleanup_unused_binaries() {
        log::warn!("Cleanup after sync failed: {e}");
      } else {
        log::debug!("Cleanup after sync completed successfully");
      }
    }
  }

  async fn process_pending_proxies(&self, app_handle: &tauri::AppHandle) {
    let proxies_to_sync: Vec<String> = {
      let mut pending = self.pending_proxies.lock().await;
      let list: Vec<String> = pending.drain().collect();
      list
    };

    if proxies_to_sync.is_empty() {
      return;
    }

    match SyncEngine::create_from_settings(app_handle).await {
      Ok(engine) => {
        for proxy_id in proxies_to_sync {
          log::info!("Syncing proxy {}", proxy_id);
          let _ = events::emit(
            "proxy-sync-status",
            serde_json::json!({
              "id": proxy_id,
              "status": "syncing"
            }),
          );
          match engine
            .sync_proxy_by_id_with_handle(&proxy_id, app_handle)
            .await
          {
            Ok(()) => {
              let _ = events::emit(
                "proxy-sync-status",
                serde_json::json!({
                  "id": proxy_id,
                  "status": "synced"
                }),
              );
            }
            Err(e) => {
              log::error!("Failed to sync proxy {}: {}", proxy_id, e);
              let _ = events::emit(
                "proxy-sync-status",
                serde_json::json!({
                  "id": proxy_id,
                  "status": "error"
                }),
              );
            }
          }
        }

        // Check if all sync work is complete after proxies finish
        if !self.is_sync_in_progress().await {
          log::debug!("All syncs completed after proxy sync, triggering cleanup");
          let registry =
            crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
          if let Err(e) = registry.cleanup_unused_binaries() {
            log::warn!("Cleanup after sync failed: {e}");
          } else {
            log::debug!("Cleanup after sync completed successfully");
          }
        }
      }
      Err(e) => {
        if is_expected_sync_engine_config_error(&e) {
          log::debug!("Sync engine not configured: {}", e);
        } else {
          log::error!("Failed to create sync engine: {}", e);
        }
      }
    }
  }

  async fn process_pending_groups(&self, app_handle: &tauri::AppHandle) {
    let groups_to_sync: Vec<String> = {
      let mut pending = self.pending_groups.lock().await;
      let list: Vec<String> = pending.drain().collect();
      list
    };

    if groups_to_sync.is_empty() {
      return;
    }

    match SyncEngine::create_from_settings(app_handle).await {
      Ok(engine) => {
        for group_id in groups_to_sync {
          log::info!("Syncing group {}", group_id);
          let _ = events::emit(
            "group-sync-status",
            serde_json::json!({
              "id": group_id,
              "status": "syncing"
            }),
          );
          match engine
            .sync_group_by_id_with_handle(&group_id, app_handle)
            .await
          {
            Ok(()) => {
              let _ = events::emit(
                "group-sync-status",
                serde_json::json!({
                  "id": group_id,
                  "status": "synced"
                }),
              );
            }
            Err(e) => {
              log::error!("Failed to sync group {}: {}", group_id, e);
              let _ = events::emit(
                "group-sync-status",
                serde_json::json!({
                  "id": group_id,
                  "status": "error"
                }),
              );
            }
          }
        }

        // Check if all sync work is complete after groups finish
        if !self.is_sync_in_progress().await {
          log::debug!("All syncs completed after group sync, triggering cleanup");
          let registry =
            crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
          if let Err(e) = registry.cleanup_unused_binaries() {
            log::warn!("Cleanup after sync failed: {e}");
          } else {
            log::debug!("Cleanup after sync completed successfully");
          }
        }
      }
      Err(e) => {
        if is_expected_sync_engine_config_error(&e) {
          log::debug!("Sync engine not configured: {}", e);
        } else {
          log::error!("Failed to create sync engine: {}", e);
        }
      }
    }
  }

  async fn process_pending_vpns(&self, app_handle: &tauri::AppHandle) {
    let vpns_to_sync: Vec<String> = {
      let mut pending = self.pending_vpns.lock().await;
      let list: Vec<String> = pending.drain().collect();
      list
    };

    if vpns_to_sync.is_empty() {
      return;
    }

    match SyncEngine::create_from_settings(app_handle).await {
      Ok(engine) => {
        for vpn_id in vpns_to_sync {
          log::info!("Syncing VPN {}", vpn_id);
          let _ = events::emit(
            "vpn-sync-status",
            serde_json::json!({
              "id": vpn_id,
              "status": "syncing"
            }),
          );
          match engine.sync_vpn_by_id_with_handle(&vpn_id, app_handle).await {
            Ok(()) => {
              let _ = events::emit(
                "vpn-sync-status",
                serde_json::json!({
                  "id": vpn_id,
                  "status": "synced"
                }),
              );
            }
            Err(e) => {
              log::error!("Failed to sync VPN {}: {}", vpn_id, e);
              let _ = events::emit(
                "vpn-sync-status",
                serde_json::json!({
                  "id": vpn_id,
                  "status": "error"
                }),
              );
            }
          }
        }

        if !self.is_sync_in_progress().await {
          log::debug!("All syncs completed after VPN sync, triggering cleanup");
          let registry =
            crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
          if let Err(e) = registry.cleanup_unused_binaries() {
            log::warn!("Cleanup after sync failed: {e}");
          } else {
            log::debug!("Cleanup after sync completed successfully");
          }
        }
      }
      Err(e) => {
        if is_expected_sync_engine_config_error(&e) {
          log::debug!("Sync engine not configured: {}", e);
        } else {
          log::error!("Failed to create sync engine: {}", e);
        }
      }
    }
  }

  async fn process_pending_extensions(&self, app_handle: &tauri::AppHandle) {
    let extensions_to_sync: Vec<String> = {
      let mut pending = self.pending_extensions.lock().await;
      let list: Vec<String> = pending.drain().collect();
      list
    };

    if extensions_to_sync.is_empty() {
      return;
    }

    match SyncEngine::create_from_settings(app_handle).await {
      Ok(engine) => {
        for ext_id in extensions_to_sync {
          log::info!("Syncing extension {}", ext_id);
          if let Err(e) = engine
            .sync_extension_by_id_with_handle(&ext_id, app_handle)
            .await
          {
            log::error!("Failed to sync extension {}: {}", ext_id, e);
          }
        }

        if !self.is_sync_in_progress().await {
          log::debug!("All syncs completed after extension sync, triggering cleanup");
          let registry =
            crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
          if let Err(e) = registry.cleanup_unused_binaries() {
            log::warn!("Cleanup after sync failed: {e}");
          }
        }
      }
      Err(e) => {
        if is_expected_sync_engine_config_error(&e) {
          log::debug!("Sync engine not configured: {}", e);
        } else {
          log::error!("Failed to create sync engine: {}", e);
        }
      }
    }
  }

  async fn process_pending_extension_groups(&self, app_handle: &tauri::AppHandle) {
    let groups_to_sync: Vec<String> = {
      let mut pending = self.pending_extension_groups.lock().await;
      let list: Vec<String> = pending.drain().collect();
      list
    };

    if groups_to_sync.is_empty() {
      return;
    }

    match SyncEngine::create_from_settings(app_handle).await {
      Ok(engine) => {
        for group_id in groups_to_sync {
          log::info!("Syncing extension group {}", group_id);
          if let Err(e) = engine
            .sync_extension_group_by_id_with_handle(&group_id, app_handle)
            .await
          {
            log::error!("Failed to sync extension group {}: {}", group_id, e);
          }
        }

        if !self.is_sync_in_progress().await {
          log::debug!("All syncs completed after extension group sync, triggering cleanup");
          let registry =
            crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
          if let Err(e) = registry.cleanup_unused_binaries() {
            log::warn!("Cleanup after sync failed: {e}");
          }
        }
      }
      Err(e) => {
        if is_expected_sync_engine_config_error(&e) {
          log::debug!("Sync engine not configured: {}", e);
        } else {
          log::error!("Failed to create sync engine: {}", e);
        }
      }
    }
  }

  async fn process_pending_tombstones(&self, _app_handle: &tauri::AppHandle) {
    let tombstones: Vec<(String, String)> = {
      let mut pending = self.pending_tombstones.lock().await;
      std::mem::take(&mut *pending)
    };

    if tombstones.is_empty() {
      return;
    }

    for (entity_type, entity_id) in tombstones {
      log::info!("Processing tombstone for {} {}", entity_type, entity_id);
      match entity_type.as_str() {
        "profile" => {
          let profile_manager = ProfileManager::instance();
          let profile_to_delete = {
            if let Ok(profiles) = profile_manager.list_profiles() {
              let profile_uuid = uuid::Uuid::parse_str(&entity_id).ok();
              profile_uuid.and_then(|uuid| profiles.into_iter().find(|p| p.id == uuid))
            } else {
              None
            }
          };

          if let Some(mut profile) = profile_to_delete {
            log::info!(
              "Profile {} was deleted remotely, disabling sync locally",
              entity_id
            );
            profile.sync_mode = crate::profile::types::SyncMode::Disabled;
            if let Err(e) = profile_manager.save_profile(&profile) {
              log::warn!("Failed to disable sync for profile {}: {}", entity_id, e);
            } else {
              log::info!(
                "Profile {} sync disabled due to remote tombstone (local copy kept)",
                entity_id
              );
              let _ = events::emit("profiles-changed", ());
            }
          }
        }
        "proxy" => {
          let proxy_manager = &crate::proxy_manager::PROXY_MANAGER;
          let proxies = proxy_manager.get_stored_proxies();
          if let Some(proxy) = proxies.iter().find(|p| p.id == entity_id) {
            if proxy.sync_enabled {
              log::info!("Proxy {} was deleted remotely, deleting locally", entity_id);
              let proxy_file = proxy_manager.get_proxy_file_path(&entity_id);
              if proxy_file.exists() {
                let _ = std::fs::remove_file(&proxy_file);
              }
              proxy_manager.remove_from_memory(&entity_id);
              let _ = events::emit("stored-proxies-changed", ());
            }
          }
        }
        "group" => {
          let group_manager = crate::group_manager::GROUP_MANAGER.lock().unwrap();
          let groups = group_manager.get_all_groups().unwrap_or_default();
          if let Some(group) = groups.iter().find(|g| g.id == entity_id) {
            if group.sync_enabled {
              log::info!("Group {} was deleted remotely, deleting locally", entity_id);
              let _ = group_manager.delete_group_internal(&entity_id);
              let _ = events::emit("groups-changed", ());
            }
          }
        }
        "vpn" => {
          let storage = crate::vpn::VPN_STORAGE.lock().unwrap();
          if let Ok(vpn) = storage.load_config(&entity_id) {
            if vpn.sync_enabled {
              log::info!("VPN {} was deleted remotely, deleting locally", entity_id);
              let _ = storage.delete_config(&entity_id);
              let _ = events::emit("vpn-configs-changed", ());
            }
          }
        }
        "extension" => {
          let manager = crate::extension_manager::EXTENSION_MANAGER.lock().unwrap();
          if let Ok(ext) = manager.get_extension(&entity_id) {
            if ext.sync_enabled {
              log::info!(
                "Extension {} was deleted remotely, deleting locally",
                entity_id
              );
              let _ = manager.delete_extension_internal(&entity_id);
              let _ = events::emit("extensions-changed", ());
            }
          }
        }
        "extension_group" => {
          let manager = crate::extension_manager::EXTENSION_MANAGER.lock().unwrap();
          if let Ok(group) = manager.get_group(&entity_id) {
            if group.sync_enabled {
              log::info!(
                "Extension group {} was deleted remotely, deleting locally",
                entity_id
              );
              let _ = manager.delete_group_internal(&entity_id);
              let _ = events::emit("extensions-changed", ());
            }
          }
        }
        _ => {}
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn retry_delay_grows_exponentially_and_caps() {
    assert_eq!(compute_retry_delay_ms(1), PROFILE_SYNC_INITIAL_RETRY_MS);
    assert_eq!(compute_retry_delay_ms(2), PROFILE_SYNC_INITIAL_RETRY_MS * 2);
    assert_eq!(compute_retry_delay_ms(3), PROFILE_SYNC_INITIAL_RETRY_MS * 4);
    assert_eq!(compute_retry_delay_ms(20), PROFILE_SYNC_MAX_RETRY_MS);
  }

  #[test]
  fn now_ms_is_monotonic_enough_for_scheduler() {
    let first = now_ms();
    let second = now_ms();
    assert!(second >= first);
  }
}
