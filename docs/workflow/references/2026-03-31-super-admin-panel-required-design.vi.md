# Super Admin Panel Required Design (Browser Antidetect Platform)

Date: 2026-03-31  
Owner: Product + Platform + Security + Billing Ops  
Status: Draft for approval (Required-first scope)

## 1) Mục tiêu tài liệu
- Định nghĩa **phạm vi bắt buộc** của Super Admin Panel cho giai đoạn production-first.
- Chốt IA (menu/menu group), chức năng, bảng dữ liệu cốt lõi và UX hành động vận hành.
- Làm baseline để thiết kế UI, API contract, DB migration, RBAC, audit trước khi mở rộng tính năng nâng cao.

## 2) Nguyên tắc thiết kế bắt buộc
- Single control plane: mọi thao tác super admin phải đi qua API authority và ghi audit.
- Action-safe: thao tác nhạy cảm cần reason + confirm + rollback path (nếu có thể).
- Read fast, write careful: ưu tiên dashboard/table đọc nhanh; ghi dữ liệu có guard đa lớp.
- Tenant isolation: dữ liệu workspace luôn gắn `workspace_id`; action platform-level phải explicit scope.
- No hidden state: trạng thái billing/entitlement/ban/suspension phải truy vết được timeline.

## 3) IA bắt buộc (menu group + menu)

### Group A. Command Center
#### A1. Overview
- Mục đích: ảnh toàn cục 5 phút gần nhất.
- Widget bắt buộc:
  - Active workspaces, active users 24h, paid workspaces.
  - Billing health (past_due count, dunning queue).
  - Runtime health (launch success rate, crash rate).
  - Sync health (success/fail jobs, lag).
  - Security alerts (abuse, anomaly, risk spikes).
- Hành động:
  - Jump nhanh sang Workspaces/Revenue/System/Audit với filter đã áp.

#### A2. Incident Board
- Mục đích: điều phối sự cố liên quan auth/billing/sync/runtime.
- Chức năng:
  - Tạo incident, gán owner, severity, timeline.
  - Link sự cố với workspace và event logs.
  - Đánh dấu resolved + postmortem URL.

### Group B. Workspace Operations
#### B1. Workspaces
- Mục đích: quản trị tenant toàn hệ thống.
- Bảng chính:
  - Workspace, owner, plan, status, entitlement state, profile usage, storage usage, risk score, updated_at.
- Hành động hàng loạt:
  - Suspend/unsuspend workspace.
  - Set entitlement (`active`, `grace`, `read_only`).
  - Override profile limit (temporary/permanent).
  - Force refresh billing state.
- Hành động từng dòng:
  - View detail, open activity timeline, open invoices, impersonate (read-only / support mode).

#### B2. Membership & Access
- Mục đích: xử lý sai phân quyền và membership platform-wide.
- Chức năng:
  - Xem owner/admin/member/viewer theo workspace.
  - Reassign owner, revoke user khỏi workspace.
  - Revoke pending invites / share grants.

#### B3. Abuse & Trust
- Mục đích: chống lạm dụng và account farming.
- Chức năng:
  - Blocklist email/domain/ip/device fingerprint.
  - Flag workspace/user với trust level.
  - Rate-limit escalation policy.

### Group C. Revenue & Billing
#### C1. Plans Catalog
- Mục đích: quản lý catalog plan công khai.
- Chức năng:
  - CRUD plan metadata (name, description, limits, support tier, public visibility).
  - Versioning kế hoạch giá (effective_from/effective_to).
  - Khóa publish khi thiếu mapping price_id/payment provider.

#### C2. Subscriptions
- Mục đích: quan sát và xử lý subscription lifecycle.
- Bảng chính:
  - Workspace, plan, cycle, status, source, period_end, cancel_at_period_end, mrr, last_invoice_status.
- Hành động:
  - Cancel now / cancel at period end / reactivate.
  - Manual grant/revoke entitlement.
  - Sync lại từ payment provider.

#### C3. Invoices & Payments
- Mục đích: đối soát doanh thu và lỗi thanh toán.
- Bảng chính:
  - Invoice id, workspace, amount, discount, method, provider_ref, paid_at, status.
