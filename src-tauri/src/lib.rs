// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use calamine::{open_workbook_auto, Data, Reader};
use chrono::Utc;
use std::collections::{BTreeMap, HashMap};
use std::env;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_log::{Target, TargetKind};

// Store pending URLs that need to be handled when the window is ready
static PENDING_URLS: Mutex<Vec<String>> = Mutex::new(Vec::new());
// Prevent duplicate probe starts for the same profile within a short window.
lazy_static::lazy_static! {
  static ref TIKTOK_PROBE_LAUNCH_GUARD: Mutex<HashMap<String, Instant>> = Mutex::new(HashMap::new());
}

fn is_app_auto_update_enabled() -> bool {
  match env::var("BUGLOGIN_APP_AUTO_UPDATE_ENABLED") {
    Ok(raw) => {
      let value = raw.trim().to_ascii_lowercase();
      matches!(value.as_str(), "1" | "true" | "yes" | "on")
    }
    Err(_) => false,
  }
}

fn compute_main_window_geometry<R: Runtime>(app: &tauri::App<R>) -> (f64, f64, f64, f64) {
  const DEFAULT_WIDTH: f64 = 1280.0;
  const DEFAULT_HEIGHT: f64 = 760.0;
  const MIN_WIDTH: f64 = 980.0;
  const MIN_HEIGHT: f64 = 680.0;
  const WORK_AREA_WIDTH_RATIO: f64 = 0.78;
  const WORK_AREA_HEIGHT_RATIO: f64 = 0.72;
  const EDGE_PADDING_X: f64 = 20.0;
  const EDGE_PADDING_TOP: f64 = 20.0;
  const EDGE_PADDING_BOTTOM: f64 = 36.0;

  let Ok(Some(monitor)) = app.primary_monitor() else {
    return (DEFAULT_WIDTH, DEFAULT_HEIGHT, 80.0, 48.0);
  };

  let work_area = monitor.work_area();
  let scale_factor = monitor.scale_factor().max(1.0);
  let work_width = f64::from(work_area.size.width) / scale_factor;
  let work_height = f64::from(work_area.size.height) / scale_factor;
  let work_x = f64::from(work_area.position.x) / scale_factor;
  let work_y = f64::from(work_area.position.y) / scale_factor;

  let max_width = (work_width - EDGE_PADDING_X * 2.0).floor().max(MIN_WIDTH);
  let max_height = (work_height - EDGE_PADDING_TOP - EDGE_PADDING_BOTTOM)
    .floor()
    .max(MIN_HEIGHT);

  let width = (work_width * WORK_AREA_WIDTH_RATIO)
    .floor()
    .max(MIN_WIDTH)
    .min(max_width);
  let height = (work_height * WORK_AREA_HEIGHT_RATIO)
    .floor()
    .max(MIN_HEIGHT)
    .min(max_height);

  let x = work_x + ((work_width - width) / 2.0).max(EDGE_PADDING_X);
  let y = work_y + ((work_height - height) / 2.0).max(EDGE_PADDING_TOP);

  (width, height, x.floor(), y.floor())
}

mod api_client;
mod api_server;
mod app_auto_updater;
pub mod app_dirs;
mod auto_updater;
mod browser;
mod browser_identity_extension;
mod browser_runner;
mod browser_version_manager;
mod browser_window;
pub mod camoufox;
mod camoufox_manager;
mod default_browser;
mod downloaded_browsers_registry;
mod downloader;
mod entitlement;
mod ephemeral_dirs;
mod extension_manager;
mod extraction;
mod geoip_downloader;
mod group_manager;
mod ip_utils;
mod platform_browser;
mod profile;
mod profile_importer;
mod proxy_manager;
pub mod proxy_runner;
pub mod proxy_server;
pub mod proxy_storage;
mod settings_manager;
pub mod sync;
pub mod traffic_stats;
mod wayfern_manager;
mod wayfern_terms;
// mod theme_detector; // removed: theme detection handled in webview via CSS prefers-color-scheme
pub mod app_config;
pub mod cloud_auth;
mod cookie_manager;
pub mod daemon;
pub mod daemon_client;
mod daemon_spawn;
pub mod daemon_ws;
pub mod events;
mod local_control_server;
mod mcp_server;
mod tag_manager;
mod team_lock;
pub mod vault_password;
mod version_updater;
pub mod vpn;
pub mod vpn_worker_runner;
pub mod vpn_worker_storage;

use browser_runner::{
  check_browser_exists, check_camoufox_ua_version_alignment, get_browser_runtime_diagnostics,
  kill_browser_profile, launch_browser_profile, launch_browser_profile_by_id,
  open_url_with_profile, park_browser_profile,
};

use profile::manager::{
  check_browser_status, check_browser_statuses_batch, clone_profile, create_browser_profile_new,
  delete_profile, list_browser_profiles, list_browser_profiles_light, rename_profile,
  update_camoufox_config, update_profile_note, update_profile_proxy,
  update_profile_proxy_bypass_rules, update_profile_tags, update_profile_vpn,
  update_profiles_proxy, update_profiles_vpn, update_wayfern_config,
};

use browser_version_manager::{
  fetch_browser_versions_cached_first, fetch_browser_versions_with_count,
  fetch_browser_versions_with_count_cached_first, get_browser_update_requirement,
  get_supported_browsers, is_browser_supported_on_platform,
};

use downloaded_browsers_registry::{
  check_missing_binaries, ensure_active_browsers_downloaded, ensure_all_binaries_exist,
  get_downloaded_browser_versions,
};

use downloader::{cancel_download, download_browser};

use settings_manager::{
  decline_launch_on_login, dismiss_window_resize_warning, enable_launch_on_login,
  get_app_access_token_state, get_app_settings, get_sync_settings, get_system_language,
  get_table_sorting_settings, get_window_resize_warning_dismissed, save_app_access_token,
  save_app_settings, save_sync_settings, save_table_sorting_settings,
  should_show_launch_on_login_prompt,
};

use sync::{
  check_has_e2e_password, delete_e2e_password, enable_sync_for_all_entities,
  get_groups_in_use_by_synced_profiles, get_proxies_in_use_by_synced_profiles,
  get_unsynced_entity_counts, get_vpns_in_use_by_synced_profiles,
  is_group_in_use_by_synced_profile, is_proxy_in_use_by_synced_profile,
  is_vpn_in_use_by_synced_profile, list_remote_workspace_profile_ids,
  pull_workspace_profiles, request_profile_sync, set_e2e_password,
  set_extension_group_sync_enabled, set_extension_sync_enabled, set_group_sync_enabled,
  set_profile_sync_mode, set_proxy_sync_enabled, set_vpn_sync_enabled,
};

use tag_manager::get_all_tags;

use default_browser::{is_default_browser, set_as_default_browser};

use version_updater::{
  clear_all_version_cache_and_refetch, get_version_update_status, get_version_updater,
  trigger_manual_version_update,
};

use app_auto_updater::{
  check_for_app_updates, check_for_app_updates_manual, download_and_prepare_app_update,
  restart_application,
};
use auto_updater::{
  check_for_browser_updates, complete_browser_update_with_auto_update, dismiss_update_notification,
};

use profile_importer::{detect_existing_profiles, import_browser_profile};

use extension_manager::{
  add_extension, add_extension_to_group, assign_extension_group_to_profile,
  assign_extension_group_to_profiles, create_extension_group, delete_extension,
  delete_extension_group, get_extension_group_for_profile, list_extension_groups, list_extensions,
  remove_extension_from_group, update_extension, update_extension_group,
};

use group_manager::{
  assign_profiles_to_group, create_profile_group, delete_profile_group, delete_selected_profiles,
  get_groups_with_profile_counts, get_profile_groups, update_profile_group,
};

use geoip_downloader::{check_missing_geoip_database, GeoIPDownloader};

use browser_version_manager::get_browser_release_types;

use api_server::{get_api_server_status, start_api_server, stop_api_server};

// Trait to extend WebviewWindow with transparent titlebar functionality
pub trait WindowExt {
  #[cfg(target_os = "macos")]
  fn set_transparent_titlebar(&self, transparent: bool) -> Result<(), String>;
}

impl<R: Runtime> WindowExt for WebviewWindow<R> {
  #[cfg(target_os = "macos")]
  fn set_transparent_titlebar(&self, transparent: bool) -> Result<(), String> {
    use objc2::rc::Retained;
    use objc2_app_kit::{NSWindow, NSWindowStyleMask, NSWindowTitleVisibility};

    unsafe {
      let ns_window: Retained<NSWindow> =
        Retained::retain(self.ns_window().unwrap().cast()).unwrap();

      if transparent {
        // Hide the title text
        ns_window.setTitleVisibility(NSWindowTitleVisibility(2)); // NSWindowTitleHidden

        // Make titlebar transparent
        ns_window.setTitlebarAppearsTransparent(true);

        // Set full size content view
        let current_mask = ns_window.styleMask();
        let new_mask = NSWindowStyleMask(current_mask.0 | (1 << 15)); // NSFullSizeContentViewWindowMask
        ns_window.setStyleMask(new_mask);
      } else {
        // Show the title text
        ns_window.setTitleVisibility(NSWindowTitleVisibility(0)); // NSWindowTitleVisible

        // Make titlebar opaque
        ns_window.setTitlebarAppearsTransparent(false);

        // Remove full size content view
        let current_mask = ns_window.styleMask();
        let new_mask = NSWindowStyleMask(current_mask.0 & !(1 << 15));
        ns_window.setStyleMask(new_mask);
      }
    }

    Ok(())
  }
}

#[tauri::command]
async fn handle_url_open(app: tauri::AppHandle, url: String) -> Result<(), String> {
  log::info!("handle_url_open called with URL: {url}");

  // Check if the main window exists and is ready
  if let Some(window) = app.get_webview_window("main") {
    log::debug!("Main window exists");

    // Try to show and focus the window first
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.unminimize();

    events::emit("show-profile-selector", url.clone())
      .map_err(|e| format!("Failed to emit URL open event: {e}"))?;
  } else {
    // Window doesn't exist yet - add to pending URLs
    log::debug!("Main window doesn't exist, adding URL to pending list");
    let mut pending = PENDING_URLS.lock().unwrap();
    pending.push(url);
  }

  Ok(())
}

#[tauri::command]
async fn create_stored_proxy(
  app_handle: tauri::AppHandle,
  name: String,
  proxy_settings: crate::browser::ProxySettings,
) -> Result<crate::proxy_manager::StoredProxy, String> {
  crate::proxy_manager::PROXY_MANAGER
    .create_stored_proxy(&app_handle, name, proxy_settings)
    .map_err(|e| format!("Failed to create stored proxy: {e}"))
}

#[tauri::command]
async fn get_stored_proxies() -> Result<Vec<crate::proxy_manager::StoredProxy>, String> {
  Ok(crate::proxy_manager::PROXY_MANAGER.get_stored_proxies())
}

#[tauri::command]
async fn update_stored_proxy(
  app_handle: tauri::AppHandle,
  proxy_id: String,
  name: Option<String>,
  proxy_settings: Option<crate::browser::ProxySettings>,
) -> Result<crate::proxy_manager::StoredProxy, String> {
  crate::proxy_manager::PROXY_MANAGER
    .update_stored_proxy(&app_handle, &proxy_id, name, proxy_settings)
    .map_err(|e| format!("Failed to update stored proxy: {e}"))
}

#[tauri::command]
async fn delete_stored_proxy(app_handle: tauri::AppHandle, proxy_id: String) -> Result<(), String> {
  crate::proxy_manager::PROXY_MANAGER
    .delete_stored_proxy(&app_handle, &proxy_id)
    .map_err(|e| format!("Failed to delete stored proxy: {e}"))
}

#[tauri::command]
async fn check_proxy_validity(
  proxy_id: String,
  proxy_settings: crate::browser::ProxySettings,
) -> Result<crate::proxy_manager::ProxyCheckResult, String> {
  crate::proxy_manager::PROXY_MANAGER
    .check_proxy_validity(&proxy_id, &proxy_settings)
    .await
}

#[tauri::command]
async fn benchmark_proxy_protocols(
  host: String,
  port: u16,
  username: Option<String>,
  password: Option<String>,
) -> Result<crate::proxy_manager::ProxyProtocolBenchmark, String> {
  Ok(
    crate::proxy_manager::PROXY_MANAGER
      .benchmark_proxy_protocols(host, port, username, password)
      .await,
  )
}

#[tauri::command]
fn get_cached_proxy_check(proxy_id: String) -> Option<crate::proxy_manager::ProxyCheckResult> {
  crate::proxy_manager::PROXY_MANAGER.get_cached_proxy_check(&proxy_id)
}

#[tauri::command]
fn get_cached_proxy_checks(
  proxy_ids: Vec<String>,
) -> std::collections::HashMap<String, crate::proxy_manager::ProxyCheckResult> {
  crate::proxy_manager::PROXY_MANAGER.get_cached_proxy_checks(&proxy_ids)
}

#[tauri::command]
fn export_proxies(format: String) -> Result<String, String> {
  match format.as_str() {
    "json" => crate::proxy_manager::PROXY_MANAGER.export_proxies_json(),
    "txt" => Ok(crate::proxy_manager::PROXY_MANAGER.export_proxies_txt()),
    _ => Err(format!("Unsupported export format: {format}")),
  }
}

#[tauri::command]
async fn import_proxies_json(
  app_handle: tauri::AppHandle,
  content: String,
) -> Result<crate::proxy_manager::ProxyImportResult, String> {
  crate::proxy_manager::PROXY_MANAGER
    .import_proxies_json(&app_handle, &content)
    .map_err(|e| format!("Failed to import proxies: {e}"))
}

#[tauri::command]
fn parse_txt_proxies(content: String) -> Vec<crate::proxy_manager::ProxyParseResult> {
  crate::proxy_manager::ProxyManager::parse_txt_proxies(&content)
}

#[tauri::command]
async fn import_proxies_from_parsed(
  app_handle: tauri::AppHandle,
  parsed_proxies: Vec<crate::proxy_manager::ParsedProxyLine>,
  name_prefix: Option<String>,
) -> Result<crate::proxy_manager::ProxyImportResult, String> {
  crate::proxy_manager::PROXY_MANAGER
    .import_proxies_from_parsed(&app_handle, parsed_proxies, name_prefix)
    .map_err(|e| format!("Failed to import proxies: {e}"))
}

