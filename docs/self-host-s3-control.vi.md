# Self-Host S3 Control Cho BugLogin (VN)

Tai lieu nay danh cho truong hop ban chua co VPS/domain/Postgres production, nhung muon:
- dung `buglogin-sync` voi S3 that,
- dong bo day du trong app,
- khong che dung luong/cost tren S3,
- co the xoa sach du lieu S3 khi can.

## 1) Kien truc toi thieu (hien tai)

Ban van can chay `buglogin-sync` server, it nhat tren may local:

- BugLogin App (desktop) -> goi HTTP den `buglogin-sync`
- `buglogin-sync` -> cap pre-signed URL + thao tac object
- S3 -> luu object sync (profiles/proxies/groups/tombstones...)

Neu chua co VPS/domain:
- Dev 1 may: dat `sync_server_url=http://127.0.0.1:3929`
- Nhieu may: tam thoi can tunnel/VPN LAN (chi nen dung noi bo)

## 2) Cac bien moi truong quan trong

Tham chieu file goc: `buglogin-sync/.env.example`

Bat buoc toi thieu:
- `SYNC_TOKEN`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_BUCKET`

Khuyen nghi:
- `CONTROL_API_TOKEN` (tranh open control-plane)
- `CONTROL_SQLITE_FILE` (DB SQLite local cho workspace/billing/coupon khi chua dung Postgres)
- `SYNC_ROOT_PREFIX` (tach namespace S3 cho tung env/may)
- `SYNC_AUDIT_LOG_FILE` (ghi log thao tac sync de truy vet)
- `S3_ENDPOINT` (neu khong phai AWS S3 native)
- `S3_FORCE_PATH_STYLE=true` (MinIO/R2 tuy provider)

Vi du Docker Compose (dung S3 provider that, khong dung MinIO):

```yaml
services:
  buglogin-sync:
    image: buglogin/buglogin-sync:latest
    ports:
      - "3929:3929"
    environment:
      - PORT=3929
      - SYNC_TOKEN=replace_me_sync_token
      - SYNC_ROOT_PREFIX=selfhost-dev
      - SYNC_AUDIT_LOG_FILE=/data/sync-audit.log
      - CONTROL_API_TOKEN=replace_me_control_token
      - CONTROL_SQLITE_FILE=/data/control-state.sqlite
      - S3_ENDPOINT=https://s3.ap-southeast-1.amazonaws.com
      - S3_REGION=ap-southeast-1
      - S3_ACCESS_KEY_ID=replace_me_key
      - S3_SECRET_ACCESS_KEY=replace_me_secret
      - S3_BUCKET=buglogin-sync-selfhost-dev
      - S3_FORCE_PATH_STYLE=false
    volumes:
      - ./data:/data
```

## 3) Flow chuc nang S3 trong code hien tai

### Server sync (NestJS)

File chinh:
- `buglogin-sync/src/sync/sync.service.ts`
- `buglogin-sync/src/sync/sync.controller.ts`

Endpoints app dang dung:
- `POST /v1/objects/presign-upload`
- `POST /v1/objects/presign-download`
- `POST /v1/objects/presign-upload-batch`
- `POST /v1/objects/presign-download-batch`
- `POST /v1/objects/list`
- `POST /v1/objects/delete`
- `POST /v1/objects/delete-prefix`

Luu y quan trong:
- self-host auth (`SYNC_TOKEN`) hien tai chay mode `self-hosted`, khong ap profile/storage cap tu JWT.
- xoa profile dung `delete-prefix` + tombstone, da co san.

### Desktop app (Tauri)

File chinh:
- `src-tauri/src/sync/client.rs`
- `src-tauri/src/sync/engine.rs`

App goi `delete_prefix` khi xoa profile, goi `delete` khi xoa proxy/group/vpn/extension group.
Nen ve mat chuc nang, app da co duong dan day du de day len va xoa tren S3.

## 4) Khong che data/cost tren S3 (best-practice)

Nen lam dong thoi 4 lop:

1. Bucket rieng theo moi truong
- `buglogin-sync-dev`, `buglogin-sync-staging`, `buglogin-sync-prod`
- khong dung chung 1 bucket cho tat ca.

2. IAM toi thieu quyen
- cho phep read/write/delete chi bucket sync.
- khong cap quyen sang bucket khac.

3. Lifecycle policy tren bucket
- Abort incomplete multipart upload sau 1 ngay.
- Xoa object tombstone cu (vi du sau 30-90 ngay).
- Neu bat versioning: dat noncurrent expiration de tranh phinh dung luong.

4. Co che purge chu dong
- Xoa theo prefix (workspace/profile) khi can cleanup.
- Xoa toan bucket khi reset moi truong.

5. Luu dau vet thao tac (audit)
- Bat `SYNC_AUDIT_LOG_FILE` de ghi JSONL cho cac hanh dong:
  - `presign_upload`, `presign_download`
  - `presign_upload_batch`, `presign_download_batch`
  - `delete`, `delete_prefix`
- Log nay rat quan trong khi local reset data, vi ban van truy vet duoc object nao da tao/xoa tren S3.
- Nen rotate log dinh ky (logrotate hoac script) de tranh phinh dung luong dia.

## 5) Purge du lieu: lenh dung ngay

### Xoa toan bo object trong bucket

AWS S3:

```bash
aws s3 rm s3://buglogin-sync-selfhost-dev --recursive
```

S3-compatible endpoint (R2/MinIO/...):

```bash
aws s3 rm s3://buglogin-sync-selfhost-dev --recursive \
  --endpoint-url https://<your-s3-endpoint>
```

### Xoa theo prefix (vi du profiles/)

```bash
aws s3 rm s3://buglogin-sync-selfhost-dev/profiles/ --recursive \
  --endpoint-url https://<your-s3-endpoint>
```

### Xoa qua API sync (de app nhan tombstone dung flow)

```bash
curl -X POST http://127.0.0.1:3929/v1/objects/delete-prefix \
  -H "Authorization: Bearer <SYNC_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "prefix": "profiles/<profile_id>/",
    "tombstoneKey": "tombstones/profiles/<profile_id>.json"
  }'
```

## 6) Cach config trong BugLogin app

Mo `Sync Config` trong app:
- `Server URL`: `http://127.0.0.1:3929` (dev local)
- `Token`: gia tri `SYNC_TOKEN`

Sau do bat sync cho tung profile/proxy/group theo nhu cau.

## 7) Gioi han hien tai va de xuat nang cap

Hien tai self-host mode voi `SYNC_TOKEN` khong co hard limit storage/profile o server.

Neu ban muon chot cung han muc ngay tren server self-host, nen bo sung:
- `SELF_HOST_PROFILE_LIMIT`
- `SELF_HOST_STORAGE_CAP_MB`
- `SELF_HOST_MAX_OBJECT_BYTES`

De xuat: neu can, tao change tiep theo de enforce 3 bien tren trong `sync.service.ts`.

## 8) Checklist van hanh ngan gon

- [ ] Da set `SYNC_TOKEN` manh (random 32 bytes tro len)
- [ ] Da set `CONTROL_API_TOKEN`
- [ ] Da tach bucket theo env
- [ ] Da dat lifecycle policy (abort multipart + expiration)
- [ ] Da test `GET /health` va `GET /readyz`
- [ ] Da test upload + delete profile tren app
- [ ] Da test purge prefix va purge bucket