- Hành động:
  - Mark paid (manual settlement), issue credit note, export CSV.

#### C4. Coupons & Promotions
- Mục đích: quản trị coupon chuẩn hóa.
- Chức năng:
  - Tạo coupon theo percent/fixed, expiry, max_redemption.
  - Allowlist/denylist workspace.
  - Revoke coupon + lý do.

### Group D. Security & Compliance
#### D1. Audit Logs
- Mục đích: forensic + compliance.
- Chức năng:
  - Filter theo actor/action/workspace/time/risk.
  - Drill-down payload trước/sau thay đổi.
  - Export signed audit bundle.

#### D2. Policy Center
- Mục đích: policy vận hành và bảo mật.
- Chức năng:
  - Password/MFA policy.
  - Session timeout policy.
  - Allowed geo/IP controls (nếu bật).

#### D3. Data Governance
- Mục đích: retention/legal requests.
- Chức năng:
  - Retention policy by entity.
  - Data export/delete request tracking.
  - Legal hold flags.

### Group E. Platform System
#### E1. Service Health
- Mục đích: readiness của dependency.
- Chức năng:
  - Auth, billing provider, sync storage, queue worker, notification.
  - Latency/error budget, degraded mode state.

#### E2. Jobs & Queues
- Mục đích: vận hành queue và background jobs.
- Chức năng:
  - Retry/dead-letter queue actions.
  - Pause/resume worker pool theo queue.

#### E3. Feature Flags
- Mục đích: rollout an toàn.
- Chức năng:
  - Enable/disable theo tenant segment.
  - Canary rollout (%) + kill switch.

### Group F. Support Tools
#### F1. Support Console
- Mục đích: xử lý ticket nhanh theo context tenant.
- Chức năng:
  - Search workspace/user/email.
  - Open timeline tổng hợp (billing + auth + sync + policy changes).

#### F2. Impersonation Center
- Mục đích: hỗ trợ điều tra có kiểm soát.
- Chức năng bắt buộc:
  - Chỉ cho role được cấp.
  - Bắt buộc reason + TTL session + banner cảnh báo.
  - Ghi audit start/stop + scope.

## 4) Bảng dữ liệu bắt buộc (logical schema)

## 4.1 `platform_workspaces`
- Mục đích: tenant master.
- Cột chính:
  - `id (uuid, pk)`
  - `name (text)`
  - `owner_user_id (uuid, indexed)`
  - `plan_id (text, indexed)`
  - `entitlement_state (enum: active/grace/read_only)`
  - `risk_score (int)`
  - `suspended_at (timestamp, nullable)`
  - `created_at`, `updated_at`

## 4.2 `platform_workspace_memberships`
- Cột chính:
  - `workspace_id (fk, indexed)`
  - `user_id (fk, indexed)`
  - `role (enum owner/admin/member/viewer)`
  - `status (active/revoked)`
  - `created_at`, `revoked_at`

## 4.3 `billing_subscriptions`
- Cột chính:
  - `workspace_id (fk, unique)`
  - `plan_id`, `plan_label`
  - `billing_cycle (monthly/yearly)`
  - `status (active/past_due/canceled)`
  - `source (internal/license/provider)`
  - `period_start`, `period_end`
  - `cancel_at_period_end (bool)`
  - `provider_subscription_ref`
  - `updated_at`

## 4.4 `billing_invoices`
- Cột chính:
  - `id (uuid, pk)`
  - `workspace_id (fk, indexed)`
  - `subscription_id (fk, indexed)`
  - `amount_usd`, `discount_percent`, `net_amount_usd`
  - `status (paid/open/void/uncollectible)`
  - `method`, `provider_invoice_ref`
  - `issued_at`, `paid_at`

## 4.5 `billing_coupons`
- Cột chính:
  - `id (uuid, pk)`
  - `code (unique, indexed)`
  - `type (percent/fixed)`
  - `value`
  - `max_redemptions`, `redeemed_count`
  - `expires_at`, `revoked_at`
  - `workspace_allowlist (jsonb)`
  - `workspace_denylist (jsonb)`