#[tauri::command]
fn read_profile_cookies(profile_id: String) -> Result<cookie_manager::CookieReadResult, String> {
  cookie_manager::CookieManager::read_cookies(&profile_id)
}

#[tauri::command]
fn read_profile_cookies_bulk(
  profile_ids: Vec<String>,
) -> std::collections::HashMap<String, cookie_manager::CookieReadResult> {
  let mut rows = std::collections::HashMap::new();
  for profile_id in profile_ids {
    if let Ok(cookie_row) = cookie_manager::CookieManager::read_cookies(&profile_id) {
      rows.insert(profile_id, cookie_row);
    }
  }
  rows
}

#[tauri::command]
fn read_profile_tiktok_cookie_headers_bulk(
  profile_ids: Vec<String>,
) -> std::collections::HashMap<String, String> {
  let mut rows = std::collections::HashMap::new();
  for profile_id in profile_ids {
    if let Ok(cookie_header) = cookie_manager::CookieManager::read_tiktok_cookie_header(&profile_id)
    {
      rows.insert(profile_id, cookie_header);
    }
  }
  rows
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TiktokSellerRuntimeStepSnapshot {
  found: bool,
  current_url: Option<String>,
  current_title: Option<String>,
  detected_step: Option<String>,
  detected_outcome: Option<String>,
}

fn query_latest_firefox_url(db_path: &Path) -> Result<Option<(String, Option<String>)>, String> {
  let conn = rusqlite::Connection::open(db_path)
    .map_err(|error| format!("Failed to open places.sqlite: {error}"))?;

  let mut stmt = conn
    .prepare(
      "SELECT url, title
       FROM moz_places
       WHERE last_visit_date IS NOT NULL
       ORDER BY last_visit_date DESC
       LIMIT 40",
    )
    .map_err(|error| format!("Failed to prepare places query: {error}"))?;

  let mut rows = stmt
    .query([])
    .map_err(|error| format!("Failed to query places.sqlite: {error}"))?;

  let mut fallback: Option<(String, Option<String>)> = None;
  while let Some(row) = rows
    .next()
    .map_err(|error| format!("Failed to read places row: {error}"))?
  {
    let url: String = row.get(0).unwrap_or_default();
    let title: Option<String> = row.get(1).ok();
    if url.trim().is_empty() {
      continue;
    }
    let lowered = url.to_ascii_lowercase();
    if lowered.contains("seller-us.tiktok.com") {
      return Ok(Some((url, title)));
    }
    if fallback.is_none() && lowered.contains("tiktok.com") {
      fallback = Some((url, title));
    }
  }
  Ok(fallback)
}

fn detect_seller_step_from_url_title(
  url: Option<&str>,
  title: Option<&str>,
) -> (Option<String>, Option<String>) {
  let normalized_url = url
    .map(|value| value.trim().to_ascii_lowercase())
    .unwrap_or_default();
  let normalized_title = title
    .map(|value| value.trim().to_ascii_lowercase())
    .unwrap_or_default();
  let combined = format!("{normalized_url} {normalized_title}");

  if combined.contains("application rejected")
    || combined.contains("rejected")
    || combined.contains("onboard_form_status=rejected")
  {
    return (
      Some("setup".to_string()),
      Some("application_rejected".to_string()),
    );
  }

  if combined.contains("under review")
    || combined.contains("onboard_form_status=review")
    || combined.contains("onboard_form_status=under_review")
  {
    return (Some("setup".to_string()), Some("under_review".to_string()));
  }

  if combined.contains("more information")
    || combined.contains("information required")
    || combined.contains("onboard_form_status=more_information")
  {
    return (
      Some("setup".to_string()),
      Some("more_information".to_string()),
    );
  }

  if normalized_url.contains("/account/register") {
    if combined.contains("verification code") || combined.contains("enter code") {
      return (Some("verify_otp".to_string()), None);
    }
    return (Some("register_opened".to_string()), None);
  }

  if normalized_url.contains("/login") {
    return (Some("register_opened".to_string()), None);
  }

  if normalized_url.contains("/settle/verification") {
    if combined.contains("upload")
      || combined.contains("document")
      || combined.contains("supporting file")
    {
      return (Some("upload_pdf".to_string()), None);
    }
    if combined.contains("verify business") || combined.contains("business details") {
      return (Some("verify_business".to_string()), None);
    }
    return (Some("legal_form".to_string()), None);
  }

  if normalized_url.contains("sellercenter")
    || normalized_url.contains("/home")
    || normalized_url.contains("/dashboard")
  {
    return (Some("setup".to_string()), None);
  }

  if combined.contains("seller") && combined.contains("sole") && combined.contains("proprietorship")
  {
    return (Some("legal_form".to_string()), None);
  }

  if combined.contains("verify") && combined.contains("business") && combined.contains("details") {
    return (Some("verify_business".to_string()), None);
  }

  (None, None)
}

#[tauri::command]
fn detect_tiktok_seller_runtime_step(
  profile_id: String,
) -> Result<TiktokSellerRuntimeStepSnapshot, String> {
  let parsed_profile_id = uuid::Uuid::parse_str(profile_id.trim())
    .map_err(|error| format!("Invalid profile id: {error}"))?;

  let profile_manager = crate::profile::manager::ProfileManager::instance();
  let profile = profile_manager
    .get_profile_by_id(&parsed_profile_id)
    .map_err(|error| format!("Failed to load profile: {error}"))?
    .ok_or_else(|| "Profile not found".to_string())?;

  let profiles_dir = profile_manager.get_profiles_dir();
  let effective_profile_path =
    crate::ephemeral_dirs::get_effective_profile_path(&profile, &profiles_dir);

  let db_path = match profile.browser.as_str() {
    "camoufox" | "bugox" => effective_profile_path.join("places.sqlite"),
    "wayfern" | "bugium" => effective_profile_path.join("Default").join("History"),
    _ => effective_profile_path.join("places.sqlite"),
  };

  if !db_path.exists() {
    return Ok(TiktokSellerRuntimeStepSnapshot {
      found: false,
      current_url: None,
      current_title: None,
      detected_step: None,
      detected_outcome: None,
    });
  }

  let latest = query_latest_firefox_url(&db_path).unwrap_or(None);
  let Some((current_url, current_title)) = latest else {
    return Ok(TiktokSellerRuntimeStepSnapshot {
      found: false,
      current_url: None,
      current_title: None,
      detected_step: None,
      detected_outcome: None,
    });
  };

  let (detected_step, detected_outcome) =
    detect_seller_step_from_url_title(Some(current_url.as_str()), current_title.as_deref());

  Ok(TiktokSellerRuntimeStepSnapshot {
    found: true,
    current_url: Some(current_url),
    current_title,
    detected_step,
    detected_outcome,
  })
}

#[tauri::command]
async fn copy_profile_cookies(
  app_handle: tauri::AppHandle,
  request: cookie_manager::CookieCopyRequest,
) -> Result<Vec<cookie_manager::CookieCopyResult>, String> {
  if !crate::cloud_auth::CLOUD_AUTH
    .has_active_paid_subscription()
    .await
  {
    return Err("Cookie copying requires an active Pro subscription".to_string());
  }
  cookie_manager::CookieManager::copy_cookies(&app_handle, request).await
}

#[tauri::command]
async fn import_cookies_from_file(
  app_handle: tauri::AppHandle,
  profile_id: String,
  content: String,
) -> Result<cookie_manager::CookieImportResult, String> {
  cookie_manager::CookieManager::import_cookies(&app_handle, &profile_id, &content).await
}

#[tauri::command]
async fn export_profile_cookies(profile_id: String, format: String) -> Result<String, String> {
  if !crate::cloud_auth::CLOUD_AUTH
    .has_active_paid_subscription()
    .await
  {
    return Err("Cookie export requires an active Pro subscription".to_string());
  }
  cookie_manager::CookieManager::export_cookies(&profile_id, &format)
}

#[tauri::command]
async fn bugidea_tiktok_request(
  method: String,
  path: String,
  bearer_token: String,
  base_url: Option<String>,
  body: Option<serde_json::Value>,
) -> Result<serde_json::Value, String> {
  let normalized_path = path.trim();
  if normalized_path.is_empty() || !normalized_path.starts_with("/api/tiktok-cookies") {
    return Err("Invalid BugIdea path".to_string());
  }

  let token = bearer_token.trim();
  if token.is_empty() {
    return Err("BugIdea bearer token is required".to_string());
  }

  let http_method = reqwest::Method::from_bytes(method.trim().as_bytes())
    .map_err(|error| format!("Invalid HTTP method: {error}"))?;
  let configured_base_url = base_url
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToOwned::to_owned)
    .or_else(|| {
      env::var("BUGIDEA_BASE_URL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    })
    .unwrap_or_else(|| "https://bugidea.com".to_string());
  let timeout_seconds = env::var("BUGIDEA_TIMEOUT_SECONDS")
    .ok()
    .and_then(|raw| raw.trim().parse::<u64>().ok())
    .map(|value| value.clamp(5, 120))
    .unwrap_or(20);
  let insecure_tls = env::var("BUGIDEA_INSECURE_TLS")
    .ok()
    .map(|raw| {
      let normalized = raw.trim().to_ascii_lowercase();
      matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
    })
    .unwrap_or(false);
  let allow_http_fallback = env::var("BUGIDEA_ALLOW_HTTP_FALLBACK")
    .ok()
    .map(|raw| {
      let normalized = raw.trim().to_ascii_lowercase();
      matches!(normalized.as_str(), "1" | "true" | "yes" | "on")
    })
    .unwrap_or(false);
  let https_url = format!(
    "{}{}",
    configured_base_url.trim_end_matches('/'),
    normalized_path
  );
  let http_fallback_url = if allow_http_fallback {
    https_url
      .strip_prefix("https://")
      .map(|rest| format!("http://{rest}"))
  } else {
    None
  };

  let client = reqwest::Client::builder()
    .user_agent("BugLogin/0.17.0")
    .connect_timeout(std::time::Duration::from_secs(8))
    .timeout(std::time::Duration::from_secs(timeout_seconds))
    .danger_accept_invalid_certs(insecure_tls)
    .build()
    .map_err(|error| format!("Failed to build BugIdea HTTP client: {error}"))?;

  let urls = if let Some(http_url) = http_fallback_url {
    vec![https_url, http_url]
  } else {
    vec![https_url]
  };
  let max_attempts: usize = 3;
  let mut last_error: Option<String> = None;

  for (url_index, url) in urls.iter().enumerate() {
    for attempt in 1..=max_attempts {
      let mut request = client
        .request(http_method.clone(), url)
        .bearer_auth(token)
        .header(reqwest::header::ACCEPT, "application/json");

      if let Some(payload) = &body {
        request = request.json(payload);
      }

      match request.send().await {
        Ok(response) => {
          let status = response.status();
          let text = response
            .text()
            .await
            .map_err(|error| format!("Failed to read BugIdea response: {error}"))?;

          if status.is_success() {
            if text.trim().is_empty() {
              return Ok(serde_json::Value::Null);
            }
            return serde_json::from_str(&text)
              .map_err(|error| format!("Invalid BugIdea JSON: {error}"));
          }

          let status_code = status.as_u16();
          let retryable_status =
            status_code == 408 || status_code == 425 || status_code == 429 || status_code >= 500;
          last_error = Some(format!("BugIdea {} [{}]: {}", status_code, url, text));
          if retryable_status && attempt < max_attempts {
            let backoff_ms = 300_u64.saturating_mul(attempt as u64);
            tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
            continue;
          }
          break;
        }
        Err(error) => {
          let message = error.to_string();
          let lowered = message.to_ascii_lowercase();
          let retryable_error = error.is_timeout()
            || error.is_connect()
            || lowered.contains("tls")
            || lowered.contains("ssl")
            || lowered.contains("handshake")
            || lowered.contains("connection reset")
            || lowered.contains("connection refused")
            || lowered.contains("eof");
          last_error = Some(format!("BugIdea request failed [{}]: {message}", url));
          if retryable_error && attempt < max_attempts {
            let backoff_ms = 300_u64.saturating_mul(attempt as u64);
            tokio::time::sleep(std::time::Duration::from_millis(backoff_ms)).await;
            continue;
          }
          break;
        }
      }
    }

    if last_error.is_none() && url_index + 1 < urls.len() {
      continue;
    }
  }

  Err(last_error.unwrap_or_else(|| "BugIdea request failed".to_string()))
}

#[derive(serde::Serialize)]
struct TiktokAccountCookieSourceRow {
  phone: String,
  api_phone: String,
  cookie: String,
}

fn spreadsheet_cell_to_string(cell: Option<&Data>) -> String {
  match cell {
    Some(Data::String(value)) => value.trim().to_string(),
    Some(Data::Float(value)) => {
      if value.fract() == 0.0 {
        format!("{value:.0}")
      } else {
        value.to_string()
      }
    }
    Some(Data::Int(value)) => value.to_string(),
    Some(Data::Bool(value)) => value.to_string(),
    Some(Data::DateTime(value)) => value.to_string(),
    Some(Data::DateTimeIso(value)) => value.trim().to_string(),
    Some(Data::DurationIso(value)) => value.trim().to_string(),
    Some(Data::Error(_)) | Some(Data::Empty) | None => String::new(),
  }
}

fn normalize_workbook_phone_like_value(value: &str) -> String {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return String::new();
  }

  let digits_only = trimmed
    .chars()
    .filter(|character| character.is_ascii_digit())
    .collect::<String>();
  if !digits_only.is_empty() && !trimmed.contains('@') && !trimmed.contains("://") {
    return digits_only;
  }

  if (trimmed.contains('e') || trimmed.contains('E'))
    && !trimmed.contains('@')
    && !trimmed.contains("://")
  {
    if let Ok(parsed) = trimmed.parse::<f64>() {
      if parsed.is_finite() {
        return format!("{parsed:.0}");
      }
    }
  }

  trimmed.to_string()
}

fn normalize_sheet_header(value: &str) -> String {
  value
    .trim()
    .to_lowercase()
    .replace('-', "_")
    .replace(' ', "_")
}

#[tauri::command]
fn read_tiktok_account_cookie_source(
  file_path: String,
) -> Result<Vec<TiktokAccountCookieSourceRow>, String> {
  let path = file_path.trim();
  if path.is_empty() {
    return Err("Cookie source file path is required".to_string());
  }

  let mut workbook = open_workbook_auto(path)
    .map_err(|error| format!("Failed to open cookie source workbook: {error}"))?;
  let mut rows_out: Vec<TiktokAccountCookieSourceRow> = Vec::new();

  for sheet_name in workbook.sheet_names().to_owned() {
    let range = workbook
      .worksheet_range(&sheet_name)
      .map_err(|error| format!("Failed to read sheet '{sheet_name}': {error}"))?;

    let mut rows = range.rows();
    let Some(header_row) = rows.next() else {
      continue;
    };

    let mut phone_index: Option<usize> = None;
    let mut api_phone_index: Option<usize> = None;
    let mut cookie_index: Option<usize> = None;

    for (index, cell) in header_row.iter().enumerate() {
      let header = normalize_sheet_header(&spreadsheet_cell_to_string(Some(cell)));
      if matches!(header.as_str(), "phone" | "phone_number" | "sdt") {
        phone_index = Some(index);
      } else if matches!(header.as_str(), "api_phone" | "api-phone" | "phone_api") {
        api_phone_index = Some(index);
      } else if matches!(
        header.as_str(),
        "cookie" | "cookie_tiktok" | "tiktok_cookie"
      ) {
        cookie_index = Some(index);
      }
    }

    let Some(cookie_col) = cookie_index else {
      continue;
    };

    for row in rows {
      let cookie = spreadsheet_cell_to_string(row.get(cookie_col));
      if cookie.trim().is_empty() {
        continue;
      }

      let phone = phone_index
        .and_then(|index| row.get(index))
        .map(|cell| spreadsheet_cell_to_string(Some(cell)))
        .map(|value| normalize_workbook_phone_like_value(&value))
        .unwrap_or_default();
      let api_phone = api_phone_index
        .and_then(|index| row.get(index))
        .map(|cell| spreadsheet_cell_to_string(Some(cell)))
        .map(|value| normalize_workbook_phone_like_value(&value))
        .unwrap_or_default();

      rows_out.push(TiktokAccountCookieSourceRow {
        phone,
        api_phone,
        cookie,
      });
    }
  }

  Ok(rows_out)
}

#[derive(serde::Serialize)]
struct TiktokSellerSeedRow {
  profile: String,
  phone: String,
  api_phone: String,
  email: String,
  password: String,
  api_mail: String,
  proxy: String,
  first_name: String,
  last_name: String,
  full_name: String,
  company_name: String,
  ein: String,
  ssn: String,
  dob: String,
  gender: String,
  address: String,
  city: String,
  state: String,
  zip: String,
  file: String,
  document_root: String,
  doc_type: String,
  raw: BTreeMap<String, String>,
}

fn normalize_seed_header(value: &str) -> String {
  value
    .trim()
    .replace('\u{feff}', "")
    .to_lowercase()
    .chars()
    .map(|c| if c.is_ascii_alphanumeric() { c } else { '_' })
    .collect::<String>()
    .trim_matches('_')
    .to_string()
}

fn detect_delimited_separator(line: &str) -> Option<char> {
  let comma_count = line.matches(',').count();
  let semicolon_count = line.matches(';').count();
  let tab_count = line.matches('\t').count();
  if comma_count == 0 && semicolon_count == 0 && tab_count == 0 {
    return None;
  }
  if tab_count >= comma_count && tab_count >= semicolon_count {
    return Some('\t');
  }
  if comma_count >= semicolon_count {
    return Some(',');
  }
  Some(';')
}

fn split_delimited_line(line: &str, separator: char) -> Vec<String> {
  let mut columns: Vec<String> = Vec::new();
  let mut current = String::new();
  let mut in_quotes = false;
  let chars: Vec<char> = line.chars().collect();
  let mut index = 0usize;

  while index < chars.len() {
    let ch = chars[index];
    if ch == '"' {
      if in_quotes && chars.get(index + 1) == Some(&'"') {
        current.push('"');
        index += 2;
        continue;
      }
      in_quotes = !in_quotes;
      index += 1;
      continue;
    }
    if !in_quotes && ch == separator {
      columns.push(current.trim().to_string());
      current.clear();
      index += 1;
      continue;
    }
    current.push(ch);
    index += 1;
  }

  columns.push(current.trim().to_string());
  columns
}

fn header_index(headers: &[String], candidates: &[&str]) -> Option<usize> {
  headers
    .iter()
    .position(|header| candidates.iter().any(|candidate| header == candidate))
}

fn row_has_seed_signal(row: &TiktokSellerSeedRow) -> bool {
  !row.profile.is_empty()
    || !row.proxy.is_empty()
    || !row.full_name.is_empty()
    || !row.company_name.is_empty()
    || !row.ein.is_empty()
    || !row.ssn.is_empty()
    || !row.address.is_empty()
    || !row.file.is_empty()
    || !row.document_root.is_empty()
    || !row.raw.is_empty()
    || !row.phone.is_empty()
    || !row.api_phone.is_empty()
    || !row.email.is_empty()
    || !row.api_mail.is_empty()
}

fn looks_like_profile_token(value: &str) -> bool {
  let trimmed = value.trim().to_ascii_lowercase();
  if trimmed.is_empty() {
    return false;
  }
  trimmed.starts_with("pt-") || trimmed.starts_with("pt_")
}

fn detect_seed_header_line(headers: &[String]) -> bool {
  if headers.is_empty() {
    return false;
  }
  let known_tokens = headers
    .iter()
    .filter(|header| {
      matches!(
        header.as_str(),
        "tinh_trang"
          | "note"
          | "proxy"
          | "profile"
          | "phone"
          | "pt_146"
          | "pt146"
          | "mail"
          | "hotmail"
          | "pass_mail"
          | "mail_khoi_phuc"
          | "2fa_mail"
          | "name"
          | "dob"
          | "gender"
          | "address"
          | "citi"
          | "bang"
          | "zip"
          | "ein"
          | "name_llc"
          | "info_llc"
          | "file"
          | "type"
      )
    })
    .count();
  known_tokens >= 2
}

fn row_has_seed_signal_legacy(row: &TiktokSellerSeedRow) -> bool {
  !row.phone.is_empty()
    || !row.api_phone.is_empty()
    || !row.email.is_empty()
    || !row.api_mail.is_empty()
}

fn normalize_seed_phone_like_value(value: &str) -> String {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return String::new();
  }
  if trimmed.contains('@') || trimmed.contains("://") {
    return trimmed.to_string();
  }
  let digits = trimmed
    .chars()
    .filter(|ch| ch.is_ascii_digit())
    .collect::<String>();
  if !digits.is_empty() {
    return digits;
  }
  trimmed.to_string()
}

fn extract_email_like_value(value: &str) -> String {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return String::new();
  }
  if trimmed.contains('|') {
    if let Some(part) = trimmed
      .split('|')
      .map(str::trim)
      .find(|part| !part.is_empty() && part.contains('@'))
    {
      return part.to_string();
    }
  }
  if trimmed.contains('@') {
    return trimmed.to_string();
  }
  String::new()
}

