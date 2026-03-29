# Đặc tả Web Admin Panel + Web Billing (thay thế luồng app)

Ngày: 2026-03-26
Trạng thái: Draft triển khai
Liên kết OpenSpec:
- `openspec/changes/topic10-web-billing-replacement`
- `openspec/changes/topic11-web-admin-portal-separation`

## 1) Mục tiêu
- Đưa toàn bộ quản trị cấp platform/workspace lên web.
- Desktop app chỉ còn là runtime client (profiles/proxy/automation/runtime settings) và đọc state từ server.
- Luồng pricing/plan/checkout/management đều chạy trên web.

## 2) Kiến trúc domain
### Selfhost
- Web app: `https://bugdev.site`
- Control API: `https://sync.bugdev.site`

### Production
- Web app: `https://buglogin.com` (hoặc domain production mới)
- Control API: `https://sync.buglogin.com`

### Quy tắc resolve web portal trong app
1. Ưu tiên `NEXT_PUBLIC_WEB_PORTAL_URL`.
2. Nếu không có, derive từ `sync_server_url` (nếu host bắt đầu bằng `sync.` thì bỏ `sync.`).
3. Fallback môi trường:
- dev/selfhost: `https://bugdev.site`
- production: `https://buglogin.com`

## 3) Cây trang web
## 3.1 Public & Billing web
- `/`
  - Landing
  - CTA: Sign in, Pricing, Contact Sales
- `/pricing`
  - So sánh plan + addon
  - Chọn chu kỳ tháng/năm
- `/plans`
  - Chi tiết quyền lợi từng gói
- `/billing/checkout`
  - Khởi tạo checkout web-only
- `/billing/management`
  - Subscription status, invoice, payment method, coupon/license policy (nếu bật)

## 3.2 Workspace Owner Panel (web)
- `/workspace/:workspaceId/overview`
  - Snapshot: usage, entitlement, limits
- `/workspace/:workspaceId/members`
  - Member list, invite, role change, revoke
- `/workspace/:workspaceId/access`
  - Share grants, policy checks
- `/workspace/:workspaceId/ops`
  - Workspace config vận hành
- `/workspace/:workspaceId/billing`
  - Billing owner scope, renewal/cancel/reactivate

## 3.3 Super Admin Panel (web)
- `/admin/command-center`
  - Platform health, incident queue, release gates
- `/admin/workspaces`
  - Workspace lifecycle, ownership transfer, suspension/restore
- `/admin/revenue`
  - Plan governance, entitlement overrides, coupon governance
- `/admin/audit`
  - Audit stream, filter, export
- `/admin/operations`
  - BugIdea operations control, automation safety rails

## 4) Phân quyền
- Super Admin Panel: chỉ `platform_admin`.
- Workspace Owner Panel: `owner` và role được owner cấp explicit permission.
- Tất cả mutation quan trọng phải đi qua control API + audit log.

## 5) Desktop app sau migration
- Không còn render in-app Super Admin Panel/Workspace Owner Panel.
- Sidebar chỉ giữ runtime sections.
- Topbar/account menu mở web portal thay vì điều hướng in-app.
- Pricing/Billing section trong app trở thành bridge mở web portal.
- App vẫn pull entitlement/subscription từ control API để lock/unlock feature runtime.

## 6) Bảo mật
- Server authority cho billing/entitlement state.
- Desktop không phải purchase authority.
- Local auth/subscription write commands chỉ là compatibility path, không là nguồn quyết định cuối.

## 7) Checklist triển khai
- [ ] Web routes cho landing/pricing/plans/management hoàn thiện.
- [ ] Desktop cắt entry-point cũ tới in-app admin panel.
- [ ] Desktop bridge mở đúng domain selfhost/prod.
- [ ] Kiểm tra downgrade path khi web portal không reachable (thông báo + retry).
- [ ] Xác nhận entitlement đồng bộ sau thao tác web.
