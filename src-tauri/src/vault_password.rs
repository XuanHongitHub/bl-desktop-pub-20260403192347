//! Machine-specific vault password derivation.
//!
//! ## Why this exists
//! The original code used `env!("BUGLOGIN_VAULT_PASSWORD")`, which is a compile-time macro.
//! This means the password is **embedded as plaintext inside the compiled binary**.
//! Anyone running `strings buglogin.exe` or a basic decompiler would expose the key,
//! rendering the AES-256-GCM encryption of tokens completely useless.
//!
//! ## How this works
//! Instead of a static compile-time secret, the vault key is derived from a combination of:
//! 1. A per-machine hardware identifier (Windows MachineGuid, Linux /etc/machine-id, or macOS serial)
//! 2. A hardcoded application salt (fine to be in the binary — it's just the salt, not the key)
//!
//! This ensures that even if someone copies the `settings/` folder to another machine,
//! they cannot decrypt its contents without the original machine's unique identifier.
//!
//! ## Migration note
//! If any encrypted files exist from the old compile-time password, they will fail
//! to decrypt and be discarded. Users will need to re-login once after this upgrade.
//! This is intentional and a one-time cost for a significant security improvement.

use std::sync::OnceLock;

/// Application-specific salt. Intentionally hardcoded — this is a salt, not the secret.
/// Change this value if you want to force a global re-encryption of all stored data.
const APP_VAULT_SALT: &str = "buglogin-vault-2025-v1";

static VAULT_PASSWORD: OnceLock<String> = OnceLock::new();

/// Returns the vault password, derived from machine-specific identifiers.
/// The result is computed once and then cached for the lifetime of the process.
pub fn get_vault_password() -> &'static str {
  VAULT_PASSWORD.get_or_init(|| {
    let machine_id = derive_machine_id();
    log::debug!(
      "vault: machine_id derived (len={}), source: {}",
      machine_id.0.len(),
      machine_id.1
    );
    format!("{}:{}", APP_VAULT_SALT, machine_id.0)
  })
}

/// Returns (machine_id_string, source_description) for logging.
fn derive_machine_id() -> (String, &'static str) {
  // --- Windows: MachineGuid from registry (most reliable) ---
  #[cfg(target_os = "windows")]
  if let Ok(guid) = read_windows_machine_guid() {
    return (guid, "Windows MachineGuid");
  }

  // --- Linux: /etc/machine-id ---
  #[cfg(target_os = "linux")]
  if let Ok(id) = read_linux_machine_id() {
    return (id, "/etc/machine-id");
  }

  // --- macOS: IOPlatformSerialNumber ---
  #[cfg(target_os = "macos")]
  if let Ok(id) = read_macos_serial() {
    return (id, "IOPlatformSerialNumber");
  }

  // --- Cross-platform fallback: hostname + username ---
  // Less unique (multiple machines can share a hostname), but better than a static string.
  log::warn!(
    "vault: could not read a hardware-unique machine ID; falling back to hostname+username. \
     Data portability risk is slightly higher."
  );
  let hostname = std::env::var("COMPUTERNAME")
    .or_else(|_| std::env::var("HOSTNAME"))
    .unwrap_or_else(|_| "unknown-host".to_string());
  let username = std::env::var("USERNAME")
    .or_else(|_| std::env::var("USER"))
    .unwrap_or_else(|_| "unknown-user".to_string());
  (
    format!("{}::{}", hostname, username),
    "hostname+username fallback",
  )
}

// ─── Platform-specific implementations ───────────────────────────────────────

#[cfg(target_os = "windows")]
fn read_windows_machine_guid() -> Result<String, Box<dyn std::error::Error>> {
  use std::os::windows::process::CommandExt;
  const CREATE_NO_WINDOW: u32 = 0x0800_0000;

  let output = std::process::Command::new("powershell")
    .args([
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      // Reads HKLM\\SOFTWARE\\Microsoft\\Cryptography\\MachineGuid
      "(Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Cryptography' -Name MachineGuid).MachineGuid",
    ])
    .creation_flags(CREATE_NO_WINDOW)
    .output()?;

  if output.status.success() {
    let guid = String::from_utf8(output.stdout)?.trim().to_string();
    if guid.is_empty() {
      return Err("Windows MachineGuid is empty".into());
    }
    Ok(guid)
  } else {
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Err(format!("PowerShell command failed: {}", stderr).into())
  }
}

#[cfg(target_os = "linux")]
fn read_linux_machine_id() -> Result<String, Box<dyn std::error::Error>> {
  let id = std::fs::read_to_string("/etc/machine-id")?;
  let trimmed = id.trim().to_string();
  if trimmed.is_empty() {
    return Err("/etc/machine-id is empty".into());
  }
  Ok(trimmed)
}

#[cfg(target_os = "macos")]
fn read_macos_serial() -> Result<String, Box<dyn std::error::Error>> {
  let output = std::process::Command::new("ioreg")
    .args(["-rd1", "-c", "IOPlatformExpertDevice"])
    .output()?;
  let text = String::from_utf8(output.stdout)?;
  for line in text.lines() {
    if line.contains("IOPlatformSerialNumber") {
      // Format: "IOPlatformSerialNumber" = "C02X..."
      if let Some(val) = line.split('"').nth(3) {
        let serial = val.trim().to_string();
        if !serial.is_empty() {
          return Ok(serial);
        }
      }
    }
  }
  Err("IOPlatformSerialNumber not found in ioreg output".into())
}
