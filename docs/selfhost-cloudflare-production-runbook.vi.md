# BugLogin Selfhost Runbook (Windows + Cloudflare Tunnel)

Tai lieu nay chuan hoa flow selfhost theo 3 domain:

- Web portal: `https://bugdev.site`
- Sync endpoint: `https://sync.bugdev.site`
- API endpoint (khuyen nghi cho app): `https://api.bugdev.site`

Muc tieu: sau nay chi doi `domain/db/env` la co the di production nhanh.

## 1) Domain architecture

- `bugdev.site` -> Next official website (landing, pricing, plans, management)
- `sync.bugdev.site` -> buglogin-sync service
- `api.bugdev.site` -> buglogin-sync service (same backend, API-friendly hostname)

Khuyen nghi app desktop dung:

- `sync_server_url=https://api.<domain>`
- `sync_token=<server token>`

## 2) One-time bootstrap

### Terminal 1 (PowerShell, run as Admin)

```powershell
cd E:\bug-login
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\bootstrap-selfhost-cloudflare.ps1 `
  -SyncHostname "sync.bugdev.site" `
  -ApiHostname "api.bugdev.site" `
  -WebHostname "bugdev.site" `
  -RepoRoot "E:\bug-login" `
  -TunnelName "buglogin-sync" `
  -SyncPort 12342 `
  -WebPort 12341
```

Script se:

- tao/refresh token trong `buglogin-sync/.env`
- route DNS cho `sync/api/web`
- ghi `C:\Users\<user>\.cloudflared\config.yml` voi 3 ingress
- cap nhat `.env.local` cua app desktop:
  - `NEXT_PUBLIC_WEB_PORTAL_URL=https://bugdev.site`
  - `NEXT_PUBLIC_BILLING_PORTAL_URL=https://bugdev.site`
  - `NEXT_PUBLIC_SYNC_SERVER_URL=https://api.bugdev.site`

## 3) Start service stack (daily)

### Terminal 1: buglogin-sync

```powershell
cd E:\bug-login\buglogin-sync
pnpm build
node dist/main.js
```

### Terminal 2: web portal

```powershell
cd E:\bug-login
pnpm build
pnpm start -- --port 12341 --hostname 127.0.0.1
```

### Terminal 3: cloudflared

```powershell
cloudflared tunnel --config C:\Users\Acer\.cloudflared\config.yml run buglogin-sync
```

## 4) Fast clean restart script

```powershell
cd E:\bug-login
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\clean-restart-selfhost-and-app.ps1 `
  -PublicSyncHealthUrl "https://sync.bugdev.site/health" `
  -PublicApiHealthUrl "https://api.bugdev.site/health" `
  -PublicWebUrl "https://bugdev.site" `
  -NoTauri
```

Neu web server chua chay ma ban van muon restart sync+tunnel:

```powershell
cd E:\bug-login
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\clean-restart-selfhost-and-app.ps1 `
  -SkipWebHealth `
  -NoTauri
```

## 5) Verification checklist

```powershell
curl.exe http://127.0.0.1:12342/health
curl.exe https://sync.bugdev.site/health
curl.exe https://api.bugdev.site/health
curl.exe -I https://bugdev.site
```

Expected:

- 3 health endpoint tra `{"status":"ok"}`
- web portal HTTP 200/301/302 la hop le

## 6) Client bootstrap (khong bat user nhap tay)

```powershell
cd E:\bug-login
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\write-sync-bootstrap.ps1 `
  -SyncServerUrl "https://api.bugdev.site" `
  -SyncToken "<SYNC_TOKEN_FROM_SERVER>"
```

File duoc ghi:

- `%LOCALAPPDATA%\BugLogin\settings\sync_bootstrap.json`
- `%LOCALAPPDATA%\BugLoginDev\settings\sync_bootstrap.json`

## 7) Production switch guide

Khi doi sang domain production (vd `buglogin.com`):

1. Doi DNS/Cloudflare route:
   - `buglogin.com`
   - `sync.buglogin.com`
   - `api.buglogin.com`
2. Doi env + restart:
   - `NEXT_PUBLIC_WEB_PORTAL_URL=https://buglogin.com`
   - `NEXT_PUBLIC_BILLING_PORTAL_URL=https://buglogin.com`
   - `NEXT_PUBLIC_SYNC_SERVER_URL=https://api.buglogin.com`
   - `SYNC_TOKEN`, `DATABASE_URL`, `S3_*`, Stripe key
3. Update bootstrap file cho client voi `api.buglogin.com`.

## 8) Notes

- Log `Failed to initialize DNS local resolver ... region1.v2.argotunnel.com` co the xuat hien tung luc; neu `health` public van `ok` thi stack van hoat dong.
- Neu gap SSL/TLS loi tren Windows, thu:
  - `ipconfig /flushdns`
  - doi DNS resolver: `1.1.1.1` hoac `8.8.8.8`
  - verify NS record da ve Cloudflare.
