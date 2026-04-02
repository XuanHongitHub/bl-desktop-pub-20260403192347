use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use zip::write::FileOptions;

use crate::browser::BrowserType;

const RUNTIME_IDENTITY_EXTENSION_VERSION: &str = "1.1.1";

fn build_profile_tag(profile_name: &str) -> String {
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

fn escape_js_single_quoted(value: &str) -> String {
  value
    .replace('\\', "\\\\")
    .replace('\'', "\\'")
    .replace('\n', "\\n")
    .replace('\r', "\\r")
}

fn build_content_js(profile_name: &str) -> String {
  let safe_name = escape_js_single_quoted(profile_name.trim());
  let safe_tag = escape_js_single_quoted(&build_profile_tag(profile_name));
  format!(
    r#"(function () {{
  const PROFILE_NAME = '{safe_name}';
  const PROFILE_TAG = '{safe_tag}';

  function labelFromLocation() {{
    try {{
      const host = (location.hostname || '').replace(/^www\./, '');
      const path = (location.pathname || '') + (location.search || '');
      const label = (host + path).trim();
      return label || (location.href || '').trim();
    }} catch (_e) {{
      return '';
    }}
  }}

  function buildTitle() {{
    const label = labelFromLocation();
    if (!PROFILE_NAME) return document.title || '';
    if (!label) return `[${{PROFILE_TAG}}] ${{PROFILE_NAME}}`;
    return `[${{PROFILE_TAG}}] ${{PROFILE_NAME}} • ${{label}}`;
  }}

  function buildFaviconDataUrl() {{
    try {{
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#111d33';
      ctx.fillRect(4, 4, 56, 56);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const compact = (PROFILE_TAG || 'profile').replace(/[^a-z0-9]/gi, '').slice(0, 7);
      const firstLine = compact.slice(0, 4);
      const secondLine = compact.slice(4);

      if (secondLine) {{
        ctx.font = '700 11px "Segoe UI Variable Text", "Segoe UI", sans-serif';
        ctx.fillText(firstLine, 32, 24);
        ctx.fillText(secondLine, 32, 40);
      }} else {{
        ctx.font = '700 12px "Segoe UI Variable Text", "Segoe UI", sans-serif';
        ctx.fillText(firstLine || 'profile', 32, 32);
      }}
      return canvas.toDataURL('image/png');
    }} catch (_e) {{
      return null;
    }}
  }}

  function applyFavicon() {{
    const dataUrl = buildFaviconDataUrl();
    if (!dataUrl) return;

    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {{
      icon = document.createElement('link');
      icon.setAttribute('rel', 'icon');
      document.head.appendChild(icon);
    }}
    icon.setAttribute('href', dataUrl);
  }}

  function applyTitle() {{
    const next = buildTitle();
    if (!next) return;
    if (document.title !== next) {{
      document.title = next;
    }}
    applyFavicon();
  }}

  applyTitle();
  setInterval(applyTitle, 700);
  window.addEventListener('hashchange', applyTitle, true);
  window.addEventListener('popstate', applyTitle, true);

  const titleNode = document.querySelector('title');
  if (titleNode && 'MutationObserver' in window) {{
    const observer = new MutationObserver(applyTitle);
    observer.observe(titleNode, {{ childList: true, subtree: true, characterData: true }});
  }}
}})();
"#
  )
}

fn build_newtab_html() -> &'static str {
  r#"<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>BugLogin Profile</title>
    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: radial-gradient(circle at 20% 20%, #0b1325 0%, #050910 60%, #03060b 100%);
        color: #e2e8f0;
        font-family: "Segoe UI", sans-serif;
      }
      .card {
        border: 1px solid rgba(148, 163, 184, 0.26);
        border-radius: 14px;
        background: rgba(15, 23, 42, 0.72);
        padding: 18px 20px;
        min-width: 320px;
        max-width: 480px;
        box-shadow: 0 20px 40px rgba(3, 6, 11, 0.45);
      }
      .title {
        margin: 0;
        font-size: 13px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #94a3b8;
      }
      .profile {
        margin-top: 8px;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.35;
      }
      .hint {
        margin-top: 8px;
        font-size: 12px;
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <p class="title">BugLogin Profile</p>
      <div class="profile" id="buglogin-profile-label">Loading...</div>
      <p class="hint">Open any URL to continue this profile session.</p>
    </div>
    <script src="newtab.js"></script>
  </body>
</html>
"#
}

