use crate::browser_runner::BrowserRunner;
use crate::profile::BrowserProfile;
use chrono::Local;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::process::Command as TokioCommand;
use tokio::sync::Mutex as AsyncMutex;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WayfernConfig {
  #[serde(default)]
  pub fingerprint: Option<String>,
  #[serde(default)]
  pub randomize_fingerprint_on_launch: Option<bool>,
  #[serde(default)]
  pub os: Option<String>,
  #[serde(default)]
  pub screen_max_width: Option<u32>,
  #[serde(default)]
  pub screen_max_height: Option<u32>,
  #[serde(default)]
  pub screen_min_width: Option<u32>,
  #[serde(default)]
  pub screen_min_height: Option<u32>,
  #[serde(default)]
  pub geoip: Option<serde_json::Value>, // For compatibility with shared config form
  #[serde(default)]
  pub block_images: Option<bool>, // For compatibility with shared config form
  #[serde(default)]
  pub block_webrtc: Option<bool>,
  #[serde(default)]
  pub block_webgl: Option<bool>,
  #[serde(default)]
  pub executable_path: Option<String>,
  #[serde(default, skip_serializing)]
  pub proxy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(non_snake_case)]
pub struct WayfernLaunchResult {
  pub id: String,
  #[serde(alias = "process_id")]
  pub processId: Option<u32>,
  #[serde(alias = "profile_path")]
  pub profilePath: Option<String>,
  pub url: Option<String>,
  pub cdp_port: Option<u16>,
}

#[derive(Debug)]
struct WayfernInstance {
  #[allow(dead_code)]
  id: String,
  process_id: Option<u32>,
  profile_path: Option<String>,
  url: Option<String>,
  cdp_port: Option<u16>,
}

struct WayfernManagerInner {
  instances: HashMap<String, WayfernInstance>,
}

pub struct WayfernManager {
  inner: Arc<AsyncMutex<WayfernManagerInner>>,
  http_client: Client,
}

#[derive(Debug, Deserialize)]
struct CdpTarget {
  #[serde(rename = "type")]
  target_type: String,
  #[serde(rename = "webSocketDebuggerUrl")]
  websocket_debugger_url: Option<String>,
}

impl WayfernManager {
  fn new() -> Self {
    Self {
      inner: Arc::new(AsyncMutex::new(WayfernManagerInner {
        instances: HashMap::new(),
      })),
      http_client: Client::new(),
    }
  }

