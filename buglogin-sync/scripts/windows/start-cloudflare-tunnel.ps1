param(
  [int]$Port = 12342,
  [string]$Hostname = "",
  [string]$TunnelName = "",
  [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($TunnelName)) {
  if ([string]::IsNullOrWhiteSpace($Hostname)) {
    Write-Host "Starting quick tunnel to http://localhost:$Port"
    cloudflared tunnel --url "http://localhost:$Port"
    exit 0
  }

  Write-Host "Starting hostname tunnel to $Hostname -> http://localhost:$Port"
  cloudflared tunnel --url "http://localhost:$Port" --hostname $Hostname
  exit 0
}

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
  Write-Host "Starting named tunnel '$TunnelName' (uses default cloudflared config)."
  cloudflared tunnel run $TunnelName
  exit 0
}

Write-Host "Starting named tunnel '$TunnelName' with config '$ConfigPath'."
cloudflared --config $ConfigPath tunnel run $TunnelName