fn build_newtab_js(profile_name: &str) -> String {
  let safe_name = escape_js_single_quoted(profile_name.trim());
  let safe_tag = escape_js_single_quoted(&build_profile_tag(profile_name));
  format!(
    r#"(function () {{
  const PROFILE_NAME = '{safe_name}';
  const PROFILE_TAG = '{safe_tag}';

  function buildFaviconDataUrl() {{
    try {{
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#111d33';
      ctx.fillRect(4, 4, 56, 56);
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const compact = (PROFILE_TAG || 'profile').replace(/[^a-z0-9]/gi, '').slice(0, 7);
      const firstLine = compact.slice(0, 4);
      const secondLine = compact.slice(4);

      if (secondLine) {{
        ctx.font = '700 11px "Segoe UI Variable Text", "Segoe UI", sans-serif';
        ctx.fillText(firstLine, 32, 24);
        ctx.fillText(secondLine, 32, 40);
      }} else {{
        ctx.font = '700 12px "Segoe UI Variable Text", "Segoe UI", sans-serif';
        ctx.fillText(firstLine || 'profile', 32, 32);
      }}
      return canvas.toDataURL('image/png');
    }} catch (_e) {{
      return null;
    }}
  }}

  function applyIdentity() {{
    const titleBase = PROFILE_NAME ? `[${{PROFILE_TAG}}] ${{PROFILE_NAME}}` : `[${{PROFILE_TAG}}]`;
    document.title = `${{titleBase}} • New Tab`;

    const label = document.getElementById('buglogin-profile-label');
    if (label) {{
      label.textContent = titleBase;
    }}

    const dataUrl = buildFaviconDataUrl();
    if (!dataUrl) return;
    let icon = document.querySelector('link[rel="icon"]');
    if (!icon) {{
      icon = document.createElement('link');
      icon.setAttribute('rel', 'icon');
      document.head.appendChild(icon);
    }}
    icon.setAttribute('href', dataUrl);
  }}

  if (document.readyState === 'loading') {{
    document.addEventListener('DOMContentLoaded', applyIdentity, {{ once: true }});
  }} else {{
    applyIdentity();
  }}
}})();
"#
  )
}

fn escape_css_content(value: &str) -> String {
  value
    .replace('\\', "\\\\")
    .replace('"', "\\\"")
    .replace('\n', " ")
    .replace('\r', " ")
}

fn upsert_marked_css_block(
  file_path: &Path,
  start_marker: &str,
  end_marker: &str,
  block: &str,
) -> Result<(), String> {
  let mut current = fs::read_to_string(file_path).unwrap_or_default();
  let wrapped_block = format!("{start_marker}\n{block}\n{end_marker}\n");

  if let Some(start_idx) = current.find(start_marker) {
    if let Some(relative_end_idx) = current[start_idx..].find(end_marker) {
      let end_idx = start_idx + relative_end_idx + end_marker.len();
      current.replace_range(start_idx..end_idx, wrapped_block.trim_end());
      if !current.ends_with('\n') {
        current.push('\n');
      }
    } else {
      if !current.ends_with('\n') && !current.is_empty() {
        current.push('\n');
      }
      current.push_str(&wrapped_block);
    }
  } else {
    if !current.ends_with('\n') && !current.is_empty() {
      current.push('\n');
    }
    current.push_str(&wrapped_block);
  }

  fs::write(file_path, current).map_err(|e| {
    format!(
      "Failed to write Firefox userChrome.css block at {}: {e}",
      file_path.display()
    )
  })?;
  Ok(())
}

fn upsert_user_pref_bool(file_path: &Path, key: &str, value: bool) -> Result<(), String> {
  let mut lines: Vec<String> = fs::read_to_string(file_path)
    .ok()
    .map(|content| content.lines().map(|line| line.to_string()).collect())
    .unwrap_or_default();

  let key_prefix = format!("user_pref(\"{key}\",");
  lines.retain(|line| !line.trim_start().starts_with(&key_prefix));
  lines.push(format!(
    "user_pref(\"{key}\", {});",
    if value { "true" } else { "false" }
  ));
  let serialized = format!("{}\n", lines.join("\n"));
  fs::write(file_path, serialized).map_err(|e| {
    format!(
      "Failed to write Firefox preference {}: {e}",
      file_path.display()
    )
  })?;
  Ok(())
}

