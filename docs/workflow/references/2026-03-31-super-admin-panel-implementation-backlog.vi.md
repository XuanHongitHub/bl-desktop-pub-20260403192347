# Super Admin Panel Implementation Backlog (Required-first)

Date: 2026-03-31  
Owner: Engineering Manager + Tech Lead  
Input: `docs/workflow/references/2026-03-31-super-admin-panel-required-design.vi.md`

## 1) Mục tiêu backlog
- Chuyển design required-first thành kế hoạch triển khai thực thi được.
- Tách rõ theo phase và theo track: FE, BE API, DB, Security/Audit, QA.

## 2) Phase plan tổng quan
1. Phase 0 - Foundation & contracts
2. Phase 1 - Core admin shell + Workspaces
3. Phase 2 - Revenue/Billing core
4. Phase 3 - Security/Compliance core
5. Phase 4 - System/Support core
6. Phase 5 - Hardening + go-live

---

## 3) Phase 0 - Foundation & contracts

### 3.1 FE
- [ ] Tạo `AdminShellLayout` + sidebar groups/menu cố định.
- [ ] Tạo component base: `PageHeader`, `FilterToolbar`, `DataTable`, `RightDetailDrawer`.
- [ ] Tạo route skeleton cho toàn bộ menu required.

### 3.2 BE/API
- [ ] Freeze API contract tối thiểu (overview/workspaces/subscriptions/invoices/coupons/audit/system).
- [ ] Chuẩn hóa pagination/sort/filter params.
- [ ] Chuẩn hóa error envelope và action response.

### 3.3 DB
- [ ] Chốt schema logical -> migration plan cho bảng core.
- [ ] Index strategy cho filter chính (status, workspace_id, created_at).

### 3.4 Security/Audit
- [ ] RBAC matrix platform roles.
- [ ] Audit event taxonomy (`resource.action`).

### 3.5 QA
- [ ] Viết test plan smoke cho từng menu route.
- [ ] Viết contract tests cho API response shape.

### Exit criteria
- [ ] Team chốt API spec + schema + component architecture.

---

## 4) Phase 1 - Core admin shell + Workspaces

### 4.1 FE
- [ ] Implement `Overview` page: KPI cards + quick links.
- [ ] Implement `Workspaces` page: table + filters + row drawer.
- [ ] Implement bulk actions UI: entitlement, suspend/unsuspend.

### 4.2 BE/API
- [ ] `GET /overview`
- [ ] `GET /workspaces`
- [ ] `POST /workspaces/{id}/entitlement`
- [ ] `POST /workspaces/{id}/suspend`

### 4.3 DB
- [ ] Materialized or cached view cho workspace health snapshot.

### 4.4 Security/Audit
- [ ] Enforce reason-required cho entitlement/suspend actions.
- [ ] Ghi audit đầy đủ payload before/after.

### 4.5 QA
- [ ] E2E: filter + bulk action + rollback behavior.
- [ ] Permission tests theo 5 role platform.

### Exit criteria
- [ ] Workspaces operations chạy production-safe với audit đầy đủ.

---

## 5) Phase 2 - Revenue/Billing core

### 5.1 FE
- [ ] Implement `Plans Catalog` table + edit flow.
- [ ] Implement `Subscriptions` table + cancel/reactivate actions.
- [ ] Implement `Invoices` table + export.
- [ ] Implement `Coupons` table + create/revoke.

### 5.2 BE/API
- [ ] `GET /subscriptions`
- [ ] `POST /subscriptions/{workspaceId}/cancel`
- [ ] `POST /subscriptions/{workspaceId}/reactivate`
- [ ] `GET /invoices`
- [ ] `GET/POST /coupons`
- [ ] `POST /coupons/{id}/revoke`

### 5.3 DB
- [ ] Billing subscription/invoice/coupon tables + indexes.
- [ ] Constraints tránh coupon invalid state.

### 5.4 Security/Audit
- [ ] Tất cả thao tác billing write ghi audit + actor role.
- [ ] Guard chống double-submit action tài chính.