fn split_phone_with_api_hint(value: &str) -> (String, String) {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return (String::new(), String::new());
  }

  if let Some((left, right)) = trimmed.split_once("----") {
    let phone = normalize_seed_phone_like_value(left);
    let api_phone = right.trim().to_string();
    return (phone, api_phone);
  }

  (normalize_seed_phone_like_value(trimmed), String::new())
}

fn split_hotmail_bundle(value: &str) -> (String, String) {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    return (String::new(), String::new());
  }

  let parts = trimmed
    .split('|')
    .map(str::trim)
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>();
  if parts.is_empty() {
    return (String::new(), String::new());
  }

  let email = parts
    .iter()
    .find(|part| part.contains('@'))
    .map(|value| value.to_string())
    .unwrap_or_default();
  let api_mail = if parts.len() >= 3 {
    trimmed.to_string()
  } else {
    String::new()
  };
  (email, api_mail)
}

fn looks_like_uuid(value: &str) -> bool {
  let trimmed = value.trim();
  if trimmed.len() != 36 {
    return false;
  }
  let bytes = trimmed.as_bytes();
  for (index, byte) in bytes.iter().enumerate() {
    if matches!(index, 8 | 13 | 18 | 23) {
      if *byte != b'-' {
        return false;
      }
      continue;
    }
    if !(*byte as char).is_ascii_hexdigit() {
      return false;
    }
  }
  true
}

fn map_seed_row_from_columns(
  headers: &[String],
  columns: &[String],
  include_raw: bool,
) -> Option<TiktokSellerSeedRow> {
  let get = |index: Option<usize>| -> String {
    index
      .and_then(|idx| columns.get(idx))
      .map(|value| value.trim().to_string())
      .unwrap_or_default()
  };

  let mut profile = get(header_index(
    headers,
    &[
      "profile",
      "profile_name",
      "profile_code",
      "profile_id",
      "pt",
      "pt_code",
    ],
  ));
  let phone_raw = get(header_index(
    headers,
    &[
      "phone",
      "phone_number",
      "phone_no",
      "mobile",
      "mobile_number",
      "sdt",
      "pt_146",
      "pt146",
    ],
  ));
  let mut api_phone = get(header_index(
    headers,
    &[
      "api_phone",
      "api_phone_url",
      "phone_api",
      "phone_api_url",
      "api_sms_phone",
    ],
  ));
  let (phone, phone_api_hint) = split_phone_with_api_hint(&phone_raw);
  if api_phone.is_empty() && !phone_api_hint.is_empty() {
    api_phone = phone_api_hint;
  }

  let mut email = get(header_index(
    headers,
    &[
      "email",
      "mail",
      "email_address",
      "mail_address",
      "hotmail",
      "hot_mail",
      "outlook",
    ],
  ));
  let mut api_mail = get(header_index(
    headers,
    &[
      "api_mail",
      "api_email",
      "mail_api",
      "email_api",
      "api_mail_url",
      "api_email_url",
    ],
  ));
  let hotmail_bundle = get(header_index(headers, &["hotmail", "hot_mail", "outlook"]));
  let (hotmail_email, hotmail_api_mail) = split_hotmail_bundle(&hotmail_bundle);
  email = extract_email_like_value(&email);
  if email.is_empty() {
    email = hotmail_email;
  }
  if api_mail.is_empty() || looks_like_uuid(&api_mail) {
    api_mail = hotmail_api_mail;
  }
  let password = get(header_index(
    headers,
    &[
      "password",
      "pass",
      "pass_tiktok",
      "tiktok_password",
      "shop_password",
      "account_password",
    ],
  ));
  let proxy = get(header_index(
    headers,
    &[
      "proxy",
      "proxy_raw",
      "proxy_string",
      "proxy_full",
      "proxy_value",
    ],
  ));
  if profile.is_empty() && looks_like_profile_token(&proxy) {
    profile = proxy.clone();
  }
  let first_name = get(header_index(headers, &["first_name", "firstname", "first"]));
  let last_name = get(header_index(headers, &["last_name", "lastname", "last"]));
  let full_name = get(header_index(
    headers,
    &["full_name", "name", "contact_name"],
  ));
  let company_name = get(header_index(
    headers,
    &[
      "company_name",
      "business_name",
      "shop_name",
      "store_name",
      "entity_name",
      "name_llc",
      "llc_name",
    ],
  ));
  let ein = normalize_seed_phone_like_value(&get(header_index(
    headers,
    &["ein", "tax_id", "taxid", "tin"],
  )));
  let ssn = normalize_seed_phone_like_value(&get(header_index(
    headers,
    &["ssn", "social_security", "social_security_number"],
  )));
  let dob = get(header_index(
    headers,
    &["dob", "birth_date", "date_of_birth"],
  ));
  let gender = get(header_index(headers, &["gender", "sex"]));
  let address = get(header_index(
    headers,
    &[
      "address",
      "street_address",
      "business_address",
      "address_llc",
      "street",
    ],
  ));
  let city = get(header_index(
    headers,
    &["city", "citi", "city_llc", "citi_llc"],
  ));
  let state = get(header_index(
    headers,
    &["state", "bang", "state_llc", "bang_llc"],
  ));
  let zip = normalize_seed_phone_like_value(&get(header_index(
    headers,
    &["zip", "zip_code", "postal_code", "zip_llc"],
  )));
  let file = get(header_index(
    headers,
    &[
      "file",
      "pdf",
      "document",
      "document_file",
      "document_path",
      "doc_path",
      "pdf_path",
      "ein_pdf",
      "ssn_pdf",
    ],
  ));
  let document_root = get(header_index(
    headers,
    &[
      "document_root",
      "doc_root",
      "file_root",
      "pdf_root",
      "folder",
      "folder_path",
    ],
  ));
  let doc_type = get(header_index(
    headers,
    &["type", "file_type", "document_type", "doc_type"],
  ));

  let mut raw = BTreeMap::new();
  if include_raw {
    for (idx, header) in headers.iter().enumerate() {
      let value = columns.get(idx).cloned().unwrap_or_default();
      if !header.is_empty() && !value.trim().is_empty() {
        raw.insert(header.clone(), value.trim().to_string());
      }
    }
  }

  let mapped = TiktokSellerSeedRow {
    profile,
    phone,
    api_phone,
    email,
    password,
    api_mail,
    proxy,
    first_name,
    last_name,
    full_name,
    company_name,
    ein,
    ssn,
    dob,
    gender,
    address,
    city,
    state,
    zip,
    file,
    document_root,
    doc_type,
    raw,
  };

  if row_has_seed_signal(&mapped) || row_has_seed_signal_legacy(&mapped) {
    Some(mapped)
  } else {
    None
  }
}

