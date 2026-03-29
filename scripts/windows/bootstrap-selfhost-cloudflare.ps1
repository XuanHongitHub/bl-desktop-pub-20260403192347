param(
  [string]$Hostname,
  [string]$SyncHostname,
  [string]$WebHostname = "",
  [string]$ApiHostname = "",
  [string]$RepoRoot = "E:\bug-login",
  [string]$TunnelName = "buglogin-sync",
  [int]$SyncPort = 12342,
  [int]$WebPort = 12341,
  [switch]$SkipBuild,
  [switch]$SkipWebRoute,
  [switch]$SkipApiRoute,
  [switch]$SkipPublicHealth
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Warn([string]$Message) {
  Write-Host "WARN: $Message" -ForegroundColor Yellow
}

function Require-Command([string]$Command) {
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    if ($Command -eq "cloudflared") {
      $candidates = @(
        "C:\Program Files (x86)\cloudflared\cloudflared.exe",
        "C:\Program Files\cloudflared\cloudflared.exe"
      )
      foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
          Set-Alias -Name cloudflared -Value $candidate -Scope Script
          return
        }
      }
    }
    throw "Missing command: $Command"
  }
}

function Invoke-Cloudflared {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args,
    [switch]$QuietErrorStream
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = if ($QuietErrorStream) {
      & cloudflared @Args 2>$null
    } else {
      & cloudflared @Args 2>&1
    }
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [PSCustomObject]@{
    ExitCode = $exitCode
    Output   = @($output)
  }
}

function New-StrongToken([int]$Bytes = 32) {
  $buffer = New-Object byte[] $Bytes
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($buffer)
  } finally {
    if ($null -ne $rng) {
      $rng.Dispose()
    }
  }
  $token = [Convert]::ToBase64String($buffer).TrimEnd("=") -replace "\+", "-" -replace "/", "_"
  return $token
}

function Set-EnvValue([string]$FilePath, [string]$Key, [string]$Value) {
  $content = @()
  if (Test-Path $FilePath) {
    $content = Get-Content -Path $FilePath -Encoding UTF8
  }
  $pattern = "^$([Regex]::Escape($Key))="
  $updated = $false
  for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -match $pattern) {
      $content[$i] = "$Key=$Value"
      $updated = $true
      break
    }
  }
  if (-not $updated) {
    $content += "$Key=$Value"
  }
  Set-Content -Path $FilePath -Value $content -Encoding UTF8
}

function Normalize-Host([string]$Value) {
  if (-not $Value) {
    return ""
  }
  return $Value.Trim().ToLowerInvariant()
}

function Get-RootDomainFromSyncHost([string]$Value) {
  if ($Value -match "^sync\.(.+)$") {
    return $matches[1]
  }
  return ""
}

function Get-TunnelId([string]$Name) {
  try {
    $infoResult = Invoke-Cloudflared -Args @("tunnel", "info", $Name)
    if ($infoResult.ExitCode -eq 0 -and $infoResult.Output) {
      foreach ($line in $infoResult.Output) {
        if ($line -match "([0-9a-fA-F-]{36})") {
          return $matches[1]
        }
      }
    }
  } catch {}

  try {
    $jsonResult = Invoke-Cloudflared -Args @("tunnel", "list", "--output", "json") -QuietErrorStream
    if ($jsonResult.ExitCode -eq 0 -and $jsonResult.Output) {
      $jsonText = ($jsonResult.Output | Out-String)
      $arrayStart = $jsonText.IndexOf("[")
      $arrayEnd = $jsonText.LastIndexOf("]")
      if ($arrayStart -ge 0 -and $arrayEnd -gt $arrayStart) {
        $jsonText = $jsonText.Substring($arrayStart, ($arrayEnd - $arrayStart + 1))
      }
      $rows = $jsonText | ConvertFrom-Json
      $match = $rows | Where-Object { $_.name -eq $Name } | Select-Object -First 1
      if ($match -and $match.id) {
        return [string]$match.id
      }
    }
  } catch {}

  try {
    $rawResult = Invoke-Cloudflared -Args @("tunnel", "list") -QuietErrorStream
    if ($rawResult.ExitCode -eq 0 -and $rawResult.Output) {
      $nameLower = $Name.ToLowerInvariant()
      foreach ($line in $rawResult.Output) {
        $lineText = [string]$line
        if ($lineText.ToLowerInvariant().Contains($nameLower) -and $lineText -match "([0-9a-fA-F-]{36})") {
          return $matches[1]
        }
      }
    }
  } catch {}

  return $null
}

