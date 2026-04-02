param(
  [int]$Port = 12342,
  [string]$ReleaseToken = "",
  [string]$BrowserReleaseStorage = "s3",
  [string]$BrowserReleaseS3Key = "meta/browser-release-state.json"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

$env:PORT = "$Port"
$env:BROWSER_RELEASE_STORAGE = $BrowserReleaseStorage
$env:BROWSER_RELEASE_S3_KEY = $BrowserReleaseS3Key

if (-not [string]::IsNullOrWhiteSpace($ReleaseToken)) {
  $env:BUGLOGIN_RELEASE_API_TOKEN = $ReleaseToken
}

Write-Host "Starting buglogin-sync on http://127.0.0.1:$Port"
Write-Host "BROWSER_RELEASE_STORAGE=$BrowserReleaseStorage"
Write-Host "BROWSER_RELEASE_S3_KEY=$BrowserReleaseS3Key"

pnpm start
