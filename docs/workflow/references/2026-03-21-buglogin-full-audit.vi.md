# BugLogin Audit Tổng Thể (UI/UX • Chức năng • Flow • Phân quyền • Billing)

- Ngày đánh giá: 2026-03-21
- Phạm vi: `app.login`, `management workspace`, `profile/group`, `plan/pricing/billing`, `admin platform/workspace`
- Mục tiêu: đánh giá công tâm mức sẵn sàng release, tìm điểm yếu hệ thống và đưa ra roadmap cải thiện theo ưu tiên thực thi.

---

## 1) Phương pháp đánh giá

### 1.1. Nguồn bằng chứng nội bộ (code-level)
- Luồng quyền và điều hướng chính: `src/app/page.tsx`, `src/components/app-sidebar.tsx`
- Luồng đăng nhập/đăng ký/quên mật khẩu: `src/components/auth-pricing-workspace.tsx`, `src/hooks/use-cloud-auth.ts`
- Luồng pricing/billing/coupon/plan activation: `src/components/workspace-pricing-page.tsx`, `src/components/workspace-billing-page.tsx`
- Luồng quản trị control-plane + admin tab: `src/components/platform-admin-workspace.tsx`, `src/hooks/use-control-plane.ts`
- Phân quyền hành động profile/team: `src/lib/team-permissions.ts`
- Cô lập dữ liệu theo workspace/account: `src/lib/workspace-data-scope.ts`
- Luồng group/profile filter mới: `src/components/group-badges.tsx`, `src/app/page.tsx`

### 1.2. Benchmark với “tiền bối” (public docs)
- GoLogin Help Center (workspace roles, seats)
- AdsPower Help Center (members, roles, invite lifecycle)
- Multilogin Pricing (seat model, team-management positioning)

---

## 2) Kết luận nhanh (Executive Summary)

### Điểm mạnh hiện tại
1. Nền tảng đã có khung chức năng rộng và khá đầy đủ cho release:
- Login (email/google), pricing, billing, coupon, workspace switcher, admin panel, profile/group/share.
2. Hạ tầng “fail-soft” tốt:
- Thiếu config auth/stripe/s3 vẫn chạy app, có banner cảnh báo rõ.
3. Có tư duy data-isolation theo account/workspace:
- Dùng data scope registry + context event để tách entity.
4. Sidebar/workspace switcher đã tiến gần SaaS pattern:
- Có trạng thái workspace, plan badge, current workspace marker.

### Điểm yếu cần xử lý trước release thật
1. RBAC còn lệch giữa UX kỳ vọng và enforcement runtime (đặc biệt admin access gate).
2. Auth UX chưa khớp logic backend (hiển thị password nhưng thực tế local auth chủ yếu email-based).
3. Billing local-mode còn cho phép “kích hoạt plan” không qua payment flow đầy đủ.
4. Một số copy/metric còn mang tính placeholder (dễ làm giảm trust B2B).
5. Quy ước role/team/workspace chưa nhất quán 100% ở tất cả entry points.

### Điểm số tổng quan (thang 10)
- UI/UX tổng thể: **7.8/10**
- Chức năng cốt lõi: **8.0/10**
- Flow nghiệp vụ end-to-end: **7.1/10**
- Phân quyền & an toàn thao tác: **6.6/10**
- Billing/paywall readiness: **6.9/10**
- Release readiness (nếu self-host local + staged): **7.3/10**
- Release readiness (production trả phí nghiêm ngặt): **5.9/10**

---

## 3) Bản đồ flow hiện tại

## 3.1. App mở lên
1. App load cloud auth + runtime config + data scope.
2. Nếu chưa login: render full-screen `AuthPricingWorkspace`.
3. Nếu đã login: render shell + sidebar + section hiện tại.

## 3.2. Workspace context
1. Sidebar cho switch workspace.
2. Lưu workspace cuối vào localStorage key theo user.
3. Mọi list profile/group/proxy/vpn được scope theo `accountId::workspaceId`.