fn ensure_firefox_urlbar_profile_badge(
  profile_path: &Path,
  profile_name: &str,
) -> Result<(), String> {
  const START_MARKER: &str = "/* BUGLOGIN_PROFILE_BADGE_START */";
  const END_MARKER: &str = "/* BUGLOGIN_PROFILE_BADGE_END */";
  const PREF_KEY_STYLESHEETS: &str = "toolkit.legacyUserProfileCustomizations.stylesheets";
  const PREF_KEY_TASKBAR_GROUPING: &str = "taskbar.grouping.useprofile";

  let chrome_dir = profile_path.join("chrome");
  fs::create_dir_all(&chrome_dir)
    .map_err(|e| format!("Failed to create Firefox chrome directory: {e}"))?;

  let display_name = profile_name.trim();
  let safe_display_name = if display_name.is_empty() {
    "BugLogin Profile"
  } else {
    display_name
  };
  let profile_tag = build_profile_tag(profile_name);
  let css_label = escape_css_content(&format!("[{profile_tag}] {safe_display_name}"));

  let css_block = format!(
    r#"#urlbar .urlbar-input-container::before,
#urlbar-input-container::before {{
  content: "{css_label}" !important;
  display: inline-flex !important;
  align-items: center !important;
  -moz-box-align: center !important;
  flex: 0 0 auto !important;
  margin-inline-end: 8px !important;
  padding: 2px 9px !important;
  min-height: 24px !important;
  border-radius: 999px !important;
  border: 1px solid color-mix(in srgb, var(--toolbar-field-color, #e5e7eb) 16%, transparent) !important;
  background-color: color-mix(in srgb, var(--toolbar-field-background-color, #111827) 78%, #334155 22%) !important;
  color: var(--toolbar-field-color, #e5e7eb) !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  letter-spacing: 0.04em !important;
  text-transform: none !important;
  font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif !important;
  max-width: 320px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}}

/* Fallback for themes/layouts where input-container pseudo elements are ignored. */
#identity-box::after,
#identity-icon-box::after {{
  content: "{css_label}" !important;
  display: inline-flex !important;
  align-items: center !important;
  -moz-box-align: center !important;
  margin-inline-start: 6px !important;
  padding: 2px 9px !important;
  min-height: 20px !important;
  border-radius: 999px !important;
  border: 1px solid color-mix(in srgb, var(--toolbar-field-color, #e5e7eb) 16%, transparent) !important;
  background-color: color-mix(in srgb, var(--toolbar-field-background-color, #111827) 78%, #334155 22%) !important;
  color: var(--toolbar-field-color, #e5e7eb) !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  letter-spacing: 0.04em !important;
  text-transform: none !important;
  font-family: "Segoe UI Variable Text", "Segoe UI", sans-serif !important;
  max-width: 320px !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}}

#main-window[inDOMFullscreen="true"] #urlbar .urlbar-input-container::before,
#main-window[inDOMFullscreen="true"] #urlbar-input-container::before,
#main-window[inDOMFullscreen="true"] #identity-box::after,
#main-window[inDOMFullscreen="true"] #identity-icon-box::after {{
  display: none !important;
}}
"#
  );

  upsert_marked_css_block(
    &chrome_dir.join("userChrome.css"),
    START_MARKER,
    END_MARKER,
    &css_block,
  )?;
  upsert_user_pref_bool(&profile_path.join("user.js"), PREF_KEY_STYLESHEETS, true)?;
  upsert_user_pref_bool(&profile_path.join("prefs.js"), PREF_KEY_STYLESHEETS, true)?;
  upsert_user_pref_bool(&profile_path.join("user.js"), PREF_KEY_TASKBAR_GROUPING, true)?;
  upsert_user_pref_bool(&profile_path.join("prefs.js"), PREF_KEY_TASKBAR_GROUPING, true)?;
  Ok(())
}

fn ensure_chromium_runtime_identity_extension(
  profile_path: &Path,
  profile_name: &str,
) -> Result<PathBuf, String> {
  let ext_dir = profile_path.join(".buglogin-runtime-identity-ext");
  fs::create_dir_all(&ext_dir)
    .map_err(|e| format!("Failed to create runtime identity extension directory: {e}"))?;

  let manifest = r#"{
  "manifest_version": 3,
  "name": "BugLogin Runtime Identity",
  "version": "__BUGLOGIN_RUNTIME_IDENTITY_VERSION__",
  "description": "Shows profile identity directly in tab titles.",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "host_permissions": ["<all_urls>"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }
  ]
}
"#
  .replace(
    "__BUGLOGIN_RUNTIME_IDENTITY_VERSION__",
    RUNTIME_IDENTITY_EXTENSION_VERSION,
  );

  fs::write(ext_dir.join("manifest.json"), manifest)
    .map_err(|e| format!("Failed to write runtime identity manifest: {e}"))?;

  fs::write(ext_dir.join("content.js"), build_content_js(profile_name))
    .map_err(|e| format!("Failed to write runtime identity content script: {e}"))?;
  fs::write(ext_dir.join("newtab.html"), build_newtab_html())
    .map_err(|e| format!("Failed to write runtime identity newtab page: {e}"))?;
  fs::write(ext_dir.join("newtab.js"), build_newtab_js(profile_name))
    .map_err(|e| format!("Failed to write runtime identity newtab script: {e}"))?;

  Ok(ext_dir)
}

fn ensure_firefox_runtime_identity_extension(
  profile_path: &Path,
  profile_name: &str,
) -> Result<(), String> {
  let extensions_dir = profile_path.join("extensions");
  fs::create_dir_all(&extensions_dir)
    .map_err(|e| format!("Failed to create Firefox extensions directory: {e}"))?;

  let extension_id = "buglogin-runtime-identity@buglogin.local";
  let xpi_path = extensions_dir.join(format!("{extension_id}.xpi"));
  let manifest = format!(
    r#"{{
  "manifest_version": 2,
  "name": "BugLogin Runtime Identity",
  "version": "{RUNTIME_IDENTITY_EXTENSION_VERSION}",
  "description": "Shows profile identity directly in tab titles.",
  "browser_specific_settings": {{
    "gecko": {{
      "id": "{extension_id}"
    }}
  }},
  "chrome_url_overrides": {{
    "newtab": "newtab.html"
  }},
  "content_scripts": [
    {{
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start"
    }}
  ]
}}
"#
  );
  let content_js = build_content_js(profile_name);
  let newtab_js = build_newtab_js(profile_name);
  let newtab_html = build_newtab_html();

  let file = fs::File::create(&xpi_path)
    .map_err(|e| format!("Failed to create runtime identity XPI: {e}"))?;
  let mut zip = zip::ZipWriter::new(file);
  let options = FileOptions::<()>::default().compression_method(zip::CompressionMethod::Deflated);

  zip
    .start_file("manifest.json", options)
    .map_err(|e| format!("Failed to start manifest entry in XPI: {e}"))?;
  zip
    .write_all(manifest.as_bytes())
    .map_err(|e| format!("Failed to write manifest into XPI: {e}"))?;

  zip
    .start_file("content.js", options)
    .map_err(|e| format!("Failed to start content script entry in XPI: {e}"))?;
  zip
    .write_all(content_js.as_bytes())
    .map_err(|e| format!("Failed to write content script into XPI: {e}"))?;
  zip
    .start_file("newtab.html", options)
    .map_err(|e| format!("Failed to start newtab page entry in XPI: {e}"))?;
  zip
    .write_all(newtab_html.as_bytes())
    .map_err(|e| format!("Failed to write newtab page into XPI: {e}"))?;
  zip
    .start_file("newtab.js", options)
    .map_err(|e| format!("Failed to start newtab script entry in XPI: {e}"))?;
  zip
    .write_all(newtab_js.as_bytes())
    .map_err(|e| format!("Failed to write newtab script into XPI: {e}"))?;

  zip
    .finish()
    .map_err(|e| format!("Failed to finalize runtime identity XPI: {e}"))?;

  Ok(())
}

