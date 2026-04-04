!macro customInstall
  DetailPrint "Stopping BugLogin processes..."
  # Kill main app and sidecars to prevent 'File in use' errors
  nsExec::ExecToLog 'cmd /C taskkill /F /IM BugLogin.exe /T >NUL 2>&1'
  nsExec::ExecToLog 'cmd /C taskkill /F /IM buglogin-daemon.exe /T >NUL 2>&1'
  nsExec::ExecToLog 'cmd /C taskkill /F /IM buglogin-proxy.exe /T >NUL 2>&1'
  Sleep 1500
!macroend

!macro customUnInstall
  DetailPrint "Stopping BugLogin processes before uninstall..."
  nsExec::ExecToLog 'cmd /C taskkill /F /IM BugLogin.exe /T >NUL 2>&1'
  nsExec::ExecToLog 'cmd /C taskkill /F /IM buglogin-daemon.exe /T >NUL 2>&1'
  nsExec::ExecToLog 'cmd /C taskkill /F /IM buglogin-proxy.exe /T >NUL 2>&1'
  Sleep 1500
!macroend