fn parse_seed_rows_from_text(raw_text: &str) -> Vec<TiktokSellerSeedRow> {
  let lines = raw_text
    .split('\n')
    .map(|line| line.trim().trim_matches('\r'))
    .filter(|line| !line.is_empty())
    .collect::<Vec<_>>();
  if lines.is_empty() {
    return Vec::new();
  }

  let separator = detect_delimited_separator(lines[0]).unwrap_or(',');
  let header_candidates = split_delimited_line(lines[0], separator)
    .into_iter()
    .map(|value| normalize_seed_header(&value))
    .collect::<Vec<_>>();
  let phone_index = header_index(
    &header_candidates,
    &[
      "phone",
      "phone_number",
      "mobile",
      "mobile_number",
      "sdt",
      "pt_146",
      "pt146",
    ],
  );
  let email_index = header_index(
    &header_candidates,
    &[
      "email",
      "mail",
      "email_address",
      "mail_address",
      "hotmail",
      "hot_mail",
      "outlook",
    ],
  );
  let api_phone_index = header_index(
    &header_candidates,
    &["api_phone", "api_phone_url", "phone_api", "phone_api_url"],
  );
  let api_mail_index = header_index(
    &header_candidates,
    &["api_mail", "api_email", "mail_api", "email_api"],
  );
  let has_header = detect_seed_header_line(&header_candidates)
    || phone_index.is_some()
    || email_index.is_some()
    || api_phone_index.is_some()
    || api_mail_index.is_some();
  let data_lines = if has_header { &lines[1..] } else { &lines[..] };

  let mut rows = Vec::new();
  if has_header {
    for line in data_lines {
      let columns = split_delimited_line(line, separator);
      if let Some(row) = map_seed_row_from_columns(&header_candidates, &columns, true) {
        rows.push(row);
      }
    }
  } else {
    for token in raw_text
      .split(['\n', ',', ';', '\t', ' '])
      .map(str::trim)
      .filter(|token| !token.is_empty())
    {
      let normalized = normalize_seed_phone_like_value(token);
      if normalized.is_empty() {
        continue;
      }
      rows.push(TiktokSellerSeedRow {
        profile: String::new(),
        phone: normalized,
        api_phone: String::new(),
        email: String::new(),
        password: String::new(),
        api_mail: String::new(),
        proxy: String::new(),
        first_name: String::new(),
        last_name: String::new(),
        full_name: String::new(),
        company_name: String::new(),
        ein: String::new(),
        ssn: String::new(),
        dob: String::new(),
        gender: String::new(),
        address: String::new(),
        city: String::new(),
        state: String::new(),
        zip: String::new(),
        file: String::new(),
        document_root: String::new(),
        doc_type: String::new(),
        raw: BTreeMap::new(),
      });
    }
  }

  rows
}