function Get-TunnelIdFromConfig([string]$ConfigPath) {
  if (-not (Test-Path $ConfigPath)) {
    return $null
  }
  $content = Get-Content -Path $ConfigPath -Encoding UTF8
  foreach ($line in $content) {
    if ($line -match "^\s*tunnel:\s*([0-9a-fA-F-]{36})\s*$") {
      return $matches[1]
    }
  }
  return $null
}

function Ensure-DnsRoute([string]$TunnelName, [string]$RouteHostname) {
  if (-not $RouteHostname) {
    return
  }
  Write-Step "Routing DNS $RouteHostname -> tunnel $TunnelName"
  $routeResult = Invoke-Cloudflared -Args @("tunnel", "route", "dns", $TunnelName, $RouteHostname)
  if ($routeResult.ExitCode -eq 0) {
    return
  }
  $text = $routeResult.Output | Out-String
  if ($text -match "already exists") {
    Write-Warn "DNS route already exists for $RouteHostname"
    return
  }
  throw "Failed to route DNS for $RouteHostname.`n$text"
}

function Stop-SyncNodeProcess([string]$SyncRoot) {
  $normalizedRoot = $SyncRoot.TrimEnd("\")
  $needle = ($normalizedRoot + "\dist\main.js").ToLowerInvariant()
  $processes = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue
  foreach ($process in $processes) {
    $commandLine = [string]$process.CommandLine
    if (-not $commandLine) {
      continue
    }
    if ($commandLine.ToLowerInvariant().Contains($needle)) {
      Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}

Write-Step "Checking prerequisites"
Require-Command "node"
Require-Command "pnpm"
Require-Command "cloudflared"

$syncHostnameNormalized = Normalize-Host $SyncHostname
if (-not $syncHostnameNormalized) {
  $syncHostnameNormalized = Normalize-Host $Hostname
}
if (-not $syncHostnameNormalized) {
  $syncHostnameNormalized = "sync.bugdev.site"
}

$rootDomain = Get-RootDomainFromSyncHost $syncHostnameNormalized

$webHostnameNormalized = Normalize-Host $WebHostname
if (-not $SkipWebRoute -and -not $webHostnameNormalized -and $rootDomain) {
  $webHostnameNormalized = $rootDomain
}

$apiHostnameNormalized = Normalize-Host $ApiHostname
if (-not $SkipApiRoute -and -not $apiHostnameNormalized -and $rootDomain) {
  $apiHostnameNormalized = "api.$rootDomain"
}

$syncRoot = Join-Path $RepoRoot "buglogin-sync"
if (-not (Test-Path $syncRoot)) {
  throw "Cannot find buglogin-sync at: $syncRoot"
}

$syncEnvFile = Join-Path $syncRoot ".env"
$syncEnvExample = Join-Path $syncRoot ".env.example"
if (-not (Test-Path $syncEnvFile)) {
  Write-Step "Creating buglogin-sync .env from .env.example"
  Copy-Item -Path $syncEnvExample -Destination $syncEnvFile
}

$desktopEnvFile = Join-Path $RepoRoot ".env.local"
if (-not (Test-Path $desktopEnvFile)) {
  Set-Content -Path $desktopEnvFile -Value @(
    "# BugLogin local environment overlay",
    "# Generated by scripts/windows/bootstrap-selfhost-cloudflare.ps1"
  ) -Encoding UTF8
}

Write-Step "Preparing sync token and control token"
$syncToken = New-StrongToken
Set-EnvValue -FilePath $syncEnvFile -Key "PORT" -Value "$SyncPort"
Set-EnvValue -FilePath $syncEnvFile -Key "SYNC_TOKEN" -Value $syncToken
Set-EnvValue -FilePath $syncEnvFile -Key "CONTROL_API_TOKEN" -Value $syncToken

$publicApiBaseUrl = if (-not $SkipApiRoute -and $apiHostnameNormalized) {
  "https://$apiHostnameNormalized"
} else {
  "https://$syncHostnameNormalized"
}

if (-not $SkipWebRoute -and $webHostnameNormalized) {
  $publicWebBaseUrl = "https://$webHostnameNormalized"
  Set-EnvValue -FilePath $desktopEnvFile -Key "NEXT_PUBLIC_WEB_PORTAL_URL" -Value $publicWebBaseUrl
  Set-EnvValue -FilePath $desktopEnvFile -Key "NEXT_PUBLIC_BILLING_PORTAL_URL" -Value $publicWebBaseUrl
  Set-EnvValue -FilePath $desktopEnvFile -Key "NEXT_PUBLIC_STRIPE_BILLING_URL" -Value $publicWebBaseUrl
  Set-EnvValue -FilePath $desktopEnvFile -Key "BUGLOGIN_STRIPE_BILLING_URL" -Value $publicWebBaseUrl
}
Set-EnvValue -FilePath $desktopEnvFile -Key "NEXT_PUBLIC_SYNC_SERVER_URL" -Value $publicApiBaseUrl

if (-not $SkipBuild) {
  Write-Step "Installing deps and building buglogin-sync"
  Push-Location $syncRoot
  try {
    pnpm install
    pnpm build
  } finally {
    Pop-Location
  }
}

Write-Step "Installing/refreshing buglogin-sync service/process"
$nssm = "C:\Program Files\NSSM\nssm.exe"
$existingService = sc.exe query buglogin-sync 2>$null | Out-String
$nodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path $nodeExe)) {
  $nodeExe = (Get-Command node -ErrorAction Stop).Source
}
$nodeArgs = "dist\main.js"
if (Test-Path $nssm) {
  if ($existingService -match "SERVICE_NAME:\s+buglogin-sync") {
    & $nssm stop buglogin-sync | Out-Null
    & $nssm set buglogin-sync Application $nodeExe | Out-Null
    & $nssm set buglogin-sync AppParameters $nodeArgs | Out-Null
    & $nssm set buglogin-sync AppDirectory $syncRoot | Out-Null
  } else {
    & $nssm install buglogin-sync $nodeExe $nodeArgs | Out-Null
    & $nssm set buglogin-sync AppDirectory $syncRoot | Out-Null
  }

  & $nssm set buglogin-sync Start SERVICE_AUTO_START | Out-Null
  & $nssm start buglogin-sync | Out-Null
} else {
  Write-Warn "NSSM not found at $nssm. Falling back to background node process."
  Write-Warn "Install later for Windows service mode: winget install --id NSSM.NSSM -e"
  Stop-SyncNodeProcess -SyncRoot $syncRoot
  Start-Process -FilePath $nodeExe -WorkingDirectory $syncRoot -ArgumentList $nodeArgs -WindowStyle Hidden
}

Write-Step "Checking local sync health"
$localSyncHealthUrl = "http://127.0.0.1:$SyncPort/health"
$localSync = Invoke-RestMethod -Method Get -Uri $localSyncHealthUrl
if ($localSync.status -ne "ok") {
  throw "Local sync health check failed at $localSyncHealthUrl"
}

Write-Step "Cloudflare login check"
$loginResult = Invoke-Cloudflared -Args @("tunnel", "list") -QuietErrorStream
if ($loginResult.ExitCode -ne 0) {
  Write-Host "You need to login first: cloudflared tunnel login" -ForegroundColor Yellow
  throw "Cloudflare login check failed."
}

Write-Step "Ensuring tunnel exists"
$tunnelId = Get-TunnelId -Name $TunnelName
if (-not $tunnelId) {
  $createResult = Invoke-Cloudflared -Args @("tunnel", "create", $TunnelName)
  if ($createResult.ExitCode -ne 0) {
    $createText = $createResult.Output | Out-String
    if ($createText -match "already exists") {
      Write-Warn "Tunnel '$TunnelName' already exists. Reusing existing tunnel."
    } else {
      throw "Failed to create tunnel '$TunnelName'.`n$createText"
    }
  } else {
    foreach ($line in $createResult.Output) {
      if ($line -match "([0-9a-fA-F-]{36})") {
        $tunnelId = $matches[1]
        break
      }
    }
  }
  $tunnelId = Get-TunnelId -Name $TunnelName
}
if (-not $tunnelId) {
  $existingConfigPath = Join-Path (Join-Path $env:USERPROFILE ".cloudflared") "config.yml"
  $tunnelId = Get-TunnelIdFromConfig -ConfigPath $existingConfigPath
}
if (-not $tunnelId) {
  throw "Cannot determine tunnel ID for tunnel '$TunnelName'"
}

Ensure-DnsRoute -TunnelName $TunnelName -RouteHostname $syncHostnameNormalized
if (-not $SkipApiRoute) {
  Ensure-DnsRoute -TunnelName $TunnelName -RouteHostname $apiHostnameNormalized
}
if (-not $SkipWebRoute) {
  Ensure-DnsRoute -TunnelName $TunnelName -RouteHostname $webHostnameNormalized
}

Write-Step "Writing cloudflared config"
$cfDir = Join-Path $env:USERPROFILE ".cloudflared"
New-Item -ItemType Directory -Force -Path $cfDir | Out-Null
$credFile = Join-Path $cfDir "$tunnelId.json"
if (-not (Test-Path $credFile)) {
  throw "Missing credentials file: $credFile"
}
$configPath = Join-Path $cfDir "config.yml"

$ingress = @()
if (-not $SkipWebRoute -and $webHostnameNormalized) {
  $ingress += @{
    hostname = $webHostnameNormalized
    service = "http://127.0.0.1:$WebPort"
  }
}
$ingress += @{
  hostname = $syncHostnameNormalized
  service = "http://127.0.0.1:$SyncPort"
}
if (-not $SkipApiRoute -and $apiHostnameNormalized) {
  $ingress += @{
    hostname = $apiHostnameNormalized
    service = "http://127.0.0.1:$SyncPort"
  }
}

$seen = @{}
$yamlLines = @(
  "tunnel: $tunnelId",
  "credentials-file: $credFile",
  "",
  "ingress:"
)

foreach ($entry in $ingress) {
  $entryHost = [string]$entry.hostname
  if (-not $entryHost) {
    continue
  }
  $key = $entryHost.ToLowerInvariant()
  if ($seen.ContainsKey($key)) {
    continue
  }
  $seen[$key] = $true
  $yamlLines += "  - hostname: $entryHost"
  $yamlLines += "    service: $($entry.service)"
}
$yamlLines += "  - service: http_status:404"

Set-Content -Path $configPath -Value ($yamlLines -join "`r`n") -Encoding UTF8

Write-Step "Installing/starting cloudflared service"
$cloudflaredService = sc.exe query cloudflared 2>$null | Out-String
if ($cloudflaredService -match "SERVICE_NAME:\s+cloudflared") {
  sc.exe stop cloudflared | Out-Null
  sc.exe start cloudflared | Out-Null
} else {
  cloudflared service install | Out-Null
  Start-Sleep -Seconds 1
  sc.exe start cloudflared | Out-Null
}

if (-not $SkipPublicHealth) {
  Write-Step "Checking public sync health"
  $publicSyncHealthUrl = "https://$syncHostnameNormalized/health"
  $publicSync = Invoke-RestMethod -Method Get -Uri $publicSyncHealthUrl
  if ($publicSync.status -ne "ok") {
    throw "Public sync health check failed at $publicSyncHealthUrl"
  }

  if (-not $SkipApiRoute -and $apiHostnameNormalized) {
    Write-Step "Checking public API health"
    $publicApiHealthUrl = "https://$apiHostnameNormalized/health"
    $publicApi = Invoke-RestMethod -Method Get -Uri $publicApiHealthUrl
    if ($publicApi.status -ne "ok") {
      throw "Public API health check failed at $publicApiHealthUrl"
    }
  }

  if (-not $SkipWebRoute -and $webHostnameNormalized) {
    $publicWebUrl = "https://$webHostnameNormalized"
    try {
      $publicWeb = Invoke-WebRequest -Method Get -Uri $publicWebUrl -UseBasicParsing -TimeoutSec 12
      if ($publicWeb.StatusCode -lt 200 -or $publicWeb.StatusCode -ge 400) {
        Write-Warn "Web domain returned HTTP $($publicWeb.StatusCode): $publicWebUrl"
      }
    } catch {
      Write-Warn "Web domain check failed ($publicWebUrl). Ensure web server is running on 127.0.0.1:$WebPort."
    }
  }
}

Write-Host ""
Write-Host "DONE." -ForegroundColor Green
Write-Host "sync_server_url = $publicApiBaseUrl" -ForegroundColor Green
Write-Host "sync_token      = $syncToken" -ForegroundColor Green
if (-not $SkipWebRoute -and $webHostnameNormalized) {
  Write-Host "web_portal_url  = https://$webHostnameNormalized" -ForegroundColor Green
}
Write-Host ""
Write-Host "Desktop .env.local was updated for selfhost routing." -ForegroundColor Yellow