pub enum RuntimeIdentityInstallResult {
  ChromiumExtensionPath(PathBuf),
  FirefoxInstalled,
}

pub fn ensure_runtime_identity_for_browser(
  browser_name: &str,
  profile_path: &Path,
  profile_name: &str,
) -> Result<RuntimeIdentityInstallResult, String> {
  let browser =
    BrowserType::from_str(browser_name).map_err(|e| format!("Invalid browser type: {e}"))?;

  match browser {
    BrowserType::Chromium | BrowserType::Brave | BrowserType::Wayfern => {
      let path = ensure_chromium_runtime_identity_extension(profile_path, profile_name)?;
      Ok(RuntimeIdentityInstallResult::ChromiumExtensionPath(path))
    }
    BrowserType::Firefox
    | BrowserType::FirefoxDeveloper
    | BrowserType::Zen
    | BrowserType::Camoufox => {
      ensure_firefox_runtime_identity_extension(profile_path, profile_name)?;
      ensure_firefox_urlbar_profile_badge(profile_path, profile_name)?;
      Ok(RuntimeIdentityInstallResult::FirefoxInstalled)
    }
  }
}

#[cfg(test)]
mod tests {
  use super::{
    build_profile_tag, ensure_firefox_urlbar_profile_badge, ensure_runtime_identity_for_browser,
    RuntimeIdentityInstallResult,
  };
  use std::fs::File;
  use tempfile::tempdir;
  use zip::ZipArchive;