#[tauri::command]
fn parse_tiktok_seller_seed_file(
  file_name: String,
  content_base64: String,
) -> Result<Vec<TiktokSellerSeedRow>, String> {
  use base64::Engine as _;

  let decoded_bytes = base64::engine::general_purpose::STANDARD
    .decode(content_base64.trim())
    .map_err(|error| format!("Failed to decode seed file bytes: {error}"))?;
  let lower_name = file_name.trim().to_lowercase();
  let parse_as_delimited =
    lower_name.ends_with(".csv") || lower_name.ends_with(".tsv") || lower_name.ends_with(".txt");

  if parse_as_delimited {
    let text = String::from_utf8_lossy(&decoded_bytes).to_string();
    return Ok(parse_seed_rows_from_text(&text));
  }

  let extension = lower_name
    .rsplit('.')
    .next()
    .filter(|ext| !ext.is_empty())
    .unwrap_or("xlsx");
  let mut temp_file = tempfile::Builder::new()
    .prefix("buglogin-seller-seed-")
    .suffix(&format!(".{extension}"))
    .tempfile()
    .map_err(|error| format!("Failed to create temp seed file: {error}"))?;
  temp_file
    .write_all(&decoded_bytes)
    .map_err(|error| format!("Failed to write temp seed file: {error}"))?;
  temp_file
    .flush()
    .map_err(|error| format!("Failed to flush temp seed file: {error}"))?;

  let mut workbook = open_workbook_auto(temp_file.path())
    .map_err(|error| format!("Failed to open seed workbook: {error}"))?;
  let mut parsed_rows: Vec<TiktokSellerSeedRow> = Vec::new();

  for sheet_name in workbook.sheet_names().to_owned() {
    let range = workbook
      .worksheet_range(&sheet_name)
      .map_err(|error| format!("Failed to read seed sheet '{sheet_name}': {error}"))?;
    let mut rows = range.rows();
    let Some(header_row) = rows.next() else {
      continue;
    };
    let headers = header_row
      .iter()
      .map(|cell| normalize_seed_header(&spreadsheet_cell_to_string(Some(cell))))
      .collect::<Vec<_>>();
    if headers.is_empty() {
      continue;
    }

    for row in rows {
      let columns = row
        .iter()
        .map(|cell| spreadsheet_cell_to_string(Some(cell)))
        .collect::<Vec<_>>();
      if let Some(parsed) = map_seed_row_from_columns(&headers, &columns, true) {
        parsed_rows.push(parsed);
      }
    }
  }

  Ok(parsed_rows)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct AutomationOutputRecordInput {
  workspace_id: String,
  run_id: Option<String>,
  flow_type: Option<String>,
  item_id: Option<String>,
  status: Option<String>,
  step: Option<String>,
  profile_id: Option<String>,
  profile_name: Option<String>,
  phone: Option<String>,
  api_phone: Option<String>,
  email: Option<String>,
  api_mail: Option<String>,
  payload: Option<serde_json::Value>,
  emitted_at: Option<String>,
}

#[derive(Debug, serde::Serialize)]
struct AutomationOutputAppendResult {
  written: bool,
  path: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct BundledExtensionPayload {
  file_name: String,
  file_data: Vec<u8>,
}

#[tauri::command]
fn get_bundled_omocaptcha_extension() -> Result<BundledExtensionPayload, String> {
  const OMO_FILE_NAME: &str = "omocaptcha_auto_solve_captcha-1.6.9.xpi";
  const OMO_FILE_BYTES: &[u8] =
    include_bytes!("../../assets/extensions/omocaptcha_auto_solve_captcha-1.6.9.xpi");

  Ok(BundledExtensionPayload {
    file_name: OMO_FILE_NAME.to_string(),
    file_data: OMO_FILE_BYTES.to_vec(),
  })
}

#[tauri::command]
fn append_automation_output_record(
  input: AutomationOutputRecordInput,
) -> Result<AutomationOutputAppendResult, String> {
  let settings = settings_manager::SettingsManager::instance()
    .load_settings()
    .map_err(|error| format!("Failed to load settings: {error}"))?;

  if !settings.automation_output_enabled {
    return Ok(AutomationOutputAppendResult {
      written: false,
      path: String::new(),
    });
  }

  let output_dir_raw = settings
    .automation_output_dir
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .ok_or_else(|| "automation_output_dir is not configured".to_string())?;
  let output_dir = PathBuf::from(output_dir_raw);
  fs::create_dir_all(&output_dir)
    .map_err(|error| format!("Failed to create automation output dir: {error}"))?;

  let day_stamp = Utc::now().format("%Y-%m-%d").to_string();
  let file_path = output_dir.join(format!("buglogin-automation-{day_stamp}.jsonl"));
  let emitted_at = input
    .emitted_at
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(ToString::to_string)
    .unwrap_or_else(|| Utc::now().to_rfc3339());

  let record = serde_json::json!({
    "emittedAt": emitted_at,
    "workspaceId": input.workspace_id,
    "runId": input.run_id,
    "flowType": input.flow_type,
    "itemId": input.item_id,
    "status": input.status,
    "step": input.step,
    "profileId": input.profile_id,
    "profileName": input.profile_name,
    "phone": input.phone,
    "apiPhone": input.api_phone,
    "email": input.email,
    "apiMail": input.api_mail,
    "payload": input.payload.unwrap_or(serde_json::Value::Null),
  });
  let line = serde_json::to_string(&record)
    .map_err(|error| format!("Failed to serialize automation output record: {error}"))?;

  let mut file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&file_path)
    .map_err(|error| format!("Failed to open automation output file: {error}"))?;
  file
    .write_all(format!("{line}\n").as_bytes())
    .map_err(|error| format!("Failed to append automation output file: {error}"))?;

  Ok(AutomationOutputAppendResult {
    written: true,
    path: file_path.to_string_lossy().to_string(),
  })
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StartTiktokProbeSessionInput {
  profile_id: Option<String>,
  profile_name: Option<String>,
  flow_type: Option<String>,
  start_url: Option<String>,
  browser_type: Option<String>,
  executable_path: Option<String>,
  proxy_url: Option<String>,
  headless: Option<bool>,
  max_duration_seconds: Option<u64>,
  seed_payload: Option<serde_json::Value>,
  user_data_dir: Option<String>,
  keep_open: Option<bool>,
  auto_best_effort: Option<bool>,
  contact_mode: Option<String>,
  entry_mode: Option<String>,
  ein_submit: Option<bool>,
  omo_key: Option<String>,
}

fn collect_pdf_files_recursive(
  root: &Path,
  entries: &mut Vec<String>,
  depth: usize,
) -> Result<(), String> {
  if depth > 24 {
    return Ok(());
  }
  let read_dir = fs::read_dir(root)
    .map_err(|error| format!("Failed to read directory '{}': {error}", root.display()))?;
  for item in read_dir {
    let entry = item.map_err(|error| format!("Failed to read directory entry: {error}"))?;
    let path = entry.path();
    let metadata = entry
      .metadata()
      .map_err(|error| format!("Failed to read metadata for '{}': {error}", path.display()))?;
    if metadata.is_dir() {
      collect_pdf_files_recursive(&path, entries, depth + 1)?;
      continue;
    }
    if !metadata.is_file() {
      continue;
    }
    let is_pdf = path
      .extension()
      .and_then(|ext| ext.to_str())
      .map(|ext| ext.eq_ignore_ascii_case("pdf"))
      .unwrap_or(false);
    if is_pdf {
      entries.push(path.to_string_lossy().to_string());
    }
  }
  Ok(())
}

#[tauri::command]
fn list_pdf_files_recursive(root_dir: String) -> Result<Vec<String>, String> {
  let normalized = root_dir.trim();
  if normalized.is_empty() {
    return Ok(Vec::new());
  }
  let root = PathBuf::from(normalized);
  if !root.exists() || !root.is_dir() {
    return Err(format!("Folder does not exist: {}", root.display()));
  }
  let mut entries = Vec::new();
  collect_pdf_files_recursive(&root, &mut entries, 0)?;
  entries.sort();
  entries.dedup();
  Ok(entries)
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct StartTiktokProbeSessionResult {
  started: bool,
  output_dir: String,
  pid: Option<u32>,
  command: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReadTiktokProbeProgressInput {
  output_dir: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TiktokProbeProgressSnapshot {
  found: bool,
  output_dir: String,
  is_running: bool,
  ended: bool,
  success_detected: bool,
  current_step: Option<String>,
  last_action: Option<String>,
  last_event_at: Option<String>,
  error: Option<String>,
}

fn slugify_probe_token(value: &str) -> String {
  let normalized = value
    .trim()
    .chars()
    .map(|ch| {
      if ch.is_ascii_alphanumeric() {
        ch.to_ascii_lowercase()
      } else {
        '_'
      }
    })
    .collect::<String>();
  let compact = normalized
    .split('_')
    .filter(|part| !part.is_empty())
    .collect::<Vec<_>>()
    .join("_");
  if compact.is_empty() {
    "probe".to_string()
  } else {
    compact
  }
}

fn resolve_probe_script_path() -> Result<PathBuf, String> {
  if let Ok(explicit) = env::var("BUGLOGIN_TIKTOK_PROBE_SCRIPT") {
    let explicit_path = PathBuf::from(explicit.trim());
    if explicit_path.exists() {
      return Ok(explicit_path);
    }
  }

  let cwd = env::current_dir().map_err(|error| format!("Failed to resolve cwd: {error}"))?;
  let candidates = [
    cwd.join("scripts/tiktok_seller_probe_session.mjs"),
    cwd.join("../scripts/tiktok_seller_probe_session.mjs"),
    cwd.join("scripts/tiktok_seller_probe_session.py"),
    cwd.join("../scripts/tiktok_seller_probe_session.py"),
  ];
  for candidate in candidates {
    if candidate.exists() {
      return Ok(candidate);
    }
  }
  Err("Probe script not found. Expected scripts/tiktok_seller_probe_session.py".to_string())
}

fn map_probe_step(stage: &str, action: &str) -> String {
  let normalized_stage = stage.trim().to_ascii_lowercase();
  let normalized_action = action.trim().to_ascii_lowercase();
  match (normalized_stage.as_str(), normalized_action.as_str()) {
    ("intent_question", "choose_intent_seller") => "seller_intent_choose".to_string(),
    ("intent_question", "submit_intent") => "seller_intent_submit".to_string(),
    ("business_type", "select_sole_proprietorship") => {
      "seller_business_type_select_sole".to_string()
    }
    ("business_type", "submit_business_type") => "seller_business_type_submit".to_string(),
    ("business_details", "fill_business_details") => "seller_business_details_fill".to_string(),
    ("business_details", "upload_supporting_document") => {
      "seller_business_details_upload_document".to_string()
    }
    ("business_details", "ready_to_verify_business_details") => {
      "seller_business_details_ready_no_submit".to_string()
    }
    ("register_entry", "fill_contact") => "seller_signup_fill_contact".to_string(),
    ("register_entry", "click_continue") => "seller_signup_submit_contact".to_string(),
    ("otp", "fill_otp") => "seller_signup_fill_otp".to_string(),
    ("otp", "submit_otp") => "seller_signup_submit_otp".to_string(),
    ("business_info", "fill_business_fields") => "seller_business_fill_fields".to_string(),
    ("business_info", "submit_business_step") => "seller_business_submit_step".to_string(),
    ("ein_verify", "fill_ein_step_fields") => "seller_ein_fill".to_string(),
    ("ein_verify", "upload_supporting_document") => "seller_ein_upload_document".to_string(),
    ("ein_verify", "fill_ein") => "seller_ein_fill".to_string(),
    ("ein_verify", "submit_verify") => "seller_ein_verify_submit".to_string(),
    ("blocked", _) => "seller_blocked_captcha_or_verify".to_string(),
    _ => {
      if normalized_stage.is_empty() {
        "seller_probe_running".to_string()
      } else if normalized_action.is_empty() {
        format!("seller_{}", normalized_stage)
      } else {
        format!("seller_{}_{}", normalized_stage, normalized_action)
      }
    }
  }
}

#[tauri::command]
fn read_tiktok_probe_progress(
  input: ReadTiktokProbeProgressInput,
) -> Result<TiktokProbeProgressSnapshot, String> {
  let output_dir = PathBuf::from(input.output_dir.trim());
  if !output_dir.exists() {
    return Ok(TiktokProbeProgressSnapshot {
      found: false,
      output_dir: output_dir.to_string_lossy().to_string(),
      is_running: false,
      ended: false,
      success_detected: false,
      current_step: None,
      last_action: None,
      last_event_at: None,
      error: None,
    });
  }

  let events_path = output_dir.join("events.jsonl");
  if !events_path.exists() {
    return Ok(TiktokProbeProgressSnapshot {
      found: true,
      output_dir: output_dir.to_string_lossy().to_string(),
      is_running: false,
      ended: false,
      success_detected: false,
      current_step: Some("seller_probe_started".to_string()),
      last_action: None,
      last_event_at: None,
      error: None,
    });
  }

  let mut current_step: Option<String> = None;
  let mut last_action: Option<String> = None;
  let mut last_event_at: Option<String> = None;
  let mut ended = false;
  let mut success_detected = false;
  let mut error: Option<String> = None;

  let content = fs::read_to_string(&events_path)
    .map_err(|err| format!("Failed to read probe events file: {err}"))?;
  for line in content.lines() {
    let trimmed = line.trim();
    if trimmed.is_empty() {
      continue;
    }
    let Ok(value) = serde_json::from_str::<serde_json::Value>(trimmed) else {
      continue;
    };
    let at = value
      .get("at")
      .and_then(|v| v.as_str())
      .map(|v| v.to_string());
    let kind = value
      .get("kind")
      .and_then(|v| v.as_str())
      .unwrap_or_default();
    if at.is_some() {
      last_event_at = at;
    }
    if kind == "auto_action" {
      let stage = value
        .get("stage")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
      let action = value
        .get("action")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
      current_step = Some(map_probe_step(stage, action));
      if !stage.is_empty() || !action.is_empty() {
        last_action = Some(format!("{stage}:{action}"));
      }
    }
    if kind == "auto_action" {
      let stage = value
        .get("stage")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
      let action = value
        .get("action")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
      let result = value
        .get("result")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();

      let explicit_completion = (stage == "completion"
        && (action == "signup_completed" || action == "onboarding_completed"))
        || (stage == "ein_verify" && action == "submit_verify" && result == "clicked");
      if explicit_completion {
        success_detected = true;
        current_step = Some("seller_signup_completed".to_string());
        last_action = Some(format!("{stage}:{action}"));
      }
    }
    if kind == "session_end" {
      ended = true;
    }
    if kind == "session_error" {
      ended = true;
      error = value
        .get("error")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
        .or_else(|| Some("seller_probe_session_error".to_string()));
    }
  }

  let is_running = if ended {
    false
  } else {
    match fs::metadata(&events_path).and_then(|meta| meta.modified()) {
      Ok(modified) => modified
        .elapsed()
        .map(|elapsed| elapsed.as_secs() <= 20)
        .unwrap_or(false),
      Err(_) => false,
    }
  };

  Ok(TiktokProbeProgressSnapshot {
    found: true,
    output_dir: output_dir.to_string_lossy().to_string(),
    is_running,
    ended,
    success_detected,
    current_step,
    last_action,
    last_event_at,
    error,
  })
}

#[tauri::command]
fn start_tiktok_probe_session(
  input: Option<StartTiktokProbeSessionInput>,
) -> Result<StartTiktokProbeSessionResult, String> {
  let input = input.ok_or_else(|| {
    "Missing required payload: input. Expected invoke('start_tiktok_probe_session', { input: {...} })."
      .to_string()
  })?;
  let launch_guard_key = input
    .profile_id
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(|value| format!("profile:{value}"))
    .or_else(|| {
      input
        .profile_name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("name:{value}"))
    })
    .unwrap_or_else(|| "unknown".to_string());
  {
    let mut guard = TIKTOK_PROBE_LAUNCH_GUARD
      .lock()
      .map_err(|error| format!("Failed to lock probe launch guard: {error}"))?;
    let now = Instant::now();
    guard.retain(|_, started_at| {
      now.saturating_duration_since(*started_at) < Duration::from_secs(120)
    });
    if let Some(previous) = guard.get(&launch_guard_key) {
      let elapsed = now.saturating_duration_since(*previous);
      if elapsed < Duration::from_secs(20) {
        return Err(format!(
          "Probe launch already in progress for this profile ({}s). Please wait a moment and retry.",
          elapsed.as_secs()
        ));
      }
    }
    guard.insert(launch_guard_key.clone(), now);
  }
  let settings = settings_manager::SettingsManager::instance()
    .load_settings()
    .map_err(|error| format!("Failed to load settings: {error}"))?;

  let base_output_dir = settings
    .automation_output_dir
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(PathBuf::from)
    .unwrap_or_else(|| env::temp_dir().join("buglogin").join("automation-output"));
  let profile_token = input
    .profile_name
    .as_deref()
    .or(input.profile_id.as_deref())
    .unwrap_or("profile");
  let profile_slug = slugify_probe_token(profile_token);
  let stamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
  let session_dir = base_output_dir
    .join("probes")
    .join(Utc::now().format("%Y-%m-%d").to_string())
    .join(format!("{stamp}-{profile_slug}"));
  fs::create_dir_all(&session_dir)
    .map_err(|error| format!("Failed to create probe output dir: {error}"))?;

  let mut resolved_user_data_dir = input
    .user_data_dir
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .map(|value| value.to_string());

  if let Some(profile_id_raw) = input.profile_id.as_deref().map(str::trim) {
    if let Ok(profile_uuid) = uuid::Uuid::parse_str(profile_id_raw) {
      let profile_manager = crate::profile::manager::ProfileManager::instance();
      if let Ok(Some(profile)) = profile_manager.get_profile_by_id(&profile_uuid) {
        let profiles_dir = profile_manager.get_profiles_dir();
        let effective_profile_path = if let Some(user_data_dir) = resolved_user_data_dir
          .as_deref()
          .map(str::trim)
          .filter(|value| !value.is_empty())
        {
          PathBuf::from(user_data_dir)
        } else {
          crate::ephemeral_dirs::get_effective_profile_path(&profile, &profiles_dir)
        };
        if resolved_user_data_dir.is_none() {
          resolved_user_data_dir = Some(effective_profile_path.to_string_lossy().to_string());
        }

        if profile.extension_group_id.is_some() {
          if let Ok(mgr) = crate::extension_manager::EXTENSION_MANAGER.lock() {
            if let Err(error) =
              mgr.install_extensions_for_profile(&profile, &effective_profile_path)
            {
              log::warn!(
                "Failed to install extensions for profile {} before probe launch: {}",
                profile.name,
                error
              );
            }
          }
        }

        if let Err(error) = crate::browser_identity_extension::ensure_runtime_identity_for_browser(
          &profile.browser,
          &effective_profile_path,
          &profile.name,
        ) {
          log::warn!(
            "Failed to ensure runtime identity extension for profile {} before probe launch: {}",
            profile.name,
            error
          );
        }
      }
    }
  }

  let seed_json = serde_json::json!({
    "profileId": input.profile_id,
    "profileName": input.profile_name,
    "flowType": input.flow_type,
    "startUrl": input.start_url,
    "browserType": input.browser_type,
    "executablePath": input.executable_path,
    "proxyUrl": input.proxy_url,
    "maxDurationSeconds": input.max_duration_seconds,
    "userDataDir": resolved_user_data_dir,
    "keepOpen": input.keep_open,
    "autoBestEffort": input.auto_best_effort,
    "contactMode": input.contact_mode,
    "entryMode": input.entry_mode,
    "einSubmit": input.ein_submit,
    "seedPayload": input.seed_payload,
    "createdAt": Utc::now().to_rfc3339(),
  });
  let seed_path = session_dir.join("seed.json");
  fs::write(
    &seed_path,
    serde_json::to_string_pretty(&seed_json)
      .map_err(|error| format!("Failed to serialize probe seed: {error}"))?,
  )
  .map_err(|error| format!("Failed to write probe seed file: {error}"))?;

  let script_path = resolve_probe_script_path()?;
  let script_extension = script_path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| ext.to_ascii_lowercase())
    .unwrap_or_default();
  let use_node_runtime = script_extension == "mjs" || script_extension == "js";
  let runtime_bin = if use_node_runtime {
    env::var("BUGLOGIN_NODE_PATH")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .unwrap_or_else(|| "node".to_string())
  } else {
    env::var("BUGLOGIN_PYTHON_PATH")
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
      .unwrap_or_else(|| "python".to_string())
  };

  let start_url = input
    .start_url
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
    .unwrap_or("https://seller-us.tiktok.com/account/register")
    .to_string();

  let browser_hint = input
    .browser_type
    .as_deref()
    .map(str::trim)
    .unwrap_or("firefox")
    .to_ascii_lowercase();
  let browser_type = match browser_hint.as_str() {
    "chromium" | "brave" => "chromium",
    _ => "firefox",
  };

  let mut command = Command::new(&runtime_bin);
  let headless = input.headless.unwrap_or(true);
  let headless_value = if headless { "true" } else { "false" };
  command.arg(&script_path);
  command.arg("--output-dir").arg(&session_dir);
  command.arg("--start-url").arg(start_url);
  command.arg("--browser-type").arg(browser_type);
  command.arg("--seed-file").arg(&seed_path);
  command.arg("--headless").arg(headless_value);
  if let Some(seconds) = input.max_duration_seconds {
    if seconds > 0 {
      command
        .arg("--max-duration-seconds")
        .arg(seconds.to_string());
    }
  }
  if let Some(executable_path) = input
    .executable_path
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
  {
    command.arg("--executable-path").arg(executable_path);
  }
  if let Some(proxy_url) = input
    .proxy_url
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
  {
    command.arg("--proxy").arg(proxy_url);
  }
  if let Some(user_data_dir) = resolved_user_data_dir
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
  {
    command.arg("--user-data-dir").arg(user_data_dir);
  }
  if let Some(keep_open) = input.keep_open {
    command
      .arg("--keep-open")
      .arg(if keep_open { "true" } else { "false" });
  }
  if let Some(auto_best_effort) = input.auto_best_effort {
    command
      .arg("--auto-best-effort")
      .arg(if auto_best_effort { "true" } else { "false" });
  }
  if let Some(contact_mode) = input
    .contact_mode
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
  {
    command.arg("--contact-mode").arg(contact_mode);
  }
  if let Some(entry_mode) = input
    .entry_mode
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
  {
    command.arg("--entry-mode").arg(entry_mode);
  }
  if let Some(ein_submit) = input.ein_submit {
    command
      .arg("--ein-submit")
      .arg(if ein_submit { "true" } else { "false" });
  }
  if let Some(omo_key) = input
    .omo_key
    .as_deref()
    .map(str::trim)
    .filter(|value| !value.is_empty())
  {
    command.arg("--omo-key").arg(omo_key);
  }

  let stdout_log = session_dir.join("probe.stdout.log");
  let stderr_log = session_dir.join("probe.stderr.log");
  let stdout_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&stdout_log)
    .map_err(|error| format!("Failed to open probe stdout log: {error}"))?;
  let stderr_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&stderr_log)
    .map_err(|error| format!("Failed to open probe stderr log: {error}"))?;
  command.stdout(Stdio::from(stdout_file));
  command.stderr(Stdio::from(stderr_file));
  command.stdin(Stdio::null());

  let rendered = format!(
    "{} {}",
    runtime_bin,
    [
      script_path.to_string_lossy().to_string(),
      "--output-dir".to_string(),
      session_dir.to_string_lossy().to_string(),
      "--start-url".to_string(),
      seed_json["startUrl"]
        .as_str()
        .unwrap_or_default()
        .to_string(),
      "--browser-type".to_string(),
      browser_type.to_string(),
      "--headless".to_string(),
      headless_value.to_string(),
      "--proxy".to_string(),
      input
        .proxy_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or_default()
        .to_string(),
    ]
    .join(" ")
  );

  let child = command
    .spawn()
    .map_err(|error| format!("Failed to start TikTok probe session: {error}"))?;

  Ok(StartTiktokProbeSessionResult {
    started: true,
    output_dir: session_dir.to_string_lossy().to_string(),
    pid: Some(child.id()),
    command: rendered,
  })
}

#[tauri::command]
fn check_wayfern_terms_accepted() -> bool {
  wayfern_terms::WayfernTermsManager::instance().is_terms_accepted()
}

#[tauri::command]
fn check_wayfern_downloaded() -> bool {
  wayfern_terms::WayfernTermsManager::instance().is_wayfern_downloaded()
}

#[tauri::command]
async fn accept_wayfern_terms() -> Result<(), String> {
  wayfern_terms::WayfernTermsManager::instance()
    .accept_terms()
    .await
}

#[tauri::command]
async fn start_mcp_server(app_handle: tauri::AppHandle) -> Result<u16, String> {
  mcp_server::McpServer::instance().start(app_handle).await
}

#[tauri::command]
async fn stop_mcp_server() -> Result<(), String> {
  mcp_server::McpServer::instance().stop().await
}

#[tauri::command]
fn get_mcp_server_status() -> bool {
  mcp_server::McpServer::instance().is_running()
}

#[derive(serde::Serialize)]
struct McpConfig {
  port: u16,
  token: String,
  config_json: String,
}

#[tauri::command]
async fn get_mcp_config(app_handle: tauri::AppHandle) -> Result<Option<McpConfig>, String> {
  let mcp_server = mcp_server::McpServer::instance();
  if !mcp_server.is_running() {
    return Ok(None);
  }

  let port = mcp_server
    .get_port()
    .ok_or("MCP server port not available")?;

  let settings_manager = settings_manager::SettingsManager::instance();
  let token = settings_manager
    .get_mcp_token(&app_handle)
    .await
    .map_err(|e| format!("Failed to get MCP token: {e}"))?
    .ok_or("MCP token not found")?;

  let config_json = serde_json::json!({
    "mcpServers": {
      "buglogin-browser": {
        "url": format!("http://127.0.0.1:{}/mcp", port),
        "headers": {
          "Authorization": format!("Bearer {}", token)
        }
      }
    }
  })
  .to_string();

  Ok(Some(McpConfig {
    port,
    token,
    config_json,
  }))
}

#[tauri::command]
async fn is_geoip_database_available() -> Result<bool, String> {
  Ok(GeoIPDownloader::is_geoip_database_available())
}

#[tauri::command]
async fn get_all_traffic_snapshots() -> Result<Vec<crate::traffic_stats::TrafficSnapshot>, String> {
  // Use real-time snapshots that merge in-memory data with disk data
  Ok(crate::traffic_stats::get_all_traffic_snapshots_realtime())
}

#[tauri::command]
async fn get_traffic_snapshots_for_profiles(
  profile_ids: Vec<String>,
) -> Result<Vec<crate::traffic_stats::TrafficSnapshot>, String> {
  Ok(crate::traffic_stats::get_traffic_snapshots_for_profiles_realtime(&profile_ids))
}

#[tauri::command]
async fn clear_all_traffic_stats() -> Result<(), String> {
  crate::traffic_stats::clear_all_traffic_stats()
    .map_err(|e| format!("Failed to clear traffic stats: {e}"))
}

#[tauri::command]
async fn get_traffic_stats_for_period(
  profile_id: String,
  seconds: u64,
) -> Result<Option<crate::traffic_stats::FilteredTrafficStats>, String> {
  Ok(crate::traffic_stats::get_traffic_stats_for_period(
    &profile_id,
    seconds,
  ))
}

#[tauri::command]
async fn download_geoip_database(app_handle: tauri::AppHandle) -> Result<(), String> {
  let downloader = GeoIPDownloader::instance();
  downloader
    .download_geoip_database(&app_handle)
    .await
    .map_err(|e| format!("Failed to download GeoIP database: {e}"))
}

// VPN commands
#[tauri::command]
async fn import_vpn_config(
  content: String,
  filename: String,
  name: Option<String>,
) -> Result<vpn::VpnImportResult, String> {
  let storage = vpn::VPN_STORAGE
    .lock()
    .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;

  match storage.import_config(&content, &filename, name.clone()) {
    Ok(config) => {
      if config.sync_enabled {
        if let Some(scheduler) = sync::get_global_scheduler() {
          let id = config.id.clone();
          tauri::async_runtime::spawn(async move {
            scheduler.queue_vpn_sync(id).await;
          });
        }
      }
      Ok(vpn::VpnImportResult {
        success: true,
        vpn_id: Some(config.id),
        vpn_type: Some(config.vpn_type),
        name: config.name,
        error: None,
      })
    }
    Err(e) => Ok(vpn::VpnImportResult {
      success: false,
      vpn_id: None,
      vpn_type: None,
      name: name.unwrap_or_else(|| filename.clone()),
      error: Some(e.to_string()),
    }),
  }
}

#[tauri::command]
async fn list_vpn_configs() -> Result<Vec<vpn::VpnConfig>, String> {
  let storage = vpn::VPN_STORAGE
    .lock()
    .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;

  storage
    .list_configs()
    .map_err(|e| format!("Failed to list VPN configs: {e}"))
}

#[tauri::command]
async fn get_vpn_config(vpn_id: String) -> Result<vpn::VpnConfig, String> {
  let storage = vpn::VPN_STORAGE
    .lock()
    .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;

  storage
    .load_config(&vpn_id)
    .map_err(|e| format!("Failed to load VPN config: {e}"))
}

#[tauri::command]
async fn delete_vpn_config(app_handle: tauri::AppHandle, vpn_id: String) -> Result<(), String> {
  // First disconnect if connected (stop VPN worker)
  let _ = vpn_worker_runner::stop_vpn_worker_by_vpn_id(&vpn_id).await;

  // Check if sync was enabled before deleting
  let was_sync_enabled = {
    let storage = vpn::VPN_STORAGE
      .lock()
      .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;
    storage
      .load_config(&vpn_id)
      .map(|c| c.sync_enabled)
      .unwrap_or(false)
  };

  // Delete from storage
  {
    let storage = vpn::VPN_STORAGE
      .lock()
      .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;

    storage
      .delete_config(&vpn_id)
      .map_err(|e| format!("Failed to delete VPN config: {e}"))?;
  }

  // If sync was enabled, also delete from remote
  if was_sync_enabled {
    let vpn_id_clone = vpn_id.clone();
    let app_handle_clone = app_handle.clone();
    tauri::async_runtime::spawn(async move {
      match sync::SyncEngine::create_from_settings(&app_handle_clone).await {
        Ok(engine) => {
          if let Err(e) = engine.delete_vpn(&vpn_id_clone).await {
            log::warn!("Failed to delete VPN {} from sync: {}", vpn_id_clone, e);
          } else {
            log::info!("VPN {} deleted from sync storage", vpn_id_clone);
          }
        }
        Err(e) => {
          log::debug!("Sync not configured, skipping remote VPN deletion: {}", e);
        }
      }
    });
  }

  let _ = events::emit("vpn-configs-changed", ());

  Ok(())
}

#[tauri::command]
async fn create_vpn_config_manual(
  name: String,
  vpn_type: vpn::VpnType,
  config_data: String,
) -> Result<vpn::VpnConfig, String> {
  let config = {
    let storage = vpn::VPN_STORAGE
      .lock()
      .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;

    storage
      .create_config_manual(&name, vpn_type, &config_data)
      .map_err(|e| format!("Failed to create VPN config: {e}"))?
  };

  if config.sync_enabled {
    if let Some(scheduler) = sync::get_global_scheduler() {
      let id = config.id.clone();
      tauri::async_runtime::spawn(async move {
        scheduler.queue_vpn_sync(id).await;
      });
    }
  }

  Ok(config)
}

#[tauri::command]
async fn update_vpn_config(vpn_id: String, name: String) -> Result<vpn::VpnConfig, String> {
  let config = {
    let storage = vpn::VPN_STORAGE
      .lock()
      .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;

    storage
      .update_config_name(&vpn_id, &name)
      .map_err(|e| format!("Failed to update VPN config: {e}"))?
  };

  if config.sync_enabled {
    if let Some(scheduler) = sync::get_global_scheduler() {
      let id = config.id.clone();
      tauri::async_runtime::spawn(async move {
        scheduler.queue_vpn_sync(id).await;
      });
    }
  }

  Ok(config)
}

#[tauri::command]
async fn check_vpn_validity(
  vpn_id: String,
) -> Result<crate::proxy_manager::ProxyCheckResult, String> {
  let now = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_secs();

  // Start a temporary VPN worker to send real traffic
  let vpn_worker = vpn_worker_runner::start_vpn_worker(&vpn_id)
    .await
    .map_err(|e| format!("Failed to start VPN worker: {e}"))?;

  let socks_url = format!("socks5://127.0.0.1:{}", vpn_worker.local_port.unwrap_or(0));

  // Fetch public IP through the VPN SOCKS5 proxy
  let result = match ip_utils::fetch_public_ip(Some(&socks_url)).await {
    Ok(ip) => {
      let geo_info = crate::proxy_manager::ProxyManager::get_ip_geolocation(&ip)
        .await
        .unwrap_or_default();

      crate::proxy_manager::ProxyCheckResult {
        ip,
        city: geo_info.city,
        country: geo_info.country,
        country_code: geo_info.country_code,
        zip: geo_info.zip,
        timezone: geo_info.timezone,
        latitude: geo_info.latitude,
        longitude: geo_info.longitude,
        isp: geo_info.isp,
        org: geo_info.org,
        asn: geo_info.asn,
        mobile: geo_info.mobile,
        timestamp: now,
        is_valid: true,
      }
    }
    Err(e) => {
      log::warn!("VPN check failed to fetch public IP: {e}");
      crate::proxy_manager::ProxyCheckResult {
        ip: String::new(),
        city: None,
        country: None,
        country_code: None,
        zip: None,
        timezone: None,
        latitude: None,
        longitude: None,
        isp: None,
        org: None,
        asn: None,
        mobile: None,
        timestamp: now,
        is_valid: false,
      }
    }
  };

  // Stop the temporary VPN worker
  let _ = vpn_worker_runner::stop_vpn_worker(&vpn_worker.id).await;

  Ok(result)
}

#[tauri::command]
async fn connect_vpn(vpn_id: String) -> Result<(), String> {
  // Start VPN worker process (detached, survives GUI shutdown)
  vpn_worker_runner::start_vpn_worker(&vpn_id)
    .await
    .map_err(|e| format!("Failed to connect VPN: {e}"))?;

  // Update last_used timestamp
  {
    let storage = vpn::VPN_STORAGE
      .lock()
      .map_err(|e| format!("Failed to lock VPN storage: {e}"))?;
    let _ = storage.update_last_used(&vpn_id);
  }

  Ok(())
}

#[tauri::command]
async fn disconnect_vpn(vpn_id: String) -> Result<(), String> {
  vpn_worker_runner::stop_vpn_worker_by_vpn_id(&vpn_id)
    .await
    .map_err(|e| format!("Failed to disconnect VPN: {e}"))?;
  Ok(())
}

#[tauri::command]
async fn get_vpn_status(vpn_id: String) -> Result<vpn::VpnStatus, String> {
  use crate::proxy_storage::is_process_running;

  if let Some(worker) = vpn_worker_storage::find_vpn_worker_by_vpn_id(&vpn_id) {
    let connected = worker.pid.map(is_process_running).unwrap_or(false);
    Ok(vpn::VpnStatus {
      connected,
      vpn_id,
      connected_at: None,
      bytes_sent: None,
      bytes_received: None,
      last_handshake: None,
    })
  } else {
    Ok(vpn::VpnStatus {
      connected: false,
      vpn_id,
      connected_at: None,
      bytes_sent: None,
      bytes_received: None,
      last_handshake: None,
    })
  }
}

#[tauri::command]
async fn list_active_vpn_connections() -> Result<Vec<vpn::VpnStatus>, String> {
  use crate::proxy_storage::is_process_running;

  let workers = vpn_worker_storage::list_vpn_worker_configs();
  Ok(
    workers
      .into_iter()
      .filter(|w| w.pid.map(is_process_running).unwrap_or(false))
      .map(|w| vpn::VpnStatus {
        connected: true,
        vpn_id: w.vpn_id,
        connected_at: None,
        bytes_sent: None,
        bytes_received: None,
        last_handshake: None,
      })
      .collect(),
  )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let args: Vec<String> = env::args().collect();
  let startup_urls: Vec<String> = args
    .iter()
    .filter(|arg| {
      arg.starts_with("buglogin://") || arg.starts_with("http://") || arg.starts_with("https://")
    })
    .cloned()
    .collect();

  if !startup_urls.is_empty() {
    log::info!("Found startup URL(s) in command line: {startup_urls:?}");
    let mut pending = PENDING_URLS.lock().unwrap();
    pending.extend(startup_urls.clone());
  }

  let log_file_name = app_dirs::app_name();

  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::new()
        .clear_targets() // Clear default targets to avoid duplicates
        .target(Target::new(TargetKind::Stdout))
        .target(Target::new(TargetKind::Webview))
        .target(Target::new(TargetKind::LogDir {
          file_name: Some(log_file_name.to_string()),
        }))
        .max_file_size(100_000) // 100KB
        .level(log::LevelFilter::Info)
        .format(|out, message, record| {
          use chrono::Local;
          let now = Local::now();
          let timestamp = format!(
            "{}.{:03}",
            now.format("%Y-%m-%d %H:%M:%S"),
            now.timestamp_subsec_millis()
          );
          out.finish(format_args!(
            "[{}][{}][{}] {}",
            timestamp,
            record.target(),
            record.level(),
            message
          ))
        })
        .build(),
    )
    .plugin(tauri_plugin_single_instance::init(
      |app_handle, args, _cwd| {
        log::info!("Single instance triggered with args: {args:?}");
        let deep_link_urls: Vec<String> = args
          .iter()
          .filter(|arg| {
            arg.starts_with("buglogin://")
              || arg.starts_with("http://")
              || arg.starts_with("https://")
          })
          .cloned()
          .collect();

        if !deep_link_urls.is_empty() {
          log::info!("Processing deep link URL(s) from single instance: {deep_link_urls:?}");
          for url in deep_link_urls {
            let handle = app_handle.clone();
            tauri::async_runtime::spawn(async move {
              if let Err(e) = handle_url_open(handle, url.clone()).await {
                log::error!("Failed to process single-instance deep link URL `{url}`: {e}");
              }
            });
          }
        }

        if let Some(window) = app_handle.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
          let _ = window.unminimize();
        }
      },
    ))
    .plugin(tauri_plugin_deep_link::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_macos_permissions::init())
    .setup(move |app| {
      // Recover ephemeral dir mappings from RAM-backed storage (tmpfs/ramdisk)
      ephemeral_dirs::recover_ephemeral_dirs();

      // One-time managed browser migration (stable runtime mode):
      // bugium/bugox -> wayfern/camoufox (profiles, registry, binaries folders).
      {
        let registry = downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
        if let Err(e) = registry.load() {
          log::warn!("Failed to load downloaded browsers registry on startup: {e}");
        } else {
          match registry.migrate_legacy_managed_state() {
            Ok(changes) if !changes.is_empty() => {
              log::info!(
                "Managed browser migration applied ({} changes): {}",
                changes.len(),
                changes.join(", ")
              );
            }
            Ok(_) => {}
            Err(e) => {
              log::warn!("Managed browser migration failed: {e}");
            }
          }
        }
      }

      // Start the daemon for tray icon
      if let Err(e) = daemon_spawn::ensure_daemon_running() {
        log::warn!("Failed to start daemon: {e}");
      }

      tauri::async_runtime::spawn(async move {
        if let Err(e) = local_control_server::ensure_local_control_server_running().await {
          log::warn!("Failed to start local control server: {e}");
        }
      });

      #[cfg(target_os = "windows")]
      {
        // Bootstrap icon patching once before users start launching profiles.
        // This avoids opening browser windows with a temporary original icon.
        let bootstrap_result = std::thread::spawn(|| {
          let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|error| format!("Failed to build icon bootstrap runtime: {error}"))?;
          runtime.block_on(crate::downloader::patch_all_installed_browser_icons_windows_once())
        })
        .join();

        match bootstrap_result {
          Ok(Ok((patched, skipped, failed))) => {
            log::info!(
              "Windows browser icon bootstrap completed: patched={}, skipped={}, failed={}",
              patched,
              skipped,
              failed
            );
          }
          Ok(Err(error)) => {
            log::warn!("Windows browser icon bootstrap failed: {error}");
          }
          Err(_) => {
            log::warn!("Windows browser icon bootstrap panicked");
          }
        }
      }

      // Register this GUI's PID in daemon state so the daemon can kill us directly
      daemon_spawn::register_gui_pid();

      // Monitor daemon health - quit GUI if daemon dies
      tauri::async_runtime::spawn(async move {
        // Give the daemon time to fully start
        tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;

        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(1));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
          interval.tick().await;

          let is_running = tokio::task::spawn_blocking(daemon_spawn::is_daemon_running)
            .await
            .unwrap_or(false);

          if !is_running {
            if cfg!(debug_assertions) {
              log::warn!("Daemon is no longer running in dev mode, attempting to restart it");

              let restarted = tokio::task::spawn_blocking(|| {
                daemon_spawn::ensure_daemon_running()?;
                daemon_spawn::register_gui_pid();
                Ok::<(), String>(())
              })
              .await
              .ok()
              .and_then(Result::ok)
              .is_some();

              if restarted {
                log::info!("Daemon restarted successfully, keeping GUI alive");
                continue;
              }

              log::warn!("Daemon restart failed in dev mode, quitting GUI immediately");
            } else {
              log::warn!("Daemon is no longer running, quitting GUI immediately");
            }

            // Use process::exit for immediate termination. Tauri's exit()
            // triggers a slow graceful shutdown that can take over a minute
            // waiting for async tasks (sync, version updater, etc.) to finish.
            std::process::exit(0);
          }
        }
      });

      // Create the main window if it does not already exist.
      #[allow(unused_variables)]
      let window = if let Some(existing_window) = app.get_webview_window("main") {
        log::debug!("Main window already exists, reusing existing window");
        existing_window
      } else {
        let (initial_width, initial_height, initial_x, initial_y) =
          compute_main_window_geometry(app);
        let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
          .title("BugLogin")
          .inner_size(initial_width, initial_height)
          .min_inner_size(980.0, 700.0)
          .prevent_overflow()
          .resizable(true)
          .fullscreen(false)
          .position(initial_x, initial_y)
          .focused(true)
          .visible(true);

        #[cfg(target_os = "windows")]
        let win_builder = win_builder.decorations(false);

        win_builder.build().map_err(|e| {
          log::error!("Failed to create main window: {e}");
          e
        })?
      };

      #[cfg(target_os = "windows")]
      {
        if let Err(e) = window.set_decorations(false) {
          log::warn!("Failed to disable native window decorations: {e}");
        }
      }

      // Set transparent titlebar for macOS
      #[cfg(target_os = "macos")]
      {
        if let Err(e) = window.set_transparent_titlebar(true) {
          log::warn!("Failed to set transparent titlebar: {e}");
        }
      }

      // Set up deep link handler
      let handle = app.handle().clone();

      // Initialize the global event emitter for the events module
      let emitter = std::sync::Arc::new(events::TauriEmitter::new(handle.clone()));
      if let Err(e) = events::set_global_emitter(emitter) {
        log::warn!("Failed to set global event emitter: {e}");
      }

      #[cfg(windows)]
      {
        // For Windows, register all deep links at runtime
        if let Err(e) = app.deep_link().register_all() {
          log::warn!("Failed to register deep links: {e}");
        }
      }

      #[cfg(target_os = "macos")]
      {
        // On macOS, try to register deep links for development builds
        if let Err(e) = app.deep_link().register_all() {
          log::debug!(
            "Note: Deep link registration failed on macOS (this is normal for production): {e}"
          );
        }
      }

      app.deep_link().on_open_url({
        let handle = handle.clone();
        move |event| {
          let urls = event.urls();
          log::info!("Deep link event received with {} URLs", urls.len());

          for url in urls {
            let url_string = url.to_string();
            log::info!("Deep link received: {url_string}");

            // Clone the handle for each async task
            let handle_clone = handle.clone();

            // Handle the URL asynchronously
            tauri::async_runtime::spawn(async move {
              if let Err(e) = handle_url_open(handle_clone, url_string.clone()).await {
                log::error!("Failed to handle deep link URL: {e}");
              }
            });
          }
        }
      });

      if !startup_urls.is_empty() {
        for startup_url in startup_urls.clone() {
          let handle_clone = handle.clone();
          tauri::async_runtime::spawn(async move {
            log::info!("Processing startup URL from command line: {startup_url}");
            if let Err(e) = handle_url_open(handle_clone, startup_url.clone()).await {
              log::error!("Failed to handle startup URL: {e}");
            }
          });
        }
      }

      // Initialize and start background version updater
      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        let version_updater = get_version_updater();

        // Set the app handle
        {
          let mut updater_guard = version_updater.lock().await;
          updater_guard.set_app_handle(app_handle);
        }

        // Run startup check without holding the lock
        {
          let updater_guard = version_updater.lock().await;
          if let Err(e) = updater_guard.start_background_updates().await {
            log::error!("Failed to start background updates: {e}");
          }
        }
      });

      // Start the background update task separately
      tauri::async_runtime::spawn(async move {
        version_updater::VersionUpdater::run_background_task().await;
      });

      let app_handle_auto_updater = app.handle().clone();

      // Start the auto-update check task separately
      tauri::async_runtime::spawn(async move {
        auto_updater::check_for_updates_with_progress(app_handle_auto_updater).await;
      });

      // Handle any pending URLs that were received before the window was ready
      let handle_pending = handle.clone();
      tauri::async_runtime::spawn(async move {
        // Wait a bit for the window to be fully ready
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        let pending_urls = {
          let mut pending = PENDING_URLS.lock().unwrap();
          let urls = pending.clone();
          pending.clear();
          urls
        };

        for url in pending_urls {
          log::info!("Processing pending URL: {url}");
          if let Err(e) = handle_url_open(handle_pending.clone(), url).await {
            log::error!("Failed to handle pending URL: {e}");
          }
        }
      });

      // Start periodic cleanup task for unused binaries
      // Only runs when sync is not in progress to avoid deleting browsers
      // that might be needed for profiles being synced from the cloud
      tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(43200)); // Every 12 hours

        loop {
          interval.tick().await;

          // Check if sync is in progress before running cleanup
          if let Some(scheduler) = sync::get_global_scheduler() {
            if scheduler.is_sync_in_progress().await {
              log::debug!("Skipping cleanup: sync is in progress");
              continue;
            }
          }

          let registry =
            crate::downloaded_browsers_registry::DownloadedBrowsersRegistry::instance();
          if let Err(e) = registry.cleanup_unused_binaries() {
            log::error!("Periodic cleanup failed: {e}");
          } else {
            log::debug!("Periodic cleanup completed successfully");
          }
        }
      });

      if is_app_auto_update_enabled() {
        tauri::async_runtime::spawn(async move {
          let updater = app_auto_updater::AppAutoUpdater::instance();
          let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3 * 60 * 60));

          loop {
            interval.tick().await;

            log::info!("Checking for app updates...");
            match updater.check_for_updates().await {
              Ok(Some(update_info)) => {
                log::info!(
                  "App update available: {} -> {}",
                  update_info.current_version,
                  update_info.new_version
                );
                if let Err(e) = events::emit("app-update-available", &update_info) {
                  log::error!("Failed to emit app update event: {e}");
                }
              }
              Ok(None) => {
                log::debug!("No app updates available");
              }
              Err(e) => {
                log::error!("Failed to check for app updates: {e}");
              }
            }
          }
        });
      } else {
        log::info!(
          "App auto-update loop disabled. Set BUGLOGIN_APP_AUTO_UPDATE_ENABLED=true to enable."
        );
      }

      // Start Camoufox cleanup task
      let _app_handle_cleanup = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        let camoufox_manager = crate::camoufox_manager::CamoufoxManager::instance();
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));

        loop {
          interval.tick().await;

          match camoufox_manager.cleanup_dead_instances().await {
            Ok(_) => {
              // Cleanup completed silently
            }
            Err(e) => {
              log::error!("Error during Camoufox cleanup: {e}");
            }
          }
        }
      });

      // Check and download GeoIP database at startup if needed
      let app_handle_geoip = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        // Wait a bit for the app to fully initialize
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        let geoip_downloader = crate::geoip_downloader::GeoIPDownloader::instance();
        match geoip_downloader.check_missing_geoip_database() {
          Ok(true) => {
            log::info!(
              "GeoIP database is missing for Camoufox profiles, downloading at startup..."
            );
            let geoip_downloader = GeoIPDownloader::instance();
            if let Err(e) = geoip_downloader
              .download_geoip_database(&app_handle_geoip)
              .await
            {
              log::error!("Failed to download GeoIP database at startup: {e}");
            } else {
              log::info!("GeoIP database downloaded successfully at startup");
            }
          }
          Ok(false) => {
            // No Camoufox profiles or GeoIP database already available
          }
          Err(e) => {
            log::error!("Failed to check GeoIP database status at startup: {e}");
          }
        }
      });

      // Start proxy cleanup task for dead browser processes
      let app_handle_proxy_cleanup = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));

        loop {
          interval.tick().await;

          match crate::proxy_manager::PROXY_MANAGER
            .cleanup_dead_proxies(app_handle_proxy_cleanup.clone())
            .await
          {
            Ok(dead_pids) => {
              if !dead_pids.is_empty() {
                log::info!(
                  "Cleaned up proxies for {} dead browser processes",
                  dead_pids.len()
                );
              }
            }
            Err(e) => {
              log::error!("Error during proxy cleanup: {e}");
            }
          }
        }
      });

      // Periodically broadcast browser running status to the frontend
      let app_handle_status = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        // Lower probe frequency to prioritize UI smoothness over immediate
        // running-state convergence on large profile sets.
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        let mut last_running_states: std::collections::HashMap<String, bool> =
          std::collections::HashMap::new();
        let mut full_probe_counter: u32 = 0;

        loop {
          interval.tick().await;
          full_probe_counter = full_probe_counter.saturating_add(1);
          // Full probe roughly every 15 minutes (30s * 30).
          let run_full_probe = if full_probe_counter >= 30 {
            full_probe_counter = 0;
            true
          } else {
            false
          };

          let runner = crate::browser_runner::BrowserRunner::instance();
          // If listing profiles fails, skip this tick
          let profiles = match runner.profile_manager.list_profiles() {
            Ok(p) => p,
            Err(e) => {
              log::warn!("Failed to list profiles in status checker: {e}");
              continue;
            }
          };

          for profile in profiles {
            let should_probe = run_full_probe
              || profile.process_id.is_some()
              || matches!(
                profile.runtime_state,
                crate::profile::types::RuntimeState::Starting
                  | crate::profile::types::RuntimeState::Stopping
                  | crate::profile::types::RuntimeState::Terminating
              );
            if !should_probe {
              let profile_id = profile.id.to_string();
              let last_state = last_running_states
                .get(&profile_id)
                .copied()
                .unwrap_or(false);
              if last_state {
                let payload = serde_json::json!({
                  "id": profile_id.clone(),
                  "is_running": false
                });
                if let Err(e) = events::emit("profile-running-changed", &payload) {
                  log::warn!("Failed to emit profile running changed event: {e}");
                }
              }
              last_running_states.insert(profile_id, false);
              continue;
            }

            // Check browser status and track changes
            match runner
              .check_browser_status(app_handle_status.clone(), &profile)
              .await
            {
              Ok(is_running) => {
                let effective_running = is_running
                  && !matches!(
                    profile.runtime_state,
                    crate::profile::types::RuntimeState::Parked
                  );
                let profile_id = profile.id.to_string();
                let last_state = last_running_states
                  .get(&profile_id)
                  .copied()
                  .unwrap_or(false);

                // Only emit event if state actually changed
                if last_state != effective_running {
                  log::debug!(
                    "Status checker detected change for profile {}: {} -> {}",
                    profile.name,
                    last_state,
                    effective_running
                  );

                  #[derive(serde::Serialize)]
                  struct RunningChangedPayload {
                    id: String,
                    is_running: bool,
                  }

                  let payload = RunningChangedPayload {
                    id: profile_id.clone(),
                    is_running: effective_running,
                  };

                  if let Err(e) = events::emit("profile-running-changed", &payload) {
                    log::warn!("Failed to emit profile running changed event: {e}");
                  } else {
                    log::debug!(
                      "Status checker emitted profile-running-changed event for {}: running={}",
                      profile.name,
                      effective_running
                    );
                  }

                  last_running_states.insert(profile_id, effective_running);
                } else {
                  // Update the state even if unchanged to ensure we have it tracked
                  last_running_states.insert(profile_id, effective_running);
                }
              }
              Err(e) => {
                log::warn!("Status check failed for profile {}: {}", profile.name, e);
                continue;
              }
            }
          }
        }
      });

      // Nodecar warm-up is now triggered from the frontend to allow UI blocking overlay

      // Start API server if enabled in settings
      let app_handle_api = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        match crate::settings_manager::get_app_settings(app_handle_api.clone()).await {
          Ok(settings) => {
            if settings.api_enabled {
              log::info!("API is enabled in settings, starting API server...");
              match crate::api_server::start_api_server_internal(settings.api_port, &app_handle_api)
                .await
              {
                Ok(port) => {
                  log::info!("API server started successfully on port {port}");
                  // Emit success toast to frontend
                  if let Err(e) = events::emit(
                    "show-toast",
                    crate::api_server::ToastPayload {
                      message: "API server started successfully".to_string(),
                      variant: "success".to_string(),
                      title: "Local API Started".to_string(),
                      description: Some(format!("API server running on port {port}")),
                    },
                  ) {
                    log::error!("Failed to emit API start toast: {e}");
                  }
                }
                Err(e) => {
                  log::error!("Failed to start API server at startup: {e}");
                  // Emit error toast to frontend
                  if let Err(toast_err) = events::emit(
                    "show-toast",
                    crate::api_server::ToastPayload {
                      message: "Failed to start API server".to_string(),
                      variant: "error".to_string(),
                      title: "Failed to Start Local API".to_string(),
                      description: Some(format!("Error: {e}")),
                    },
                  ) {
                    log::error!("Failed to emit API error toast: {toast_err}");
                  }
                }
              }
            }
          }
          Err(e) => {
            log::error!("Failed to load app settings for API startup: {e}");
          }
        }
      });

      // Start sync subscription and scheduler if configured
      let app_handle_sync = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        use std::sync::Arc;

        let mut subscription_manager = sync::SubscriptionManager::new();
        let work_rx = subscription_manager.take_work_receiver();

        if let Err(e) = subscription_manager.start(app_handle_sync.clone()).await {
          log::warn!("Failed to start sync subscription: {e}");
        }

        if let Some(work_rx) = work_rx {
          let scheduler = Arc::new(sync::SyncScheduler::new());

          // Set the global scheduler so commands can access it
          sync::set_global_scheduler(scheduler.clone());

          // Start initial sync for all enabled profiles
          scheduler.sync_all_enabled_profiles(&app_handle_sync).await;

          // Check for missing synced profiles (deleted locally but exist remotely)
          match sync::SyncEngine::create_from_settings(&app_handle_sync).await {
            Ok(engine) => {
              if let Err(e) = engine
                .check_for_missing_synced_profiles(&app_handle_sync)
                .await
              {
                log::warn!("Failed to check for missing profiles: {}", e);
              }
              if let Err(e) = engine
                .check_for_missing_synced_entities(&app_handle_sync)
                .await
              {
                log::warn!("Failed to check for missing entities: {}", e);
              }
            }
            Err(e) => {
              log::debug!("Sync not configured, skipping missing profile check: {}", e);
            }
          }

          scheduler
            .clone()
            .start(app_handle_sync.clone(), work_rx)
            .await;
          log::info!("Sync scheduler started");
        }
      });

      // Start cloud auth background refresh loop
      let app_handle_cloud = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        // On startup, refresh sync token and proxy if cloud auth is active.
        // api_call_with_retry handles 401/refresh internally â€” no direct
        // refresh_access_token call needed.
        if cloud_auth::CLOUD_AUTH.is_logged_in().await {
          if let Err(e) = cloud_auth::CLOUD_AUTH.get_or_refresh_sync_token().await {
            if e.to_ascii_lowercase().contains("not logged in") {
              log::debug!("Skipping cloud sync token refresh on startup while logged out: {e}");
            } else {
              log::warn!("Failed to refresh cloud sync token on startup: {e}");
            }
          }
          cloud_auth::CLOUD_AUTH.sync_cloud_proxy().await;
        }
        cloud_auth::CloudAuthManager::start_sync_token_refresh_loop(app_handle_cloud).await;
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      get_supported_browsers,
      is_browser_supported_on_platform,
      download_browser,
      cancel_download,
      delete_profile,
      clone_profile,
      check_browser_exists,
      create_browser_profile_new,
      list_browser_profiles,
      list_browser_profiles_light,
      launch_browser_profile,
      launch_browser_profile_by_id,
      get_browser_runtime_diagnostics,
      check_camoufox_ua_version_alignment,
      fetch_browser_versions_with_count,
      fetch_browser_versions_cached_first,
      fetch_browser_versions_with_count_cached_first,
      get_downloaded_browser_versions,
      get_all_tags,
      get_browser_release_types,
      get_browser_update_requirement,
      update_profile_proxy,
      update_profile_vpn,
      update_profiles_proxy,
      update_profiles_vpn,
      update_profile_tags,
      update_profile_note,
      update_profile_proxy_bypass_rules,
      check_browser_status,
      check_browser_statuses_batch,
      park_browser_profile,
      kill_browser_profile,
      rename_profile,
      get_app_settings,
      save_app_settings,
      should_show_launch_on_login_prompt,
      enable_launch_on_login,
      decline_launch_on_login,
      get_table_sorting_settings,
      save_table_sorting_settings,
      get_system_language,
      dismiss_window_resize_warning,
      get_window_resize_warning_dismissed,
      clear_all_version_cache_and_refetch,
      is_default_browser,
      open_url_with_profile,
      set_as_default_browser,
      trigger_manual_version_update,
      get_version_update_status,
      check_for_browser_updates,
      dismiss_update_notification,
      complete_browser_update_with_auto_update,
      check_for_app_updates,
      check_for_app_updates_manual,
      download_and_prepare_app_update,
      restart_application,
      detect_existing_profiles,
      import_browser_profile,
      check_missing_binaries,
      check_missing_geoip_database,
      ensure_all_binaries_exist,
      ensure_active_browsers_downloaded,
      create_stored_proxy,
      get_stored_proxies,
      update_stored_proxy,
      delete_stored_proxy,
      check_proxy_validity,
      benchmark_proxy_protocols,
      get_cached_proxy_check,
      get_cached_proxy_checks,
      export_proxies,
      import_proxies_json,
      parse_txt_proxies,
      import_proxies_from_parsed,
      update_camoufox_config,
      update_wayfern_config,
      get_profile_groups,
      get_groups_with_profile_counts,
      create_profile_group,
      update_profile_group,
      delete_profile_group,
      assign_profiles_to_group,
      delete_selected_profiles,
      list_extensions,
      add_extension,
      update_extension,
      delete_extension,
      list_extension_groups,
      create_extension_group,
      update_extension_group,
      delete_extension_group,
      add_extension_to_group,
      remove_extension_from_group,
      assign_extension_group_to_profile,
      assign_extension_group_to_profiles,
      get_extension_group_for_profile,
      is_geoip_database_available,
      download_geoip_database,
      start_api_server,
      stop_api_server,
      get_api_server_status,
      get_all_traffic_snapshots,
      get_traffic_snapshots_for_profiles,
      clear_all_traffic_stats,
      get_traffic_stats_for_period,
      get_sync_settings,
      save_sync_settings,
      get_app_access_token_state,
      save_app_access_token,
      set_profile_sync_mode,
      request_profile_sync,
      set_proxy_sync_enabled,
      set_group_sync_enabled,
      is_proxy_in_use_by_synced_profile,
      get_proxies_in_use_by_synced_profiles,
      is_group_in_use_by_synced_profile,
      get_groups_in_use_by_synced_profiles,
      set_vpn_sync_enabled,
      is_vpn_in_use_by_synced_profile,
      get_vpns_in_use_by_synced_profiles,
      set_extension_sync_enabled,
      set_extension_group_sync_enabled,
      get_unsynced_entity_counts,
      enable_sync_for_all_entities,
      set_e2e_password,
      check_has_e2e_password,
      delete_e2e_password,
      list_remote_workspace_profile_ids,
      pull_workspace_profiles,
      read_profile_cookies,
      read_profile_cookies_bulk,
      read_profile_tiktok_cookie_headers_bulk,
      copy_profile_cookies,
      import_cookies_from_file,
      export_profile_cookies,
      bugidea_tiktok_request,
      read_tiktok_account_cookie_source,
      parse_tiktok_seller_seed_file,
      get_bundled_omocaptcha_extension,
      list_pdf_files_recursive,
      append_automation_output_record,
      start_tiktok_probe_session,
      read_tiktok_probe_progress,
      detect_tiktok_seller_runtime_step,
      check_wayfern_terms_accepted,
      check_wayfern_downloaded,
      accept_wayfern_terms,
      start_mcp_server,
      stop_mcp_server,
      get_mcp_server_status,
      get_mcp_config,
      // VPN commands
      import_vpn_config,
      list_vpn_configs,
      get_vpn_config,
      delete_vpn_config,
      create_vpn_config_manual,
      update_vpn_config,
      check_vpn_validity,
      connect_vpn,
      disconnect_vpn,
      get_vpn_status,
      list_active_vpn_connections,
      // Cloud auth commands
      cloud_auth::cloud_request_otp,
      cloud_auth::cloud_verify_otp,
      cloud_auth::cloud_get_user,
      cloud_auth::cloud_set_self_host_auth_state,
      cloud_auth::cloud_refresh_profile,
      cloud_auth::cloud_logout,
      cloud_auth::cloud_get_proxy_usage,
      cloud_auth::cloud_get_countries,
      cloud_auth::cloud_get_states,
      cloud_auth::cloud_get_cities,
      cloud_auth::create_cloud_location_proxy,
      cloud_auth::cloud_sync_local_subscription_state,
      cloud_auth::restart_sync_service,
      entitlement::get_entitlement_state,
      entitlement::set_entitlement_state,
      entitlement::is_entitlement_read_only,
      entitlement::get_feature_access_snapshot,
      entitlement::get_runtime_config_status,
      // Team lock commands
      team_lock::get_team_locks,
      team_lock::get_team_lock_status,
    ])
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|_app_handle, _event| {
      #[cfg(target_os = "macos")]
      if let tauri::RunEvent::Reopen { .. } = _event {
        if let Some(window) = _app_handle.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
          let _ = window.unminimize();
        }
      }
    });
}

