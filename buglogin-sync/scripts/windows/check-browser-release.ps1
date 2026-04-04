param(
  [string]$BaseUrl = "http://127.0.0.1:12342",
  [string]$ReleaseToken = "",
  [switch]$PublishSample
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ReleaseToken) -and -not [string]::IsNullOrWhiteSpace($env:BUGLOGIN_RELEASE_API_TOKEN)) {
  $ReleaseToken = $env:BUGLOGIN_RELEASE_API_TOKEN
}

function Invoke-Check {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null
  )

  if ($null -ne $Body) {
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
  }
  return Invoke-RestMethod -Method $Method -Uri $Url -Headers $Headers
}

Write-Host "Health: $BaseUrl/health"
$health = Invoke-Check -Method "GET" -Url "$BaseUrl/health"
$health | ConvertTo-Json -Depth 10

if ($PublishSample) {
  if ([string]::IsNullOrWhiteSpace($ReleaseToken)) {
    throw "PublishSample requires release token. Pass -ReleaseToken or set BUGLOGIN_RELEASE_API_TOKEN."
  }

  $headers = @{ Authorization = "Bearer $ReleaseToken" }
  $payload = @{
    browser = "bugox"
    version = "1.0.0-dev"
    downloads = @{
      "windows-x64" = "https://downloads.bugdev.site/bugox/windows-x64/1.0.0-dev.zip"
    }
    update_policy = @{
      mode = "optional"
      required = $false
      message = "Dev channel"
    }
  }

  Write-Host "Publish sample release: $BaseUrl/v1/browser/release"
  $publishResult = Invoke-Check -Method "POST" -Url "$BaseUrl/v1/browser/release" -Headers $headers -Body $payload
  $publishResult | ConvertTo-Json -Depth 10
}

Write-Host "Get bugox manifest: $BaseUrl/v1/browser/bugox.json"
$bugox = Invoke-Check -Method "GET" -Url "$BaseUrl/v1/browser/bugox.json"
$bugox | ConvertTo-Json -Depth 10

Write-Host "Get bugium manifest: $BaseUrl/v1/browser/bugium.json"
try {
  $bugium = Invoke-Check -Method "GET" -Url "$BaseUrl/v1/browser/bugium.json"
  $bugium | ConvertTo-Json -Depth 10
} catch {
  Write-Host "bugium manifest is empty or not published yet."
}
