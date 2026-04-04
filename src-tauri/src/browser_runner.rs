use crate::browser::{create_browser, BrowserType, ProxySettings};
use crate::browser_version_manager::BrowserVersionManager;
use crate::camoufox_manager::{CamoufoxConfig, CamoufoxManager};
use crate::cloud_auth::CLOUD_AUTH;
use crate::downloaded_browsers_registry::DownloadedBrowsersRegistry;
use crate::events;
use crate::platform_browser;
use crate::profile::types::RuntimeState;
use crate::profile::{BrowserProfile, ProfileManager};
use crate::proxy_manager::PROXY_MANAGER;
use crate::wayfern_manager::{WayfernConfig, WayfernManager};
#[cfg(target_os = "windows")]
use image::{ImageFormat, Rgba, RgbaImage};
use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use sysinfo::System;
use url::Url;

static TEMP_PROXY_PID_COUNTER: AtomicU32 = AtomicU32::new(2_000_000_000);

struct ProfileLaunchGuard {
  profile_id: String,
}

impl Drop for ProfileLaunchGuard {
  fn drop(&mut self) {
    if let Ok(mut in_flight) = PROFILE_LAUNCH_IN_FLIGHT.lock() {
      in_flight.remove(&self.profile_id);
    }
  }
}

fn acquire_profile_launch_guard(profile_id: &str) -> Result<ProfileLaunchGuard, String> {
  let mut in_flight = PROFILE_LAUNCH_IN_FLIGHT
    .lock()
    .map_err(|_| "Failed to acquire launch mutex".to_string())?;
  if in_flight.contains(profile_id) {
    return Err(format!(
      "Launch is already in progress for profile '{profile_id}'. Please wait."
    ));
  }
  in_flight.insert(profile_id.to_string());
  Ok(ProfileLaunchGuard {
    profile_id: profile_id.to_string(),
  })
}

fn next_temp_proxy_pid() -> u32 {
  let next = TEMP_PROXY_PID_COUNTER.fetch_add(1, Ordering::Relaxed);
  if next == u32::MAX {
    TEMP_PROXY_PID_COUNTER.store(2_000_000_000, Ordering::Relaxed);
    return 2_000_000_000;
  }
  next
}
pub struct BrowserRunner {
  pub profile_manager: &'static ProfileManager,
  pub downloaded_browsers_registry: &'static DownloadedBrowsersRegistry,
  auto_updater: &'static crate::auto_updater::AutoUpdater,
  camoufox_manager: &'static CamoufoxManager,
  wayfern_manager: &'static WayfernManager,
}

impl BrowserRunner {
  fn new() -> Self {
    Self {
      profile_manager: ProfileManager::instance(),
      downloaded_browsers_registry: DownloadedBrowsersRegistry::instance(),
      auto_updater: crate::auto_updater::AutoUpdater::instance(),
      camoufox_manager: CamoufoxManager::instance(),
      wayfern_manager: WayfernManager::instance(),
    }
  }