#[cfg(test)]
mod tests {
  use std::fs;

  #[test]
  fn test_no_unused_tauri_commands() {
    check_unused_commands(false); // Run in strict mode for CI
  }

  #[test]
  fn test_unused_tauri_commands_detailed() {
    check_unused_commands(true); // Run in verbose mode for development
  }

  fn check_unused_commands(verbose: bool) {
    // Commands that are intentionally not used in the frontend
    // but are used via MCP server or other programmatic APIs
    let mcp_only_commands = [
      "connect_vpn",
      "disconnect_vpn",
      "get_vpn_status",
      "get_vpn_config",
      "list_active_vpn_connections",
      "export_profile_cookies",
      "update_extension",
      "set_extension_sync_enabled",
      "set_extension_group_sync_enabled",
      "get_team_lock_status",
      "set_entitlement_state",
      "is_entitlement_read_only",
    ];

    // Extract command names from the generate_handler! macro in this file
    let lib_rs_content = fs::read_to_string("src/lib.rs").expect("Failed to read lib.rs");
    let commands = extract_tauri_commands(&lib_rs_content);

    // Get all frontend files
    let frontend_files = get_frontend_files("../src");

    // Check which commands are actually used
    let mut unused_commands = Vec::new();
    let mut used_commands = Vec::new();

    for command in &commands {
      // Skip commands that are intentionally MCP-only
      if mcp_only_commands.contains(&command.as_str()) {
        used_commands.push(command.clone());
        if verbose {
          println!("âœ… {command} (MCP-only)");
        }
        continue;
      }

      let mut is_used = false;

      for file_content in &frontend_files {
        // More comprehensive search for command usage
        if is_command_used(file_content, command) {
          is_used = true;
          break;
        }
      }

      if is_used {
        used_commands.push(command.clone());
        if verbose {
          println!("âœ… {command}");
        }
      } else {
        unused_commands.push(command.clone());
        if verbose {
          println!("âŒ {command} (UNUSED)");
        }
      }
    }

    if verbose {
      println!("\nðŸ“Š Summary:");
      println!("  âœ… Used commands: {}", used_commands.len());
      println!("  âŒ Unused commands: {}", unused_commands.len());
    }

    if !unused_commands.is_empty() {
      let message = format!(
        "Found {} unused Tauri commands: {}\n\nThese commands are exported in generate_handler! but not used in the frontend.\nConsider removing them or add them to the allowlist if they're used elsewhere.\n\nRun `pnpm check-unused-commands` for detailed analysis.",
        unused_commands.len(),
        unused_commands.join(", ")
      );

      if verbose {
        println!("\nðŸš¨ {message}");
      } else {
        panic!("{}", message);
      }
    } else if verbose {
      println!("\nðŸŽ‰ All exported commands are being used!");
    } else {
      println!(
        "âœ… All {} exported Tauri commands are being used in the frontend",
        commands.len()
      );
    }
  }

