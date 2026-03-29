param(
  [string]$RepoRoot = "E:\bug-login",
  [string]$SyncDir = "E:\bug-login\buglogin-sync",
  [string]$SyncHealthUrl = "http://127.0.0.1:12342/health",
  [string]$PublicSyncHealthUrl = "https://sync.bugdev.site/health",
  [string]$PublicApiHealthUrl = "https://api.bugdev.site/health",
  [string]$PublicWebUrl = "https://bugdev.site",
  [string]$CloudflaredConfig = "C:\Users\Acer\.cloudflared\config.yml",
  [string]$TunnelName = "buglogin-sync",
  [switch]$SkipPublicHealth,
  [switch]$SkipApiHealth,
  [switch]$SkipWebHealth,
  [switch]$NoTauri
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Step([string]$msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Stop-ByNames([string[]]$names) {
  foreach ($name in $names) {
    Get-Process -Name $name -ErrorAction SilentlyContinue |
      Stop-Process -Force -ErrorAction SilentlyContinue
  }
}

if (-not (Test-Path $SyncDir)) { throw "Missing sync dir: $SyncDir" }
if (-not (Test-Path $RepoRoot)) { throw "Missing repo root: $RepoRoot" }
if (-not (Test-Path $CloudflaredConfig)) { throw "Missing cloudflared config: $CloudflaredConfig" }

Step "Stopping old processes that commonly cause already-running conflicts"
Stop-ByNames @("buglogin", "cloudflared", "cargo", "rustc", "pnpm", "node")
Start-Sleep -Seconds 2

Step "Rebuilding buglogin-sync"
Push-Location $SyncDir
try {
  pnpm build
} finally {
  Pop-Location
}

Step "Starting buglogin-sync (node dist/main.js)"
Start-Process -FilePath "C:\Program Files\nodejs\node.exe" `
  -WorkingDirectory $SyncDir `
  -ArgumentList "dist/main.js" `
  -WindowStyle Hidden
Start-Sleep -Seconds 2

Step "Starting cloudflared tunnel"
Start-Process -FilePath "C:\Program Files (x86)\cloudflared\cloudflared.exe" `
  -ArgumentList "tunnel --config `"$CloudflaredConfig`" run $TunnelName" `
  -WindowStyle Hidden
Start-Sleep -Seconds 2

Step "Verifying local health"
$local = Invoke-RestMethod -Method Get -Uri $SyncHealthUrl
if ($local.status -ne "ok") {
  throw "Local health check failed: $SyncHealthUrl"
}
Write-Host "LOCAL: ok" -ForegroundColor Green

if (-not $SkipPublicHealth) {
  Step "Verifying public sync health"
  $publicSync = Invoke-RestMethod -Method Get -Uri $PublicSyncHealthUrl
  if ($publicSync.status -ne "ok") {
    throw "Public sync health check failed: $PublicSyncHealthUrl"
  }
  Write-Host "PUBLIC_SYNC: ok" -ForegroundColor Green

  if (-not $SkipApiHealth) {
    Step "Verifying public api health"
    $publicApi = Invoke-RestMethod -Method Get -Uri $PublicApiHealthUrl
    if ($publicApi.status -ne "ok") {
      throw "Public api health check failed: $PublicApiHealthUrl"
    }
    Write-Host "PUBLIC_API: ok" -ForegroundColor Green
  }

  if (-not $SkipWebHealth) {
    Step "Verifying public web"
    try {
      $publicWeb = Invoke-WebRequest -Method Get -Uri $PublicWebUrl -UseBasicParsing -TimeoutSec 12
      if ($publicWeb.StatusCode -lt 200 -or $publicWeb.StatusCode -ge 400) {
        throw "Public web returned HTTP $($publicWeb.StatusCode): $PublicWebUrl"
      }
      Write-Host "PUBLIC_WEB: ok" -ForegroundColor Green
    } catch {
      Write-Warning "Cannot verify web at $PublicWebUrl. Ensure your web server is running."
    }
  }
}

if (-not $NoTauri) {
  Step "Launching BugLogin app via pnpm tauri dev"
  $cmd = "Set-Location '$RepoRoot'; pnpm tauri dev"
  Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoExit", "-Command", $cmd)
}

Write-Host ""
Write-Host "DONE: clean restart completed." -ForegroundColor Green