  pub fn instance() -> &'static BrowserRunner {
    &BROWSER_RUNNER
  }

  pub fn get_binaries_dir(&self) -> PathBuf {
    crate::app_dirs::binaries_dir()
  }

  fn is_global_rtc_disabled_for_all_browsers(&self) -> bool {
    match crate::settings_manager::SettingsManager::instance().load_settings() {
      Ok(settings) => settings.disable_rtc_for_all_browsers,
      Err(error) => {
        log::warn!(
          "Failed to load app settings for RTC policy; defaulting to disabled: {}",
          error
        );
        true
      }
    }
  }

  fn append_chromium_global_rtc_policy_args(&self, browser_args: &mut Vec<String>) {
    let rtc_policy_args = [
      "--disable-webrtc",
      "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      "--enforce-webrtc-ip-permission-check",
      "--webrtc-ip-handling-policy=disable_non_proxied_udp",
    ];

    for arg in rtc_policy_args {
      if !browser_args.iter().any(|existing| existing == arg) {
        browser_args.push(arg.to_string());
      }
    }
  }

  /// Refresh cloud proxy credentials if the profile uses a cloud or cloud-derived proxy,
  /// then resolve the proxy settings.
  async fn resolve_proxy_with_refresh(&self, proxy_id: Option<&String>) -> Option<ProxySettings> {
    let proxy_id = proxy_id?;
    if PROXY_MANAGER.is_cloud_or_derived(proxy_id) {
      log::info!("Refreshing cloud proxy credentials before launch for proxy {proxy_id}");
      CLOUD_AUTH.sync_cloud_proxy().await;
    }
    PROXY_MANAGER.get_proxy_settings_by_id(proxy_id)
  }

  async fn ensure_camoufox_fingerprint(
    &self,
    app_handle: &tauri::AppHandle,
    profile: &BrowserProfile,
    updated_profile: &mut BrowserProfile,
    camoufox_config: &mut CamoufoxConfig,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let needs_generation = camoufox_config.fingerprint.is_none()
      || camoufox_config.randomize_fingerprint_on_launch == Some(true);

    if !needs_generation {
      return Ok(());
    }

    let generation_reason = if camoufox_config.randomize_fingerprint_on_launch == Some(true) {
      "randomize-on-launch"
    } else {
      "missing-stored-fingerprint"
    };
    log::info!(
      "Generating Camoufox fingerprint for profile '{}' ({})",
      profile.name,
      generation_reason
    );

    let mut config_for_generation = camoufox_config.clone();
    config_for_generation.fingerprint = None;

    let new_fingerprint = self
      .camoufox_manager
      .generate_fingerprint_config(app_handle, profile, &config_for_generation)
      .await
      .map_err(|e| format!("Failed to generate Camoufox fingerprint: {e}"))?;

    camoufox_config.fingerprint = Some(new_fingerprint.clone());

    let mut persisted_camoufox_config = updated_profile.camoufox_config.clone().unwrap_or_default();
    persisted_camoufox_config.fingerprint = Some(new_fingerprint);
    persisted_camoufox_config.randomize_fingerprint_on_launch =
      camoufox_config.randomize_fingerprint_on_launch;
    if camoufox_config.os.is_some() {
      persisted_camoufox_config.os = camoufox_config.os.clone();
    }
    updated_profile.camoufox_config = Some(persisted_camoufox_config);

    Ok(())
  }

  async fn ensure_wayfern_fingerprint(
    &self,
    app_handle: &tauri::AppHandle,
    profile: &BrowserProfile,
    updated_profile: &mut BrowserProfile,
    wayfern_config: &mut WayfernConfig,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let needs_generation = wayfern_config.fingerprint.is_none()
      || wayfern_config.randomize_fingerprint_on_launch == Some(true);

    if !needs_generation {
      return Ok(());
    }

    let generation_reason = if wayfern_config.randomize_fingerprint_on_launch == Some(true) {
      "randomize-on-launch"
    } else {
      "missing-stored-fingerprint"
    };
    log::info!(
      "Generating Wayfern fingerprint for profile '{}' ({})",
      profile.name,
      generation_reason
    );

    let mut config_for_generation = wayfern_config.clone();
    config_for_generation.fingerprint = None;

    let new_fingerprint = self
      .wayfern_manager
      .generate_fingerprint_config(app_handle, profile, &config_for_generation)
      .await
      .map_err(|e| format!("Failed to generate Wayfern fingerprint: {e}"))?;

    wayfern_config.fingerprint = Some(new_fingerprint.clone());

    let mut persisted_wayfern_config = updated_profile.wayfern_config.clone().unwrap_or_default();
    persisted_wayfern_config.fingerprint = Some(new_fingerprint);
    persisted_wayfern_config.randomize_fingerprint_on_launch =
      wayfern_config.randomize_fingerprint_on_launch;
    if wayfern_config.os.is_some() {
      persisted_wayfern_config.os = wayfern_config.os.clone();
    }
    updated_profile.wayfern_config = Some(persisted_wayfern_config);

    Ok(())
  }

  fn schedule_profile_window_identity_with_url(
    &self,
    profile: &BrowserProfile,
    navigation_url: Option<&str>,
  ) {
    crate::browser_window::schedule_profile_identity_for_pid_with_url(
      profile.process_id,
      &profile.name,
      navigation_url,
    );
  }

  /// Get the executable path for a browser profile
  /// This is a common helper to eliminate code duplication across the codebase
  pub fn get_browser_executable_path(
    &self,
    profile: &BrowserProfile,
  ) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    // Create browser instance to get executable path
    let browser_type = crate::browser::BrowserType::from_str(&profile.browser)
      .map_err(|e| format!("Invalid browser type: {e}"))?;
    let browser = crate::browser::create_browser(browser_type);

    // Construct browser directory path: binaries/<browser>/<version>/
    let mut browser_dir = self.get_binaries_dir();
    browser_dir.push(crate::browser::canonical_managed_browser_slug(
      &profile.browser,
    ));
    browser_dir.push(&profile.version);

    // Get platform-specific executable path
    browser
      .get_executable_path(&browser_dir)
      .map_err(|e| format!("Failed to get executable path for {}: {e}", profile.browser).into())
  }

  async fn resolve_launch_executable_for_profile(
    &self,
    profile: &BrowserProfile,
  ) -> Result<PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    let base_executable_path = self.get_browser_executable_path(profile)?;

    #[cfg(target_os = "windows")]
    {
      match self
        .ensure_windows_profile_launcher_executable(profile, &base_executable_path)
        .await
      {
        Ok(path) => return Ok(path),
        Err(error) => {
          log::warn!(
            "Failed to prepare profile launcher executable for {} ({}): {}. Falling back to original executable.",
            profile.name,
            profile.id,
            error
          );
        }
      }
    }

    Ok(base_executable_path)
  }

  #[cfg(target_os = "windows")]
  async fn ensure_windows_profile_launcher_executable(
    &self,
    profile: &BrowserProfile,
    base_executable_path: &Path,
  ) -> Result<PathBuf, String> {
    let executable_dir = base_executable_path
      .parent()
      .ok_or_else(|| {
        format!(
          "Base executable has no parent directory: {}",
          base_executable_path.display()
        )
      })?
      .to_path_buf();

    let support_dir = executable_dir.join(".buglogin-profile-launchers");
    std::fs::create_dir_all(&support_dir)
      .map_err(|e| format!("Failed to create launcher directory: {e}"))?;

    let sanitized_profile_id: String = profile
      .id
      .to_string()
      .chars()
      .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
      .collect();
    let base_stem = base_executable_path
      .file_stem()
      .and_then(|s| s.to_str())
      .filter(|value| !value.trim().is_empty())
      .unwrap_or("browser")
      .to_ascii_lowercase();
    let launcher_file_name = format!("buglogin-profile-{sanitized_profile_id}.exe");
    let launcher_path = executable_dir.join(&launcher_file_name);
    let marker_path = support_dir.join(format!("{launcher_file_name}.identity.txt"));
    let icon_path = support_dir.join(format!("{launcher_file_name}.ico"));
    let profile_tag = build_profile_runtime_tag(&profile.name);

    // Cleanup old launcher naming pattern (e.g. `camoufox-buglogin-...`) to avoid
    // path growth/chaining and accidental executable auto-detection.
    if let Ok(entries) = std::fs::read_dir(&executable_dir) {
      for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_none_or(|ext| ext != "exe") {
          continue;
        }
        let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
          continue;
        };
        let lower_name = name.to_ascii_lowercase();
        let legacy_prefix = format!("{base_stem}-buglogin-");
        if lower_name.starts_with(&legacy_prefix) {
          let _ = std::fs::remove_file(&path);
          let _ = std::fs::remove_file(support_dir.join(format!("{name}.identity.txt")));
          let _ = std::fs::remove_file(support_dir.join(format!("{name}.ico")));
        }
      }
    }

    let source_metadata = std::fs::metadata(base_executable_path).map_err(|e| {
      format!(
        "Failed to stat base executable {}: {}",
        base_executable_path.display(),
        e
      )
    })?;
    let source_size = source_metadata.len();
    let source_mtime = source_metadata
      .modified()
      .ok()
      .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
      .map(|duration| duration.as_secs())
      .unwrap_or(0);
    let marker_content = format!(
      "profile_tag={profile_tag}\nsource={}\nsource_size={source_size}\nsource_mtime={source_mtime}\nicon_layout=v3\nmarker=v3\n",
      base_executable_path.display()
    );

    let marker_matches = std::fs::read_to_string(&marker_path)
      .ok()
      .map(|content| content == marker_content)
      .unwrap_or(false);

    if launcher_path.exists() && marker_matches {
      return Ok(launcher_path);
    }

    if launcher_path.exists() {
      let _ = std::fs::remove_file(&launcher_path);
    }
    std::fs::copy(base_executable_path, &launcher_path).map_err(|e| {
      format!(
        "Failed to create profile launcher executable {} from {}: {}",
        launcher_path.display(),
        base_executable_path.display(),
        e
      )
    })?;

    if let Err(error) = write_profile_launcher_icon_ico(&icon_path, &profile_tag) {
      log::warn!(
        "Failed to generate profile launcher icon {}: {}. Continuing with unpatched launcher icon.",
        icon_path.display(),
        error
      );
    } else if let Err(error) = crate::downloader::Downloader::instance()
      .patch_executable_icon_windows_with_icon(&launcher_path, &icon_path)
      .await
    {
      log::warn!(
        "Failed to patch launcher icon for {}: {}. Continuing with launcher executable.",
        launcher_path.display(),
        error
      );
    }

    std::fs::write(&marker_path, marker_content).map_err(|e| {
      format!(
        "Failed to write launcher marker {}: {e}",
        marker_path.display()
      )
    })?;

    log::info!(
      "Prepared Windows profile launcher executable for {} at {}",
      profile.name,
      launcher_path.display()
    );

    Ok(launcher_path)
  }

  pub async fn launch_browser(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
    url: Option<String>,
    local_proxy_settings: Option<&ProxySettings>,
  ) -> Result<BrowserProfile, Box<dyn std::error::Error + Send + Sync>> {
    self
      .launch_browser_internal(app_handle, profile, url, local_proxy_settings, None, false)
      .await
  }

  async fn launch_browser_internal(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
    url: Option<String>,
    local_proxy_settings: Option<&ProxySettings>,
    remote_debugging_port: Option<u16>,
    headless: bool,
  ) -> Result<BrowserProfile, Box<dyn std::error::Error + Send + Sync>> {
    let navigation_url = url.as_deref().map(|value| value.to_string());
    let disable_rtc_for_all_browsers = self.is_global_rtc_disabled_for_all_browsers();

    // Handle Camoufox profiles using CamoufoxManager
    if matches!(profile.browser.as_str(), "camoufox" | "bugox") {
      // Get or create camoufox config
      let mut camoufox_config = profile.camoufox_config.clone().unwrap_or_else(|| {
        log::info!(
          "No camoufox config found for profile {}, using default",
          profile.name
        );
        CamoufoxConfig::default()
      });

      // Heal legacy Camoufox policies (Default=None, Remove list, search-addon uninstall)
      // before launch so search engine service initializes correctly.
      if let Ok(executable_path) = self.get_browser_executable_path(profile) {
        if let Some(browser_dir) = executable_path.parent() {
          if let Err(e) = crate::downloader::configure_camoufox_search_engine(browser_dir) {
            log::warn!("Failed to heal Camoufox search policies before launch: {e}");
          }
        }
      }

      // Always start a local proxy for Camoufox (for traffic monitoring and geoip support)
      // Refresh cloud proxy credentials if needed before resolving
      let mut upstream_proxy = self
        .resolve_proxy_with_refresh(profile.proxy_id.as_ref())
        .await;

      // If profile has a VPN instead of proxy, start VPN worker and use it as upstream
      if upstream_proxy.is_none() {
        if let Some(ref vpn_id) = profile.vpn_id {
          match crate::vpn_worker_runner::start_vpn_worker(vpn_id).await {
            Ok(vpn_worker) => {
              if let Some(port) = vpn_worker.local_port {
                upstream_proxy = Some(ProxySettings {
                  proxy_type: "socks5".to_string(),
                  host: "127.0.0.1".to_string(),
                  port,
                  username: None,
                  password: None,
                });
                log::info!("VPN worker started for Camoufox profile on port {}", port);
              }
            }
            Err(e) => {
              return Err(format!("Failed to start VPN worker: {e}").into());
            }
          }
        }
      }

      log::info!(
        "Starting local proxy for Bugox profile: {} (upstream: {})",
        profile.name,
        upstream_proxy
          .as_ref()
          .map(|p| format!("{}:{}", p.host, p.port))
          .unwrap_or_else(|| "DIRECT".to_string())
      );

      // Start the proxy and get local proxy settings
      // If proxy startup fails, DO NOT launch Camoufox - it requires local proxy
      let profile_id_str = profile.id.to_string();
      let temp_pid = next_temp_proxy_pid();
      let local_proxy = PROXY_MANAGER
        .start_proxy(
          app_handle.clone(),
          upstream_proxy.as_ref(),
          temp_pid,
          Some(&profile_id_str),
          profile.proxy_bypass_rules.clone(),
        )
        .await
        .map_err(|e| {
          let error_msg = format!("Failed to start local proxy for Camoufox: {e}");
          log::error!("{}", error_msg);
          error_msg
        })?;

      // Format proxy URL for camoufox - always use HTTP for the local proxy
      let proxy_url = format!("http://{}:{}", local_proxy.host, local_proxy.port);

      // Set proxy in camoufox config
      camoufox_config.proxy = Some(proxy_url);
      camoufox_config.block_webrtc = Some(disable_rtc_for_all_browsers);

      // Ensure geoip is always enabled for proper geolocation spoofing
      if camoufox_config.geoip.is_none() {
        camoufox_config.geoip = Some(serde_json::Value::Bool(true));
      }

      log::info!(
        "Configured local proxy for Bugox: {:?}, geoip: {:?}",
        camoufox_config.proxy,
        camoufox_config.geoip
      );

      let mut updated_profile = profile.clone();
      if let Ok(executable_path) = self
        .resolve_launch_executable_for_profile(&updated_profile)
        .await
      {
        camoufox_config.executable_path = Some(executable_path.to_string_lossy().to_string());
      }
      self
        .ensure_camoufox_fingerprint(
          &app_handle,
          profile,
          &mut updated_profile,
          &mut camoufox_config,
        )
        .await?;

      // Create ephemeral dir for ephemeral profiles
      let override_profile_path = if profile.ephemeral {
        let dir = crate::ephemeral_dirs::create_ephemeral_dir(&profile.id.to_string())
          .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { e.into() })?;
        Some(dir)
      } else {
        None
      };

      let effective_profile_path = if let Some(ref override_path) = override_profile_path {
        override_path.clone()
      } else {
        updated_profile.get_profile_data_path(&self.profile_manager.get_profiles_dir())
      };

      self
        .profile_manager
        .apply_proxy_settings_to_profile(&effective_profile_path, &local_proxy, Some(&local_proxy))
        .map_err(|e| format!("Failed to apply local Camoufox proxy prefs: {e}"))?;

      // Install extensions if an extension group is assigned
      if updated_profile.extension_group_id.is_some() {
        let mgr = crate::extension_manager::EXTENSION_MANAGER.lock().unwrap();
        match mgr.install_extensions_for_profile(&updated_profile, &effective_profile_path) {
          Ok(paths) => {
            if !paths.is_empty() {
              log::info!(
                "Installed {} Firefox extensions for profile: {}",
                paths.len(),
                updated_profile.name
              );
            }
          }
          Err(e) => {
            log::warn!("Failed to install extensions for Camoufox profile: {e}");
          }
        }
      }

      match crate::browser_identity_extension::ensure_runtime_identity_for_browser(
        &updated_profile.browser,
        &effective_profile_path,
        &updated_profile.name,
      ) {
        Ok(
          crate::browser_identity_extension::RuntimeIdentityInstallResult::ChromiumExtensionPath(_),
        ) => {}
        Ok(crate::browser_identity_extension::RuntimeIdentityInstallResult::FirefoxInstalled) => {}
        Err(error) => {
          log::warn!(
            "Failed to prepare runtime identity extension for Camoufox profile {}: {}",
            updated_profile.name,
            error
          );
        }
      }

      // Launch Camoufox browser
      log::info!("Launching Bugox for profile: {}", profile.name);
      let camoufox_result = self
        .camoufox_manager
        .launch_camoufox_profile(
          app_handle.clone(),
          updated_profile.clone(),
          camoufox_config,
          url,
          override_profile_path,
        )
        .await
        .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
          format!("Failed to launch Bugox: {e}").into()
        })?;

      // For server-based Camoufox, we use the process_id
      let process_id = camoufox_result.processId.unwrap_or(0);
      log::info!("Bugox launched successfully with PID: {process_id}");

      // Update profile with the process info from camoufox result
      updated_profile.process_id = Some(process_id);
      updated_profile.last_launch = Some(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs());
      updated_profile.runtime_state = RuntimeState::Running;
      self.schedule_profile_window_identity_with_url(&updated_profile, navigation_url.as_deref());

      // Update the proxy manager with the correct PID
      if let Err(e) = PROXY_MANAGER.update_proxy_pid(temp_pid, process_id) {
        log::warn!("Warning: Failed to update proxy PID mapping: {e}");
      } else {
        log::info!(
          "Updated proxy PID mapping from temp ({}) to actual PID: {}",
          temp_pid,
          process_id
        );
      }

      // Save the updated profile (includes new fingerprint if randomize is enabled)
      log::info!(
        "Saving profile {} with camoufox_config fingerprint length: {}",
        updated_profile.name,
        updated_profile
          .camoufox_config
          .as_ref()
          .and_then(|c| c.fingerprint.as_ref())
          .map(|f| f.len())
          .unwrap_or(0)
      );
      self.save_process_info(&updated_profile)?;
      log::info!(
        "Successfully saved profile with process info: {}",
        updated_profile.name
      );

      // `profile-updated` already carries the latest persisted fields (including
      // fingerprint updates), so avoid forcing a full profiles list reload on
      // every launch. Full list reloads are costly and can cause visible UI jank.

      log::info!(
        "Emitting profile events for successful Camoufox launch: {}",
        updated_profile.name
      );

      // Emit profile update event to frontend
      if let Err(e) = events::emit("profile-updated", &updated_profile) {
        log::warn!("Warning: Failed to emit profile update event: {e}");
      }

      // Emit minimal running changed event to frontend with a small delay
      #[derive(Serialize)]
      struct RunningChangedPayload {
        id: String,
        is_running: bool,
      }

      let payload = RunningChangedPayload {
        id: updated_profile.id.to_string(),
        is_running: updated_profile.process_id.is_some(),
      };

      if let Err(e) = events::emit("profile-running-changed", &payload) {
        log::warn!("Warning: Failed to emit profile running changed event: {e}");
      } else {
        log::info!(
          "Successfully emitted profile-running-changed event for Camoufox {}: running={}",
          updated_profile.name,
          payload.is_running
        );
      }

      return Ok(updated_profile);
    }

    // Handle Wayfern profiles using WayfernManager
    if matches!(profile.browser.as_str(), "wayfern" | "bugium") {
      // Get or create wayfern config
      let mut wayfern_config = profile.wayfern_config.clone().unwrap_or_else(|| {
        log::info!(
          "No wayfern config found for profile {}, using default",
          profile.name
        );
        WayfernConfig::default()
      });

      // Always start a local proxy for Wayfern (for traffic monitoring and geoip support)
      // Refresh cloud proxy credentials if needed before resolving
      let mut upstream_proxy = self
        .resolve_proxy_with_refresh(profile.proxy_id.as_ref())
        .await;

      // If profile has a VPN instead of proxy, start VPN worker and use it as upstream
      if upstream_proxy.is_none() {
        if let Some(ref vpn_id) = profile.vpn_id {
          match crate::vpn_worker_runner::start_vpn_worker(vpn_id).await {
            Ok(vpn_worker) => {
              if let Some(port) = vpn_worker.local_port {
                upstream_proxy = Some(ProxySettings {
                  proxy_type: "socks5".to_string(),
                  host: "127.0.0.1".to_string(),
                  port,
                  username: None,
                  password: None,
                });
                log::info!("VPN worker started for Wayfern profile on port {}", port);
              }
            }
            Err(e) => {
              return Err(format!("Failed to start VPN worker: {e}").into());
            }
          }
        }
      }

      log::info!(
        "Starting local proxy for Bugium profile: {} (upstream: {})",
        profile.name,
        upstream_proxy
          .as_ref()
          .map(|p| format!("{}:{}", p.host, p.port))
          .unwrap_or_else(|| "DIRECT".to_string())
      );

      // Start the proxy and get local proxy settings
      // If proxy startup fails, DO NOT launch Wayfern - it requires local proxy
      let profile_id_str = profile.id.to_string();
      let temp_pid = next_temp_proxy_pid();
      let local_proxy = PROXY_MANAGER
        .start_proxy(
          app_handle.clone(),
          upstream_proxy.as_ref(),
          temp_pid,
          Some(&profile_id_str),
          profile.proxy_bypass_rules.clone(),
        )
        .await
        .map_err(|e| {
          let error_msg = format!("Failed to start local proxy for Wayfern: {e}");
          log::error!("{}", error_msg);
          error_msg
        })?;

      // Format proxy URL for wayfern - always use HTTP for the local proxy
      let proxy_url = format!("http://{}:{}", local_proxy.host, local_proxy.port);

      // Set proxy in wayfern config
      wayfern_config.proxy = Some(proxy_url);
      wayfern_config.block_webrtc = Some(disable_rtc_for_all_browsers);

      log::info!(
        "Configured local proxy for Bugium: {:?}",
        wayfern_config.proxy
      );

      let mut updated_profile = profile.clone();
      if let Ok(executable_path) = self
        .resolve_launch_executable_for_profile(&updated_profile)
        .await
      {
        wayfern_config.executable_path = Some(executable_path.to_string_lossy().to_string());
      }
      self
        .ensure_wayfern_fingerprint(
          &app_handle,
          profile,
          &mut updated_profile,
          &mut wayfern_config,
        )
        .await?;

      // Create ephemeral dir for ephemeral profiles
      if profile.ephemeral {
        crate::ephemeral_dirs::create_ephemeral_dir(&profile.id.to_string())
          .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> { e.into() })?;
      }

      // Launch Wayfern browser
      log::info!("Launching Bugium for profile: {}", profile.name);

      // Get profile path for Wayfern
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path =
        crate::ephemeral_dirs::get_effective_profile_path(&updated_profile, &profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy().to_string();

      // Install extensions if an extension group is assigned
      let mut extension_paths = Vec::new();
      if updated_profile.extension_group_id.is_some() {
        let mgr = crate::extension_manager::EXTENSION_MANAGER.lock().unwrap();
        match mgr.install_extensions_for_profile(&updated_profile, &profile_data_path) {
          Ok(paths) => {
            if !paths.is_empty() {
              log::info!(
                "Prepared {} Chromium extensions for profile: {}",
                paths.len(),
                updated_profile.name
              );
            }
            extension_paths = paths;
          }
          Err(e) => {
            log::warn!("Failed to install extensions for Wayfern profile: {e}");
          }
        }
      }

      match crate::browser_identity_extension::ensure_runtime_identity_for_browser(
        &updated_profile.browser,
        &profile_data_path,
        &updated_profile.name,
      ) {
        Ok(
          crate::browser_identity_extension::RuntimeIdentityInstallResult::ChromiumExtensionPath(
            path,
          ),
        ) => {
          let runtime_identity_path = path.to_string_lossy().to_string();
          if !extension_paths
            .iter()
            .any(|item| item == &runtime_identity_path)
          {
            extension_paths.push(runtime_identity_path);
          }
        }
        Ok(crate::browser_identity_extension::RuntimeIdentityInstallResult::FirefoxInstalled) => {}
        Err(error) => {
          log::warn!(
            "Failed to prepare runtime identity extension for Wayfern profile {}: {}",
            updated_profile.name,
            error
          );
        }
      }

      // Get proxy URL from config
      let proxy_url = wayfern_config.proxy.as_deref();

      let wayfern_result = self
        .wayfern_manager
        .launch_wayfern(
          &app_handle,
          &updated_profile,
          &profile_path_str,
          &wayfern_config,
          url.as_deref(),
          proxy_url,
          profile.ephemeral,
          &extension_paths,
        )
        .await
        .map_err(|e| -> Box<dyn std::error::Error + Send + Sync> {
          format!("Failed to launch Bugium: {e}").into()
        })?;

      // Get the process ID from launch result
      let process_id = wayfern_result.processId.unwrap_or(0);
      log::info!("Bugium launched successfully with PID: {process_id}");

      // Update profile with the process info
      updated_profile.process_id = Some(process_id);
      updated_profile.last_launch = Some(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs());
      updated_profile.runtime_state = RuntimeState::Running;
      self.schedule_profile_window_identity_with_url(&updated_profile, url.as_deref());

      // Update the proxy manager with the correct PID
      if let Err(e) = PROXY_MANAGER.update_proxy_pid(temp_pid, process_id) {
        log::warn!("Warning: Failed to update proxy PID mapping: {e}");
      } else {
        log::info!(
          "Updated proxy PID mapping from temp ({}) to actual PID: {}",
          temp_pid,
          process_id
        );
      }

      // Save the updated profile
      log::info!(
        "Saving profile {} with wayfern_config fingerprint length: {}",
        updated_profile.name,
        updated_profile
          .wayfern_config
          .as_ref()
          .and_then(|c| c.fingerprint.as_ref())
          .map(|f| f.len())
          .unwrap_or(0)
      );
      self.save_process_info(&updated_profile)?;
      log::info!(
        "Successfully saved profile with process info: {}",
        updated_profile.name
      );

      // `profile-updated` already carries the latest persisted fields (including
      // fingerprint updates), so avoid forcing a full profiles list reload on
      // every launch. Full list reloads are costly and can cause visible UI jank.

      log::info!(
        "Emitting profile events for successful Wayfern launch: {}",
        updated_profile.name
      );

      // Emit profile update event to frontend
      if let Err(e) = events::emit("profile-updated", &updated_profile) {
        log::warn!("Warning: Failed to emit profile update event: {e}");
      }

      // Emit minimal running changed event to frontend
      #[derive(Serialize)]
      struct RunningChangedPayload {
        id: String,
        is_running: bool,
      }

      let payload = RunningChangedPayload {
        id: updated_profile.id.to_string(),
        is_running: updated_profile.process_id.is_some(),
      };

      if let Err(e) = events::emit("profile-running-changed", &payload) {
        log::warn!("Warning: Failed to emit profile running changed event: {e}");
      } else {
        log::info!(
          "Successfully emitted profile-running-changed event for Wayfern {}: running={}",
          updated_profile.name,
          payload.is_running
        );
      }

      return Ok(updated_profile);
    }

    // Create browser instance
    let browser_type = BrowserType::from_str(&profile.browser)
      .map_err(|_| format!("Invalid browser type: {}", profile.browser))?;
    let browser = create_browser(browser_type.clone());

    // Get executable path using common helper
    let executable_path = self
      .resolve_launch_executable_for_profile(profile)
      .await
      .expect("Failed to get executable path");

    log::info!("Executable path: {executable_path:?}");

    // Prepare the executable (set permissions, etc.)
    if let Err(e) = browser.prepare_executable(&executable_path) {
      log::warn!("Warning: Failed to prepare executable: {e}");
      // Continue anyway, the error might not be critical
    }

    // Refresh cloud proxy credentials if needed before resolving
    let _stored_proxy_settings = self
      .resolve_proxy_with_refresh(profile.proxy_id.as_ref())
      .await;

    // Use provided local proxy for Chromium-based browsers launch arguments
    let proxy_for_launch_args: Option<&ProxySettings> = local_proxy_settings;

    // Get profile data path and launch arguments
    let profiles_dir = self.profile_manager.get_profiles_dir();
    let profile_data_path = profile.get_profile_data_path(&profiles_dir);
    let mut browser_args = browser
      .create_launch_args(
        &profile_data_path.to_string_lossy(),
        proxy_for_launch_args,
        url,
        remote_debugging_port,
        headless,
      )
      .expect("Failed to create launch arguments");

    if disable_rtc_for_all_browsers
      && matches!(browser_type, BrowserType::Chromium | BrowserType::Brave)
    {
      self.append_chromium_global_rtc_policy_args(&mut browser_args);
    }

    match crate::browser_identity_extension::ensure_runtime_identity_for_browser(
      &profile.browser,
      &profile_data_path,
      &profile.name,
    ) {
      Ok(
        crate::browser_identity_extension::RuntimeIdentityInstallResult::ChromiumExtensionPath(
          path,
        ),
      ) => {
        let ext_path = path.to_string_lossy().to_string();
        let ext_arg = format!("--load-extension={ext_path}");
        let ext_allow_arg = format!("--disable-extensions-except={ext_path}");
        browser_args.push(ext_arg);
        browser_args.push(ext_allow_arg);
      }
      Ok(crate::browser_identity_extension::RuntimeIdentityInstallResult::FirefoxInstalled) => {}
      Err(error) => {
        log::warn!(
          "Failed to prepare runtime identity extension for profile {}: {}",
          profile.name,
          error
        );
      }
    }

    if matches!(
      browser_type,
      BrowserType::Chromium | BrowserType::Brave | BrowserType::Wayfern
    ) {
      let app_id = build_chromium_profile_app_id(&profile.id.to_string());
      browser_args.push(format!("--app-id={app_id}"));
      #[cfg(target_os = "windows")]
      browser_args.push(format!("--app-user-model-id={app_id}"));
    }

    if let Some(identity_arg) = browser_args.iter().find(|arg| {
      arg.starts_with("--load-extension=") && arg.contains(".buglogin-runtime-identity-ext")
    }) {
      log::info!(
        "Runtime identity extension enabled for profile {} with arg: {}",
        profile.name,
        identity_arg
      );
    }

    // Launch browser using platform-specific method
    let child = {
      #[cfg(target_os = "macos")]
      {
        platform_browser::macos::launch_browser_process(&executable_path, &browser_args).await?
      }

      #[cfg(target_os = "windows")]
      {
        platform_browser::windows::launch_browser_process(&executable_path, &browser_args).await?
      }

      #[cfg(target_os = "linux")]
      {
        platform_browser::linux::launch_browser_process(&executable_path, &browser_args).await?
      }

      #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
      {
        return Err("Unsupported platform for browser launching".into());
      }
    };

    let launcher_pid = child.id();

    log::info!(
      "Launched browser with launcher PID: {} for profile: {} (ID: {})",
      launcher_pid,
      profile.name,
      profile.id
    );

    // On macOS, when launching via `open -a`, the child PID is the `open` helper.
    // Resolve and store the actual browser PID for all browser types.
    let actual_pid = {
      #[cfg(target_os = "macos")]
      {
        // Give the browser a moment to start
        tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

        let system = System::new_all();
        let profiles_dir = self.profile_manager.get_profiles_dir();
        let profile_data_path = profile.get_profile_data_path(&profiles_dir);
        let profile_data_path_str = profile_data_path.to_string_lossy();

        let mut resolved_pid = launcher_pid;

        for (pid, process) in system.processes() {
          let cmd = process.cmd();
          if cmd.is_empty() {
            continue;
          }

          // Determine if this process matches the intended browser type
          let exe_name_lower = process.name().to_string_lossy().to_lowercase();
          let is_correct_browser = match profile.browser.as_str() {
            "firefox" => {
              exe_name_lower.contains("firefox")
                && !exe_name_lower.contains("developer")
                && !exe_name_lower.contains("camoufox")
            }
            "firefox-developer" => {
              // More flexible detection for Firefox Developer Edition
              (exe_name_lower.contains("firefox") && exe_name_lower.contains("developer"))
                || (exe_name_lower.contains("firefox")
                  && cmd.iter().any(|arg| {
                    let arg_str = arg.to_str().unwrap_or("");
                    arg_str.contains("Developer")
                      || arg_str.contains("developer")
                      || arg_str.contains("FirefoxDeveloperEdition")
                      || arg_str.contains("firefox-developer")
                  }))
                || exe_name_lower == "firefox" // Firefox Developer might just show as "firefox"
            }
            "zen" => exe_name_lower.contains("zen"),
            "chromium" => exe_name_lower.contains("chromium") || exe_name_lower.contains("chrome"),
            "brave" => exe_name_lower.contains("brave") || exe_name_lower.contains("Brave"),
            _ => false,
          };

          if !is_correct_browser {
            continue;
          }

          // Check for profile path match
          let profile_path_match = if matches!(
            profile.browser.as_str(),
            "firefox" | "firefox-developer" | "zen"
          ) {
            // Firefox-based browsers: look for -profile argument followed by path
            let mut found_profile_arg = false;
            for (i, arg) in cmd.iter().enumerate() {
              if let Some(arg_str) = arg.to_str() {
                if arg_str == "-profile" && i + 1 < cmd.len() {
                  if let Some(next_arg) = cmd.get(i + 1).and_then(|a| a.to_str()) {
                    if next_arg == profile_data_path_str {
                      found_profile_arg = true;
                      break;
                    }
                  }
                }
                // Also check for combined -profile=path format
                if arg_str == format!("-profile={profile_data_path_str}") {
                  found_profile_arg = true;
                  break;
                }
                // Check if the argument is the profile path directly
                if arg_str == profile_data_path_str {
                  found_profile_arg = true;
                  break;
                }
              }
            }
            found_profile_arg
          } else {
            // Chromium-based browsers: look for --user-data-dir argument
            cmd.iter().any(|s| {
              if let Some(arg) = s.to_str() {
                arg == format!("--user-data-dir={profile_data_path_str}")
                  || arg == profile_data_path_str
              } else {
                false
              }
            })
          };

          if profile_path_match {
            let pid_u32 = pid.as_u32();
            if pid_u32 != launcher_pid {
              resolved_pid = pid_u32;
              break;
            }
          }
        }

        resolved_pid
      }

      #[cfg(not(target_os = "macos"))]
      {
        launcher_pid
      }
    };

    // Update profile with process info and save
    let mut updated_profile = profile.clone();
    updated_profile.process_id = Some(actual_pid);
    updated_profile.last_launch = Some(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs());
    updated_profile.runtime_state = RuntimeState::Running;
    self.schedule_profile_window_identity_with_url(&updated_profile, navigation_url.as_deref());

    self.save_process_info(&updated_profile)?;

    // Apply proxy settings if needed (for Firefox-based browsers)
    if profile.proxy_id.is_some()
      && matches!(
        browser_type,
        BrowserType::Firefox | BrowserType::FirefoxDeveloper | BrowserType::Zen
      )
    {
      // Proxy settings for Firefox-based browsers are applied via user.js file
      // which is already handled in the profile creation process
    }

    log::info!(
      "Emitting profile events for successful launch: {} (ID: {})",
      updated_profile.name,
      updated_profile.id
    );

    // Emit profile update event to frontend
    if let Err(e) = events::emit("profile-updated", &updated_profile) {
      log::warn!("Warning: Failed to emit profile update event: {e}");
    }

    // Emit minimal running changed event to frontend with a small delay to ensure UI consistency
    #[derive(Serialize)]
    struct RunningChangedPayload {
      id: String,
      is_running: bool,
    }
    let payload = RunningChangedPayload {
      id: updated_profile.id.to_string(),
      is_running: updated_profile.process_id.is_some(),
    };

    if let Err(e) = events::emit("profile-running-changed", &payload) {
      log::warn!("Warning: Failed to emit profile running changed event: {e}");
    } else {
      log::info!(
        "Successfully emitted profile-running-changed event for {}: running={}",
        updated_profile.name,
        payload.is_running
      );
    }

    Ok(updated_profile)
  }

  pub async fn open_url_in_existing_browser(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
    url: &str,
    _internal_proxy_settings: Option<&ProxySettings>,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Handle Camoufox profiles using CamoufoxManager
    if matches!(profile.browser.as_str(), "camoufox" | "bugox") {
      // Get the profile path based on the UUID
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path =
        crate::ephemeral_dirs::get_effective_profile_path(profile, &profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy();

      // Check if the process is running
      match self
        .camoufox_manager
        .find_camoufox_by_profile(&profile_path_str)
        .await
      {
        Ok(Some(_camoufox_process)) => {
          log::info!(
            "Opening URL in existing Camoufox process for profile: {} (ID: {})",
            profile.name,
            profile.id
          );

          // Use the same resolved launcher executable path as main launch flow.
          // This avoids briefly invoking the base browser binary/icon.
          let executable_path = self
            .resolve_launch_executable_for_profile(profile)
            .await
            .map_err(|e| format!("Failed to resolve Camoufox executable path: {e}"))?;

          // Use non-blocking remote-tab open to avoid freezing the app while Firefox-like
          // browsers handle lock-race/request-pending states.
          let mut cmd = std::process::Command::new(&executable_path);
          cmd
            .arg("-profile")
            .arg(&*profile_path_str)
            .arg("-requestPending")
            .arg("-new-tab")
            .arg(url);

          if let Some(parent_dir) = executable_path.parent() {
            cmd.current_dir(parent_dir);
          }

          cmd
            .spawn()
            .map_err(|e| format!("Failed to execute Camoufox: {e}"))?;
          log::info!("Dispatched URL open request in existing Camoufox instance");
          return Ok(());
        }
        Ok(None) => {
          return Err("Camoufox browser is not running".into());
        }
        Err(e) => {
          return Err(format!("Error checking Camoufox process: {e}").into());
        }
      }
    }

    // Handle Wayfern profiles using WayfernManager
    if matches!(profile.browser.as_str(), "wayfern" | "bugium") {
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path =
        crate::ephemeral_dirs::get_effective_profile_path(profile, &profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy();

      // Check if the process is running
      match self
        .wayfern_manager
        .find_wayfern_by_profile(&profile_path_str)
        .await
      {
        Some(_wayfern_process) => {
          log::info!(
            "Opening URL in existing Wayfern process for profile: {} (ID: {})",
            profile.name,
            profile.id
          );

          // Use CDP to open URL in a new tab
          self
            .wayfern_manager
            .open_url_in_tab(&profile_path_str, url)
            .await?;
          return Ok(());
        }
        None => {
          return Err("Wayfern browser is not running".into());
        }
      }
    }

    // Use the comprehensive browser status check for non-camoufox/wayfern browsers
    let is_running = self
      .check_browser_status(app_handle.clone(), profile)
      .await?;

    if !is_running {
      return Err("Browser is not running".into());
    }

    // Get the updated profile with current PID
    let profiles = self
      .profile_manager
      .list_profiles()
      .expect("Failed to list profiles");
    let updated_profile = profiles
      .into_iter()
      .find(|p| p.id == profile.id)
      .unwrap_or_else(|| profile.clone());

    // Ensure we have a valid process ID
    if updated_profile.process_id.is_none() {
      return Err("No valid process ID found for the browser".into());
    }

    let browser_type = BrowserType::from_str(&updated_profile.browser)
      .map_err(|_| format!("Invalid browser type: {}", updated_profile.browser))?;

    // Get browser directory for all platforms - path structure: binaries/<browser>/<version>/
    let mut browser_dir = self.get_binaries_dir();
    browser_dir.push(&updated_profile.browser);
    browser_dir.push(&updated_profile.version);

    match browser_type {
      BrowserType::Firefox | BrowserType::FirefoxDeveloper | BrowserType::Zen => {
        #[cfg(target_os = "macos")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::macos::open_url_in_existing_browser_firefox_like(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(target_os = "windows")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::windows::open_url_in_existing_browser_firefox_like(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(target_os = "linux")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::linux::open_url_in_existing_browser_firefox_like(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return Err("Unsupported platform".into());
      }
      BrowserType::Camoufox => {
        #[cfg(target_os = "macos")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::macos::open_url_in_existing_browser_firefox_like(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(target_os = "windows")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::windows::open_url_in_existing_browser_firefox_like(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(target_os = "linux")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::linux::open_url_in_existing_browser_firefox_like(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return Err("Unsupported platform".into());
      }
      BrowserType::Wayfern => {
        // Wayfern URL opening is handled differently
        Err("URL opening in existing Wayfern instance is not supported".into())
      }
      BrowserType::Chromium | BrowserType::Brave => {
        #[cfg(target_os = "macos")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::macos::open_url_in_existing_browser_chromium(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(target_os = "windows")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::windows::open_url_in_existing_browser_chromium(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(target_os = "linux")]
        {
          let profiles_dir = self.profile_manager.get_profiles_dir();
          return platform_browser::linux::open_url_in_existing_browser_chromium(
            &updated_profile,
            url,
            browser_type,
            &browser_dir,
            &profiles_dir,
          )
          .await;
        }

        #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
        return Err("Unsupported platform".into());
      }
    }
  }

  pub async fn launch_browser_with_debugging(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
    url: Option<String>,
    remote_debugging_port: Option<u16>,
    headless: bool,
  ) -> Result<BrowserProfile, Box<dyn std::error::Error + Send + Sync>> {
    // Always start a local proxy for API launches
    // Determine upstream proxy if configured; otherwise use DIRECT
    let upstream_proxy = profile
      .proxy_id
      .as_ref()
      .and_then(|id| PROXY_MANAGER.get_proxy_settings_by_id(id));

    // Use an isolated temporary PID placeholder, then remap to the real browser PID
    let temp_pid = next_temp_proxy_pid();
    let profile_id_str = profile.id.to_string();

    // Start local proxy - if this fails, DO NOT launch browser
    let internal_proxy = PROXY_MANAGER
      .start_proxy(
        app_handle.clone(),
        upstream_proxy.as_ref(),
        temp_pid,
        Some(&profile_id_str),
        profile.proxy_bypass_rules.clone(),
      )
      .await
      .map_err(|e| {
        let error_msg = format!("Failed to start local proxy: {e}");
        log::error!("{}", error_msg);
        error_msg
      })?;

    let internal_proxy_settings = Some(internal_proxy.clone());

    // Configure Firefox profiles to use local proxy
    {
      // For Firefox-based browsers, apply PAC/user.js to point to the local proxy
      if matches!(
        profile.browser.as_str(),
        "firefox" | "firefox-developer" | "zen"
      ) {
        let profiles_dir = self.profile_manager.get_profiles_dir();
        let profile_path = profiles_dir.join(profile.id.to_string()).join("profile");

        // Provide a dummy upstream (ignored when internal proxy is provided)
        let dummy_upstream = ProxySettings {
          proxy_type: "http".to_string(),
          host: "127.0.0.1".to_string(),
          port: internal_proxy.port,
          username: None,
          password: None,
        };

        self
          .profile_manager
          .apply_proxy_settings_to_profile(&profile_path, &dummy_upstream, Some(&internal_proxy))
          .map_err(|e| format!("Failed to update profile proxy: {e}"))?;
      }
    }

    let result = self
      .launch_browser_internal(
        app_handle.clone(),
        profile,
        url,
        internal_proxy_settings.as_ref(),
        remote_debugging_port,
        headless,
      )
      .await;

    // Update proxy with correct PID if launch succeeded
    if let Ok(ref updated_profile) = result {
      if let Some(actual_pid) = updated_profile.process_id {
        let _ = PROXY_MANAGER.update_proxy_pid(temp_pid, actual_pid);
      }
    }

    result
  }

  pub async fn launch_or_open_url(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
    url: Option<String>,
    internal_proxy_settings: Option<&ProxySettings>,
  ) -> Result<BrowserProfile, Box<dyn std::error::Error + Send + Sync>> {
    log::info!(
      "launch_or_open_url called for profile: {} (ID: {})",
      profile.name,
      profile.id
    );

    // Get the most up-to-date profile data
    let profiles = self
      .profile_manager
      .list_profiles()
      .map_err(|e| format!("Failed to list profiles in launch_or_open_url: {e}"))?;
    let updated_profile = profiles
      .into_iter()
      .find(|p| p.id == profile.id)
      .unwrap_or_else(|| profile.clone());

    log::info!(
      "Checking browser status for profile: {} (ID: {})",
      updated_profile.name,
      updated_profile.id
    );

    // Check if browser is already running
    let is_running = self
      .check_browser_status(app_handle.clone(), &updated_profile)
      .await
      .map_err(|e| format!("Failed to check browser status: {e}"))?;

    // Get the updated profile again after status check (PID might have been updated)
    let profiles = self
      .profile_manager
      .list_profiles()
      .map_err(|e| format!("Failed to list profiles after status check: {e}"))?;
    let final_profile = profiles
      .into_iter()
      .find(|p| p.id == profile.id)
      .unwrap_or_else(|| updated_profile.clone());

    let normalized_url = url
      .as_deref()
      .map(normalize_navigation_url)
      .and_then(|value| if value.is_empty() { None } else { Some(value) });
    log::info!(
      "Browser status check - Profile: {} (ID: {}), Running: {}, URL: {:?}, PID: {:?}",
      final_profile.name,
      final_profile.id,
      is_running,
      normalized_url,
      final_profile.process_id
    );

    if is_running && normalized_url.is_none() && final_profile.is_parked() {
      let mut resumed = final_profile.clone();
      resumed.runtime_state = RuntimeState::Running;
      self.save_process_info(&resumed)?;
      if let Err(e) = crate::browser_window::restore_for_pid(resumed.process_id) {
        log::debug!(
          "Failed to restore parked browser window for profile {} (ID: {}): {}",
          resumed.name,
          resumed.id,
          e
        );
      }
      let _ = events::emit("profile-updated", &resumed);
      let _ = events::emit(
        "profile-runtime-state-changed",
        serde_json::json!({
          "id": resumed.id.to_string(),
          "runtime_state": "running"
        }),
      );
      let _ = events::emit(
        "profile-running-changed",
        serde_json::json!({
          "id": resumed.id.to_string(),
          "is_running": true
        }),
      );
      return Ok(resumed);
    }

    if should_reuse_existing_running_profile(is_running, normalized_url.as_deref()) {
      log::info!(
        "Profile {} (ID: {}) already running and no URL provided; reusing current instance",
        final_profile.name,
        final_profile.id
      );
      self.schedule_profile_window_identity_with_url(&final_profile, None);
      if let Err(e) = crate::browser_window::restore_for_pid(final_profile.process_id) {
        log::debug!(
          "Failed to restore running browser window for profile {} (ID: {}): {}",
          final_profile.name,
          final_profile.id,
          e
        );
      }
      return Ok(final_profile);
    }

    if is_running && normalized_url.is_some() {
      // Browser is running and we have a URL to open
      if let Some(url_ref) = normalized_url.as_ref() {
        log::info!("Opening URL in existing browser: {url_ref}");
        let mut last_error_message = String::new();
        let mut running_probe_after_failure = is_running;
        let max_attempts = 4usize;

        for attempt in 1..=max_attempts {
          match self
            .open_url_in_existing_browser(
              app_handle.clone(),
              &final_profile,
              url_ref,
              internal_proxy_settings,
            )
            .await
          {
            Ok(()) => {
              log::info!("Successfully opened URL in existing browser");
              self
                .schedule_profile_window_identity_with_url(&final_profile, Some(url_ref.as_str()));
              return Ok(final_profile);
            }
            Err(error) => {
              last_error_message = error.to_string();
              log::info!(
                "Attempt {attempt}/{max_attempts} failed to open URL in existing browser: {}",
                last_error_message
              );

              running_probe_after_failure = self
                .check_browser_status(app_handle.clone(), &final_profile)
                .await
                .unwrap_or_else(|status_error| {
                  log::debug!(
                    "Status probe failed after URL open attempt for profile {} (ID: {}): {}",
                    final_profile.name,
                    final_profile.id,
                    status_error
                  );
                  false
                });

              let should_retry = running_probe_after_failure
                && attempt < max_attempts
                && should_retry_open_existing_browser_error(&last_error_message);

              if should_retry {
                let backoff_ms = 250 + (attempt as u64 * 250);
                log::info!(
                  "Retrying open-url in existing browser for profile {} (ID: {}) after {}ms",
                  final_profile.name,
                  final_profile.id,
                  backoff_ms
                );
                tokio::time::sleep(tokio::time::Duration::from_millis(backoff_ms)).await;
                continue;
              }

              break;
            }
          }
        }

        if is_firefox_like_browser(&final_profile.browser) {
          return Err(
            format!(
              "Failed to open URL in existing browser for Firefox-like profile: {}",
              last_error_message
            )
            .into(),
          );
        }

        if !should_fallback_to_new_instance_after_open_url_failure(
          running_probe_after_failure,
          &final_profile.browser,
          &last_error_message,
        ) {
          return Err(
            format!(
              "Failed to open URL in existing browser while profile is still running: {}",
              last_error_message
            )
            .into(),
          );
        }

        log::info!(
          "Falling back to new instance for browser {} after open-url failure: {}",
          final_profile.browser,
          last_error_message
        );
        self
          .launch_browser_internal(
            app_handle.clone(),
            &final_profile,
            normalized_url.clone(),
            internal_proxy_settings,
            None,
            false,
          )
          .await
      } else {
        // This case shouldn't happen since we checked is_some() above, but handle it gracefully
        log::info!("URL was unexpectedly None, launching new browser instance");
        self
          .launch_browser(
            app_handle.clone(),
            &final_profile,
            url,
            internal_proxy_settings,
          )
          .await
      }
    } else {
      // Browser is not running or no URL provided, launch new instance
      if !is_running
        && normalized_url.is_some()
        && is_firefox_like_browser(&final_profile.browser)
        && final_profile.process_id.is_some()
      {
        return Err(
          "Firefox is already running, but is not responding. Existing profile process is still tracked; refusing to spawn a second instance."
            .into(),
        );
      }
      if !is_running {
        log::info!("Launching new browser instance - browser not running");
      } else {
        log::info!("Launching new browser instance - no URL provided");
      }
      self
        .launch_browser_internal(
          app_handle.clone(),
          &final_profile,
          normalized_url,
          internal_proxy_settings,
          None,
          false,
        )
        .await
    }
  }

  fn set_profile_runtime_state(
    &self,
    profile_id: uuid::Uuid,
    runtime_state: RuntimeState,
  ) -> Result<Option<BrowserProfile>, String> {
    let Some(mut latest) = self
      .profile_manager
      .get_profile_by_id(&profile_id)
      .map_err(|e| format!("Failed to load profile while updating runtime state: {e}"))?
    else {
      return Ok(None);
    };

    if latest.runtime_state == runtime_state {
      return Ok(Some(latest));
    }

    latest.runtime_state = runtime_state;
    self
      .save_process_info(&latest)
      .map_err(|e| format!("Failed to save runtime state: {e}"))?;

    let _ = events::emit("profile-updated", &latest);
    let _ = events::emit(
      "profile-runtime-state-changed",
      serde_json::json!({
        "id": latest.id.to_string(),
        "runtime_state": format!("{:?}", latest.runtime_state).to_lowercase()
      }),
    );

    Ok(Some(latest))
  }

  fn save_process_info(
    &self,
    profile: &BrowserProfile,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Use the regular save_profile method which handles the UUID structure
    self.profile_manager.save_profile(profile).map_err(|e| {
      let error_string = e.to_string();
      Box::new(std::io::Error::other(error_string)) as Box<dyn std::error::Error + Send + Sync>
    })
  }

  pub async fn check_browser_status(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
  ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    self
      .profile_manager
      .check_browser_status(app_handle, profile)
      .await
  }

  pub async fn kill_browser_process(
    &self,
    app_handle: tauri::AppHandle,
    profile: &BrowserProfile,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Handle Camoufox profiles using CamoufoxManager
    if matches!(profile.browser.as_str(), "camoufox" | "bugox") {
      // Search by profile path to find the running Camoufox instance
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path =
        crate::ephemeral_dirs::get_effective_profile_path(profile, &profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy();

      log::info!(
        "Attempting to kill Camoufox process for profile: {} (ID: {})",
        profile.name,
        profile.id
      );

      // Stop the proxy associated with this profile first
      let profile_id_str = profile.id.to_string();
      if let Err(e) = PROXY_MANAGER
        .stop_proxy_by_profile_id(app_handle.clone(), &profile_id_str)
        .await
      {
        log::warn!(
          "Warning: Failed to stop proxy for profile {}: {e}",
          profile_id_str
        );
      }

      let mut process_actually_stopped = false;
      match self
        .camoufox_manager
        .find_camoufox_by_profile(&profile_path_str)
        .await
      {
        Ok(Some(camoufox_process)) => {
          log::info!(
            "Found Camoufox process: {} (PID: {:?})",
            camoufox_process.id,
            camoufox_process.processId
          );

          match self
            .camoufox_manager
            .stop_camoufox(&app_handle, &camoufox_process.id)
            .await
          {
            Ok(stopped) => {
              if let Some(pid) = camoufox_process.processId {
                if stopped {
                  // Verify the process actually died by checking after a short delay
                  use tokio::time::{sleep, Duration};
                  sleep(Duration::from_millis(500)).await;

                  use sysinfo::{Pid, System};
                  let system = System::new_all();
                  process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();

                  if process_actually_stopped {
                    log::info!(
                      "Successfully stopped Camoufox process: {} (PID: {:?}) - verified process is dead",
                      camoufox_process.id,
                      pid
                    );
                  } else {
                    log::warn!(
                      "Camoufox stop command returned success but process {} (PID: {:?}) is still running - forcing kill",
                      camoufox_process.id,
                      pid
                    );
                    // Force kill the process
                    #[cfg(target_os = "macos")]
                    {
                      use crate::platform_browser;
                      if let Err(e) = platform_browser::macos::kill_browser_process_impl(
                        pid,
                        Some(&profile_path_str),
                      )
                      .await
                      {
                        log::error!("Failed to force kill Camoufox process {}: {}", pid, e);
                      } else {
                        // Verify the process is actually dead after force kill
                        use tokio::time::{sleep, Duration};
                        sleep(Duration::from_millis(500)).await;
                        use sysinfo::{Pid, System};
                        let system = System::new_all();
                        process_actually_stopped =
                          system.process(Pid::from(pid as usize)).is_none();
                        if process_actually_stopped {
                          log::info!(
                            "Successfully force killed Camoufox process {} (PID: {:?})",
                            camoufox_process.id,
                            pid
                          );
                        }
                      }
                    }
                    #[cfg(target_os = "linux")]
                    {
                      use crate::platform_browser;
                      if let Err(e) = platform_browser::linux::kill_browser_process_impl(
                        pid,
                        Some(&profile_path_str),
                      )
                      .await
                      {
                        log::error!("Failed to force kill Camoufox process {}: {}", pid, e);
                      } else {
                        // Verify the process is actually dead after force kill
                        use tokio::time::{sleep, Duration};
                        sleep(Duration::from_millis(500)).await;
                        use sysinfo::{Pid, System};
                        let system = System::new_all();
                        process_actually_stopped =
                          system.process(Pid::from(pid as usize)).is_none();
                        if process_actually_stopped {
                          log::info!(
                            "Successfully force killed Camoufox process {} (PID: {:?})",
                            camoufox_process.id,
                            pid
                          );
                        }
                      }
                    }
                    #[cfg(target_os = "windows")]
                    {
                      use crate::platform_browser;
                      if let Err(e) =
                        platform_browser::windows::kill_browser_process_impl(pid).await
                      {
                        log::error!("Failed to force kill Camoufox process {}: {}", pid, e);
                      } else {
                        // Verify the process is actually dead after force kill
                        use tokio::time::{sleep, Duration};
                        sleep(Duration::from_millis(500)).await;
                        use sysinfo::{Pid, System};
                        let system = System::new_all();
                        process_actually_stopped =
                          system.process(Pid::from(pid as usize)).is_none();
                        if process_actually_stopped {
                          log::info!(
                            "Successfully force killed Camoufox process {} (PID: {:?})",
                            camoufox_process.id,
                            pid
                          );
                        }
                      }
                    }
                  }
                } else {
                  // stop_camoufox returned false, try to force kill the process
                  log::warn!(
                    "Camoufox stop command returned false for process {} (PID: {:?}) - attempting force kill",
                    camoufox_process.id,
                    pid
                  );
                  #[cfg(target_os = "macos")]
                  {
                    use crate::platform_browser;
                    if let Err(e) = platform_browser::macos::kill_browser_process_impl(
                      pid,
                      Some(&profile_path_str),
                    )
                    .await
                    {
                      log::error!("Failed to force kill Camoufox process {}: {}", pid, e);
                    } else {
                      // Verify the process is actually dead after force kill
                      use tokio::time::{sleep, Duration};
                      sleep(Duration::from_millis(500)).await;
                      use sysinfo::{Pid, System};
                      let system = System::new_all();
                      process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                      if process_actually_stopped {
                        log::info!(
                          "Successfully force killed Camoufox process {} (PID: {:?})",
                          camoufox_process.id,
                          pid
                        );
                      }
                    }
                  }
                  #[cfg(target_os = "linux")]
                  {
                    use crate::platform_browser;
                    if let Err(e) = platform_browser::linux::kill_browser_process_impl(
                      pid,
                      Some(&profile_path_str),
                    )
                    .await
                    {
                      log::error!("Failed to force kill Camoufox process {}: {}", pid, e);
                    } else {
                      // Verify the process is actually dead after force kill
                      use tokio::time::{sleep, Duration};
                      sleep(Duration::from_millis(500)).await;
                      use sysinfo::{Pid, System};
                      let system = System::new_all();
                      process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                      if process_actually_stopped {
                        log::info!(
                          "Successfully force killed Camoufox process {} (PID: {:?})",
                          camoufox_process.id,
                          pid
                        );
                      }
                    }
                  }
                  #[cfg(target_os = "windows")]
                  {
                    use crate::platform_browser;
                    if let Err(e) = platform_browser::windows::kill_browser_process_impl(pid).await
                    {
                      log::error!("Failed to force kill Camoufox process {}: {}", pid, e);
                    } else {
                      // Verify the process is actually dead after force kill
                      use tokio::time::{sleep, Duration};
                      sleep(Duration::from_millis(500)).await;
                      use sysinfo::{Pid, System};
                      let system = System::new_all();
                      process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                      if process_actually_stopped {
                        log::info!(
                          "Successfully force killed Camoufox process {} (PID: {:?})",
                          camoufox_process.id,
                          pid
                        );
                      }
                    }
                  }
                }
              } else {
                // No PID available, assume stopped if stop_camoufox returned true
                process_actually_stopped = stopped;
                if !stopped {
                  log::warn!(
                    "Failed to stop Camoufox process {} but no PID available for force kill",
                    camoufox_process.id
                  );
                }
              }
            }
            Err(e) => {
              log::error!(
                "Error stopping Camoufox process {}: {}",
                camoufox_process.id,
                e
              );
              // Try to force kill if we have a PID
              if let Some(pid) = camoufox_process.processId {
                log::info!(
                  "Attempting force kill after stop_camoufox error for PID: {}",
                  pid
                );
                #[cfg(target_os = "macos")]
                {
                  use crate::platform_browser;
                  if let Err(kill_err) =
                    platform_browser::macos::kill_browser_process_impl(pid, Some(&profile_path_str))
                      .await
                  {
                    log::error!(
                      "Failed to force kill Camoufox process {}: {}",
                      pid,
                      kill_err
                    );
                  } else {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_millis(500)).await;
                    use sysinfo::{Pid, System};
                    let system = System::new_all();
                    process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                  }
                }
                #[cfg(target_os = "linux")]
                {
                  use crate::platform_browser;
                  if let Err(kill_err) =
                    platform_browser::linux::kill_browser_process_impl(pid, Some(&profile_path_str))
                      .await
                  {
                    log::error!(
                      "Failed to force kill Camoufox process {}: {}",
                      pid,
                      kill_err
                    );
                  } else {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_millis(500)).await;
                    use sysinfo::{Pid, System};
                    let system = System::new_all();
                    process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                  }
                }
                #[cfg(target_os = "windows")]
                {
                  use crate::platform_browser;
                  if let Err(kill_err) =
                    platform_browser::windows::kill_browser_process_impl(pid).await
                  {
                    log::error!(
                      "Failed to force kill Camoufox process {}: {}",
                      pid,
                      kill_err
                    );
                  } else {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_millis(500)).await;
                    use sysinfo::{Pid, System};
                    let system = System::new_all();
                    process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                  }
                }
              }
            }
          }
        }
        Ok(None) => {
          log::info!(
            "No running Camoufox process found for profile: {} (ID: {})",
            profile.name,
            profile.id
          );
          process_actually_stopped = true; // No process found, consider it stopped
        }
        Err(e) => {
          log::error!(
            "Error finding Camoufox process for profile {}: {}",
            profile.name,
            e
          );
        }
      }

      // If process wasn't confirmed stopped, return an error
      if !process_actually_stopped {
        log::error!(
          "Failed to stop Camoufox process for profile: {} (ID: {}) - process may still be running",
          profile.name,
          profile.id
        );
        return Err(
          format!(
            "Failed to stop Camoufox process for profile {} - process may still be running",
            profile.name
          )
          .into(),
        );
      }

      // Clear the process ID from the profile
      let mut updated_profile = profile.clone();
      updated_profile.process_id = None;
      updated_profile.runtime_state = RuntimeState::Stopped;

      // Check for pending updates and apply them for Camoufox profiles too
      if let Ok(Some(pending_update)) = self
        .auto_updater
        .get_pending_update(&profile.browser, &profile.version)
      {
        log::info!(
          "Found pending update for Camoufox profile {}: {} -> {}",
          profile.name,
          profile.version,
          pending_update.new_version
        );

        // Update the profile to the new version
        match self.profile_manager.update_profile_version(
          &app_handle,
          &profile.id.to_string(),
          &pending_update.new_version,
        ) {
          Ok(updated_profile_after_update) => {
            log::info!(
              "Successfully updated Camoufox profile {} from version {} to {}",
              profile.name,
              profile.version,
              pending_update.new_version
            );
            updated_profile = updated_profile_after_update;

            // Remove the pending update from the auto updater state
            if let Err(e) = self
              .auto_updater
              .dismiss_update_notification(&pending_update.id)
            {
              log::warn!("Warning: Failed to dismiss pending update notification: {e}");
            }
          }
          Err(e) => {
            log::error!(
              "Failed to apply pending update for Camoufox profile {}: {}",
              profile.name,
              e
            );
            // Continue with the original profile update (just clearing process_id)
          }
        }
      }

      self
        .save_process_info(&updated_profile)
        .map_err(|e| format!("Failed to update profile: {e}"))?;

      log::info!(
        "Emitting profile events for successful Camoufox kill: {}",
        updated_profile.name
      );

      // Emit profile update event to frontend
      if let Err(e) = events::emit("profile-updated", &updated_profile) {
        log::warn!("Warning: Failed to emit profile update event: {e}");
      }

      // Emit minimal running changed event to frontend immediately
      #[derive(Serialize)]
      struct RunningChangedPayload {
        id: String,
        is_running: bool,
      }
      let payload = RunningChangedPayload {
        id: updated_profile.id.to_string(),
        is_running: false, // Explicitly set to false since we just killed it
      };

      if let Err(e) = events::emit("profile-running-changed", &payload) {
        log::warn!("Warning: Failed to emit profile running changed event: {e}");
      } else {
        log::info!(
          "Successfully emitted profile-running-changed event for Camoufox {}: running={}",
          updated_profile.name,
          payload.is_running
        );
      }

      if profile.ephemeral {
        crate::ephemeral_dirs::remove_ephemeral_dir(&profile.id.to_string());
      }

      log::info!(
        "Camoufox process cleanup completed for profile: {} (ID: {})",
        profile.name,
        profile.id
      );

      // Consolidate browser versions after stopping a browser
      if let Ok(consolidated) = self
        .downloaded_browsers_registry
        .consolidate_browser_versions(&app_handle)
      {
        if !consolidated.is_empty() {
          log::info!("Post-stop version consolidation results:");
          for action in &consolidated {
            log::info!("  {action}");
          }
        }
      }

      return Ok(());
    }

    // Handle Wayfern profiles using WayfernManager
    if matches!(profile.browser.as_str(), "wayfern" | "bugium") {
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path =
        crate::ephemeral_dirs::get_effective_profile_path(profile, &profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy();

      log::info!(
        "Attempting to kill Wayfern process for profile: {} (ID: {})",
        profile.name,
        profile.id
      );

      // Stop the proxy associated with this profile first
      let profile_id_str = profile.id.to_string();
      if let Err(e) = PROXY_MANAGER
        .stop_proxy_by_profile_id(app_handle.clone(), &profile_id_str)
        .await
      {
        log::warn!(
          "Warning: Failed to stop proxy for profile {}: {e}",
          profile_id_str
        );
      }

      let mut process_actually_stopped = false;
      match self
        .wayfern_manager
        .find_wayfern_by_profile(&profile_path_str)
        .await
      {
        Some(wayfern_process) => {
          log::info!(
            "Found Wayfern process: {} (PID: {:?})",
            wayfern_process.id,
            wayfern_process.processId
          );

          match self.wayfern_manager.stop_wayfern(&wayfern_process.id).await {
            Ok(_) => {
              if let Some(pid) = wayfern_process.processId {
                // Verify the process actually died by checking after a short delay
                use tokio::time::{sleep, Duration};
                sleep(Duration::from_millis(500)).await;

                use sysinfo::{Pid, System};
                let system = System::new_all();
                process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();

                if process_actually_stopped {
                  log::info!(
                    "Successfully stopped Wayfern process: {} (PID: {:?}) - verified process is dead",
                    wayfern_process.id,
                    pid
                  );
                } else {
                  log::warn!(
                    "Wayfern stop command returned success but process {} (PID: {:?}) is still running - forcing kill",
                    wayfern_process.id,
                    pid
                  );
                  // Force kill the process
                  #[cfg(target_os = "macos")]
                  {
                    use crate::platform_browser;
                    if let Err(e) = platform_browser::macos::kill_browser_process_impl(
                      pid,
                      Some(&profile_path_str),
                    )
                    .await
                    {
                      log::error!("Failed to force kill Wayfern process {}: {}", pid, e);
                    } else {
                      sleep(Duration::from_millis(500)).await;
                      let system = System::new_all();
                      process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                      if process_actually_stopped {
                        log::info!(
                          "Successfully force killed Wayfern process {} (PID: {:?})",
                          wayfern_process.id,
                          pid
                        );
                      }
                    }
                  }
                  #[cfg(target_os = "linux")]
                  {
                    use crate::platform_browser;
                    if let Err(e) = platform_browser::linux::kill_browser_process_impl(
                      pid,
                      Some(&profile_path_str),
                    )
                    .await
                    {
                      log::error!("Failed to force kill Wayfern process {}: {}", pid, e);
                    } else {
                      sleep(Duration::from_millis(500)).await;
                      let system = System::new_all();
                      process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                      if process_actually_stopped {
                        log::info!(
                          "Successfully force killed Wayfern process {} (PID: {:?})",
                          wayfern_process.id,
                          pid
                        );
                      }
                    }
                  }
                  #[cfg(target_os = "windows")]
                  {
                    use crate::platform_browser;
                    if let Err(e) = platform_browser::windows::kill_browser_process_impl(pid).await
                    {
                      log::error!("Failed to force kill Wayfern process {}: {}", pid, e);
                    } else {
                      sleep(Duration::from_millis(500)).await;
                      let system = System::new_all();
                      process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                      if process_actually_stopped {
                        log::info!(
                          "Successfully force killed Wayfern process {} (PID: {:?})",
                          wayfern_process.id,
                          pid
                        );
                      }
                    }
                  }
                }
              } else {
                process_actually_stopped = true;
              }
            }
            Err(e) => {
              log::error!(
                "Error stopping Wayfern process {}: {}",
                wayfern_process.id,
                e
              );
              // Try to force kill if we have a PID
              if let Some(pid) = wayfern_process.processId {
                log::info!(
                  "Attempting force kill after stop_wayfern error for PID: {}",
                  pid
                );
                #[cfg(target_os = "macos")]
                {
                  use crate::platform_browser;
                  if let Err(kill_err) =
                    platform_browser::macos::kill_browser_process_impl(pid, Some(&profile_path_str))
                      .await
                  {
                    log::error!("Failed to force kill Wayfern process {}: {}", pid, kill_err);
                  } else {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_millis(500)).await;
                    use sysinfo::{Pid, System};
                    let system = System::new_all();
                    process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                  }
                }
                #[cfg(target_os = "linux")]
                {
                  use crate::platform_browser;
                  if let Err(kill_err) =
                    platform_browser::linux::kill_browser_process_impl(pid, Some(&profile_path_str))
                      .await
                  {
                    log::error!("Failed to force kill Wayfern process {}: {}", pid, kill_err);
                  } else {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_millis(500)).await;
                    use sysinfo::{Pid, System};
                    let system = System::new_all();
                    process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                  }
                }
                #[cfg(target_os = "windows")]
                {
                  use crate::platform_browser;
                  if let Err(kill_err) =
                    platform_browser::windows::kill_browser_process_impl(pid).await
                  {
                    log::error!("Failed to force kill Wayfern process {}: {}", pid, kill_err);
                  } else {
                    use tokio::time::{sleep, Duration};
                    sleep(Duration::from_millis(500)).await;
                    use sysinfo::{Pid, System};
                    let system = System::new_all();
                    process_actually_stopped = system.process(Pid::from(pid as usize)).is_none();
                  }
                }
              }
            }
          }
        }
        None => {
          log::info!(
            "No running Wayfern process found for profile: {} (ID: {})",
            profile.name,
            profile.id
          );
          process_actually_stopped = true;
        }
      }

      // If process wasn't confirmed stopped, return an error
      if !process_actually_stopped {
        log::error!(
          "Failed to stop Wayfern process for profile: {} (ID: {}) - process may still be running",
          profile.name,
          profile.id
        );
        return Err(
          format!(
            "Failed to stop Wayfern process for profile {} - process may still be running",
            profile.name
          )
          .into(),
        );
      }

      // Clear the process ID from the profile
      let mut updated_profile = profile.clone();
      updated_profile.process_id = None;
      updated_profile.runtime_state = RuntimeState::Stopped;

      // Check for pending updates and apply them
      if let Ok(Some(pending_update)) = self
        .auto_updater
        .get_pending_update(&profile.browser, &profile.version)
      {
        log::info!(
          "Found pending update for Wayfern profile {}: {} -> {}",
          profile.name,
          profile.version,
          pending_update.new_version
        );

        match self.profile_manager.update_profile_version(
          &app_handle,
          &profile.id.to_string(),
          &pending_update.new_version,
        ) {
          Ok(updated_profile_after_update) => {
            log::info!(
              "Successfully updated Wayfern profile {} from version {} to {}",
              profile.name,
              profile.version,
              pending_update.new_version
            );
            updated_profile = updated_profile_after_update;

            if let Err(e) = self
              .auto_updater
              .dismiss_update_notification(&pending_update.id)
            {
              log::warn!("Warning: Failed to dismiss pending update notification: {e}");
            }
          }
          Err(e) => {
            log::error!(
              "Failed to apply pending update for Wayfern profile {}: {}",
              profile.name,
              e
            );
          }
        }
      }

      self
        .save_process_info(&updated_profile)
        .map_err(|e| format!("Failed to update profile: {e}"))?;

      log::info!(
        "Emitting profile events for successful Wayfern kill: {}",
        updated_profile.name
      );

      // Emit profile update event to frontend
      if let Err(e) = events::emit("profile-updated", &updated_profile) {
        log::warn!("Warning: Failed to emit profile update event: {e}");
      }

      // Emit minimal running changed event
      #[derive(Serialize)]
      struct RunningChangedPayload {
        id: String,
        is_running: bool,
      }
      let payload = RunningChangedPayload {
        id: updated_profile.id.to_string(),
        is_running: false,
      };

      if let Err(e) = events::emit("profile-running-changed", &payload) {
        log::warn!("Warning: Failed to emit profile running changed event: {e}");
      } else {
        log::info!(
          "Successfully emitted profile-running-changed event for Wayfern {}: running={}",
          updated_profile.name,
          payload.is_running
        );
      }

      if profile.ephemeral {
        crate::ephemeral_dirs::remove_ephemeral_dir(&profile.id.to_string());
      }

      log::info!(
        "Wayfern process cleanup completed for profile: {} (ID: {})",
        profile.name,
        profile.id
      );

      // Consolidate browser versions after stopping a browser
      if let Ok(consolidated) = self
        .downloaded_browsers_registry
        .consolidate_browser_versions(&app_handle)
      {
        if !consolidated.is_empty() {
          log::info!("Post-stop version consolidation results:");
          for action in &consolidated {
            log::info!("  {action}");
          }
        }
      }

      return Ok(());
    }

    // For non-camoufox/wayfern browsers, use the existing logic
    let pid = if let Some(pid) = profile.process_id {
      // First verify the stored PID is still valid and belongs to our profile
      let system = System::new_all();
      if let Some(process) = system.process(sysinfo::Pid::from(pid as usize)) {
        let cmd = process.cmd();
        let exe_name = process.name().to_string_lossy();

        // Verify this process is actually our browser
        let is_correct_browser = match profile.browser.as_str() {
          "firefox" => {
            exe_name.contains("firefox")
              && !exe_name.contains("developer")
              && !exe_name.contains("camoufox")
          }
          "firefox-developer" => {
            // More flexible detection for Firefox Developer Edition
            (exe_name.contains("firefox") && exe_name.contains("developer"))
              || (exe_name.contains("firefox")
                && cmd.iter().any(|arg| {
                  let arg_str = arg.to_str().unwrap_or("");
                  arg_str.contains("Developer")
                    || arg_str.contains("developer")
                    || arg_str.contains("FirefoxDeveloperEdition")
                    || arg_str.contains("firefox-developer")
                }))
              || exe_name == "firefox" // Firefox Developer might just show as "firefox"
          }
          "zen" => exe_name.contains("zen"),
          "chromium" => exe_name.contains("chromium") || exe_name.contains("chrome"),
          "brave" => exe_name.contains("brave") || exe_name.contains("Brave"),
          _ => false,
        };

        if is_correct_browser {
          // Verify profile path match
          let profiles_dir = self.profile_manager.get_profiles_dir();
          let profile_data_path = profile.get_profile_data_path(&profiles_dir);
          let profile_data_path_str = profile_data_path.to_string_lossy();

          let profile_path_match = if matches!(
            profile.browser.as_str(),
            "firefox" | "firefox-developer" | "zen"
          ) {
            // Firefox-based browsers: look for -profile argument followed by path
            let mut found_profile_arg = false;
            for (i, arg) in cmd.iter().enumerate() {
              if let Some(arg_str) = arg.to_str() {
                if arg_str == "-profile" && i + 1 < cmd.len() {
                  if let Some(next_arg) = cmd.get(i + 1).and_then(|a| a.to_str()) {
                    if next_arg == profile_data_path_str {
                      found_profile_arg = true;
                      break;
                    }
                  }
                }
                // Also check for combined -profile=path format
                if arg_str == format!("-profile={profile_data_path_str}") {
                  found_profile_arg = true;
                  break;
                }
                // Check if the argument is the profile path directly
                if arg_str == profile_data_path_str {
                  found_profile_arg = true;
                  break;
                }
              }
            }
            found_profile_arg
          } else {
            // Chromium-based browsers: look for --user-data-dir argument
            cmd.iter().any(|s| {
              if let Some(arg) = s.to_str() {
                arg == format!("--user-data-dir={profile_data_path_str}")
                  || arg == profile_data_path_str
              } else {
                false
              }
            })
          };

          if profile_path_match {
            log::info!(
              "Verified stored PID {} is valid for profile {} (ID: {})",
              pid,
              profile.name,
              profile.id
            );
            pid
          } else {
            log::info!("Stored PID {} doesn't match profile path for {} (ID: {}), searching for correct process", pid, profile.name, profile.id);
            // Fall through to search for correct process
            self.find_browser_process_by_profile(profile)?
          }
        } else {
          log::info!("Stored PID {} doesn't match browser type for {} (ID: {}), searching for correct process", pid, profile.name, profile.id);
          // Fall through to search for correct process
          self.find_browser_process_by_profile(profile)?
        }
      } else {
        log::info!(
          "Stored PID {} is no longer valid for profile {} (ID: {}), searching for correct process",
          pid,
          profile.name,
          profile.id
        );
        // Fall through to search for correct process
        self.find_browser_process_by_profile(profile)?
      }
    } else {
      // No stored PID, search for the process
      self.find_browser_process_by_profile(profile)?
    };

    log::info!("Attempting to kill browser process with PID: {pid}");

    // Stop any associated proxy first
    if let Err(e) = PROXY_MANAGER.stop_proxy(app_handle.clone(), pid).await {
      log::warn!("Warning: Failed to stop proxy for PID {pid}: {e}");
    }

    #[cfg(target_os = "macos")]
    {
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path = profile.get_profile_data_path(&profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy().to_string();
      platform_browser::macos::kill_browser_process_impl(pid, Some(&profile_path_str)).await?;
    }

    #[cfg(target_os = "windows")]
    platform_browser::windows::kill_browser_process_impl(pid).await?;

    #[cfg(target_os = "linux")]
    {
      let profiles_dir = self.profile_manager.get_profiles_dir();
      let profile_data_path = profile.get_profile_data_path(&profiles_dir);
      let profile_path_str = profile_data_path.to_string_lossy().to_string();
      platform_browser::linux::kill_browser_process_impl(pid, Some(&profile_path_str)).await?;
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return Err("Unsupported platform".into());

    let system = System::new_all();
    if system.process(sysinfo::Pid::from(pid as usize)).is_some() {
      log::error!(
        "Browser process {} is still running after kill attempt for profile: {} (ID: {})",
        pid,
        profile.name,
        profile.id
      );
      return Err(
        format!(
          "Browser process {} is still running after kill attempt",
          pid
        )
        .into(),
      );
    }

    log::info!(
      "Verified browser process {} is terminated for profile: {} (ID: {})",
      pid,
      profile.name,
      profile.id
    );

    // Clear the process ID from the profile
    let mut updated_profile = profile.clone();
    updated_profile.process_id = None;
    updated_profile.runtime_state = RuntimeState::Stopped;

    // Check for pending updates and apply them
    if let Ok(Some(pending_update)) = self
      .auto_updater
      .get_pending_update(&profile.browser, &profile.version)
    {
      log::info!(
        "Found pending update for profile {}: {} -> {}",
        profile.name,
        profile.version,
        pending_update.new_version
      );

      // Update the profile to the new version
      match self.profile_manager.update_profile_version(
        &app_handle,
        &profile.id.to_string(),
        &pending_update.new_version,
      ) {
        Ok(updated_profile_after_update) => {
          log::info!(
            "Successfully updated profile {} from version {} to {}",
            profile.name,
            profile.version,
            pending_update.new_version
          );
          updated_profile = updated_profile_after_update;

          // Remove the pending update from the auto updater state
          if let Err(e) = self
            .auto_updater
            .dismiss_update_notification(&pending_update.id)
          {
            log::warn!("Warning: Failed to dismiss pending update notification: {e}");
          }
        }
        Err(e) => {
          log::error!(
            "Failed to apply pending update for profile {}: {}",
            profile.name,
            e
          );
          // Continue with the original profile update (just clearing process_id)
        }
      }
    }

    self
      .save_process_info(&updated_profile)
      .map_err(|e| format!("Failed to update profile: {e}"))?;

    log::info!(
      "Emitting profile events for successful kill: {}",
      updated_profile.name
    );

    // Emit profile update event to frontend
    if let Err(e) = events::emit("profile-updated", &updated_profile) {
      log::warn!("Warning: Failed to emit profile update event: {e}");
    }

    // Emit minimal running changed event to frontend immediately
    #[derive(Serialize)]
    struct RunningChangedPayload {
      id: String,
      is_running: bool,
    }
    let payload = RunningChangedPayload {
      id: updated_profile.id.to_string(),
      is_running: false, // Explicitly set to false since we just killed it
    };

    if let Err(e) = events::emit("profile-running-changed", &payload) {
      log::warn!("Warning: Failed to emit profile running changed event: {e}");
    } else {
      log::info!(
        "Successfully emitted profile-running-changed event for {}: running={}",
        updated_profile.name,
        payload.is_running
      );
    }

    // Consolidate browser versions after stopping a browser
    if let Ok(consolidated) = self
      .downloaded_browsers_registry
      .consolidate_browser_versions(&app_handle)
    {
      if !consolidated.is_empty() {
        log::info!("Post-stop version consolidation results:");
        for action in &consolidated {
          log::info!("  {action}");
        }
      }
    }

    Ok(())
  }

  /// Helper method to find browser process by profile path
  fn find_browser_process_by_profile(
    &self,
    profile: &BrowserProfile,
  ) -> Result<u32, Box<dyn std::error::Error + Send + Sync>> {
    let system = System::new_all();
    let profiles_dir = self.profile_manager.get_profiles_dir();
    let profile_data_path = profile.get_profile_data_path(&profiles_dir);
    let profile_data_path_str = profile_data_path.to_string_lossy();

    log::info!(
      "Searching for {} browser process with profile path: {}",
      profile.browser,
      profile_data_path_str
    );

    for (pid, process) in system.processes() {
      let cmd = process.cmd();
      if cmd.is_empty() {
        continue;
      }

      // Check if this is the right browser executable first
      let exe_name = process.name().to_string_lossy().to_lowercase();
      let is_correct_browser = match profile.browser.as_str() {
        "firefox" => {
          exe_name.contains("firefox")
            && !exe_name.contains("developer")
            && !exe_name.contains("camoufox")
        }
        "firefox-developer" => {
          // More flexible detection for Firefox Developer Edition
          (exe_name.contains("firefox") && exe_name.contains("developer"))
            || (exe_name.contains("firefox")
              && cmd.iter().any(|arg| {
                let arg_str = arg.to_str().unwrap_or("");
                arg_str.contains("Developer")
                  || arg_str.contains("developer")
                  || arg_str.contains("FirefoxDeveloperEdition")
                  || arg_str.contains("firefox-developer")
              }))
            || exe_name == "firefox" // Firefox Developer might just show as "firefox"
        }
        "zen" => exe_name.contains("zen"),
        "chromium" => exe_name.contains("chromium") || exe_name.contains("chrome"),
        "brave" => exe_name.contains("brave") || exe_name.contains("Brave"),
        _ => false,
      };

      if !is_correct_browser {
        continue;
      }

      // Check for profile path match with improved logic
      let profile_path_match = if matches!(
        profile.browser.as_str(),
        "firefox" | "firefox-developer" | "zen"
      ) {
        // Firefox-based browsers: look for -profile argument followed by path
        let mut found_profile_arg = false;
        for (i, arg) in cmd.iter().enumerate() {
          if let Some(arg_str) = arg.to_str() {
            if arg_str == "-profile" && i + 1 < cmd.len() {
              if let Some(next_arg) = cmd.get(i + 1).and_then(|a| a.to_str()) {
                if next_arg == profile_data_path_str {
                  found_profile_arg = true;
                  break;
                }
              }
            }
            // Also check for combined -profile=path format
            if arg_str == format!("-profile={profile_data_path_str}") {
              found_profile_arg = true;
              break;
            }
            // Check if the argument is the profile path directly
            if arg_str == profile_data_path_str {
              found_profile_arg = true;
              break;
            }
          }
        }
        found_profile_arg
      } else {
        // Chromium-based browsers: look for --user-data-dir argument
        cmd.iter().any(|s| {
          if let Some(arg) = s.to_str() {
            arg == format!("--user-data-dir={profile_data_path_str}")
              || arg == profile_data_path_str
          } else {
            false
          }
        })
      };

      if profile_path_match {
        let pid_u32 = pid.as_u32();
        log::info!(
          "Found matching {} browser process with PID: {} for profile: {} (ID: {})",
          profile.browser,
          pid_u32,
          profile.name,
          profile.id
        );
        return Ok(pid_u32);
      }
    }

    Err(
      format!(
        "No running {} browser process found for profile: {} (ID: {})",
        profile.browser, profile.name, profile.id
      )
      .into(),
    )
  }

  pub async fn open_url_with_profile(
    &self,
    app_handle: tauri::AppHandle,
    profile_id: String,
    url: String,
  ) -> Result<(), String> {
    let _launch_guard = acquire_profile_launch_guard(profile_id.as_str())?;

    // Get the profile by name
    let profiles = self
      .profile_manager
      .list_profiles()
      .map_err(|e| format!("Failed to list profiles: {e}"))?;
    let profile = profiles
      .into_iter()
      .find(|p| p.id.to_string() == profile_id)
      .ok_or_else(|| format!("Profile '{profile_id}' not found"))?;

    if profile.is_cross_os() {
      return Err(format!(
        "Cannot open URL with profile '{}': it was created on {} and is not supported on this system",
        profile.name,
        profile.host_os.as_deref().unwrap_or("unknown")
      ));
    }

    log::info!("Opening URL '{url}' with profile '{profile_id}'");

    let was_running = self
      .check_browser_status(app_handle.clone(), &profile)
      .await
      .unwrap_or(false);

    let mut should_release_lock_on_error = false;
    if !was_running {
      crate::team_lock::acquire_team_lock_if_needed(&profile).await?;
      should_release_lock_on_error =
        profile.is_sync_enabled() && crate::cloud_auth::CLOUD_AUTH.is_on_team_plan().await;

      if let Err(e) = self.set_profile_runtime_state(profile.id, RuntimeState::Starting) {
        log::debug!(
          "Failed to persist Starting state for profile {}: {}",
          profile.id,
          e
        );
      }
    }

    // Use launch_or_open_url which handles both launching new instances and opening in existing ones
    let updated_profile = match self
      .launch_or_open_url(app_handle, &profile, Some(url.clone()), None)
      .await
    {
      Ok(updated) => updated,
      Err(e) => {
        log::info!("Failed to open URL with profile '{profile_id}': {e}");
        let _ = self.set_profile_runtime_state(profile.id, RuntimeState::Error);
        if should_release_lock_on_error {
          crate::team_lock::release_team_lock_if_needed(&profile).await;
        }
        return Err(format!("Failed to open URL with profile: {e}"));
      }
    };

    if !was_running && updated_profile.is_sync_enabled() {
      if let Some(scheduler) = crate::sync::get_global_scheduler() {
        let profile_id = updated_profile.id.to_string();
        scheduler.mark_profile_running(&profile_id).await;
        scheduler.queue_profile_sync(profile_id).await;
      }
    }

    log::info!("Successfully opened URL '{url}' with profile '{profile_id}'");
    Ok(())
  }
}

