param(
  [Parameter(Mandatory = $true)]
  [string]$SyncServerUrl,
  [Parameter(Mandatory = $true)]
  [string]$SyncToken
)

$ErrorActionPreference = "Stop"

$targets = @(
  "$env:LOCALAPPDATA\\BugLogin\\settings",
  "$env:LOCALAPPDATA\\BugLoginDev\\settings"
)

$payload = @{
  sync_server_url = $SyncServerUrl
  sync_token = $SyncToken
} | ConvertTo-Json -Depth 4

foreach ($dir in $targets) {
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  $file = Join-Path $dir "sync_bootstrap.json"
  Set-Content -Path $file -Value $payload -Encoding UTF8
  Write-Host "WROTE $file"
}
