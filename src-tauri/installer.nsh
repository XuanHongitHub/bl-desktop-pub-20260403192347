!macro customInstall
  DetailPrint "Stopping BugLogin processes..."
  # Kill main app and sidecars to prevent 'File in use' errors
  nsExec::Exec 'taskkill /F /IM BugLogin.exe /T'
  nsExec::Exec 'taskkill /F /IM buglogin-daemon.exe /T'
  nsExec::Exec 'taskkill /F /IM buglogin-proxy.exe /T'
  Sleep 1000
!macroend