fn normalize_navigation_url(raw: &str) -> String {
  let trimmed = raw.trim();
  if trimmed.is_empty() {
    return String::new();
  }

  if Url::parse(trimmed).is_ok() {
    return trimmed.to_string();
  }

  let host_candidate = trimmed.trim_end_matches('/').trim();
  if looks_like_direct_host(host_candidate) {
    return format!("http://{}", host_candidate);
  }

  let encoded: String = url::form_urlencoded::byte_serialize(trimmed.as_bytes()).collect();
  format!("https://www.google.com/search?q={encoded}")
}

fn looks_like_direct_host(value: &str) -> bool {
  if value.is_empty() {
    return false;
  }

  let lowered = value.to_ascii_lowercase();
  if lowered == "localhost" {
    return true;
  }

  if value.parse::<std::net::IpAddr>().is_ok() {
    return true;
  }

  // Domain-like values should navigate directly, e.g. example.com or intranet.local:8080.
  value.contains('.')
}

fn is_firefox_like_browser(browser: &str) -> bool {
  matches!(
    browser,
    "firefox" | "firefox-developer" | "zen" | "camoufox" | "bugox"
  )
}

fn should_reuse_existing_running_profile(is_running: bool, normalized_url: Option<&str>) -> bool {
  is_running && normalized_url.is_none()
}