### 5.5 QA
- [ ] Regression matrix lifecycle: active -> past_due -> canceled -> reactivated.
- [ ] Test export CSV consistency.

### Exit criteria
- [ ] Revenue & Billing đầy đủ chức năng required-first.

---

## 6) Phase 3 - Security/Compliance core

### 6.1 FE
- [ ] Implement `Audit Logs` table + drawer payload diff.
- [ ] Implement `Policy Center` forms + diff before save.
- [ ] Implement `Data Governance` tables.

### 6.2 BE/API
- [ ] `GET /audit-logs`
- [ ] Policy update endpoints (auth/session/access policies).
- [ ] Data governance endpoints (retention/request/legal hold).

### 6.3 DB
- [ ] Audit logs partition/index strategy theo `created_at`.

### 6.4 Security/Audit
- [ ] Signed audit export bundle.
- [ ] Policy change approval flow (optional in required-first: 1-level approval).

### 6.5 QA
- [ ] Verify non-repudiation path cho logs.
- [ ] Verify policy changes reflect runtime.

### Exit criteria
- [ ] Security/compliance menu đạt usable production baseline.

---

## 7) Phase 4 - System/Support core

### 7.1 FE
- [ ] Implement `Service Health` dashboard.
- [ ] Implement `Jobs & Queues` controls.
- [ ] Implement `Feature Flags` table.
- [ ] Implement `Support Console` + `Impersonation Center`.

### 7.2 BE/API
- [ ] `GET /system/health`
- [ ] Queue actions endpoints (retry/pause/resume).
- [ ] Feature flags CRUD/apply endpoints.
- [ ] Impersonation session start/stop endpoints.

### 7.3 DB
- [ ] Tables for incidents, feature flags, impersonation sessions.

### 7.4 Security/Audit
- [ ] Impersonation constraints: reason + TTL + banner + audit start/stop.

### 7.5 QA
- [ ] Abuse tests cho impersonation flow.
- [ ] Service degradation visual regression tests.

### Exit criteria
- [ ] Full required-first menu scope đã usable.

---

## 8) Phase 5 - Hardening + go-live

### 8.1 Performance
- [ ] Query p95 cho table trọng yếu < target.
- [ ] Server-side pagination cho dataset lớn.

### 8.2 Observability
- [ ] Tracing cho action nhạy cảm.
- [ ] Dashboard KPI mục 8 trong design doc.

### 8.3 Reliability
- [ ] Idempotency keys cho actions tài chính.
- [ ] Retry/timeout policy chuẩn.

### 8.4 QA/UAT
- [ ] Full UAT checklist theo role.
- [ ] Runbook incident và rollback.

### Exit criteria
- [ ] Ready for staged rollout (internal -> limited tenants -> full).

---

## 9) Backlog ưu tiên theo track

## 9.1 FE priority
1. Admin shell + shared table primitives.
2. Workspaces page + detail drawer.
3. Subscriptions/Invoices/Coupons.
4. Audit logs.
5. System/support pages.

## 9.2 BE priority
1. Workspaces + entitlement/suspend actions.
2. Subscription lifecycle endpoints.
3. Invoice/coupon endpoints.
4. Audit logs + policy endpoints.
5. Health/queue/flags/impersonation.

## 9.3 Security priority
1. RBAC guard at endpoint.
2. Reason-required + audit writes.
3. Impersonation hard constraints.

## 9.4 QA priority
1. Permission matrix.
2. Billing lifecycle regression.
3. Audit integrity.
4. E2E smoke toàn menu.

## 10) Definition of Done (global)
- [ ] Mọi menu required-first có route + data thật.
- [ ] Mọi write action có reason + audit log.
- [ ] RBAC backend chặn đúng, FE không chỉ “ẩn nút”.
- [ ] E2E smoke pass cho luồng chính từng menu.
- [ ] Không còn dependency vào mock/local-only state cho nghiệp vụ admin.