## 4.6 `workspace_usage_daily`
- Cột chính:
  - `workspace_id (fk, indexed)`
  - `date (date, indexed)`
  - `profiles_used`
  - `storage_used_bytes`
  - `sessions_launched`
  - `automation_runs`
  - `sync_jobs_success`, `sync_jobs_failed`

## 4.7 `platform_audit_logs`
- Cột chính:
  - `id (uuid, pk)`
  - `actor_user_id`, `actor_role`
  - `action (indexed)`
  - `resource_type`, `resource_id`
  - `workspace_id (nullable, indexed)`
  - `reason (text)`
  - `payload_before (jsonb)`, `payload_after (jsonb)`
  - `ip`, `user_agent`
  - `created_at (indexed)`

## 4.8 `platform_incidents`
- Cột chính:
  - `id (uuid, pk)`
  - `title`, `severity`, `status`
  - `owner_user_id`
  - `affected_services (jsonb)`
  - `started_at`, `resolved_at`
  - `postmortem_url`

## 5) Table UX/interaction chuẩn bắt buộc

## 5.1 Pattern chung cho toàn bộ table
- Toolbar: search + filter chips + saved views + export.
- Cột pin trái: identity (`workspace/user`) luôn cố định khi scroll ngang.
- Bulk actions: chỉ hiện khi có row selected.
- Row detail panel: mở bên phải, không rời trang.
- Empty state: có CTA rõ (tạo mới/làm mới/điều chỉnh filter).

## 5.2 Filter chuẩn
- Time range preset: 24h, 7d, 30d, custom.
- Status filter đa chọn.
- Risk filter đa mức.
- Source filter (internal/provider/license).

## 5.3 Action safety UX
- Action phá hủy hoặc có tác động tài chính cần:
  - confirm modal + nhập reason bắt buộc.
  - hiển thị preview tác động.
  - toast + timeline update sau khi thành công.

## 6) Role & permission model tối thiểu
- `platform_super_admin`: full read/write.
- `platform_billing_ops`: chỉ Revenue & Billing + read workspace.
- `platform_security_ops`: Security/Policy/Audit + Abuse actions.
- `platform_support_ops`: Support console + impersonation support mode.
- `platform_readonly_analyst`: read-only dashboards/tables.

## 7) API contract tối thiểu (bắt buộc có)
- `GET /v1/platform/admin/overview`
- `GET /v1/platform/admin/workspaces`
- `POST /v1/platform/admin/workspaces/{id}/entitlement`
- `POST /v1/platform/admin/workspaces/{id}/suspend`
- `GET /v1/platform/admin/subscriptions`
- `POST /v1/platform/admin/subscriptions/{workspaceId}/cancel`
- `POST /v1/platform/admin/subscriptions/{workspaceId}/reactivate`
- `GET /v1/platform/admin/invoices`
- `GET /v1/platform/admin/coupons`
- `POST /v1/platform/admin/coupons`
- `POST /v1/platform/admin/coupons/{id}/revoke`
- `GET /v1/platform/admin/audit-logs`
- `GET /v1/platform/admin/incidents`
- `POST /v1/platform/admin/incidents`
- `GET /v1/platform/admin/system/health`

## 8) KPI vận hành bắt buộc trong panel
- Billing:
  - Checkout success rate, payment failure rate, dunning recovery rate.
- Product/runtime:
  - Launch success rate, crash-free sessions, sync success ratio.
- Security:
  - Abuse blocked count, suspicious login count.
- Support:
  - MTTR incident, ticket resolution time.

## 9) Phạm vi “không bắt buộc ngay” (phase sau)
- BI dashboard nâng cao đa chiều.
- Rule engine anti-fraud tự động theo ML.
- Multi-provider billing routing.
- Compliance automation nâng cao (SOC2 report generator).

## 10) Acceptance checklist cho Required-first scope
- [ ] Có đủ 6 menu group + các menu bắt buộc ở mục 3.
- [ ] Mỗi action nhạy cảm có reason + audit log.
- [ ] Workspaces/Subscriptions/Invoices/Coupons/Audit có table và filter chuẩn.
- [ ] Có role matrix và backend guard tương ứng.
- [ ] Không có thao tác write nào đi vòng qua local state không audit.
- [ ] Dashboard hiển thị được KPI cốt lõi tại mục 8.
