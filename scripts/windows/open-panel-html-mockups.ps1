[CmdletBinding()]
param(
  [switch]$UseHttpServer,
  [int]$Port = 8799,
  [ValidateSet("panel", "ia")]
  [string]$View = "panel"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fileName = if ($View -eq "ia") { "index.html" } else { "panel.html" }
$superAdminPath = Join-Path $repoRoot "mockups\panels\super-admin\$fileName"
$workspaceOwnerPath = Join-Path $repoRoot "mockups\panels\workspace-owner\$fileName"

if (-not (Test-Path $superAdminPath)) {
  throw "Missing file: $superAdminPath"
}

if (-not (Test-Path $workspaceOwnerPath)) {
  throw "Missing file: $workspaceOwnerPath"
}

if ($UseHttpServer) {
  $mockupsRoot = Join-Path $repoRoot "mockups\panels"
  Write-Host "Starting static server at http://127.0.0.1:$Port from $mockupsRoot"

  Start-Process powershell -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-Command",
    "Set-Location '$mockupsRoot'; python -m http.server $Port"
  ) | Out-Null

  Start-Sleep -Seconds 1
  Start-Process "http://127.0.0.1:$Port/super-admin/$fileName" | Out-Null
  Start-Process "http://127.0.0.1:$Port/workspace-owner/$fileName" | Out-Null

  Write-Host "Opened:"
  Write-Host " - http://127.0.0.1:$Port/super-admin/$fileName"
  Write-Host " - http://127.0.0.1:$Port/workspace-owner/$fileName"
  Write-Host "To stop server, close the spawned Python window."
  exit 0
}

Start-Process $superAdminPath | Out-Null
Start-Process $workspaceOwnerPath | Out-Null

Write-Host "Opened:"
Write-Host " - $superAdminPath"
Write-Host " - $workspaceOwnerPath"