fn should_retry_open_existing_browser_error(error_message: &str) -> bool {
  let lower = error_message.to_lowercase();
  lower.contains("already running")
    || lower.contains("not responding")
    || lower.contains("close firefox")
    || lower.contains("requestpending")
    || lower.contains("failed to open url in existing browser")
    || lower.contains("failed to open url with profile")
}

fn build_chromium_profile_app_id(profile_id: &str) -> String {
  let sanitized: String = profile_id
    .chars()
    .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
    .collect();
  format!("buglogin.profile.{sanitized}")
}

#[cfg(target_os = "windows")]
fn build_profile_runtime_tag(profile_name: &str) -> String {
  let compact: String = profile_name
    .chars()
    .filter(|c| c.is_alphanumeric())
    .take(7)
    .collect();

  if compact.is_empty() {
    "profile".to_string()
  } else {
    compact.to_lowercase()
  }
}

#[cfg(target_os = "windows")]
fn write_profile_launcher_icon_ico(icon_path: &Path, profile_tag: &str) -> Result<(), String> {
  let mut image = RgbaImage::from_pixel(128, 128, Rgba([10, 16, 30, 255]));

  // High-contrast inner plate + subtle border for better taskbar readability.
  for y in 6..122 {
    for x in 6..122 {
      let px = if (8..120).contains(&x) && (8..120).contains(&y) {
        Rgba([16, 28, 52, 255])
      } else {
        Rgba([55, 74, 112, 255])
      };
      image.put_pixel(x, y, px);
    }
  }

  let short_tag: String = profile_tag.chars().take(7).collect();
  let lines: Vec<String> = split_profile_tag_into_icon_lines(&short_tag);

  let scale = 5u32;
  let glyph_width = 5 * scale;
  let glyph_height = 7 * scale;
  let glyph_spacing = 3u32;
  let line_spacing = 6u32;
  let total_height = glyph_height * lines.len() as u32
    + line_spacing.saturating_mul(lines.len().saturating_sub(1) as u32);
  let start_y = ((128 - total_height) / 2) as i32;
  let foreground = Rgba([246, 250, 255, 255]);

  for (line_idx, line) in lines.iter().enumerate() {
    let line_len = line.chars().count() as u32;
    if line_len == 0 {
      continue;
    }
    let line_width = line_len * glyph_width + line_len.saturating_sub(1) * glyph_spacing;
    let start_x = ((128 - line_width) / 2) as i32;
    let y = start_y + (line_idx as i32 * (glyph_height + line_spacing) as i32);

    for (char_idx, ch) in line.chars().enumerate() {
      let x = start_x + (char_idx as i32 * (glyph_width + glyph_spacing) as i32);
      draw_icon_glyph(&mut image, ch, x, y, scale, foreground);
    }
  }

  image::DynamicImage::ImageRgba8(image)
    .save_with_format(icon_path, ImageFormat::Ico)
    .map_err(|e| format!("Failed to save icon as ICO: {e}"))?;

  Ok(())
}

