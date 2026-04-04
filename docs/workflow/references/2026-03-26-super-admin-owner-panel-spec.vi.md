# BugLogin Admin IA v2 (Super Admin Panel vs Workspace Owner Panel)

Date: 2026-03-26
Owner: Product + Platform Engineering
Status: Implemented (Phase 2-5)

## 1) Mục tiêu
- Tách rõ 2 cấp quản trị để tránh lẫn quyền và lẫn context:
  - Super Admin Panel: quản trị toàn platform BugLogin.
  - Workspace Owner Panel: quản trị workspace đang mở.
- Loại bỏ UX/flow demo gây nhiễu.
- Chuẩn hóa quyền và API theo scope workspace.

## 2) Information Architecture
### 2.1 Super Admin Panel
- Overview: KPI toàn hệ thống, trạng thái control plane.
- Workspace: danh sách và sức khỏe workspace toàn cục.
- Billing: coupon/subscription/invoice cấp platform.
- Cookies (BugIdea): chỉ khi role hợp lệ + bearer key.
- Audit: nhật ký hành động toàn hệ thống.
- System: trạng thái auth/stripe/s3, guard vận hành.
- Analytics: snapshot vận hành.

### 2.2 Workspace Owner Panel
- Owner Overview: KPI workspace hiện tại.
- Current Workspace: member/invite/share trong workspace hiện tại.
- Owner Access: quyền nội bộ theo role (owner/admin/member/viewer) trong workspace hiện tại.

## 3) Access Matrix (runtime)
- `platform_admin`
  - Full Super Admin Panel.
  - Full Workspace Owner Panel trên mọi workspace.
- `owner`, `admin` (workspace hiện tại)
  - Workspace Owner Panel: allowed.
  - BugIdea workspace endpoints: allowed (owner/admin/platform_admin).
  - Super Admin Panel: denied.
- `member`, `viewer`
  - Workspace Owner Panel: denied.
  - Super Admin Panel: denied.

## 4) Navigation Rules
- Entry vào panel qua account/workspace menu (không để primary sidebar của workspace app).
- Khi đang ở panel mode:
  - Có action quay lại Workspace App.
  - Không tự động nhảy sang panel khác nếu không đổi context rõ ràng.
- Legacy section ids được map sang ids mới để giữ tương thích state cũ.

## 5) Data/Storage Rules
- Dữ liệu thao tác panel lấy từ Control Plane/Postgres.
- Không dùng JSON/local mock để giữ state nghiệp vụ panel.
- Local UI state chỉ dùng cho preference/view-state (lọc, page size, tab local).

## 6) Performance & UX Rules
- Tab/panel chỉ load data theo scope (không eager tất cả endpoint).
- Bề mặt card/table dùng token theme (`bg-background`, `bg-card`, `text-foreground`, `border-border`), không hardcode màu.
- Bảng ưu tiên pagination + filter trên dataset lớn.

## 7) Rollout Phases
### Phase 2
- Chuẩn hóa taxonomy section + mapping legacy section ids.
- Đổi navigation mode sang: `workspace`, `workspace-owner`, `super-admin`.

### Phase 3
- Tách quyền BugIdea theo workspace operator (owner/admin/platform_admin).
- Đồng bộ frontend guard + backend guard.

### Phase 4
- Dọn UI/UX overview và panel labels theo ngữ nghĩa mới.
- Loại bỏ role UI giả/không hỗ trợ runtime.

### Phase 5
- Hoàn thiện docs vận hành + matrix quyền + acceptance checklist.

## 8) Implementation Snapshot (2026-03-26)
- Phase 2:
  - Chuẩn hóa section ids với mapping legacy `workspace-admin-*`/`admin-*` sang `workspace-owner-*`/`super-admin-*`.
  - Panel mode runtime tách rõ `workspace` vs `workspace-owner` vs `super-admin`.
- Phase 3:
  - Guard BugIdea đồng bộ FE + BE cho `owner/admin/platform_admin`.
  - `member/viewer` bị chặn truy cập đúng bằng flow fallback + toast.
- Phase 4:
  - Dọn luồng Workspace Owner:
    - Giữ `Current Workspace` + `Owner Access` theo dữ liệu runtime thật.
    - Bỏ cụm role-preset/policy-toggle mock không có enforcement backend.
    - Chuẩn hóa hiển thị identity thành viên, tránh lộ placeholder `@local`.
  - Entry panel đưa về account menu actions trực tiếp để mở nhanh:
    - Open Super Admin Panel
    - Open Workspace Owner Panel
    - Back to Workspace
- Phase 5:
  - Persist section theo account (`buglogin.activeSection.v2.<userId>`) để F5/reload giữ đúng panel/tab theo alias mới.
  - Cập nhật checklist nghiệm thu và ghi nhận trạng thái hoàn tất.

## 9) Acceptance Checklist
- [x] `owner/admin` mở được Workspace Owner Panel của workspace hiện tại.
- [x] `owner/admin` dùng được BugIdea workspace flow khi có bearer key.
- [x] `member/viewer` bị chặn đúng thông báo quyền.
- [x] `platform_admin` mở được toàn bộ Super Admin Panel.
- [x] Reload/F5 không làm mất route panel hiện tại do legacy alias.
- [x] Không còn text role mock không có trong runtime policy.
