# BugLogin Web Portal Product Contract (v2)

Ngày cập nhật: 2026-03-30  
Phạm vi: Web portal `localhost:12341` (public website + auth + account/billing + admin web)

## 1) Mục tiêu sản phẩm web
- Web là cổng thương mại và vận hành nhẹ cho BugLogin, tập trung vào:
  - Chuyển đổi người dùng mới (landing + pricing).
  - Đăng ký/đăng nhập và hoàn tất thanh toán.
  - Quản lý subscription, invoice, payment method, workspace limit.
  - Super admin control plane (nếu có role).
- Web không thay desktop app cho tác vụ automation nặng; web chỉ đảm nhiệm billing + quản trị account/workspace + quan sát hệ thống.

## 2) Định vị và thông điệp chuẩn
- Positioning: `BugLogin là antidetect browser cho cá nhân, team và operator.`
- Value props phải nhất quán ở toàn bộ web:
  - Isolated browser profiles.
  - Workspace governance cho team.
  - Billing + cloud sync + admin control.

## 3) Information Architecture chuẩn

### 3.1 Public (chưa đăng nhập)
- `/` Landing
- `/pricing`
- `/help`
- `/signin`
- `/signup`
- `/legal/terms`
- `/legal/privacy`
- `/legal/refund`
- `/auth/oauth-google` và `/oauth-callback` (technical routes)

### 3.2 Portal (đã đăng nhập)
- `/account` Overview
- `/account/billing` Subscription + payment + usage
- `/account/invoices` Invoice list
- `/account/settings` Account/workspace settings

### 3.3 Super Admin (role: `platform_admin`)
- `/admin/command-center`
- `/admin/workspaces`
- `/admin/revenue`
- `/admin/audit`
- `/admin/system`

## 4) Chuẩn UI shell dùng chung
- Dùng 1 bộ shell chung cho desktop và web:
  - Sidebar trái full-height.
  - Top nav phải (language, theme, device/customize, notifications, avatar).
  - Chỉ khác biệt theo runtime (desktop có custom theme đầy đủ; web giữ subset nếu cần).
- Không tạo các biến thể top-nav riêng theo từng page nếu không có lý do nghiệp vụ.
- Không bọc control bằng nhiều lớp pill gây rối; dùng separator `|`/`Separator` theo style shadcn.
- Trạng thái loading không làm nhảy layout:
  - Không render placeholder khác kích thước thật.
  - Không thay đổi text server/client theo locale ngẫu nhiên.
  - Không hiện form auth giữa chừng khi đang OAuth redirect.

## 5) Header chuẩn sau đăng nhập
- Sidebar menu nền tảng (mọi user):
  - `Overview`
  - `Account`
  - `Billing`
- Nhóm admin chỉ hiện khi user có role `platform_admin`:
  - `Command Center`, `Workspaces`, `Revenue`, `Audit`, `System`
- User trigger ở đáy sidebar:
  - Dòng 1: tên/handle ngắn.
  - Dòng 2: quota ngắn gọn theo format `used/limit profiles`.
  - Ví dụ: `0/3 profiles` hoặc `120/1000 profiles`.
  - Không hiển thị số trần đơn lẻ kiểu `3`.

## 6) Pricing model đề xuất chuẩn hóa (v1)
Gói giá phục vụ đúng core offer antidetect + workspace runtime:

1. `Starter`
- Dành cho cá nhân mới bắt đầu.
- Monthly: `9 USD`
- Yearly: `90 USD` (tương đương 7.5 USD/tháng)
- Limits: `50 profiles`, `1 member`, `5 GB storage`, `2 GB proxy traffic`

2. `Team`
- Dành cho nhóm nhỏ cần cộng tác.
- Monthly: `29 USD`
- Yearly: `290 USD` (tương đương 24.17 USD/tháng)
- Limits: `300 profiles`, `5 members`, `30 GB storage`, `20 GB proxy traffic`

3. `Scale`
- Dành cho operator/team vận hành thường xuyên.
- Monthly: `79 USD`
- Yearly: `790 USD` (tương đương 65.83 USD/tháng)
- Limits: `1000 profiles`, `15 members`, `120 GB storage`, `100 GB proxy traffic`

4. `Enterprise`
- Dành cho tổ chức cần chính sách đặc thù.
- Price: `Custom`
- Limits: `custom` theo hợp đồng.
- CTA: `Contact sales`

Ghi chú dữ liệu:
- Các mức trên là product contract cho web. Khi chốt chính thức cần map 1-1 vào `BILLING_PLAN_DEFINITIONS` + Stripe `product/price IDs`.
- Không hiển thị giá/limit hardcode khác với source runtime.

## 7) Chuẩn UX Pricing/Billing cho user đã mua
1. Trên pricing card:
- Gói hiện tại: badge `Current plan`, CTA `Manage plan`.
- Gói cao hơn: CTA `Upgrade`/`Choose plan`.
- Gói thấp hơn: disable CTA + note `Downgrade xử lý thủ công qua Billing Support`.