## 3.3. Pricing/Billing
1. Pricing chọn plan + addon -> ghi `checkout intent`.
2. Billing đọc intent -> áp coupon -> confirm activate.
3. Nếu Stripe chưa ready, có branch local coupon + local subscription update.

## 3.4. Admin panel
1. Platform admin: đầy đủ tab (overview/workspace/billing/system/audit/analytics).
2. Team operator: bị giới hạn tab trong admin panel.
3. Workspace governance page riêng (non-platform vẫn có thể vào theo role phù hợp).

---

## 4) Phân tích chi tiết theo hạng mục

## 4.1. UI/UX khung điều hướng

### Điểm tốt
- Sidebar có 2 mode rõ (workspace panel vs admin panel), menu đổi theo role/panel mode.
- Workspace switcher dropdown đã có status + plan badge + current marker.
- Có persistence workspace selection sau reload.

### Điểm yếu
- Gate hiển thị “Admin Panel” đang nghiêng về `platform_admin` quá mạnh ở một số nhánh, làm trải nghiệm owner/admin team thiếu nhất quán so với kỳ vọng quản trị workspace.
- Một số key label admin trong sidebar dùng key chưa chuẩn hóa tuyệt đối (nguy cơ fallback key string nếu thiếu i18n map tương ứng).

### Evidence
- `canAccessAdminWorkspace` đang chặn theo platform role: `src/app/page.tsx:263`
- Nav phân nhánh role theo panel mode: `src/components/app-sidebar.tsx:140-157`
- Workspace selection persistence: `src/app/page.tsx:1112-1146`

## 4.2. Auth UX vs Auth Logic

### Điểm tốt
- Auth page full-screen, có switch ngôn ngữ/theme trực tiếp.
- Có invite token acceptance flow sau login.
- Có Google login branch và email flow.

### Điểm yếu
- Form login có field password và register có password, nhưng luồng `handleSignIn` gọi `loginWithEmail` (không dùng password để verify ở local flow) -> dễ gây mismatch kỳ vọng người dùng.
- Register/Forgot hiện chủ yếu request OTP rồi chuyển về login, chưa tạo cảm giác “hoàn tất transaction” rõ như SaaS production-grade.
- Google flow dùng implicit token URL pattern + localhost callback branch, cần harden thêm nếu production public lớn.

### Evidence
- Login handler không verify password: `src/components/auth-pricing-workspace.tsx:260-273`
- Password field đang hiển thị trong form: `src/components/auth-pricing-workspace.tsx:571-589`
- Register/Forgot chủ yếu request OTP rồi về login: `src/components/auth-pricing-workspace.tsx:313-360`
- Local email login fallback user seed: `src/hooks/use-cloud-auth.ts:330-386`

## 4.3. Profile/Group UX & logic

### Điểm tốt
- Đã chuyển logic filter theo yêu cầu “All”: badge `All` hiển thị tổng profile, bao gồm profile có group và không group.
- Khi group hiện tại bị xóa/không còn tồn tại, có fallback về `All` để tránh empty state sai.
- Data scope tách entity theo workspace giúp tránh nhiễu dữ liệu giữa workspace.

### Điểm yếu
- Vẫn còn “legacy compatibility branch” với `default` trong vài điều kiện để tương thích dữ liệu cũ; đúng kỹ thuật nhưng cần kế hoạch cleanup migration rõ để tránh tồn tại lâu.

### Evidence
- All badge + total count: `src/components/group-badges.tsx:170-199`
- Filter all/no-filter logic: `src/app/page.tsx:2195-2202`
- Data scope core: `src/lib/workspace-data-scope.ts:17-24`, `:150`, `:253`

## 4.4. Pricing/Billing/Paywall

### Điểm tốt
- Có checkout-intent tách khỏi UI lựa chọn plan, giúp flow pricing -> billing rõ ràng.
- Có coupon allowlist/denylist check theo workspace khi có control-plane.
- Có read-only gating + role gating tại billing page.