  fn is_command_used(content: &str, command: &str) -> bool {
    // Check various patterns for invoke usage
    let patterns = vec![
      format!("invoke<{}>(\"{}\"", "", command), // invoke<Type>("command"
      format!("invoke(\"{}\"", command),         // invoke("command"
      format!("invoke<{}>(\"{}\",", "", command), // invoke<Type>("command",
      format!("invoke(\"{}\",", command),        // invoke("command",
      format!("\"{}\"", command),                // Just the command name in quotes
    ];

    for pattern in patterns {
      if content.contains(&pattern) {
        return true;
      }
    }

    // Also check for the command name appearing after "invoke" within a reasonable distance
    if let Some(invoke_pos) = content.find("invoke") {
      let after_invoke = &content[invoke_pos..];
      if let Some(cmd_pos) = after_invoke.find(&format!("\"{command}\"")) {
        // If the command appears within 100 characters of "invoke", consider it used
        if cmd_pos < 100 {
          return true;
        }
      }
    }

    false
  }

  fn extract_tauri_commands(content: &str) -> Vec<String> {
    let mut commands = Vec::new();

    // Find the generate_handler! macro
    if let Some(start) = content.find("tauri::generate_handler![") {
      if let Some(end) = content[start..].find("])") {
        let handler_content = &content[start + 25..start + end]; // Skip "tauri::generate_handler!["

        // Extract command names
        for line in handler_content.lines() {
          let line = line.trim();
          if !line.is_empty() && !line.starts_with("//") {
            // Remove trailing comma and whitespace
            let command = line.trim_end_matches(',').trim();
            if !command.is_empty() {
              // Strip module prefix (e.g., "cloud_auth::cloud_request_otp" -> "cloud_request_otp")
              let command = command.rsplit("::").next().unwrap_or(command);
              commands.push(command.to_string());
            }
          }
        }
      }
    }

    commands
  }

  fn get_frontend_files(src_dir: &str) -> Vec<String> {
    let mut files_content = Vec::new();

    if let Ok(entries) = fs::read_dir(src_dir) {
      for entry in entries.flatten() {
        let path = entry.path();

        if path.is_dir() {
          // Recursively read subdirectories
          let subdir_files = get_frontend_files(&path.to_string_lossy());
          files_content.extend(subdir_files);
        } else if let Some(extension) = path.extension() {
          if matches!(
            extension.to_str(),
            Some("ts") | Some("tsx") | Some("js") | Some("jsx")
          ) {
            if let Ok(content) = fs::read_to_string(&path) {
              files_content.push(content);
            }
          }
        }
      }
    }

    files_content
  }
}
