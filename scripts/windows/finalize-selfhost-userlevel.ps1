$ErrorActionPreference = "Stop"

$startScript = "C:\Users\Acer\start-selfhost-buglogin.ps1"
$syncDir = "E:\bug-login\buglogin-sync"
$node = "C:\Program Files\nodejs\node.exe"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$cfConfig = "C:\Users\Acer\.cloudflared\config.yml"
$envFile = "E:\bug-login\buglogin-sync\.env"
$outPath = "C:\Users\Acer\Desktop\buglogin-selfhost-sync.txt"
$hostname = "sync.bugdev.site"

if (!(Test-Path $syncDir)) { throw "Missing sync dir: $syncDir" }
if (!(Test-Path $node)) { throw "Missing node: $node" }
if (!(Test-Path $cloudflared)) { throw "Missing cloudflared: $cloudflared" }
if (!(Test-Path $cfConfig)) { throw "Missing cloudflared config: $cfConfig" }
if (!(Test-Path $envFile)) { throw "Missing env file: $envFile" }

$scriptContent = @'
$ErrorActionPreference = "SilentlyContinue"
$syncDir = "E:\bug-login\buglogin-sync"
$node = "C:\Program Files\nodejs\node.exe"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$cfConfig = "C:\Users\Acer\.cloudflared\config.yml"

Get-Process node,cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
Start-Process -FilePath $node -ArgumentList "dist/main.js" -WorkingDirectory $syncDir -WindowStyle Hidden
Start-Sleep -Seconds 2
Start-Process -FilePath $cloudflared -ArgumentList "tunnel --config `"$cfConfig`" run buglogin-sync" -WindowStyle Hidden
'@

Set-Content -Path $startScript -Value $scriptContent -Encoding UTF8

schtasks /Create /SC ONLOGON /TN "BugLoginSelfhostUser" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript" /F | Out-Host

powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startScript
Start-Sleep -Seconds 5

$local = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:12342/health"
$public = Invoke-RestMethod -Method Get -Uri "https://$hostname/health"
$tokenLine = Get-Content $envFile | Where-Object { $_ -match "^SYNC_TOKEN=" } | Select-Object -First 1
$token = $tokenLine -replace "^SYNC_TOKEN=", ""

@"
sync_server_url=https://$hostname
sync_token=$token

Local health: $($local.status)
Public health: $($public.status)
Auto-start: Scheduled Task 'BugLoginSelfhostUser' (ONLOGON)
"@ | Set-Content -Path $outPath -Encoding UTF8

Write-Host "LOCAL=$($local.status) PUBLIC=$($public.status)"
Write-Host "TOKEN=$token"
Write-Host "TASK_CREATED=BugLoginSelfhostUser"
Write-Host "OUT_FILE=$outPath"
