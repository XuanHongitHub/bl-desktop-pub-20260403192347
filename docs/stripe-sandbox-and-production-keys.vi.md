# Stripe Sandbox + Production Key Setup (BugLogin)

Tài liệu này mô tả cách cấu hình Stripe cho local self-host trước, và cách release production mà không lộ API key.

## 1) Cấu hình sandbox (local self-host)

### App desktop (Tauri)

Tạo/sửa file `.env.local` ở root repo:

```env
BUGLOGIN_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
BUGLOGIN_STRIPE_BILLING_URL=https://your-checkout-host.example.com/checkout
```

Ghi chú:

- App đang đọc runtime endpoint từ `app_config` (file runtime hoặc biến môi trường `BUGLOGIN_*`).
- Script `scripts/tauri-before-dev.mjs` đã forward `BUGLOGIN_*` từ `.env.local` sang process Tauri backend khi chạy `pnpm tauri dev`.
- `BUGLOGIN_STRIPE_BILLING_URL` phải là URL checkout thực tế (server của bạn hoặc payment link/checkout router), vì app sẽ mở URL này khi bấm thanh toán.

### buglogin-sync server (NestJS)

Tạo file `buglogin-sync/.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

`buglogin-sync` đã load `.env.local` ưu tiên trước `.env`.

## 2) Cấu hình runtime cho bản release desktop

Không cần rebuild app để đổi endpoint Stripe. Tạo file:

- Windows release: `%LOCALAPPDATA%\BugLogin\settings\buglogin-config.json`
- Windows dev/debug: `%LOCALAPPDATA%\BugLoginDev\settings\buglogin-config.json`

Ví dụ:

```json
{
  "stripe_publishable_key": "pk_live_xxx",
  "stripe_billing_url": "https://billing.yourdomain.com/checkout"
}
```

## 3) Quy tắc không lộ key

Tuyệt đối không để trong client bundle:

- `sk_*`
- `rk_*`
- `whsec_*`

Cho phép ở client runtime config:

- `pk_*`

Best practice:

1. Dùng secret manager ở server/CI, không hardcode trong code.
2. Không dùng `NEXT_PUBLIC_*` cho secret key.
3. Stripe webhook chỉ verify ở server.
4. Bật rotation key định kỳ và rotation ngay khi nghi lộ.

## 4) Quy trình release production an toàn

1. Tạo live keys trên Stripe Dashboard.
2. Lưu `sk_live_*` và `whsec_*` vào secret manager của server.
3. Cập nhật `pk_live_*` + `stripe_billing_url` trong runtime config file của desktop app.
4. Deploy `buglogin-sync` với env secret mới.
5. Test:
   - tạo checkout sandbox/live theo môi trường
   - verify webhook nhận được event
   - kiểm tra config-status trước khi phát hành rộng.

## 5) Lưu ý quan trọng

Nếu key test từng được chia sẻ qua chat/log công khai, hãy rotate key test ngay để tránh bị lạm dụng.
