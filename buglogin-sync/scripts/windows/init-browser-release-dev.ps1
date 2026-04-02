param(
  [string]$EnvFile = ".env.local",
  [int]$Port = 12342,
  [string]$BrowserReleaseStorage = "s3",
  [string]$BrowserReleaseS3Key = "meta/browser-release-state.json",
  [switch]$RegenerateToken
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $repoRoot

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Key,
    [string]$Value
  )

  if (-not (Test-Path $Path)) {
    New-Item -ItemType File -Path $Path -Force | Out-Null
  }

  $content = Get-Content -Path $Path -Raw
  $pattern = "(?m)^$([regex]::Escape($Key))=.*$"
  $line = "$Key=$Value"

  if ($content -match $pattern) {
    $updated = [regex]::Replace($content, $pattern, $line)
  } else {
    $suffix = ""
    if ($content.Length -gt 0 -and -not $content.EndsWith("`n")) {
      $suffix = "`n"
    }
    $updated = "$content$suffix$line`n"
  }

  Set-Content -Path $Path -Value $updated -Encoding UTF8
}

function New-Token {
  $bytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $hex = [BitConverter]::ToString($bytes).Replace("-", "").ToLowerInvariant()
  return "bl_$hex"
}

$envPath = Join-Path $repoRoot $EnvFile

$existingToken = ""
if (Test-Path $envPath) {
  $line = Select-String -Path $envPath -Pattern "^BUGLOGIN_RELEASE_API_TOKEN=(.*)$" | Select-Object -First 1
  if ($line) {
    $existingToken = $line.Matches[0].Groups[1].Value.Trim()
  }
}

$finalToken = $existingToken
if ($RegenerateToken -or [string]::IsNullOrWhiteSpace($finalToken)) {
  $finalToken = New-Token
}

Set-EnvValue -Path $envPath -Key "PORT" -Value "$Port"
Set-EnvValue -Path $envPath -Key "BUGLOGIN_RELEASE_API_TOKEN" -Value $finalToken
Set-EnvValue -Path $envPath -Key "BROWSER_RELEASE_STORAGE" -Value $BrowserReleaseStorage
Set-EnvValue -Path $envPath -Key "BROWSER_RELEASE_S3_KEY" -Value $BrowserReleaseS3Key

Write-Host "Initialized browser release dev config in $envPath"
Write-Host "PORT=$Port"
Write-Host "BUGLOGIN_RELEASE_API_TOKEN=$finalToken"
Write-Host "BROWSER_RELEASE_STORAGE=$BrowserReleaseStorage"
Write-Host "BROWSER_RELEASE_S3_KEY=$BrowserReleaseS3Key"
