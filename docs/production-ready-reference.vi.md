# BugLogin Production Ready Reference (VN)

Tài liệu này là checklist tham chiếu nhanh khi đưa BugLogin lên production.

## 1) Kết luận nhanh

Có, **1 domain + 1 VPS + S3 + PostgreSQL** là đủ để chạy bản production giai đoạn đầu.

Mô hình tối thiểu:

- `app desktop` (BugLogin)
- `buglogin-sync` chạy trên 1 VPS
- `PostgreSQL` chạy cùng VPS (hoặc managed DB ngoài VPS)
- `S3` (bạn đã có)
- `TLS` qua reverse proxy (Caddy/Nginx)
- `1 domain` + subdomain (ví dụ `sync.yourdomain.com`)

## 2) Khi nào mô hình này phù hợp

Phù hợp nếu:

- đội nhỏ, traffic thấp đến vừa
- cần release nhanh, vận hành đơn giản
- dùng PostgreSQL làm nguồn dữ liệu authority cho workspace/billing/entitlement

Không phù hợp nếu:

- yêu cầu HA cao (zero downtime)
- volume lớn, cần audit/billing authority ở DB chuẩn

## 3) Hạ tầng tối thiểu đề xuất

### `VPS`

- CPU: 2 vCPU
- RAM: 2 GB (khuyến nghị), 1 GB chỉ nên dùng thử tải nhẹ
- Disk: >= 40 GB SSD
- OS: Ubuntu 22.04/24.04

### `Domain`

- 1 domain là đủ
- dùng subdomain:
  - `sync.yourdomain.com` -> `buglogin-sync`
  - (tuỳ chọn) `api.yourdomain.com`, `billing.yourdomain.com`

### `S3`

- bucket riêng cho sync data
- IAM key tối thiểu quyền read/write đúng bucket
- bật versioning/lifecycle nếu cần backup dài hạn

## 4) Luồng kết nối production chuẩn

1. BugLogin app gọi `sync_server_url` (HTTPS) + bearer token.
2. Server `buglogin-sync` xác thực token (`SYNC_TOKEN` hoặc JWT public key).
3. Server xử lý control-plane/sync và ghi object lên S3.
4. App **không** kết nối trực tiếp DB/S3.

## 5) ENV server production (`buglogin-sync`)

Tham chiếu file: `buglogin-sync/.env.example`

```env
SYNC_TOKEN=replace_with_long_random_token
SYNC_ROOT_PREFIX=prod
SYNC_AUDIT_LOG_FILE=/data/sync-audit.log
SYNC_JWT_PUBLIC_KEY=
CONTROL_API_TOKEN=replace_with_control_api_token
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/buglogin
CONTROL_SQLITE_FILE=/data/control-state.sqlite
CONTROL_LICENSE_KEYS=BUG-STARTER-CLAIM:starter:100:monthly,BUG-GROWTH-CLAIM:growth:300:monthly

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

PORT=3929
S3_ENDPOINT=https://s3.your-provider.com
S3_REGION=ap-southeast-1
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=yyy
S3_BUCKET=buglogin-sync-prod
S3_FORCE_PATH_STYLE=false
```

Ghi chú:

- nếu chưa bật Stripe ngay, để trống 2 biến Stripe, app vẫn chạy.
- `CONTROL_API_TOKEN` bắt buộc nên có ở production.
- `DATABASE_URL` nên bắt buộc ở production.
- `CONTROL_SQLITE_FILE` dùng cho local/dev khi chưa cấu hình Postgres.
- `CONTROL_LICENSE_KEYS` dùng cho luồng self-host claim license (không bypass plan).
- dùng token dài ngẫu nhiên cho `SYNC_TOKEN` (ví dụ 32 bytes trở lên).
- `SYNC_ROOT_PREFIX` giup tach namespace S3 theo moi truong.
- `SYNC_AUDIT_LOG_FILE` nen dat tren volume ben vung de giu dau vet sync.

## 6) Runtime config cho app desktop (không cần rebuild)

File runtime:

- Windows release: `%LOCALAPPDATA%\BugLogin\settings\buglogin-config.json`
- Debug/dev có thể là thư mục `BugLoginDev`