#[cfg(target_os = "windows")]
fn split_profile_tag_into_icon_lines(short_tag: &str) -> Vec<String> {
  let chars: Vec<char> = short_tag.chars().collect();
  match chars.len() {
    0 => vec!["profile".chars().take(7).collect()],
    1..=3 => vec![chars.into_iter().collect()],
    4..=5 => vec![
      chars[..3].iter().collect::<String>(),
      chars[3..].iter().collect::<String>(),
    ],
    _ => vec![
      chars[..3].iter().collect::<String>(),
      chars[3..5].iter().collect::<String>(),
      chars[5..].iter().collect::<String>(),
    ],
  }
}

#[cfg(target_os = "windows")]
fn draw_icon_glyph(canvas: &mut RgbaImage, ch: char, x: i32, y: i32, scale: u32, color: Rgba<u8>) {
  let rows = icon_glyph_rows(ch);
  for (row_idx, bits) in rows.iter().enumerate() {
    for col_idx in 0..5 {
      if (bits >> (4 - col_idx)) & 1 == 1 {
        fill_icon_rect(
          canvas,
          x + (col_idx as i32 * scale as i32),
          y + (row_idx as i32 * scale as i32),
          scale,
          scale,
          color,
        );
      }
    }
  }
}

#[cfg(target_os = "windows")]
fn fill_icon_rect(
  canvas: &mut RgbaImage,
  x: i32,
  y: i32,
  width: u32,
  height: u32,
  color: Rgba<u8>,
) {
  let max_x = canvas.width() as i32;
  let max_y = canvas.height() as i32;

  for yy in 0..height as i32 {
    for xx in 0..width as i32 {
      let px = x + xx;
      let py = y + yy;
      if px >= 0 && py >= 0 && px < max_x && py < max_y {
        canvas.put_pixel(px as u32, py as u32, color);
      }
    }
  }
}