  #[test]
  fn profile_tag_uses_up_to_seven_alnum_lowercase() {
    assert_eq!(build_profile_tag("Bug Idea Sync-01"), "bugidea");
    assert_eq!(build_profile_tag("  "), "profile");
  }

  #[test]
  fn firefox_urlbar_badge_is_written_and_idempotent() {
    let temp = tempdir().expect("create temp dir");
    let profile_path = temp.path();
    ensure_firefox_urlbar_profile_badge(profile_path, "Bug Idea Sync-01")
      .expect("first badge write should succeed");
    ensure_firefox_urlbar_profile_badge(profile_path, "Bug Idea Sync-01")
      .expect("second badge write should succeed");

    let chrome_css = std::fs::read_to_string(profile_path.join("chrome").join("userChrome.css"))
      .expect("must write userChrome.css");
    assert!(chrome_css.contains("[bugidea] Bug Idea Sync-01"));
    assert_eq!(
      chrome_css
        .matches("/* BUGLOGIN_PROFILE_BADGE_START */")
        .count(),
      1
    );
    assert_eq!(
      chrome_css
        .matches("/* BUGLOGIN_PROFILE_BADGE_END */")
        .count(),
      1
    );

    for pref_file in ["user.js", "prefs.js"] {
      let content =
        std::fs::read_to_string(profile_path.join(pref_file)).expect("must write pref file");
      assert!(content.contains("toolkit.legacyUserProfileCustomizations.stylesheets"));
      assert!(content.contains("true"));
    }
  }

  #[test]
  fn chromium_runtime_identity_includes_newtab_override_assets() {
    let temp = tempdir().expect("create temp dir");
    let result = ensure_runtime_identity_for_browser("wayfern", temp.path(), "Bug Idea Sync-01")
      .expect("ensure runtime identity");
    match result {
      RuntimeIdentityInstallResult::ChromiumExtensionPath(path) => {
        let manifest =
          std::fs::read_to_string(path.join("manifest.json")).expect("manifest should exist");
        assert!(manifest.contains("\"chrome_url_overrides\""));
        assert!(manifest.contains("\"newtab\""));
        assert!(path.join("newtab.html").exists());
        assert!(path.join("newtab.js").exists());
      }
      RuntimeIdentityInstallResult::FirefoxInstalled => panic!("expected chromium extension path"),
    }
  }

  #[test]
  fn firefox_runtime_identity_xpi_includes_newtab_override_assets() {
    let temp = tempdir().expect("create temp dir");
    ensure_runtime_identity_for_browser("camoufox", temp.path(), "Bug Idea Sync-01")
      .expect("ensure runtime identity");

    let xpi_path = temp
      .path()
      .join("extensions")
      .join("buglogin-runtime-identity@buglogin.local.xpi");
    let file = File::open(&xpi_path).expect("xpi should exist");
    let mut archive = ZipArchive::new(file).expect("valid xpi zip");

    let mut manifest = String::new();
    {
      let mut manifest_file = archive
        .by_name("manifest.json")
        .expect("manifest entry should exist");
      use std::io::Read;
      manifest_file
        .read_to_string(&mut manifest)
        .expect("read manifest");
    }

    assert!(manifest.contains("\"chrome_url_overrides\""));
    assert!(archive.by_name("newtab.html").is_ok());
    assert!(archive.by_name("newtab.js").is_ok());
  }
}