Ví dụ:

```json
{
  "cloud_api_url": "https://api.yourdomain.com",
  "cloud_sync_url": "https://sync.yourdomain.com",
  "update_check_url": "https://api.yourdomain.com/v1/app/check-update",
  "browser_manifest_url": "https://api.yourdomain.com/v1/browsers/manifest",
  "auth_api_url": "https://auth.yourdomain.com",
  "stripe_publishable_key": "pk_live_xxx",
  "stripe_billing_url": "https://billing.yourdomain.com"
}
```

Nếu chưa có auth/billing thật, có thể để `auth_api_url`, `stripe_*` rỗng để app vào trạng thái `pending config` thay vì crash.

## 7) Checklist go-live

1. Trỏ DNS `sync.yourdomain.com` về VPS.
2. Cài reverse proxy + TLS (Let’s Encrypt).
3. Khởi động PostgreSQL (local service hoặc managed).
4. Chạy `buglogin-sync` bằng Docker/PM2/systemd.
5. Set đầy đủ env `SYNC_TOKEN`, `CONTROL_API_TOKEN`, `DATABASE_URL`, `S3_*`.
6. Kiểm tra:
   - `GET /health` trả `{"status":"ok"}`
   - `GET /readyz` trả `{"status":"ready","s3":true}`
   - `GET /config-status` phản ánh đúng trạng thái config
7. Trên app desktop:
   - vào Sync Config
   - set `sync_server_url=https://sync.yourdomain.com`
   - set `sync_token=<SYNC_TOKEN>`
8. Test end-to-end:
   - login
   - tạo profile/group
   - bật sync
   - kiểm tra object xuất hiện trên S3
9. Bật monitor/log rotate + backup DB + backup bucket S3.

## 8) Lộ trình nâng cấp khi scale

Giai đoạn 1 (hiện tại):

- PostgreSQL + S3 + 1 VPS

Giai đoạn 2 (ổn định production):

- tinh chỉnh backup/restore DB định kỳ
- tách DB managed nếu cần độ ổn định cao hơn
- server stateless hơn, scale ngang dễ hơn

Giai đoạn 3 (cao tải):

- tách reverse proxy riêng
- thêm staging/prod tách biệt
- thêm alerting (CPU/RAM/5xx/webhook fail/quota deny)

## 9) Lưu ý pháp lý thanh toán

- Stripe cần pháp nhân ở quốc gia hỗ trợ.
- Nếu pháp nhân hiện tại chưa phù hợp, giữ billing ở trạng thái pending và vẫn cho app chạy với control hạn mức nội bộ.

## 10) Stripe key security khi release

Nguyên tắc bắt buộc:

- `pk_*` (publishable key): có thể xuất hiện ở client runtime config.
- `sk_*`, `rk_*`, `whsec_*`: chỉ nằm trên server (`buglogin-sync`) hoặc secret manager.

Không để lộ key khi release:

1. Không commit key vào git (`.env.local` đã ignore, nhưng vẫn cần kiểm tra trước commit).
2. Dùng secret manager của CI/CD (GitHub Actions Secrets, Docker secrets, VPS env file ngoài repo).
3. Build desktop app không nhúng `sk_*`/`rk_*`/`whsec_*` vào bundle.
4. Reverse proxy + HTTPS bắt buộc cho webhook endpoint.
5. Bật quy trình rotation key định kỳ (ít nhất mỗi 90 ngày hoặc ngay khi nghi lộ key).

Checklist release an toàn key:

1. Quét code trước tag release: không còn `sk_`, `rk_`, `whsec_` trong file tracked.
2. Inject secret tại runtime deploy, không truyền qua `NEXT_PUBLIC_*`.
3. Kiểm tra `GET /config-status` để chắc Stripe server-side đã nhận đủ secret/webhook.
4. Test thanh toán sandbox và webhook trước khi chuyển live key.
5. Rotate test key nếu từng chia sẻ qua chat/log công khai.

---

Tài liệu liên quan:

- `docs/self-hosting-buglogin-sync.md`
- `buglogin-sync/docs/production-architecture.md`
- `buglogin-sync/docs/control-plane-postgres-schema.sql`