#[cfg(target_os = "windows")]
fn icon_glyph_rows(ch: char) -> [u8; 7] {
  match ch {
    'a' => [
      0b00000, 0b00000, 0b01110, 0b00001, 0b01111, 0b10001, 0b01111,
    ],
    'b' => [
      0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b11110,
    ],
    'c' => [
      0b00000, 0b00000, 0b01111, 0b10000, 0b10000, 0b10000, 0b01111,
    ],
    'd' => [
      0b00001, 0b00001, 0b01111, 0b10001, 0b10001, 0b10001, 0b01111,
    ],
    'e' => [
      0b00000, 0b00000, 0b01110, 0b10001, 0b11111, 0b10000, 0b01111,
    ],
    'f' => [
      0b00110, 0b01000, 0b11100, 0b01000, 0b01000, 0b01000, 0b01000,
    ],
    'g' => [
      0b00000, 0b00000, 0b01111, 0b10001, 0b01111, 0b00001, 0b01110,
    ],
    'h' => [
      0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001,
    ],
    'i' => [
      0b00100, 0b00000, 0b01100, 0b00100, 0b00100, 0b00100, 0b01110,
    ],
    'j' => [
      0b00010, 0b00000, 0b00110, 0b00010, 0b00010, 0b10010, 0b01100,
    ],
    'k' => [
      0b10000, 0b10000, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010,
    ],
    'l' => [
      0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110,
    ],
    'm' => [
      0b00000, 0b00000, 0b11010, 0b10101, 0b10101, 0b10101, 0b10101,
    ],
    'n' => [
      0b00000, 0b00000, 0b11110, 0b10001, 0b10001, 0b10001, 0b10001,
    ],
    'o' => [
      0b00000, 0b00000, 0b01110, 0b10001, 0b10001, 0b10001, 0b01110,
    ],
    'p' => [
      0b00000, 0b00000, 0b11110, 0b10001, 0b11110, 0b10000, 0b10000,
    ],
    'q' => [
      0b00000, 0b00000, 0b01111, 0b10001, 0b01111, 0b00001, 0b00001,
    ],
    'r' => [
      0b00000, 0b00000, 0b10110, 0b11001, 0b10000, 0b10000, 0b10000,
    ],
    's' => [
      0b00000, 0b00000, 0b01111, 0b10000, 0b01110, 0b00001, 0b11110,
    ],
    't' => [
      0b01000, 0b01000, 0b11100, 0b01000, 0b01000, 0b01001, 0b00110,
    ],
    'u' => [
      0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b10011, 0b01101,
    ],
    'v' => [
      0b00000, 0b00000, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100,
    ],
    'w' => [
      0b00000, 0b00000, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010,
    ],
    'x' => [
      0b00000, 0b00000, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001,
    ],
    'y' => [
      0b00000, 0b00000, 0b10001, 0b10001, 0b01111, 0b00001, 0b01110,
    ],
    'z' => [
      0b00000, 0b00000, 0b11111, 0b00010, 0b00100, 0b01000, 0b11111,
    ],
    'A' => [
      0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001,
    ],
    'B' => [
      0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110,
    ],
    'C' => [
      0b01111, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b01111,
    ],
    'D' => [
      0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110,
    ],
    'E' => [
      0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111,
    ],
    'F' => [
      0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000,
    ],
    'G' => [
      0b01111, 0b10000, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110,
    ],
    'H' => [
      0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001,
    ],
    'I' => [
      0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b11111,
    ],
    'J' => [
      0b11111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100,
    ],
    'K' => [
      0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001,
    ],
    'L' => [
      0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111,
    ],
    'M' => [
      0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001,
    ],
    'N' => [
      0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001,
    ],
    'O' => [
      0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110,
    ],
    'P' => [
      0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000,
    ],
    'Q' => [
      0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101,
    ],
    'R' => [
      0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001,
    ],
    'S' => [
      0b01111, 0b10000, 0b10000, 0b01110, 0b00001, 0b00001, 0b11110,
    ],
    'T' => [
      0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100,
    ],
    'U' => [
      0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110,
    ],
    'V' => [
      0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100,
    ],
    'W' => [
      0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b10101, 0b01010,
    ],
    'X' => [
      0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001,
    ],
    'Y' => [
      0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100,
    ],
    'Z' => [
      0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111,
    ],
    '0' => [
      0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110,
    ],
    '1' => [
      0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110,
    ],
    '2' => [
      0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111,
    ],
    '3' => [
      0b11110, 0b00001, 0b00001, 0b01110, 0b00001, 0b00001, 0b11110,
    ],
    '4' => [
      0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010,
    ],
    '5' => [
      0b11111, 0b10000, 0b10000, 0b11110, 0b00001, 0b00001, 0b11110,
    ],
    '6' => [
      0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110,
    ],
    '7' => [
      0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000,
    ],
    '8' => [
      0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110,
    ],
    '9' => [
      0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110,
    ],
    _ => [
      0b11111, 0b10001, 0b00100, 0b00100, 0b00100, 0b10001, 0b11111,
    ],
  }
}

fn should_fallback_to_new_instance_after_open_url_failure(
  is_browser_running: bool,
  browser: &str,
  error_message: &str,
) -> bool {
  if is_browser_running {
    return false;
  }

  // For Firefox-like browsers, lock-related errors indicate an in-flight startup
  // race more than a real "not running" state. Avoid spawning a second process.
  if is_firefox_like_browser(browser) {
    let lower = error_message.to_lowercase();
    if lower.contains("already running")
      || lower.contains("not responding")
      || lower.contains("close firefox")
      || lower.contains("profile appears to be in use")
    {
      return false;
    }
  }

  true
}

#[cfg(test)]
mod tests {
  use super::{
    should_fallback_to_new_instance_after_open_url_failure,
    should_retry_open_existing_browser_error, should_reuse_existing_running_profile,
  };

  #[test]
  fn reuses_running_profile_when_no_url_is_provided() {
    assert!(should_reuse_existing_running_profile(true, None));
    assert!(!should_reuse_existing_running_profile(false, None));
    assert!(!should_reuse_existing_running_profile(
      true,
      Some("https://example.com")
    ));
  }

  #[test]
  fn does_not_fallback_when_profile_is_still_running() {
    assert!(!should_fallback_to_new_instance_after_open_url_failure(
      true,
      "camoufox",
      "Failed to open URL in existing browser: Firefox is already running, but is not responding.",
    ));
  }

