# VPS Auto Deploy via GitHub Webhook

## Muc tieu
- `git push origin main` tren private repo tu dong deploy VPS.
- Khong dung GitHub Actions release workflow.
- Verify manh truoc khi reload PM2.

## 1) Cai webhook receiver service tren VPS
```bash
cd /var/www/buglogin/app
git pull --ff-only
WEBHOOK_SECRET='<secret-random-dai>' \
bash scripts/vps/install-github-webhook-service.sh
```

## 2) Cau hinh GitHub Webhook (repo private)
- Repo: `keyduc91/Malvanut-Login`
- URL: `http://<VPS_IP>:9912/github/deploy`
- Content type: `application/json`
- Secret: trung voi `WEBHOOK_SECRET` o buoc 1
- Events: chi chon `Just the push event`
- Active: on

Khuyen nghi:
- Dat reverse proxy + TLS cho webhook endpoint neu mo internet.
- Hoac chi allow GitHub IP ranges tren firewall.

## 3) Deploy script behavior
File: `scripts/deploy-vps-web-api.sh`
- Auto `git fetch + checkout + pull --ff-only`.
- Co lock file: tranh deploy chong cheo.
- Mac dinh `VERIFY_STRICT=1`:
  - `pnpm lint`
  - `pnpm --dir buglogin-sync test -- --runInBand`
- Sau verify moi build/reload PM2 va healthcheck.

## 4) Lenh quan sat
```bash
systemctl status buglogin-github-webhook --no-pager
journalctl -u buglogin-github-webhook -f
pm2 status
```

## 5) Emergency skip verify
Chi dung khi can hotfix:
```bash
VERIFY_STRICT=0 bash scripts/deploy-vps-web-api.sh
```