### Điểm yếu
- Local mode vẫn cho phép activation plan qua coupon hardcoded (`FREE100`, `LOCAL100`, `BUG100`) và `updateLocalSubscription`.
- Hero metric ở pricing dùng số placeholder (`10,000+`, `99.95%`, `<3m`) chưa có chứng minh data thật -> giảm trust nếu release production sớm.

### Evidence
- Local coupons hardcoded: `src/components/workspace-billing-page.tsx:327`
- Local confirm activation branch: `src/components/workspace-billing-page.tsx:417-431`
- Placeholder metrics: `src/components/workspace-pricing-page.tsx:250-262`

## 4.5. RBAC và enforcement

### Điểm tốt
- Matrix quyền owner/admin/member/viewer cho action-level operations đã có.
- Hầu hết action nhạy cảm (create/delete/assign/share/export) đi qua `requireTeamPermission`.

### Điểm yếu nghiêm trọng
- `canPerformTeamAction(role=null)` trả về `true`, nghĩa là khi role chưa resolve được thì logic coi như có quyền -> rủi ro mở quyền ngoài ý muốn.
- `canAccessAdminWorkspace` hiện chặn bằng platform role ở entry chính, tạo mismatch với nhánh workspace operator ở nơi khác.

### Evidence
- Role null => allow all: `src/lib/team-permissions.ts:72-80`
- App-level permission gateway dùng trực tiếp result này: `src/app/page.tsx:1036-1047`
- Admin access gate platform-only: `src/app/page.tsx:263`

## 4.6. Quản trị workspace/admin

### Điểm tốt
- Admin workspace tab đã có structure tốt hơn: directory + member/invite/share + snapshot entitlement/members/invites/shares.
- Platform admin tab matrix đã tách theo role.

### Điểm yếu
- Vẫn thiếu một lớp “policy engine UI” rõ ràng cho owner/team admin (giới hạn seat, policy chia sẻ, policy revoke, policy export) theo workspace.
- Thiếu “empty states có hướng dẫn hành động” sâu hơn ở vài module quản trị (đặc biệt khi local mode và control-plane chưa nối).

### Evidence
- Admin tab availability: `src/components/platform-admin-workspace.tsx:86-90`
- Workspace governance module local fallback: `src/hooks/use-control-plane.ts:372-390`

---

## 5) So sánh với tiền bối (công tâm)

## 5.1. Chuẩn tham chiếu rút ra

### GoLogin
- Nhấn mạnh seat/workspace access rõ theo plan; có pattern role-based access theo workspace (full access/read-only).

### AdsPower
- Role phân tầng rõ (Administrator/Manager/Employee) + kiểm soát profile-group permission.
- Invite lifecycle có trạng thái pending/expired (72h) minh bạch.

### Multilogin
- Pricing/packaging thể hiện trực tiếp trục scale: profile limit + team seats + advanced team management.

## 5.2. Bảng so sánh năng lực

| Năng lực | BugLogin (hiện tại) | GoLogin/AdsPower/Multilogin (tham chiếu) | Nhận định |
|---|---|---|---|
| Workspace switch + context | Có, khá tốt | Có | Tiệm cận chuẩn |
| Role matrix ở action-level | Có | Có | Tốt, nhưng cần fix null-role fallback |
| Invite lifecycle | Có pending/accept, có revoke | AdsPower có pending/expired rõ | Cần UI trạng thái deadline rõ hơn |
| Billing paywall strict | Chưa strict hoàn toàn ở local branch | Mạnh ở production flow | Cần harden trước public launch |
| Plan packaging clarity | Có nhưng còn placeholder metrics | Multilogin rõ trục profile/seat/team mgmt | Cần data thật + policy rõ |
| Admin governance depth | Có nền tảng | Các tiền bối có policy chi tiết hơn theo nhóm/quyền | Cần nâng policy UI/engine |

---

## 6) Danh sách vấn đề theo mức độ