  #[test]
  fn does_not_fallback_for_firefox_lock_error_even_if_status_probe_is_false() {
    assert!(!should_fallback_to_new_instance_after_open_url_failure(
      false,
      "camoufox",
      "Firefox is already running, but is not responding. The old Firefox process must be closed.",
    ));
  }

  #[test]
  fn falls_back_for_non_lock_error_when_browser_is_not_running() {
    assert!(should_fallback_to_new_instance_after_open_url_failure(
      false,
      "camoufox",
      "Browser is not running",
    ));
  }

  #[test]
  fn retries_on_transient_lock_error() {
    assert!(should_retry_open_existing_browser_error(
      "Failed to open URL: already running but not responding",
    ));
  }

  #[test]
  fn does_not_retry_on_non_transient_error() {
    assert!(!should_retry_open_existing_browser_error(
      "unsupported browser type",
    ));
  }
}

async fn preflight_check_profile_proxy(profile: &BrowserProfile) -> Result<(), String> {
  let Some(proxy_id) = profile.proxy_id.as_ref() else {
    return Ok(());
  };

  if PROXY_MANAGER.is_cloud_or_derived(proxy_id) {
    CLOUD_AUTH.sync_cloud_proxy().await;
  }

  let proxy_settings = PROXY_MANAGER
    .get_proxy_settings_by_id(proxy_id)
    .ok_or_else(|| format!("Assigned proxy '{proxy_id}' was not found"))?;

  PROXY_MANAGER
    .check_proxy_validity(proxy_id, &proxy_settings)
    .await
    .map(|_| ())
    .map_err(|e| format!("Proxy check failed for profile '{}': {e}", profile.name))
}

async fn ensure_managed_browser_downloaded_for_profile(
  app_handle: &tauri::AppHandle,
  browser_runner: &BrowserRunner,
  profile: &BrowserProfile,
) -> Result<BrowserProfile, String> {
  let managed_slug = match profile.browser.as_str() {
    "bugium" | "wayfern" => Some("wayfern"),
    "bugox" | "camoufox" => Some("camoufox"),
    _ => None,
  };

  let Some(managed_slug) = managed_slug else {
    return Ok(profile.clone());
  };

  let browser_type = crate::browser::BrowserType::from_str(managed_slug)
    .map_err(|e| format!("Invalid managed browser type '{managed_slug}': {e}"))?;
  let browser = crate::browser::create_browser(browser_type);
  let binaries_dir = crate::app_dirs::binaries_dir();

  if browser.is_version_downloaded(&profile.version, &binaries_dir) {
    return Ok(profile.clone());
  }

  let release_types = crate::browser_version_manager::BrowserVersionManager::instance()
    .get_browser_release_types(managed_slug)
    .await
    .map_err(|e| format!("Failed to resolve latest version for {managed_slug}: {e}"))?;
  let target_version = release_types
    .stable
    .unwrap_or_else(|| profile.version.clone());

  log::info!(
    "Managed browser binary missing for profile '{}' ({} {}). Auto-downloading {} {}",
    profile.name,
    managed_slug,
    profile.version,
    managed_slug,
    target_version
  );

  let downloaded_version = crate::downloader::download_browser(
    app_handle.clone(),
    managed_slug.to_string(),
    target_version.clone(),
  )
  .await
  .map_err(|e| format!("Failed to auto-download {managed_slug} {target_version}: {e}"))?;

  let persisted_version = if browser.is_version_downloaded(&target_version, &binaries_dir) {
    target_version.clone()
  } else if browser.is_version_downloaded(&downloaded_version, &binaries_dir) {
    downloaded_version.clone()
  } else {
    return Err(format!(
      "Downloaded {managed_slug} but binary is missing for both requested '{target_version}' and downloaded '{downloaded_version}'"
    ));
  };

  if persisted_version != profile.version {
    browser_runner
      .profile_manager
      .update_profile_version(app_handle, &profile.id.to_string(), &persisted_version)
      .map_err(|e| format!("Failed to update profile version after download: {e}"))?;
    let refreshed = browser_runner
      .profile_manager
      .list_profiles()
      .map_err(|e| format!("Failed to refresh profiles after download: {e}"))?
      .into_iter()
      .find(|candidate| candidate.id == profile.id)
      .unwrap_or_else(|| profile.clone());
    return Ok(refreshed);
  }

  Ok(profile.clone())
}

