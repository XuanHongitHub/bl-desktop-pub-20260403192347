#[cfg(target_os = "windows")]
#[allow(dead_code)]
mod platform_windows {
  use ::sysinfo::{Pid, System};
  use ::windows::core::{BOOL, PCWSTR};
  use ::windows::Win32::Foundation::{HWND, LPARAM};
  use ::windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindow, GetWindowThreadProcessId, IsWindowVisible, SetForegroundWindow,
    SetWindowTextW, ShowWindow, GW_OWNER, SW_MINIMIZE, SW_RESTORE,
  };
  use std::collections::HashSet;
  use std::time::Duration;

  #[derive(Clone, Copy)]
  enum WindowAction {
    Minimize,
    Restore,
  }

  struct EnumContext {
    pid: u32,
    action: WindowAction,
    matched: bool,
  }

  struct TitleEnumContext {
    pids: HashSet<u32>,
    title_utf16: Vec<u16>,
    matched: bool,
  }

  unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    // SAFETY: lparam contains a valid mutable EnumContext pointer from our call site.
    let ctx = unsafe { &mut *(lparam.0 as *mut EnumContext) };

    let mut window_pid = 0u32;
    // SAFETY: hwnd is provided by EnumWindows and valid for this callback.
    unsafe {
      GetWindowThreadProcessId(hwnd, Some(&mut window_pid));
    }

    if window_pid != ctx.pid {
      return BOOL(1);
    }

    // Skip invisible/owned windows to target top-level browser windows.
    // SAFETY: hwnd is valid during callback.
    let is_visible = unsafe { IsWindowVisible(hwnd).as_bool() };
    if !is_visible {
      return BOOL(1);
    }
    // SAFETY: hwnd is valid during callback.
    let Ok(owner) = (unsafe { GetWindow(hwnd, GW_OWNER) }) else {
      return BOOL(1);
    };
    if !owner.is_invalid() {
      return BOOL(1);
    }

    match ctx.action {
      WindowAction::Minimize => {
        // SAFETY: hwnd belongs to an active top-level window.
        let _ = unsafe { ShowWindow(hwnd, SW_MINIMIZE) };
      }
      WindowAction::Restore => {
        // SAFETY: hwnd belongs to an active top-level window.
        let _ = unsafe { ShowWindow(hwnd, SW_RESTORE) };
        // Best-effort bring-to-front for resume UX.
        // SAFETY: hwnd belongs to an active top-level window.
        let _ = unsafe { SetForegroundWindow(hwnd) };
      }
    }

    ctx.matched = true;
    BOOL(1)
  }

  unsafe extern "system" fn enum_windows_set_title_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    // SAFETY: lparam contains a valid mutable TitleEnumContext pointer from our call site.
    let ctx = unsafe { &mut *(lparam.0 as *mut TitleEnumContext) };

    let mut window_pid = 0u32;
    // SAFETY: hwnd is provided by EnumWindows and valid for this callback.
    unsafe {
      GetWindowThreadProcessId(hwnd, Some(&mut window_pid));
    }

    if !ctx.pids.contains(&window_pid) {
      return BOOL(1);
    }

    // Skip invisible/owned windows to target top-level browser windows.
    // SAFETY: hwnd is valid during callback.
    let is_visible = unsafe { IsWindowVisible(hwnd).as_bool() };
    if !is_visible {
      return BOOL(1);
    }
    // SAFETY: title_utf16 is null-terminated and valid for this callback lifetime.
    let _ = unsafe { SetWindowTextW(hwnd, PCWSTR(ctx.title_utf16.as_ptr())) };

    ctx.matched = true;
    BOOL(1)
  }

  fn apply_window_action(pid: u32, action: WindowAction) -> Result<(), String> {
    let mut ctx = EnumContext {
      pid,
      action,
      matched: false,
    };

    // SAFETY: callback and context pointer remain valid for the call duration.
    let _ = unsafe {
      EnumWindows(
        Some(enum_windows_proc),
        LPARAM((&mut ctx as *mut EnumContext) as isize),
      )
    };

    if !ctx.matched {
      return Err(format!("No top-level window found for PID {pid}"));
    }

    Ok(())
  }

  pub fn minimize_for_pid(pid: u32) -> Result<(), String> {
    apply_window_action(pid, WindowAction::Minimize)
  }

  pub fn restore_for_pid(pid: u32) -> Result<(), String> {
    apply_window_action(pid, WindowAction::Restore)
  }

  fn build_profile_short_label(profile_name: &str) -> String {
    let compact: String = profile_name
      .chars()
      .filter(|c| c.is_alphanumeric())
      .take(7)
      .collect();

    if compact.is_empty() {
      "PROFILE".to_string()
    } else {
      compact.to_uppercase()
    }
  }

  fn build_navigation_label(navigation_url: Option<&str>) -> Option<String> {
    let raw = navigation_url?.trim();
    if raw.is_empty() {
      return None;
    }

    if let Ok(parsed) = url::Url::parse(raw) {
      let host = parsed.host_str().unwrap_or_default();
      let path = parsed.path();
      let mut label = if host.is_empty() {
        raw.to_string()
      } else if path.is_empty() || path == "/" {
        host.to_string()
      } else {
        format!("{host}{path}")
      };
      if let Some(query) = parsed.query() {
        if !query.is_empty() {
          label.push('?');
          label.push_str(query);
        }
      }
      if !label.is_empty() {
        return Some(label);
      }
    }

    Some(raw.to_string())
  }

  fn build_profile_window_title(profile_name: &str, navigation_url: Option<&str>) -> String {
    let trimmed = profile_name.trim();
    if trimmed.is_empty() {
      return "BugLogin Profile".to_string();
    }

    let short = build_profile_short_label(trimmed);
    let title = if let Some(label) = build_navigation_label(navigation_url) {
      format!("[{short}] {trimmed} • {label}")
    } else {
      format!("[{short}] {trimmed}")
    };

    // Keep title bounded to avoid oversized captions on Windows.
    title.chars().take(144).collect()
  }

  fn collect_process_tree_pids(root_pid: u32) -> HashSet<u32> {
    let mut pids = HashSet::new();
    pids.insert(root_pid);

    let system = System::new_all();
    let mut changed = true;
    while changed {
      changed = false;
      for (pid, process) in system.processes() {
        if let Some(parent) = process.parent() {
          let parent_u32 = parent.as_u32();
          let pid_u32 = pid.as_u32();
          if pids.contains(&parent_u32) && pids.insert(pid_u32) {
            changed = true;
          }
        }
      }
    }

    pids
  }

  fn set_profile_title_once(root_pid: u32, title: &str) -> bool {
    let mut title_utf16: Vec<u16> = title.encode_utf16().collect();
    title_utf16.push(0);

    let mut ctx = TitleEnumContext {
      pids: collect_process_tree_pids(root_pid),
      title_utf16,
      matched: false,
    };

    // SAFETY: callback and context pointer remain valid for the call duration.
    let _ = unsafe {
      EnumWindows(
        Some(enum_windows_set_title_proc),
        LPARAM((&mut ctx as *mut TitleEnumContext) as isize),
      )
    };

    ctx.matched
  }

  fn is_process_running(pid: u32) -> bool {
    let system = System::new_all();
    system.process(Pid::from_u32(pid)).is_some()
  }

  async fn set_profile_title_with_retry(pid: u32, title: String) -> Result<(), String> {
    let mut matched = false;

    // Wait for browser main window, then apply title.
    for _ in 0..24 {
      if set_profile_title_once(pid, &title) {
        matched = true;
        break;
      }
      tokio::time::sleep(Duration::from_millis(250)).await;
    }

    if !matched {
      return Err(format!(
        "No top-level browser window found for PID {} while applying title",
        pid
      ));
    }

    // Keep overriding while the process is alive because Chromium-based browsers
    // frequently reset window captions after page navigation.
    for _ in 0..1800 {
      if !is_process_running(pid) {
        break;
      }
      let _ = set_profile_title_once(pid, &title);
      tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Ok(())
  }

  pub fn schedule_profile_identity_for_pid(
    pid: u32,
    profile_name: String,
    navigation_url: Option<String>,
  ) {
    if pid == 0 {
      return;
    }

    let title = build_profile_window_title(&profile_name, navigation_url.as_deref());

    tokio::spawn(async move {
      if let Err(e) = set_profile_title_with_retry(pid, title).await {
        log::debug!(
          "Failed to apply profile window identity for PID {} (profile '{}'): {}",
          pid,
          profile_name,
          e
        );
      }
    });
  }
}

pub fn minimize_for_pid(pid: Option<u32>) -> Result<(), String> {
  let Some(pid) = pid else {
    return Ok(());
  };

  #[cfg(target_os = "windows")]
  {
    return platform_windows::minimize_for_pid(pid);
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = pid;
    Ok(())
  }
}

pub fn restore_for_pid(pid: Option<u32>) -> Result<(), String> {
  let Some(pid) = pid else {
    return Ok(());
  };

  #[cfg(target_os = "windows")]
  {
    return platform_windows::restore_for_pid(pid);
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = pid;
    Ok(())
  }
}

#[allow(dead_code)]
pub fn schedule_profile_identity_for_pid_with_url(
  pid: Option<u32>,
  profile_name: &str,
  navigation_url: Option<&str>,
) {
  let Some(pid) = pid else {
    return;
  };

  if profile_name.trim().is_empty() {
    return;
  }

  #[cfg(target_os = "windows")]
  {
    platform_windows::schedule_profile_identity_for_pid(
      pid,
      profile_name.to_string(),
      navigation_url.map(|value| value.to_string()),
    );
  }

  #[cfg(not(target_os = "windows"))]
  {
    let _ = pid;
    let _ = profile_name;
    let _ = navigation_url;
  }
}