  pub fn instance() -> &'static WayfernManager {
    &WAYFERN_MANAGER
  }

  #[allow(dead_code)]
  pub fn get_profiles_dir(&self) -> PathBuf {
    crate::app_dirs::profiles_dir()
  }

  #[allow(dead_code)]
  fn get_binaries_dir(&self) -> PathBuf {
    crate::app_dirs::binaries_dir()
  }

  async fn find_free_port() -> Result<u16, Box<dyn std::error::Error + Send + Sync>> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    drop(listener);
    Ok(port)
  }

  /// Normalize fingerprint data from Wayfern CDP format to our storage format.
  /// Wayfern returns fields like fonts, webglParameters as JSON strings which we keep as-is.
  fn normalize_fingerprint(fingerprint: serde_json::Value) -> serde_json::Value {
    // Our storage format matches what Wayfern returns:
    // - fonts, plugins, mimeTypes, voices are JSON strings
    // - webglParameters, webgl2Parameters, etc. are JSON strings
    // The form displays them as JSON text areas, so no conversion needed.
    fingerprint
  }

  /// Denormalize fingerprint data from our storage format to Wayfern CDP format.
  /// Wayfern expects certain fields as JSON strings.
  fn denormalize_fingerprint(fingerprint: serde_json::Value) -> serde_json::Value {
    // Our storage format matches what Wayfern expects:
    // - fonts, plugins, mimeTypes, voices are JSON strings
    // - webglParameters, webgl2Parameters, etc. are JSON strings
    // So no conversion is needed
    fingerprint
  }

  fn is_geoip_enabled(config: &WayfernConfig) -> bool {
    match config.geoip.as_ref() {
      None => true,
      Some(serde_json::Value::Bool(enabled)) => *enabled,
      Some(serde_json::Value::Number(n)) => n.as_i64().unwrap_or(1) != 0,
      Some(serde_json::Value::String(s)) => !matches!(
        s.trim().to_ascii_lowercase().as_str(),
        "false" | "0" | "off" | "disabled" | "no"
      ),
      Some(_) => true,
    }
  }

  fn local_js_timezone_offset_minutes() -> i32 {
    // JS Date#getTimezoneOffset uses opposite sign: west is positive.
    -(Local::now().offset().local_minus_utc() / 60)
  }

  fn js_timezone_offset_minutes_from_utc_offset_seconds(utc_offset_seconds: i32) -> i32 {
    -(utc_offset_seconds / 60)
  }

  fn ensure_timezone_defaults(fingerprint: &mut serde_json::Value) {
    if let Some(obj) = fingerprint.as_object_mut() {
      if !obj.contains_key("timezone") {
        obj.insert("timezone".to_string(), json!("UTC"));
      }

      if !obj.contains_key("timezoneOffset") {
        let fallback_offset = if obj.get("timezone").and_then(|v| v.as_str()) == Some("UTC") {
          0
        } else {
          Self::local_js_timezone_offset_minutes()
        };
        obj.insert("timezoneOffset".to_string(), json!(fallback_offset));
      }
    }
  }

  fn extract_chrome_major_from_user_agent(user_agent: &str) -> Option<String> {
    let marker = "Chrome/";
    let start = user_agent.find(marker)? + marker.len();
    let version = user_agent[start..]
      .split_whitespace()
      .next()?
      .trim_end_matches(';');
    let major = version.split('.').next()?;
    if major.chars().all(|c| c.is_ascii_digit()) {
      Some(major.to_string())
    } else {
      None
    }
  }

  fn sync_runtime_user_agent(fingerprint: &mut serde_json::Value, runtime_user_agent: &str) {
    let runtime_user_agent = runtime_user_agent.trim();
    if runtime_user_agent.is_empty() {
      return;
    }

    if let Some(obj) = fingerprint.as_object_mut() {
      obj.insert("userAgent".to_string(), json!(runtime_user_agent));
      if let Some(major) = Self::extract_chrome_major_from_user_agent(runtime_user_agent) {
        obj.insert("brandVersion".to_string(), json!(major));
      }
    }
  }

  fn resolve_launch_language(config: &WayfernConfig) -> String {
    const DEFAULT_LANG: &str = "en-US";

    let Some(raw_fingerprint) = config.fingerprint.as_deref() else {
      return DEFAULT_LANG.to_string();
    };

    let Ok(value) = serde_json::from_str::<serde_json::Value>(raw_fingerprint) else {
      return DEFAULT_LANG.to_string();
    };

    let from_language = value
      .get("language")
      .and_then(|v| v.as_str())
      .map(str::trim)
      .filter(|s| !s.is_empty());
    if let Some(lang) = from_language {
      return lang.replace('_', "-");
    }

    let from_languages = value
      .get("languages")
      .and_then(|v| v.as_array())
      .and_then(|arr| arr.first())
      .and_then(|v| v.as_str())
      .map(str::trim)
      .filter(|s| !s.is_empty());
    if let Some(lang) = from_languages {
      return lang.replace('_', "-");
    }

    DEFAULT_LANG.to_string()
  }

  fn enforce_storage_signals(fingerprint: &mut serde_json::Value, ephemeral: bool) {
    // Persistent profiles should not expose incognito-like storage signals.
    if ephemeral {
      return;
    }

    if let Some(obj) = fingerprint.as_object_mut() {
      for key in [
        "localStorage",
        "sessionStorage",
        "indexedDb",
        "cookieEnabled",
      ] {
        if obj.get(key).and_then(|v| v.as_bool()) != Some(true) {
          obj.insert(key.to_string(), json!(true));
        }
      }
    }
  }

  fn resolve_proxy_url_from_profile(profile: &BrowserProfile) -> Option<String> {
    let proxy_id = profile.proxy_id.as_deref()?;
    let proxy = crate::proxy_manager::PROXY_MANAGER.get_proxy_settings_by_id(proxy_id)?;
    Some(match (&proxy.username, &proxy.password) {
      (Some(u), Some(p)) => format!(
        "{}://{}:{}@{}:{}",
        proxy.proxy_type.to_lowercase(),
        u,
        p,
        proxy.host,
        proxy.port
      ),
      _ => format!(
        "{}://{}:{}",
        proxy.proxy_type.to_lowercase(),
        proxy.host,
        proxy.port
      ),
    })
  }

  fn locale_from_country_code(country_code: &str) -> Option<String> {
    let selector = crate::camoufox::geolocation::LocaleSelector::new().ok()?;
    selector
      .from_region(country_code)
      .ok()
      .map(|l| l.as_string())
  }

  async fn get_runtime_user_agent(&self, ws_url: &str) -> Option<String> {
    match self
      .send_cdp_command(ws_url, "Browser.getVersion", json!({}))
      .await
    {
      Ok(result) => result
        .get("userAgent")
        .and_then(|v| v.as_str())
        .map(str::to_string),
      Err(e) => {
        log::warn!("Failed to read Browser.getVersion from Wayfern CDP: {e}");
        None
      }
    }
  }

  async fn sync_fingerprint_with_proxy_context(
    &self,
    profile: &BrowserProfile,
    config: &WayfernConfig,
    proxy_url: Option<&str>,
    fingerprint: &mut serde_json::Value,
  ) {
    if !Self::is_geoip_enabled(config) {
      log::info!("Wayfern geo sync skipped because auto-location is disabled");
      return;
    }

    let proxy_for_geo = proxy_url
      .map(str::to_string)
      .or_else(|| Self::resolve_proxy_url_from_profile(profile));

    let Some(proxy_for_geo) = proxy_for_geo else {
      log::info!("Wayfern geo sync skipped because no proxy is configured");
      return;
    };

    let public_ip = match crate::ip_utils::fetch_public_ip(Some(proxy_for_geo.as_str())).await {
      Ok(ip) => ip,
      Err(e) => {
        log::warn!("Wayfern geo sync failed to fetch public IP through proxy: {e}");
        return;
      }
    };

    let geo = match crate::proxy_manager::ProxyManager::get_ip_geolocation(&public_ip).await {
      Ok(geo) => geo,
      Err(e) => {
        log::warn!("Wayfern geo sync failed to resolve geolocation for IP {public_ip}: {e}");
        return;
      }
    };

    if let Some(obj) = fingerprint.as_object_mut() {
      if let Some(timezone) = geo.timezone.as_ref() {
        obj.insert("timezone".to_string(), json!(timezone));
      }
      if let Some(offset_seconds) = geo.utc_offset_seconds {
        obj.insert(
          "timezoneOffset".to_string(),
          json!(Self::js_timezone_offset_minutes_from_utc_offset_seconds(
            offset_seconds
          )),
        );
      }
      if let Some(latitude) = geo.latitude {
        obj.insert("latitude".to_string(), json!(latitude));
      }
      if let Some(longitude) = geo.longitude {
        obj.insert("longitude".to_string(), json!(longitude));
      }
      if let Some(country_code) = geo.country_code.as_deref() {
        if let Some(locale) = Self::locale_from_country_code(country_code) {
          obj.insert("language".to_string(), json!(locale.clone()));
          obj.insert("languages".to_string(), json!([locale]));
        }
      }
    }

    log::info!(
      "Wayfern geo sync applied from proxy IP {}: timezone={:?}, offset={:?}, lat={:?}, lon={:?}, country={:?}",
      public_ip,
      geo.timezone,
      geo.utc_offset_seconds,
      geo.latitude,
      geo.longitude,
      geo.country_code
    );
  }

  async fn wait_for_cdp_ready(
    &self,
    port: u16,
    process_id: Option<u32>,
    stderr_log_path: Option<&Path>,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("http://127.0.0.1:{port}/json/version");
    // Bugium cold starts can legitimately take longer than 5s on slower
    // machines (proxy setup, extension load, first profile init). Prefer
    // smooth reliability over fast-fail.
    let max_attempts = 200;
    let delay = Duration::from_millis(150);
    let total_wait_ms = max_attempts as u64 * delay.as_millis() as u64;
    log::info!(
      "Waiting for CDP readiness on port {port} (max {} attempts, ~{}ms)",
      max_attempts,
      total_wait_ms
    );

    for attempt in 0..max_attempts {
      // Do not fail-fast solely on launcher PID death on Windows.
      // `buglogin-profile-*.exe` may exit after handing off to the real browser
      // process, while CDP is still coming up on the same port.

      match self
        .http_client
        .get(&url)
        .timeout(Duration::from_millis(500))
        .send()
        .await
      {
        Ok(resp) if resp.status().is_success() => {
          log::info!("CDP ready on port {port} after {attempt} attempts");
          return Ok(());
        }
        _ => {
          if let Some(pid) = process_id {
            if attempt % 20 == 0 {
              use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
              let mut system = System::new_with_specifics(
                RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
              );
              system.refresh_processes_specifics(
                ProcessesToUpdate::All,
                true,
                ProcessRefreshKind::everything(),
              );
              if system.process(Pid::from_u32(pid)).is_none() {
                log::warn!(
                  "Wayfern launcher PID {} is no longer running while waiting for CDP on port {} (handoff to child process may have occurred)",
                  pid,
                  port
                );
              }
            }
          }
          if attempt > 0 && attempt % 20 == 0 {
            log::info!("CDP still not ready on port {port} after {attempt} attempts");
          }
          tokio::time::sleep(delay).await;
        }
      }
    }

    let stderr_tail = stderr_log_path
      .and_then(|path| std::fs::read_to_string(path).ok())
      .map(|content| {
        let lines: Vec<&str> = content.lines().collect();
        let start = lines.len().saturating_sub(30);
        lines[start..].join("\n")
      })
      .filter(|tail| !tail.trim().is_empty());

    if let Some(tail) = stderr_tail {
      Err(
        format!(
          "CDP not ready after {max_attempts} attempts on port {port}. Last stderr lines:\n{}",
          tail
        )
        .into(),
      )
    } else {
      Err(format!("CDP not ready after {max_attempts} attempts on port {port}").into())
    }
  }

  async fn get_cdp_targets(
    &self,
    port: u16,
  ) -> Result<Vec<CdpTarget>, Box<dyn std::error::Error + Send + Sync>> {
    let url = format!("http://127.0.0.1:{port}/json");
    let resp = self.http_client.get(&url).send().await?;
    let targets: Vec<CdpTarget> = resp.json().await?;
    Ok(targets)
  }

  fn is_cdp_method_not_found(error: &str, method: &str) -> bool {
    error.contains("\"code\":-32601")
      || error.contains("wasn't found") && error.contains(method)
      || error.contains("Method not found")
  }

  async fn apply_standard_fingerprint_fallback(
    &self,
    ws_url: &str,
    fingerprint: &serde_json::Value,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if let Some(user_agent) = fingerprint.get("userAgent").and_then(|v| v.as_str()) {
      let _ = self
        .send_cdp_command(
          ws_url,
          "Network.setUserAgentOverride",
          json!({ "userAgent": user_agent }),
        )
        .await;
    }

    if let Some(timezone) = fingerprint.get("timezone").and_then(|v| v.as_str()) {
      let _ = self
        .send_cdp_command(
          ws_url,
          "Emulation.setTimezoneOverride",
          json!({ "timezoneId": timezone }),
        )
        .await;
    }

    let latitude = fingerprint.get("latitude").and_then(|v| v.as_f64());
    let longitude = fingerprint.get("longitude").and_then(|v| v.as_f64());
    if let (Some(lat), Some(lon)) = (latitude, longitude) {
      let _ = self
        .send_cdp_command(
          ws_url,
          "Emulation.setGeolocationOverride",
          json!({ "latitude": lat, "longitude": lon, "accuracy": 10 }),
        )
        .await;
    }

    Ok(())
  }

  async fn send_cdp_command(
    &self,
    ws_url: &str,
    method: &str,
    params: serde_json::Value,
  ) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
    let (mut ws_stream, _) = connect_async(ws_url).await?;

    let command = json!({
      "id": 1,
      "method": method,
      "params": params
    });

    use futures_util::sink::SinkExt;
    use futures_util::stream::StreamExt;

    ws_stream
      .send(Message::Text(command.to_string().into()))
      .await?;

    while let Some(msg) = ws_stream.next().await {
      match msg? {
        Message::Text(text) => {
          let response: serde_json::Value = serde_json::from_str(text.as_str())?;
          if response.get("id") == Some(&json!(1)) {
            if let Some(error) = response.get("error") {
              return Err(format!("CDP error: {}", error).into());
            }
            return Ok(response.get("result").cloned().unwrap_or(json!({})));
          }
        }
        Message::Close(_) => break,
        _ => {}
      }
    }

    Err("No response received from CDP".into())
  }

  pub async fn generate_fingerprint_config(
    &self,
    _app_handle: &AppHandle,
    profile: &BrowserProfile,
    config: &WayfernConfig,
  ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
    let executable_path = if let Some(path) = &config.executable_path {
      let p = PathBuf::from(path);
      if p.exists() {
        p
      } else {
        log::warn!("Stored Wayfern executable path does not exist: {path}, falling back to dynamic resolution");
        BrowserRunner::instance()
          .get_browser_executable_path(profile)
          .map_err(|e| format!("Failed to get Wayfern executable path: {e}"))?
      }
    } else {
      BrowserRunner::instance()
        .get_browser_executable_path(profile)
        .map_err(|e| format!("Failed to get Wayfern executable path: {e}"))?
    };

    let port = Self::find_free_port().await?;
    log::info!("Launching headless Wayfern on port {port} for fingerprint generation");

    let temp_profile_dir =
      std::env::temp_dir().join(format!("wayfern_fingerprint_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_profile_dir)?;

    let mut cmd = TokioCommand::new(&executable_path);
    cmd
      .arg("--headless=new")
      .arg(format!("--remote-debugging-port={port}"))
      .arg("--remote-debugging-address=127.0.0.1")
      .arg(format!("--user-data-dir={}", temp_profile_dir.display()))
      .arg("--disable-gpu")
      .arg("--no-first-run")
      .arg("--no-default-browser-check")
      .arg("--disable-background-mode")
      .arg("--use-mock-keychain")
      .arg("--password-store=basic")
      .arg("--disable-features=DialMediaRouteProvider")
      .stdout(Stdio::null())
      .stderr(Stdio::null());

    let child = cmd.spawn()?;
    let child_id = child.id();

    let cleanup = || async {
      if let Some(id) = child_id {
        #[cfg(unix)]
        {
          use nix::sys::signal::{kill, Signal};
          use nix::unistd::Pid;
          let _ = kill(Pid::from_raw(id as i32), Signal::SIGTERM);
        }
        #[cfg(windows)]
        {
          use std::os::windows::process::CommandExt;
          const CREATE_NO_WINDOW: u32 = 0x08000000;
          let _ = std::process::Command::new("taskkill")
            .args(["/PID", &id.to_string(), "/F"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
        }
      }
      let _ = std::fs::remove_dir_all(&temp_profile_dir);
    };

    if let Err(e) = self.wait_for_cdp_ready(port, child_id, None).await {
      cleanup().await;
      return Err(e);
    }

    let targets = match self.get_cdp_targets(port).await {
      Ok(t) => t,
      Err(e) => {
        cleanup().await;
        return Err(e);
      }
    };

    let page_target = targets
      .iter()
      .find(|t| t.target_type == "page" && t.websocket_debugger_url.is_some());

    let ws_url = match page_target {
      Some(target) => target.websocket_debugger_url.as_ref().unwrap().clone(),
      None => {
        cleanup().await;
        return Err("No page target found for CDP".into());
      }
    };

    let os = config
      .os
      .as_deref()
      .unwrap_or(if cfg!(target_os = "macos") {
        "macos"
      } else if cfg!(target_os = "linux") {
        "linux"
      } else {
        "windows"
      });

    let refresh_result = self
      .send_cdp_command(
        &ws_url,
        "Wayfern.refreshFingerprint",
        json!({ "operatingSystem": os }),
      )
      .await;

    if let Err(e) = refresh_result {
      let error_text = e.to_string();
      if Self::is_cdp_method_not_found(&error_text, "Wayfern.refreshFingerprint") {
        log::warn!(
          "Wayfern.refreshFingerprint not available in this runtime; continuing with existing fingerprint state"
        );
      } else {
        cleanup().await;
        return Err(format!("Failed to refresh fingerprint: {e}").into());
      }
    }

    let runtime_user_agent = self.get_runtime_user_agent(&ws_url).await;

    let get_result = self
      .send_cdp_command(&ws_url, "Wayfern.getFingerprint", json!({}))
      .await;

    let fingerprint = match get_result {
      Ok(result) => {
        // Wayfern.getFingerprint returns { fingerprint: {...} }
        // We need to extract just the fingerprint object
        let fp = result.get("fingerprint").cloned().unwrap_or(result);
        // Normalize the fingerprint: convert JSON string fields to proper types
        let mut normalized = Self::normalize_fingerprint(fp);

        self
          .sync_fingerprint_with_proxy_context(
            profile,
            config,
            config.proxy.as_deref(),
            &mut normalized,
          )
          .await;

        if let Some(runtime_ua) = runtime_user_agent.as_deref() {
          Self::sync_runtime_user_agent(&mut normalized, runtime_ua);
        }
        Self::enforce_storage_signals(&mut normalized, profile.ephemeral);
        Self::ensure_timezone_defaults(&mut normalized);

        normalized
      }
      Err(e) => {
        let error_text = e.to_string();
        if Self::is_cdp_method_not_found(&error_text, "Wayfern.getFingerprint") {
          log::warn!(
            "Wayfern.getFingerprint not available in this runtime; falling back to stored fingerprint config when possible"
          );
          if let Some(raw_fingerprint) = config.fingerprint.as_deref() {
            if let Ok(mut fallback_fp) = serde_json::from_str::<serde_json::Value>(raw_fingerprint)
            {
              self
                .sync_fingerprint_with_proxy_context(
                  profile,
                  config,
                  config.proxy.as_deref(),
                  &mut fallback_fp,
                )
                .await;
              if let Some(runtime_ua) = runtime_user_agent.as_deref() {
                Self::sync_runtime_user_agent(&mut fallback_fp, runtime_ua);
              }
              Self::enforce_storage_signals(&mut fallback_fp, profile.ephemeral);
              Self::ensure_timezone_defaults(&mut fallback_fp);
              fallback_fp
            } else {
              cleanup().await;
              return Err(format!("Failed to parse stored fingerprint config after Wayfern.getFingerprint missing: {e}").into());
            }
          } else {
            log::warn!(
              "No stored fingerprint available and Wayfern CDP not present; generating minimal software fingerprint"
            );
            let mut fallback_fp = json!({
              "localStorage": true,
              "sessionStorage": true,
              "indexedDb": true,
              "cookieEnabled": true,
            });
            if let Some(runtime_ua) = runtime_user_agent.as_deref() {
              Self::sync_runtime_user_agent(&mut fallback_fp, runtime_ua);
            }
            self
              .sync_fingerprint_with_proxy_context(
                profile,
                config,
                config.proxy.as_deref(),
                &mut fallback_fp,
              )
              .await;
            Self::enforce_storage_signals(&mut fallback_fp, profile.ephemeral);
            Self::ensure_timezone_defaults(&mut fallback_fp);
            fallback_fp
          }
        } else {
          cleanup().await;
          return Err(format!("Failed to get fingerprint: {e}").into());
        }
      }
    };

    cleanup().await;

    let fingerprint_json = serde_json::to_string(&fingerprint)
      .map_err(|e| format!("Failed to serialize fingerprint: {e}"))?;

    log::info!(
      "Generated Wayfern fingerprint for OS: {}, fields: {:?}",
      os,
      fingerprint
        .as_object()
        .map(|o| o.keys().collect::<Vec<_>>())
    );

    // Log timezone/geolocation fields specifically for debugging
    if let Some(obj) = fingerprint.as_object() {
      log::info!(
        "Generated fingerprint - timezone: {:?}, timezoneOffset: {:?}, latitude: {:?}, longitude: {:?}, language: {:?}",
        obj.get("timezone"),
        obj.get("timezoneOffset"),
        obj.get("latitude"),
        obj.get("longitude"),
        obj.get("language")
      );
    }

    Ok(fingerprint_json)
  }

  #[allow(clippy::too_many_arguments)]
  pub async fn launch_wayfern(
    &self,
    _app_handle: &AppHandle,
    profile: &BrowserProfile,
    profile_path: &str,
    config: &WayfernConfig,
    url: Option<&str>,
    proxy_url: Option<&str>,
    ephemeral: bool,
    extension_paths: &[String],
  ) -> Result<WayfernLaunchResult, Box<dyn std::error::Error + Send + Sync>> {
    let executable_path = if let Some(path) = &config.executable_path {
      let p = PathBuf::from(path);
      if p.exists() {
        p
      } else {
        log::warn!("Stored Wayfern executable path does not exist: {path}, falling back to dynamic resolution");
        BrowserRunner::instance()
          .get_browser_executable_path(profile)
          .map_err(|e| format!("Failed to get Wayfern executable path: {e}"))?
      }
    } else {
      BrowserRunner::instance()
        .get_browser_executable_path(profile)
        .map_err(|e| format!("Failed to get Wayfern executable path: {e}"))?
    };

    let port = Self::find_free_port().await?;
    log::info!("Launching Wayfern on CDP port {port}");

    // Keep launch args close to Wayfern's known-stable baseline.
    // Avoid over-constraining flags that can break forked Chromium builds.
    let mut args = vec![
      format!("--remote-debugging-port={port}"),
      "--remote-debugging-address=127.0.0.1".to_string(),
      format!("--user-data-dir={}", profile_path),
      format!("--lang={}", Self::resolve_launch_language(config)),
      "--no-first-run".to_string(),
      "--no-default-browser-check".to_string(),
      "--disable-background-mode".to_string(),
      "--use-mock-keychain".to_string(),
      "--password-store=basic".to_string(),
    ];

    if let Some(proxy) = proxy_url {
      args.push(format!("--proxy-server={proxy}"));
    }

    if ephemeral {
      args.push("--disk-cache-size=1".to_string());
      args.push("--disable-breakpad".to_string());
      args.push("--disable-crash-reporter".to_string());
      args.push("--no-service-autorun".to_string());
      args.push("--disable-sync".to_string());
    }

    if !extension_paths.is_empty() {
      let extension_csv = extension_paths.join(",");
      args.push(format!("--load-extension={extension_csv}"));
      args.push(format!("--disable-extensions-except={extension_csv}"));
      if extension_csv.contains(".buglogin-runtime-identity-ext") {
        log::info!(
          "Wayfern runtime identity extension enabled for profile {}",
          profile.name
        );
      }
    }

    // Don't add URL to args - we'll navigate via CDP after setting fingerprint
    // This ensures fingerprint is applied at navigation commit time

    log::info!(
      "Wayfern executable resolved: {} | args_count={}",
      executable_path.display(),
      args.len()
    );
    let stderr_log_path = std::env::temp_dir().join(format!(
      "buglogin-wayfern-launch-{}-{}.log",
      profile
        .id
        .to_string()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
        .collect::<String>(),
      port
    ));
    let stderr_log_file = std::fs::OpenOptions::new()
      .create(true)
      .write(true)
      .truncate(true)
      .open(&stderr_log_path)
      .map_err(|e| format!("Failed to create Wayfern stderr log file: {e}"))?;
    let stdout_log_file = stderr_log_file
      .try_clone()
      .map_err(|e| format!("Failed to clone Wayfern stderr log file handle: {e}"))?;

    log::info!(
      "Wayfern launch stdout/stderr redirected to {}",
      stderr_log_path.display()
    );

    let mut cmd = TokioCommand::new(&executable_path);
    cmd.args(&args);
    cmd.stdout(Stdio::from(stdout_log_file));
    cmd.stderr(Stdio::from(stderr_log_file));

    let child = cmd.spawn()?;
    let process_id = child.id();

    self
      .wait_for_cdp_ready(port, process_id, Some(&stderr_log_path))
      .await?;

    // Get CDP targets first - needed for both fingerprint and navigation
    let targets = self.get_cdp_targets(port).await?;
    log::info!("Found {} CDP targets", targets.len());

    let page_targets: Vec<_> = targets.iter().filter(|t| t.target_type == "page").collect();
    log::info!("Found {} page targets", page_targets.len());

    let runtime_user_agent = if let Some(target) = page_targets.first() {
      if let Some(ws_url) = &target.websocket_debugger_url {
        self.get_runtime_user_agent(ws_url).await
      } else {
        None
      }
    } else {
      None
    };

    // Apply fingerprint if configured
    if let Some(fingerprint_json) = &config.fingerprint {
      log::info!(
        "Applying fingerprint to Wayfern browser, fingerprint length: {} chars",
        fingerprint_json.len()
      );

      let stored_value: serde_json::Value = serde_json::from_str(fingerprint_json)
        .map_err(|e| format!("Failed to parse stored fingerprint JSON: {e}"))?;

      // The stored fingerprint should be the fingerprint object directly (after our fix in generate_fingerprint_config)
      // But for backwards compatibility, also handle the wrapped format
      let mut fingerprint = if stored_value.get("fingerprint").is_some() {
        // Old format: {"fingerprint": {...}} - extract the inner fingerprint
        stored_value.get("fingerprint").cloned().unwrap()
      } else {
        // New format: fingerprint object directly {...}
        stored_value.clone()
      };

      self
        .sync_fingerprint_with_proxy_context(profile, config, proxy_url, &mut fingerprint)
        .await;

      if let Some(runtime_ua) = runtime_user_agent.as_deref() {
        Self::sync_runtime_user_agent(&mut fingerprint, runtime_ua);
      }
      Self::enforce_storage_signals(&mut fingerprint, ephemeral);
      Self::ensure_timezone_defaults(&mut fingerprint);

      // Denormalize fingerprint for Wayfern CDP (convert arrays/objects to JSON strings)
      let fingerprint_for_cdp = Self::denormalize_fingerprint(fingerprint);

      log::info!(
        "Fingerprint prepared for CDP command, fields: {:?}",
        fingerprint_for_cdp
          .as_object()
          .map(|o| o.keys().collect::<Vec<_>>())
      );

      // Log timezone and geolocation fields specifically for debugging
      if let Some(obj) = fingerprint_for_cdp.as_object() {
        log::info!(
          "Timezone/Geolocation fields - timezone: {:?}, timezoneOffset: {:?}, latitude: {:?}, longitude: {:?}, language: {:?}, languages: {:?}",
          obj.get("timezone"),
          obj.get("timezoneOffset"),
          obj.get("latitude"),
          obj.get("longitude"),
          obj.get("language"),
          obj.get("languages")
        );
      }

      for target in &page_targets {
        if let Some(ws_url) = &target.websocket_debugger_url {
          log::info!("Applying fingerprint to target via WebSocket: {}", ws_url);
          // Wayfern.setFingerprint expects the fingerprint object directly, NOT wrapped
          match self
            .send_cdp_command(
              ws_url,
              "Wayfern.setFingerprint",
              fingerprint_for_cdp.clone(),
            )
            .await
          {
            Ok(result) => log::info!(
              "Successfully applied fingerprint to page target: {:?}",
              result
            ),
            Err(e) => {
              let error_text = e.to_string();
              if Self::is_cdp_method_not_found(&error_text, "Wayfern.setFingerprint") {
                log::warn!(
                  "Wayfern.setFingerprint not available in this runtime; applying standard CDP fallback"
                );
                if let Err(fallback_error) = self
                  .apply_standard_fingerprint_fallback(ws_url, &fingerprint_for_cdp)
                  .await
                {
                  log::warn!(
                    "Standard fingerprint fallback failed for target {}: {}",
                    ws_url,
                    fallback_error
                  );
                }
              } else {
                log::warn!("Failed to apply fingerprint to target: {}", error_text);
              }
            }
          }
        }
      }
    } else {
      log::warn!("No fingerprint found in config, browser will use default fingerprint");
    }

    // Navigate to URL via CDP - fingerprint will be applied at navigation commit time
    if let Some(url) = url {
      log::info!("Navigating to URL via CDP: {}", url);
      if let Some(target) = page_targets.first() {
        if let Some(ws_url) = &target.websocket_debugger_url {
          match self
            .send_cdp_command(ws_url, "Page.navigate", json!({ "url": url }))
            .await
          {
            Ok(_) => log::info!("Successfully navigated to URL: {}", url),
            Err(e) => log::error!("Failed to navigate to URL: {e}"),
          }
        }
      }
    }

    let id = uuid::Uuid::new_v4().to_string();
    let instance = WayfernInstance {
      id: id.clone(),
      process_id,
      profile_path: Some(profile_path.to_string()),
      url: url.map(|s| s.to_string()),
      cdp_port: Some(port),
    };

    let mut inner = self.inner.lock().await;
    inner.instances.insert(id.clone(), instance);

    Ok(WayfernLaunchResult {
      id,
      processId: process_id,
      profilePath: Some(profile_path.to_string()),
      url: url.map(|s| s.to_string()),
      cdp_port: Some(port),
    })
  }

  pub async fn stop_wayfern(
    &self,
    id: &str,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut inner = self.inner.lock().await;

    if let Some(instance) = inner.instances.remove(id) {
      if let Some(pid) = instance.process_id {
        #[cfg(unix)]
        {
          use nix::sys::signal::{kill, Signal};
          use nix::unistd::Pid;
          let _ = kill(Pid::from_raw(pid as i32), Signal::SIGTERM);
        }
        #[cfg(windows)]
        {
          use std::os::windows::process::CommandExt;
          const CREATE_NO_WINDOW: u32 = 0x08000000;
          let graceful = std::process::Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

          let mut still_running = false;
          if graceful.as_ref().is_ok() {
            use sysinfo::{Pid, ProcessRefreshKind, RefreshKind, System};
            std::thread::sleep(std::time::Duration::from_millis(800));
            let system = System::new_with_specifics(
              RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
            );
            still_running = system.process(Pid::from_u32(pid)).is_some();
          }

          // Fallback force kill only if graceful termination did not finish.
          if still_running {
            let _ = std::process::Command::new("taskkill")
              .args(["/PID", &pid.to_string(), "/T", "/F"])
              .creation_flags(CREATE_NO_WINDOW)
              .output();
          }
        }
        log::info!("Stopped Wayfern instance {id} (PID: {pid})");
      }
    }

    Ok(())
  }

  /// Opens a URL in a new tab for an existing Wayfern instance using CDP.
  /// Returns Ok(()) if successful, or an error if the instance is not found or CDP fails.
  pub async fn open_url_in_tab(
    &self,
    profile_path: &str,
    url: &str,
  ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let instance = self
      .find_wayfern_by_profile(profile_path)
      .await
      .ok_or("Wayfern instance not found for profile")?;

    let cdp_port = instance
      .cdp_port
      .ok_or("No CDP port available for Wayfern instance")?;

    // Get the browser target to create a new tab
    let targets = self.get_cdp_targets(cdp_port).await?;

    // Find a page target to get the WebSocket URL (we need any target to send commands)
    let page_target = targets
      .iter()
      .find(|t| t.target_type == "page" && t.websocket_debugger_url.is_some())
      .ok_or("No page target found for CDP")?;

    let ws_url = page_target
      .websocket_debugger_url
      .as_ref()
      .ok_or("No WebSocket URL available")?;

    // Use Target.createTarget to open a new tab with the URL
    self
      .send_cdp_command(ws_url, "Target.createTarget", json!({ "url": url }))
      .await?;

    log::info!("Opened URL in new tab via CDP: {}", url);
    Ok(())
  }

  pub async fn find_wayfern_by_profile(&self, profile_path: &str) -> Option<WayfernLaunchResult> {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};

    let mut inner = self.inner.lock().await;

    // Canonicalize the target path for comparison
    let target_path = std::path::Path::new(profile_path)
      .canonicalize()
      .unwrap_or_else(|_| std::path::Path::new(profile_path).to_path_buf());

    // Find the instance with the matching profile path
    let mut found_id: Option<String> = None;
    for (id, instance) in &inner.instances {
      if let Some(path) = &instance.profile_path {
        let instance_path = std::path::Path::new(path)
          .canonicalize()
          .unwrap_or_else(|_| std::path::Path::new(path).to_path_buf());
        if instance_path == target_path {
          found_id = Some(id.clone());
          break;
        }
      }
    }

    // If we found an instance, verify the process is still running
    if let Some(id) = found_id {
      if let Some(instance) = inner.instances.get(&id) {
        if let Some(pid) = instance.process_id {
          let system = System::new_with_specifics(
            RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
          );
          let sysinfo_pid = sysinfo::Pid::from_u32(pid);

          if system.process(sysinfo_pid).is_some() {
            return Some(WayfernLaunchResult {
              id: id.clone(),
              processId: instance.process_id,
              profilePath: instance.profile_path.clone(),
              url: instance.url.clone(),
              cdp_port: instance.cdp_port,
            });
          } else {
            log::info!(
              "Wayfern process {} for profile {} is no longer running, cleaning up",
              pid,
              profile_path
            );
            inner.instances.remove(&id);
            return None;
          }
        }
      }
    }

    // If not found in in-memory instances, scan system processes.
    // This handles the case where the GUI was restarted but Wayfern is still running.
    if let Some((pid, found_profile_path, cdp_port)) =
      Self::find_wayfern_process_by_profile(&target_path)
    {
      log::info!(
        "Found running Wayfern process (PID: {}) for profile path via system scan",
        pid
      );

      let instance_id = format!("recovered_{}", pid);
      inner.instances.insert(
        instance_id.clone(),
        WayfernInstance {
          id: instance_id.clone(),
          process_id: Some(pid),
          profile_path: Some(found_profile_path.clone()),
          url: None,
          cdp_port,
        },
      );

      return Some(WayfernLaunchResult {
        id: instance_id,
        processId: Some(pid),
        profilePath: Some(found_profile_path),
        url: None,
        cdp_port,
      });
    }

    None
  }

  /// Scan system processes to find a Wayfern/Chromium process using a specific profile path
  fn find_wayfern_process_by_profile(
    target_path: &std::path::Path,
  ) -> Option<(u32, String, Option<u16>)> {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};

    let system = System::new_with_specifics(
      RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
    );

    let target_path_str = target_path.to_string_lossy();

    for (pid, process) in system.processes() {
      let cmd = process.cmd();
      if cmd.is_empty() {
        continue;
      }

      let exe_name = process.name().to_string_lossy().to_lowercase();
      let is_chromium_like = exe_name.contains("bugium")
        || exe_name.contains("wayfern")
        || exe_name.contains("chromium")
        || exe_name.contains("chrome")
        || exe_name.starts_with("buglogin-profile-");

      if !is_chromium_like {
        continue;
      }

      // Skip child processes (renderer, GPU, utility, zygote, etc.)
      // Only the main browser process lacks a --type= argument
      let is_child = cmd
        .iter()
        .any(|a| a.to_str().is_some_and(|s| s.starts_with("--type=")));
      if is_child {
        continue;
      }

      let mut matched = false;
      let mut cdp_port: Option<u16> = None;

      for arg in cmd.iter() {
        if let Some(arg_str) = arg.to_str() {
          if let Some(dir_val) = arg_str.strip_prefix("--user-data-dir=") {
            let cmd_path = std::path::Path::new(dir_val)
              .canonicalize()
              .unwrap_or_else(|_| std::path::Path::new(dir_val).to_path_buf());
            if cmd_path == target_path {
              matched = true;
            }
          }

          if let Some(port_val) = arg_str.strip_prefix("--remote-debugging-port=") {
            cdp_port = port_val.parse().ok();
          }
        }
      }

      if matched {
        return Some((pid.as_u32(), target_path_str.to_string(), cdp_port));
      }
    }

    None
  }

  #[allow(dead_code)]
  pub async fn launch_wayfern_profile(
    &self,
    app_handle: &AppHandle,
    profile: &BrowserProfile,
    config: &WayfernConfig,
    url: Option<&str>,
    proxy_url: Option<&str>,
  ) -> Result<WayfernLaunchResult, Box<dyn std::error::Error + Send + Sync>> {
    let profiles_dir = self.get_profiles_dir();
    let profile_path = profiles_dir.join(profile.id.to_string()).join("profile");
    let profile_path_str = profile_path.to_string_lossy().to_string();

    std::fs::create_dir_all(&profile_path)?;

    if let Some(existing) = self.find_wayfern_by_profile(&profile_path_str).await {
      if url.is_none() {
        log::info!(
          "Reusing existing Wayfern instance for profile '{}' (ID: {})",
          profile.name,
          profile.id
        );
        return Ok(existing);
      }

      log::info!("Stopping existing Wayfern instance for profile");
      self.stop_wayfern(&existing.id).await?;
    }

    self
      .launch_wayfern(
        app_handle,
        profile,
        &profile_path_str,
        config,
        url,
        proxy_url,
        profile.ephemeral,
        &[],
      )
      .await
  }

  #[allow(dead_code)]
  pub async fn cleanup_dead_instances(&self) {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};

    let mut inner = self.inner.lock().await;
    let mut dead_ids = Vec::new();

    let system = System::new_with_specifics(
      RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()),
    );

    for (id, instance) in &inner.instances {
      if let Some(pid) = instance.process_id {
        let pid = sysinfo::Pid::from_u32(pid);
        if !system.processes().contains_key(&pid) {
          dead_ids.push(id.clone());
        }
      }
    }

    for id in dead_ids {
      log::info!("Cleaning up dead Wayfern instance: {id}");
      inner.instances.remove(&id);
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_is_geoip_enabled_defaults_to_true() {
    assert!(WayfernManager::is_geoip_enabled(&WayfernConfig::default()));

    let mut disabled_bool = WayfernConfig::default();
    disabled_bool.geoip = Some(serde_json::json!(false));
    assert!(!WayfernManager::is_geoip_enabled(&disabled_bool));

    let mut disabled_str = WayfernConfig::default();
    disabled_str.geoip = Some(serde_json::json!("false"));
    assert!(!WayfernManager::is_geoip_enabled(&disabled_str));
  }

  #[test]
  fn test_convert_utc_offset_to_js_offset_minutes() {
    // UTC-7 => JS getTimezoneOffset() = +420
    assert_eq!(
      WayfernManager::js_timezone_offset_minutes_from_utc_offset_seconds(-7 * 3600),
      420
    );
    // UTC+7 => JS getTimezoneOffset() = -420
    assert_eq!(
      WayfernManager::js_timezone_offset_minutes_from_utc_offset_seconds(7 * 3600),
      -420
    );
  }

  #[test]
  fn test_ensure_timezone_defaults_uses_utc_pair() {
    let mut fingerprint = serde_json::json!({});
    WayfernManager::ensure_timezone_defaults(&mut fingerprint);
    assert_eq!(fingerprint.get("timezone"), Some(&serde_json::json!("UTC")));
    assert_eq!(
      fingerprint.get("timezoneOffset"),
      Some(&serde_json::json!(0))
    );
  }

  #[test]
  fn test_extract_chrome_major_from_user_agent() {
    let ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
    assert_eq!(
      WayfernManager::extract_chrome_major_from_user_agent(ua),
      Some("145".to_string())
    );
  }

  #[test]
  fn test_sync_runtime_user_agent_updates_version_fields() {
    let mut fingerprint = serde_json::json!({
      "userAgent": "Mozilla/5.0 ... Chrome/119.0.0.0 ...",
      "brandVersion": "119"
    });

    WayfernManager::sync_runtime_user_agent(
      &mut fingerprint,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
    );

    assert_eq!(
      fingerprint.get("brandVersion"),
      Some(&serde_json::json!("145"))
    );
    assert_eq!(
      fingerprint.get("userAgent"),
      Some(&serde_json::json!(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
      ))
    );
  }

  #[test]
  fn test_enforce_storage_signals_for_persistent_profile() {
    let mut fingerprint = serde_json::json!({
      "localStorage": false,
      "sessionStorage": false,
      "indexedDb": false,
      "cookieEnabled": false
    });

    WayfernManager::enforce_storage_signals(&mut fingerprint, false);

    assert_eq!(
      fingerprint.get("localStorage"),
      Some(&serde_json::json!(true))
    );
    assert_eq!(
      fingerprint.get("sessionStorage"),
      Some(&serde_json::json!(true))
    );
    assert_eq!(fingerprint.get("indexedDb"), Some(&serde_json::json!(true)));
    assert_eq!(
      fingerprint.get("cookieEnabled"),
      Some(&serde_json::json!(true))
    );
  }
}

lazy_static::lazy_static! {
  static ref WAYFERN_MANAGER: WayfernManager = WayfernManager::new();
}