async fn preflight_check_required_managed_browser_update(
  profile: &BrowserProfile,
) -> Result<(), String> {
  if !matches!(
    profile.browser.as_str(),
    "camoufox" | "bugox" | "wayfern" | "bugium"
  ) {
    return Ok(());
  }

  let update_requirement = BrowserVersionManager::instance()
    .get_managed_browser_update_requirement(&profile.browser, &profile.version, false)
    .await
    .map_err(|e| {
      format!(
        "Failed to verify browser update policy for '{}': {e}",
        profile.name
      )
    })?;

  if !update_requirement.is_required {
    return Ok(());
  }

  let minimum_note = update_requirement
    .minimum_supported_version
    .as_ref()
    .map(|minimum| format!("minimum supported is {minimum}"))
    .unwrap_or_else(|| "minimum supported version is not specified".to_string());

  let extra = update_requirement
    .message
    .as_ref()
    .map(|msg| format!(" {msg}"))
    .unwrap_or_default();

  Err(format!(
    "Profile '{}' is blocked by required browser update policy for {}. Current: {}, required target: {}, {}. Please update browser binaries before launch.{}",
    profile.name,
    profile.browser,
    profile.version,
    update_requirement.latest_version,
    minimum_note,
    extra
  ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserRuntimeProcessSnapshot {
  pub pid: u32,
  pub executable_path: Option<String>,
  pub command_line: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserRuntimeDiagnostic {
  pub profile_id: String,
  pub profile_name: String,
  pub browser: String,
  pub version: String,
  pub runtime_state: String,
  pub is_running: bool,
  pub stored_process_id: Option<u32>,
  pub detected_process_id: Option<u32>,
  pub profile_data_path: String,
  pub effective_profile_path: String,
  pub configured_executable_path: Option<String>,
  pub configured_executable_exists: bool,
  pub resolved_executable_path: Option<String>,
  pub resolved_executable_exists: bool,
  pub profile_launcher_path: Option<String>,
  pub managed_slug: Option<String>,
  pub managed_metadata_url: Option<String>,
  pub process_executable_path: Option<String>,
  pub process_command_line: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CamoufoxUaVersionAlignment {
  pub profile_id: String,
  pub profile_name: String,
  pub browser: String,
  pub executable_version: Option<u32>,
  pub fingerprint_user_agent: Option<String>,
  pub fingerprint_firefox_version: Option<u32>,
  pub is_mismatch: bool,
  pub message: Option<String>,
}

fn parse_firefox_major_from_ua(user_agent: &str) -> Option<u32> {
  let marker = "Firefox/";
  let start = user_agent.find(marker)? + marker.len();
  let major = user_agent[start..]
    .chars()
    .take_while(|ch| ch.is_ascii_digit())
    .collect::<String>();
  major.parse::<u32>().ok()
}

fn managed_browser_slug(browser: &str) -> Option<&'static str> {
  match browser {
    "camoufox" | "bugox" => Some("camoufox"),
    "wayfern" | "bugium" => Some("wayfern"),
    _ => None,
  }
}

fn managed_browser_metadata_url(browser: &str) -> Option<String> {
  let slug = managed_browser_slug(browser)?;
  let base = std::env::var("BUGLOGIN_BROWSER_API_BASE")
    .ok()
    .map(|value| value.trim().trim_end_matches('/').to_string())
    .filter(|value| !value.is_empty())
    .unwrap_or_else(|| "https://api.gnohh.com".to_string());
  Some(format!("{base}/v1/browser/{slug}.json"))
}

fn configured_profile_executable_path(profile: &BrowserProfile) -> Option<String> {
  match profile.browser.as_str() {
    "camoufox" | "bugox" => profile
      .camoufox_config
      .as_ref()
      .and_then(|config| config.executable_path.clone()),
    "wayfern" | "bugium" => profile
      .wayfern_config
      .as_ref()
      .and_then(|config| config.executable_path.clone()),
    _ => None,
  }
}

fn resolve_process_snapshot_by_pid(
  process_id: Option<u32>,
) -> Option<BrowserRuntimeProcessSnapshot> {
  use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System};

  let pid = process_id?;
  let system = System::new_with_specifics(
    RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
  );
  let process = system.process(Pid::from(pid as usize))?;
  let executable_path = process.exe().map(|path| path.to_string_lossy().to_string());
  let command_line = process
    .cmd()
    .iter()
    .filter_map(|value| value.to_str().map(|text| text.to_string()))
    .collect::<Vec<String>>();

  Some(BrowserRuntimeProcessSnapshot {
    pid,
    executable_path,
    command_line,
  })
}

#[cfg(target_os = "windows")]
fn resolve_windows_profile_launcher_path(
  profile: &BrowserProfile,
  resolved_executable_path: Option<&PathBuf>,
) -> Option<String> {
  let executable_dir = resolved_executable_path?.parent()?;
  let sanitized_profile_id: String = profile
    .id
    .to_string()
    .chars()
    .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
    .collect();
  let launcher_file_name = format!("buglogin-profile-{sanitized_profile_id}.exe");
  let launcher_path = executable_dir.join(launcher_file_name);
  if launcher_path.exists() {
    Some(launcher_path.to_string_lossy().to_string())
  } else {
    None
  }
}

#[cfg(not(target_os = "windows"))]
fn resolve_windows_profile_launcher_path(
  _profile: &BrowserProfile,
  _resolved_executable_path: Option<&PathBuf>,
) -> Option<String> {
  None
}

#[tauri::command]
pub async fn get_browser_runtime_diagnostics(
  app_handle: tauri::AppHandle,
  profile_ids: Option<Vec<String>>,
  running_only: Option<bool>,
  limit: Option<usize>,
) -> Result<Vec<BrowserRuntimeDiagnostic>, String> {
  let runner = BrowserRunner::instance();
  let mut profiles = runner
    .profile_manager
    .list_profiles()
    .map_err(|e| format!("Failed to list profiles: {e}"))?;

  if let Some(filter_ids) = profile_ids {
    if !filter_ids.is_empty() {
      let filter_set = filter_ids
        .into_iter()
        .collect::<std::collections::HashSet<_>>();
      profiles.retain(|profile| filter_set.contains(&profile.id.to_string()));
    }
  }

  profiles.sort_by(|left, right| left.name.cmp(&right.name));
  let running_only = running_only.unwrap_or(false);
  let max_items = limit.unwrap_or(80).clamp(1, 250);

  let profiles_dir = runner.profile_manager.get_profiles_dir();
  let mut diagnostics = Vec::new();

  for profile in profiles.into_iter() {
    if diagnostics.len() >= max_items {
      break;
    }

    let is_running = runner
      .check_browser_status(app_handle.clone(), &profile)
      .await
      .unwrap_or(false);

    let latest_profile = runner
      .profile_manager
      .get_profile_by_id(&profile.id)
      .ok()
      .flatten()
      .unwrap_or(profile.clone());

    if running_only && !is_running && latest_profile.process_id.is_none() {
      continue;
    }

    let profile_data_path = latest_profile.get_profile_data_path(&profiles_dir);
    let effective_profile_path =
      crate::ephemeral_dirs::get_effective_profile_path(&latest_profile, &profiles_dir);
    let configured_executable_path = configured_profile_executable_path(&latest_profile);
    let configured_executable_exists = configured_executable_path
      .as_ref()
      .map(|path| Path::new(path).exists())
      .unwrap_or(false);

    let resolved_executable_path = runner.get_browser_executable_path(&latest_profile).ok();
    let resolved_executable_exists = resolved_executable_path
      .as_ref()
      .map(|path| path.exists())
      .unwrap_or(false);
    let profile_launcher_path =
      resolve_windows_profile_launcher_path(&latest_profile, resolved_executable_path.as_ref());

    let process_snapshot = resolve_process_snapshot_by_pid(latest_profile.process_id);
    let detected_process_id = process_snapshot.as_ref().map(|snapshot| snapshot.pid);
    let process_executable_path = process_snapshot
      .as_ref()
      .and_then(|snapshot| snapshot.executable_path.clone());
    let process_command_line = process_snapshot
      .map(|snapshot| snapshot.command_line)
      .unwrap_or_default();

    let managed_slug = managed_browser_slug(&latest_profile.browser).map(str::to_string);
    let managed_metadata_url = managed_browser_metadata_url(&latest_profile.browser);

    diagnostics.push(BrowserRuntimeDiagnostic {
      profile_id: latest_profile.id.to_string(),
      profile_name: latest_profile.name.clone(),
      browser: latest_profile.browser.clone(),
      version: latest_profile.version.clone(),
      runtime_state: format!("{:?}", latest_profile.runtime_state).to_lowercase(),
      is_running,
      stored_process_id: latest_profile.process_id,
      detected_process_id,
      profile_data_path: profile_data_path.to_string_lossy().to_string(),
      effective_profile_path: effective_profile_path.to_string_lossy().to_string(),
      configured_executable_path,
      configured_executable_exists,
      resolved_executable_path: resolved_executable_path
        .as_ref()
        .map(|path| path.to_string_lossy().to_string()),
      resolved_executable_exists,
      profile_launcher_path,
      managed_slug,
      managed_metadata_url,
      process_executable_path,
      process_command_line,
    });
  }

  Ok(diagnostics)
}

#[tauri::command]
pub async fn check_camoufox_ua_version_alignment(
  profile_id: String,
) -> Result<CamoufoxUaVersionAlignment, String> {
  let runner = BrowserRunner::instance();
  let parsed_profile_id = uuid::Uuid::parse_str(profile_id.trim())
    .map_err(|error| format!("Invalid profile id: {error}"))?;
  let profile = runner
    .profile_manager
    .get_profile_by_id(&parsed_profile_id)
    .map_err(|error| format!("Failed to get profile: {error}"))?
    .ok_or_else(|| "Profile not found".to_string())?;

  let browser = profile.browser.clone();
  if browser != "camoufox" && browser != "bugox" {
    return Ok(CamoufoxUaVersionAlignment {
      profile_id: profile.id.to_string(),
      profile_name: profile.name.clone(),
      browser,
      executable_version: None,
      fingerprint_user_agent: None,
      fingerprint_firefox_version: None,
      is_mismatch: false,
      message: None,
    });
  }

  let executable_path = runner
    .get_browser_executable_path(&profile)
    .ok()
    .filter(|path| path.exists());
  let executable_version = executable_path
    .as_ref()
    .and_then(|path| crate::camoufox::config::get_firefox_version(path));

  let fingerprint_user_agent = profile
    .camoufox_config
    .as_ref()
    .and_then(|config| config.fingerprint.as_ref())
    .and_then(|fingerprint_json| serde_json::from_str::<serde_json::Value>(fingerprint_json).ok())
    .and_then(|value| {
      value
        .get("navigator.userAgent")
        .and_then(|raw| raw.as_str().map(str::to_string))
        .or_else(|| {
          value
            .get("userAgent")
            .and_then(|raw| raw.as_str().map(str::to_string))
        })
    });
  let fingerprint_firefox_version = fingerprint_user_agent
    .as_deref()
    .and_then(parse_firefox_major_from_ua);

  let is_mismatch = match (executable_version, fingerprint_firefox_version) {
    (Some(exe_major), Some(fp_major)) => exe_major != fp_major,
    _ => false,
  };

  let message = if is_mismatch {
    Some(format!(
      "UA/version mismatch detected for profile '{}': executable Firefox/{} but fingerprint UA Firefox/{}. Regenerate fingerprint for this profile before launch.",
      profile.name,
      executable_version.unwrap_or_default(),
      fingerprint_firefox_version.unwrap_or_default()
    ))
  } else {
    None
  };

  Ok(CamoufoxUaVersionAlignment {
    profile_id: profile.id.to_string(),
    profile_name: profile.name.clone(),
    browser: profile.browser.clone(),
    executable_version,
    fingerprint_user_agent,
    fingerprint_firefox_version,
    is_mismatch,
    message,
  })
}

#[tauri::command]
pub async fn launch_browser_profile(
  app_handle: tauri::AppHandle,
  profile: BrowserProfile,
  url: Option<String>,
) -> Result<BrowserProfile, String> {
  log::info!(
    "Launch request received for profile: {} (ID: {})",
    profile.name,
    profile.id
  );

  if profile.is_cross_os() {
    return Err(format!(
      "Cannot launch profile '{}': it was created on {} and is not supported on this system",
      profile.name,
      profile.host_os.as_deref().unwrap_or("unknown")
    ));
  }

  let browser_runner = BrowserRunner::instance();

  // Resolve the most up-to-date profile from disk by ID before lock checks.
  let mut profile_for_launch = match browser_runner
    .profile_manager
    .list_profiles()
    .map_err(|e| format!("Failed to list profiles: {e}"))
  {
    Ok(profiles) => profiles
      .into_iter()
      .find(|p| p.id == profile.id)
      .unwrap_or_else(|| profile.clone()),
    Err(e) => return Err(e),
  };

  log::info!(
    "Resolved profile for launch: {} (ID: {})",
    profile_for_launch.name,
    profile_for_launch.id
  );

  profile_for_launch =
    ensure_managed_browser_downloaded_for_profile(&app_handle, browser_runner, &profile_for_launch)
      .await?;

  // Enforce lock in backend against fresh profile metadata (not stale UI payload).
  crate::team_lock::acquire_team_lock_if_needed(&profile_for_launch).await?;
  let should_release_lock_on_error =
    profile_for_launch.is_sync_enabled() && crate::cloud_auth::CLOUD_AUTH.is_on_team_plan().await;

  if let Err(e) =
    browser_runner.set_profile_runtime_state(profile_for_launch.id, RuntimeState::Starting)
  {
    log::debug!(
      "Failed to persist Starting state for profile {}: {}",
      profile_for_launch.id,
      e
    );
  }

  let launch_result: Result<(BrowserProfile, Option<u32>), String> = async {
  preflight_check_required_managed_browser_update(&profile_for_launch).await?;
  preflight_check_profile_proxy(&profile_for_launch).await?;

    // Store the internal proxy settings for passing to launch_browser
    let mut internal_proxy_settings: Option<ProxySettings> = None;
    let mut temp_proxy_pid: Option<u32> = None;

  // Always start a local proxy before launching (non-Camoufox/Wayfern handled here; they have their own flow)
  // This ensures all traffic goes through the local proxy for monitoring and future features
  if !matches!(
    profile_for_launch.browser.as_str(),
    "camoufox" | "bugox" | "wayfern" | "bugium"
  ) {
    // Determine upstream proxy if configured; otherwise use DIRECT (no upstream)
    let mut upstream_proxy = profile_for_launch
      .proxy_id
      .as_ref()
      .and_then(|id| PROXY_MANAGER.get_proxy_settings_by_id(id));

    // If profile has a VPN instead of proxy, start VPN worker and use it as upstream
    if upstream_proxy.is_none() {
      if let Some(ref vpn_id) = profile_for_launch.vpn_id {
        match crate::vpn_worker_runner::start_vpn_worker(vpn_id).await {
          Ok(vpn_worker) => {
            if let Some(port) = vpn_worker.local_port {
              upstream_proxy = Some(ProxySettings {
                proxy_type: "socks5".to_string(),
                host: "127.0.0.1".to_string(),
                port,
                username: None,
                password: None,
              });
              log::info!("VPN worker started for profile on port {}", port);
            }
          }
          Err(e) => {
            return Err(format!("Failed to start VPN worker: {e}"));
          }
        }
      }
    }

      // Use an isolated temporary PID placeholder, then remap to the real browser PID
      let temp_pid = next_temp_proxy_pid();
      temp_proxy_pid = Some(temp_pid);
      let profile_id_str = profile_for_launch.id.to_string();

    // Always start a local proxy, even if there's no upstream proxy
    // This allows for traffic monitoring and future features
    match PROXY_MANAGER
      .start_proxy(
        app_handle.clone(),
        upstream_proxy.as_ref(),
        temp_pid,
        Some(&profile_id_str),
        profile_for_launch.proxy_bypass_rules.clone(),
      )
      .await
    {
      Ok(internal_proxy) => {
        // Use internal proxy for subsequent launch
        internal_proxy_settings = Some(internal_proxy.clone());

        // For Firefox-based browsers, always apply PAC/user.js to point to the local proxy
        if matches!(
          profile_for_launch.browser.as_str(),
          "firefox" | "firefox-developer" | "zen"
        ) {
          let profiles_dir = browser_runner.profile_manager.get_profiles_dir();
          let profile_path = profiles_dir
            .join(profile_for_launch.id.to_string())
            .join("profile");

          // Provide a dummy upstream (ignored when internal proxy is provided)
          let dummy_upstream = ProxySettings {
            proxy_type: "http".to_string(),
            host: "127.0.0.1".to_string(),
            port: internal_proxy.port,
            username: None,
            password: None,
          };

          browser_runner
            .profile_manager
              .apply_proxy_settings_to_profile(
                &profile_path,
                &dummy_upstream,
                Some(&internal_proxy),
              )
            .map_err(|e| format!("Failed to update profile proxy: {e}"))?;
        }

        log::info!(
          "Local proxy prepared for profile: {} on port: {} (upstream: {})",
          profile_for_launch.name,
          internal_proxy.port,
          upstream_proxy
            .as_ref()
            .map(|p| format!("{}:{}", p.host, p.port))
            .unwrap_or_else(|| "DIRECT".to_string())
        );
      }
      Err(e) => {
        let error_msg = format!("Failed to start local proxy: {e}");
        log::error!("{}", error_msg);
        // DO NOT launch browser if proxy startup fails - all browsers must use local proxy
        return Err(error_msg);
      }
    }
  }

  log::info!(
    "Starting browser launch for profile: {} (ID: {})",
    profile_for_launch.name,
    profile_for_launch.id
  );

  // Launch browser or open URL in existing instance
    let updated_profile = browser_runner
      .launch_or_open_url(
        app_handle.clone(),
        &profile_for_launch,
        url,
        internal_proxy_settings.as_ref(),
      )
      .await
      .map_err(|e| {
        if let Some(io_error) = e.downcast_ref::<std::io::Error>() {
          if io_error.kind() == std::io::ErrorKind::Other
            && io_error.to_string().contains("Exec format error")
          {
            return format!(
              "Failed to launch browser: Executable format error. This browser version is not compatible with your system architecture ({}). Please try a different browser or version that supports your platform.",
              std::env::consts::ARCH
            );
          }
        }
        format!("Failed to launch browser or open URL: {e}")
      })?;

    Ok((updated_profile, temp_proxy_pid))
  }
  .await;

  let (updated_profile, temp_proxy_pid) = match launch_result {
    Ok(result) => result,
    Err(error_message) => {
      log::info!(
        "Browser launch failed for profile: {}, error: {}",
        profile_for_launch.name,
        error_message
      );
      if let Err(audit_err) = events::emit_audit_event(
        "run",
        "profile",
        Some(&profile_for_launch.id.to_string()),
        "failed",
        Some(&format!(
          "Failed to launch profile '{}': {}",
          profile_for_launch.name, error_message
        )),
      ) {
        log::warn!("Failed to emit audit event for profile launch failure: {audit_err}");
      }

      let _ = events::emit(
        "profile-running-changed",
        serde_json::json!({
          "id": profile_for_launch.id.to_string(),
          "is_running": false
        }),
      );

      let _ = browser_runner.set_profile_runtime_state(profile_for_launch.id, RuntimeState::Error);

      if should_release_lock_on_error {
        crate::team_lock::release_team_lock_if_needed(&profile_for_launch).await;
      }

      return Err(error_message);
    }
  };

  log::info!(
    "Browser launch completed for profile: {} (ID: {})",
    updated_profile.name,
    updated_profile.id
  );
  if let Err(e) = events::emit_audit_event(
    "run",
    "profile",
    Some(&updated_profile.id.to_string()),
    "success",
    Some(&format!("Launched profile '{}'", updated_profile.name)),
  ) {
    log::warn!("Failed to emit audit event for profile launch: {e}");
  }

  // Now update the proxy with the correct PID if we have one.
  if let (Some(actual_pid), Some(temp_pid)) = (updated_profile.process_id, temp_proxy_pid) {
    let _ = PROXY_MANAGER.update_proxy_pid(temp_pid, actual_pid);
  }

  if updated_profile.is_sync_enabled() {
    if let Some(scheduler) = crate::sync::get_global_scheduler() {
      let profile_id = updated_profile.id.to_string();
      scheduler.mark_profile_running(&profile_id).await;
      scheduler.queue_profile_sync(profile_id).await;
    }
  }

  Ok(updated_profile)
}

#[tauri::command]
pub async fn launch_browser_profile_by_id(
  app_handle: tauri::AppHandle,
  profile_id: String,
  url: Option<String>,
) -> Result<BrowserProfile, String> {
  let browser_runner = BrowserRunner::instance();
  let profiles = browser_runner
    .profile_manager
    .list_profiles()
    .map_err(|e| format!("Failed to list profiles: {e}"))?;

  let profile = profiles
    .into_iter()
    .find(|candidate| candidate.id.to_string() == profile_id)
    .ok_or_else(|| format!("Profile with ID '{}' not found", profile_id))?;

  launch_browser_profile(app_handle, profile, url).await
}

#[tauri::command]
pub fn check_browser_exists(browser_str: String, version: String) -> bool {
  // This is an alias for is_browser_downloaded to provide clearer semantics for auto-updates
  let runner = BrowserRunner::instance();
  runner
    .downloaded_browsers_registry
    .is_browser_downloaded(&browser_str, &version)
}

#[tauri::command]
pub async fn park_browser_profile(
  app_handle: tauri::AppHandle,
  profile: BrowserProfile,
) -> Result<(), String> {
  if profile.ephemeral {
    return kill_browser_profile(app_handle, profile).await;
  }

  let runner = BrowserRunner::instance();
  let profile_manager = runner.profile_manager;

  let profiles = profile_manager
    .list_profiles()
    .map_err(|e| format!("Failed to list profiles: {e}"))?;
  let mut latest = profiles
    .into_iter()
    .find(|p| p.id == profile.id)
    .ok_or_else(|| format!("Profile with ID '{}' not found", profile.id))?;

  let is_running = runner
    .check_browser_status(app_handle, &latest)
    .await
    .map_err(|e| format!("Failed to check browser status: {e}"))?;
  if !is_running {
    // Keep stop UX resilient when runtime metadata says the profile is live but
    // a transient status probe misses the process.
    let optimistic_live = latest.process_id.is_some()
      || matches!(
        latest.runtime_state,
        RuntimeState::Running | RuntimeState::Starting | RuntimeState::Stopping
      );
    if !optimistic_live {
      return Err("Cannot park profile because browser is not running".to_string());
    }
    log::warn!(
      "Status probe reported not running for profile {} (ID: {}), but runtime metadata indicates active process. Applying optimistic park.",
      latest.name,
      latest.id
    );
  }

  latest.runtime_state = RuntimeState::Parked;
  profile_manager
    .save_profile(&latest)
    .map_err(|e| format!("Failed to save parked profile state: {e}"))?;

  let _ = events::emit("profile-updated", &latest);
  let _ = events::emit(
    "profile-runtime-state-changed",
    serde_json::json!({
      "id": latest.id.to_string(),
      "runtime_state": "parked"
    }),
  );
  let _ = events::emit(
    "profile-running-changed",
    serde_json::json!({
      "id": latest.id.to_string(),
      "is_running": false
    }),
  );
  if let Err(e) = crate::browser_window::minimize_for_pid(latest.process_id) {
    log::debug!(
      "Failed to minimize parked browser window for profile {} (ID: {}): {}",
      latest.name,
      latest.id,
      e
    );
  }
  Ok(())
}

#[tauri::command]
pub async fn kill_browser_profile(
  app_handle: tauri::AppHandle,
  profile: BrowserProfile,
) -> Result<(), String> {
  log::info!(
    "Kill request received for profile: {} (ID: {})",
    profile.name,
    profile.id
  );

  let browser_runner = BrowserRunner::instance();
  let _ = browser_runner.set_profile_runtime_state(profile.id, RuntimeState::Stopping);

  match browser_runner
    .kill_browser_process(app_handle.clone(), &profile)
    .await
  {
    Ok(()) => {
      log::info!(
        "Successfully killed browser profile: {} (ID: {})",
        profile.name,
        profile.id
      );
      if let Err(e) = events::emit_audit_event(
        "stop",
        "profile",
        Some(&profile.id.to_string()),
        "success",
        Some(&format!("Stopped profile '{}'", profile.name)),
      ) {
        log::warn!("Failed to emit audit event for profile stop: {e}");
      }

      let _ = browser_runner.set_profile_runtime_state(profile.id, RuntimeState::Stopped);

      if profile.is_sync_enabled() {
        if let Some(scheduler) = crate::sync::get_global_scheduler() {
          let profile_id = profile.id.to_string();
          scheduler.mark_profile_stopped(&profile_id).await;
          scheduler.queue_profile_sync_immediate(profile_id).await;
        }
      }

      // Release team lock if applicable
      let latest_for_lock_release = browser_runner
        .profile_manager
        .get_profile_by_id(&profile.id)
        .ok()
        .flatten();
      if let Some(latest) = latest_for_lock_release.as_ref() {
        crate::team_lock::release_team_lock_if_needed(latest).await;
      } else {
        crate::team_lock::release_team_lock_if_needed(&profile).await;
      }

      // Auto-update non-running profiles and cleanup unused binaries
      let browser_for_update = profile.browser.clone();
      let app_handle_for_update = app_handle.clone();
      tauri::async_runtime::spawn(async move {
        let registry = crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
        let mut versions = registry.get_downloaded_versions(&browser_for_update);
        if !versions.is_empty() {
          versions.sort_by(|a, b| crate::api_client::compare_versions(b, a));
          let latest_version = &versions[0];

          let auto_updater = crate::auto_updater::AutoUpdater::instance();
          match auto_updater
            .auto_update_profile_versions(
              &app_handle_for_update,
              &browser_for_update,
              latest_version,
            )
            .await
          {
            Ok(updated) => {
              if !updated.is_empty() {
                log::info!(
                  "Auto-updated {} profiles after stop: {:?}",
                  updated.len(),
                  updated
                );
              }
            }
            Err(e) => {
              log::error!("Failed to auto-update profile versions after stop: {e}");
            }
          }
        }

        match registry.cleanup_unused_binaries() {
          Ok(cleaned) => {
            if !cleaned.is_empty() {
              log::info!("Cleaned up unused binaries after stop: {:?}", cleaned);
            }
          }
          Err(e) => {
            log::error!("Failed to cleanup unused binaries after stop: {e}");
          }
        }
      });

      Ok(())
    }
    Err(e) => {
      log::info!("Failed to kill browser profile {}: {}", profile.name, e);
      if let Err(audit_err) = events::emit_audit_event(
        "stop",
        "profile",
        Some(&profile.id.to_string()),
        "failed",
        Some(&format!("Failed to stop profile '{}': {}", profile.name, e)),
      ) {
        log::warn!("Failed to emit audit event for profile stop failure: {audit_err}");
      }

      // Emit a failure event to clear loading states in the frontend
      #[derive(serde::Serialize)]
      struct RunningChangedPayload {
        id: String,
        is_running: bool,
      }
      // On kill failure, we assume the process is still running
      let payload = RunningChangedPayload {
        id: profile.id.to_string(),
        is_running: true,
      };

      if let Err(e) = events::emit("profile-running-changed", &payload) {
        log::warn!("Warning: Failed to emit profile running changed event: {e}");
      }

      let _ = browser_runner.set_profile_runtime_state(profile.id, RuntimeState::Error);

      Err(format!("Failed to kill browser: {e}"))
    }
  }
}

pub async fn launch_browser_profile_with_debugging(
  app_handle: tauri::AppHandle,
  profile: BrowserProfile,
  url: Option<String>,
  remote_debugging_port: Option<u16>,
  headless: bool,
) -> Result<BrowserProfile, String> {
  if profile.is_cross_os() {
    return Err(format!(
      "Cannot launch profile '{}': it was created on {} and is not supported on this system",
      profile.name,
      profile.host_os.as_deref().unwrap_or("unknown")
    ));
  }

  let browser_runner = BrowserRunner::instance();
  let latest_profile = browser_runner
    .profile_manager
    .list_profiles()
    .ok()
    .and_then(|profiles| profiles.into_iter().find(|p| p.id == profile.id))
    .unwrap_or(profile);

  crate::team_lock::acquire_team_lock_if_needed(&latest_profile).await?;
  let should_release_lock_on_error =
    latest_profile.is_sync_enabled() && crate::cloud_auth::CLOUD_AUTH.is_on_team_plan().await;

  let _ = browser_runner.set_profile_runtime_state(latest_profile.id, RuntimeState::Starting);

  let result = browser_runner
    .launch_browser_with_debugging(
      app_handle,
      &latest_profile,
      url,
      remote_debugging_port,
      headless,
    )
    .await;

  match result {
    Ok(updated_profile) => {
      if updated_profile.is_sync_enabled() {
        if let Some(scheduler) = crate::sync::get_global_scheduler() {
          let profile_id = updated_profile.id.to_string();
          scheduler.mark_profile_running(&profile_id).await;
          scheduler.queue_profile_sync(profile_id).await;
        }
      }
      Ok(updated_profile)
    }
    Err(e) => {
      let _ = browser_runner.set_profile_runtime_state(latest_profile.id, RuntimeState::Error);
      if should_release_lock_on_error {
        crate::team_lock::release_team_lock_if_needed(&latest_profile).await;
      }
      Err(format!("Failed to launch browser with debugging: {e}"))
    }
  }
}

#[tauri::command]
pub async fn open_url_with_profile(
  app_handle: tauri::AppHandle,
  profile_id: String,
  url: String,
) -> Result<(), String> {
  let browser_runner = BrowserRunner::instance();
  browser_runner
    .open_url_with_profile(app_handle, profile_id, url)
    .await
}

// Global singleton instance
lazy_static::lazy_static! {
  static ref BROWSER_RUNNER: BrowserRunner = BrowserRunner::new();
  static ref PROFILE_LAUNCH_IN_FLIGHT: Mutex<HashSet<String>> = Mutex::new(HashSet::new());
}