## P0 (chặn release production trả phí)
1. Sửa default-permit khi `teamRole = null`:
- `canPerformTeamAction(null, ...)` phải deny-by-default.

2. Chuẩn hóa gateway admin access:
- Tách rõ `Platform Admin Panel` và `Workspace Admin Panel` bằng policy nhất quán ở app-level route gate.

3. Harden payment activation:
- Tắt nhánh local coupon hardcoded khi production flag bật.
- Plan activation phải dựa trên server-verified entitlement/subscription.

4. Làm rõ semantics auth:
- Nếu password chưa backend-verified, bỏ password field khỏi login/register hoặc dán nhãn “email link/OTP flow”.

## P1 (nâng chất lượng vận hành)
1. Policy center cho owner/admin workspace:
- Seat cap policy, share policy, export policy, invite TTL policy.

2. Invite UX nâng cấp:
- trạng thái + countdown + reason khi expired/denied.

3. Thống nhất i18n admin menu keys và copy consistency.

4. Loại bỏ metric placeholder bằng data thực hoặc đổi sang copy neutral (không claim).

## P2 (tối ưu trải nghiệm nâng cao)
1. Thêm checklist onboarding theo role sau login đầu tiên.
2. Telemetry UX cho hành vi lỗi/cancel trong pricing->billing->activation funnel.
3. Accessibility pass toàn bộ auth/admin (focus order, contrast, keyboard shortcuts).

---

## 7) Đề xuất kiến trúc quyền (mục tiêu)

## 7.1. Quy tắc vàng
- Deny by default khi không resolve được role.
- UI visibility theo role chỉ là lớp 1; server/API permission mới là lớp 2 bắt buộc.
- Mọi thao tác nhạy cảm (billing/role/share/export) cần audit trail + reason.

## 7.2. Role scope đề xuất
1. `platform_admin`:
- Toàn quyền cross-workspace, billing, audit, system config.

2. `workspace_owner`:
- Quản trị thành viên/workspace policy/billing workspace hiện tại.

3. `workspace_admin`:
- Quản trị vận hành profile/group/share, giới hạn billing theo policy owner.

4. `member`:
- Thao tác profile thường ngày, không nâng quyền/không billing.

5. `viewer`:
- Read-only.

---

## 8) KPI để xác nhận đã “ổn”

1. Security/RBAC
- 0 route nhạy cảm truy cập được khi role null.
- 100% action nhạy cảm có deny test.

2. Billing
- 100% plan activation có server verification event.
- 0 trường hợp local bypass khi production mode.

3. UX
- Time-to-first-successful-login < 90s (P50).
- Pricing->Billing->Activated conversion không drop bất thường do copy/flow mismatch.

4. Reliability
- Không có workspace switch reset bất ngờ sau reload trong 95% session.

---

## 9) Kết luận công tâm

BugLogin đã có nền khá mạnh để thành sản phẩm anti-detect SaaS nghiêm túc: kiến trúc workspace, quản trị, billing và data scope đều đã hình thành rõ.

Tuy nhiên, để release production trả phí “an toàn và chuyên nghiệp”, cần ưu tiên xử lý ngay 4 trục:
1. RBAC deny-by-default,
2. Admin gateway nhất quán,
3. Billing activation server-verified,
4. Auth semantics khớp UI.

Nếu xử lý xong P0/P1 theo roadmap trên, chất lượng tổng thể có thể nâng từ ~7.x lên mức **8.7+** đủ tự tin rollout rộng.

---

## 10) Nguồn benchmark tham khảo

- GoLogin Help Center - Team members / Workspace access / Seats:
  - https://support.gologin.com/en/articles/3452635-team-members
  - https://support.gologin.com/en/articles/7073191-workspace-settings
  - https://support.gologin.com/en/articles/7977417-invite-users-to-your-workspace
- AdsPower Help Center - Members / Groups / permissions:
  - https://help.adspower.com/docs/members
  - https://help.adspower.com/docs/groups
- Multilogin Pricing / team management positioning:
  - https://multilogin.com/pricing