2. Billing header bắt buộc có:
- `Plan`
- `Billing cycle`
- `Status`
- `Renewal date`
- `Workspace`

3. Usage panel bắt buộc:
- `Profiles used / limit`
- `Members used / limit`
- `Storage used / limit`
- `Proxy used / limit`
- Mỗi mục có progress bar và số thực tế.

4. Action panel chính:
- `Update payment method`
- `Download invoice`
- `Change cycle`
- `Upgrade`

5. Sau thanh toán thành công:
- Toast thành công.
- Card pricing/billing cập nhật ngay trong phiên.
- Không reload cứng và không nhảy UI.

## 8) Chuẩn content theo từng page

### 8.1 Landing `/`
- Hero:
  - H1: `The antidetect browser system for teams and operators`
  - Sub: `Purpose-built for profile isolation, workspace controls, and billing operations.`
- Primary CTA: `Download desktop app`
- Secondary CTA: `View pricing`
- 3 khối lợi ích ngắn:
  - Profile isolation
  - Team workspace controls
  - Cloud sync + billing operations
- Không dùng copy dài, không jargon kỹ thuật thừa.

### 8.2 Pricing `/pricing`
- Trọng tâm: so sánh nhanh theo limits + cycle.
- Có switch `Monthly / Yearly` dạng single-select clean.
- Card phải nằm gọn trong 1 viewport desktop phổ biến (không kéo quá dài mới thấy CTA).
- Không mô tả marketing giả tạo; ưu tiên số liệu mua hàng.

### 8.3 Signin/Signup
- Chỉ 2 phương thức:
  - Email/password
  - Google OAuth
- Không render form “kẹt” trong lúc redirect OAuth.
- Password field icon và label spacing phải cân đối (không lệch xuống, không dính sát).

### 8.4 Account Overview
- Tóm tắt workspace hiện tại:
  - Plan hiện dùng
  - Subscription status
  - Quota tóm tắt
  - CTA nhanh sang Billing

### 8.5 Billing `/account/billing`
- Màn hình vận hành subscription đầy đủ theo mục 7.
- Trạng thái loading dùng skeleton cùng kích thước bản thật.

### 8.6 Invoices `/account/invoices`
- Bảng cột tối thiểu:
  - Date
  - Invoice ID
  - Plan
  - Cycle
  - Amount
  - Status
  - Action (download/open)

### 8.7 Admin pages
- `command-center`: system snapshot và queue pressure.
- `workspaces`: bảng workspace + plan + health + owner.
- `revenue`: MRR/ARR cơ bản + invoice stream.
- `audit`: các sự kiện billing/admin có filter thời gian.
- `system`: dependency readiness (Auth, Billing, Sync, API).

## 9) Functional contract kỹ thuật
- Auth/session:
  - `/account/*` cần session.
  - `/admin/*` cần role `platform_admin`.
- Data source chuẩn:
  - Pricing: `BILLING_PLAN_DEFINITIONS`
  - Billing state: `getWorkspaceBillingState`
  - Workspace selector: `listWorkspaces`
- State chuẩn cho UI:
  - `pendingPlanId`
  - `isCurrentPlan`
  - `isDowngrade`
  - `isCheckoutReturning`
  - `isPlanSwitchSuccess`

## 10) i18n contract
- Mọi string mới phải có đủ `vi` + `en`.
- Không để lộ raw key dạng `portalSite.*`.
- Không đổi ngôn ngữ server/client trước khi hydrate xong để tránh mismatch.
- Thuật ngữ chuẩn xuyên suốt:
  - `Plan`, `Billing cycle`, `Status`, `Renewal date`, `Workspace`, `Profiles`, `Members`, `Storage`, `Proxy`.

## 11) Definition of Done
- Không còn UI tạm/sơ sài ở web portal.
- Header/top-nav/sidebar dùng chung cấu trúc với desktop shell.
- Pricing có đủ gói + limits + cycle + CTA logic đúng.
- Billing đạt đủ block thông tin, usage, action, downgrade handling.
- Không còn hydration mismatch do copy locale ở header/footer/auth.
- Không còn jump flash đáng kể ở login, OAuth callback, redirect sau mua.

## 12) Backlog triển khai đề xuất (ưu tiên)
1. Chuẩn hóa danh mục plan + map Stripe IDs theo model mục 6.
2. Chốt 1 component top-nav dùng chung desktop/web (chỉ khác custom-theme control).
3. Hoàn thiện billing state machine (purchase/update/downgrade/refresh không reload).
4. Chuẩn hóa user trigger badge về `used/limit profiles` ở mọi shell.
5. Xây bộ QA checklist cho 4 role: guest, member, workspace owner, platform admin.
