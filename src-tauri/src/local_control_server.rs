use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::Duration;

use crate::app_config;

static START_GUARD: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();

fn start_guard() -> &'static tokio::sync::Mutex<()> {
  START_GUARD.get_or_init(|| tokio::sync::Mutex::new(()))
}

fn is_local_self_host_mode() -> bool {
  app_config::get().auth_api_url.is_none()
}

fn local_control_addr() -> SocketAddr {
  SocketAddr::from(([127, 0, 0, 1], 12342))
}

fn is_local_control_server_running() -> bool {
  TcpStream::connect_timeout(&local_control_addr(), Duration::from_millis(250)).is_ok()
}

fn find_buglogin_sync_dir() -> Option<PathBuf> {
  let mut candidates = Vec::new();

  let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  if let Some(project_root) = manifest_dir.parent() {
    candidates.push(project_root.to_path_buf());
    candidates.push(project_root.join("buglogin-sync"));
  }

  if let Ok(current_dir) = std::env::current_dir() {
    candidates.push(current_dir);
  }

  if let Ok(current_exe) = std::env::current_exe() {
    for ancestor in current_exe.ancestors() {
      candidates.push(ancestor.to_path_buf());
    }
  }

  for base in candidates {
    let direct = if base.file_name().is_some_and(|name| name == "buglogin-sync") {
      base.clone()
    } else {
      base.join("buglogin-sync")
    };

    if direct.join("package.json").exists() {
      return Some(direct);
    }
  }

  None
}

fn spawn_local_control_server_process() -> Result<(), String> {
  let sync_dir = find_buglogin_sync_dir().ok_or_else(|| {
    format!(
      "Could not locate buglogin-sync workspace. current_exe={:?} current_dir={:?}",
      std::env::current_exe().ok(),
      std::env::current_dir().ok()
    )
  })?;

  #[cfg(windows)]
  let mut commands: Vec<Command> = {
    use std::os::windows::process::CommandExt;
    const DETACHED_PROCESS: u32 = 0x00000008;
    const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

    let mut node_cmd = Command::new("cmd");
    node_cmd
      .arg("/C")
      .arg("node")
      .arg("dist/main.js")
      .current_dir(&sync_dir)
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);

    let mut pnpm_cmd = Command::new("cmd");
    pnpm_cmd
      .arg("/C")
      .arg("pnpm.cmd")
      .arg("run")
      .arg("start:prod")
      .current_dir(&sync_dir)
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);

    vec![node_cmd, pnpm_cmd]
  };

  #[cfg(not(windows))]
  let mut commands: Vec<Command> = {
    let mut node_cmd = Command::new("node");
    node_cmd
      .arg("dist/main.js")
      .current_dir(&sync_dir)
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null());

    let mut pnpm_cmd = Command::new("pnpm");
    pnpm_cmd
      .arg("run")
      .arg("start:prod")
      .current_dir(&sync_dir)
      .stdin(Stdio::null())
      .stdout(Stdio::null())
      .stderr(Stdio::null());

    vec![node_cmd, pnpm_cmd]
  };

  let mut last_error: Option<String> = None;
  for cmd in &mut commands {
    cmd
      .env("BUGLOGIN_EMBEDDED_LOCAL_CONTROL", "1")
      .env("PORT", "12342")
      .env("SYNC_TOKEN", "dev-sync-token-change-me")
      .env("CONTROL_API_TOKEN", "dev-sync-token-change-me");
    match cmd.spawn() {
      Ok(_) => return Ok(()),
      Err(error) => {
        last_error = Some(error.to_string());
      }
    }
  }

  Err(format!(
    "Failed to spawn buglogin-sync from {}: {}",
    sync_dir.display(),
    last_error.unwrap_or_else(|| "unknown_error".to_string())
  ))
}

pub async fn ensure_local_control_server_running() -> Result<(), String> {
  if !is_local_self_host_mode() {
    return Ok(());
  }

  if is_local_control_server_running() {
    return Ok(());
  }

  let _guard = start_guard().lock().await;
  if is_local_control_server_running() {
    return Ok(());
  }

  spawn_local_control_server_process()?;

  for _ in 0..50 {
    if is_local_control_server_running() {
      return Ok(());
    }
    tokio::time::sleep(Duration::from_millis(200)).await;
  }

  Err("local_control_server_start_timeout".to_string())
}
