# Super Admin Menu Functional Spec

Date: 2026-04-02
Owner: Product + Platform + Billing + Security
Status: Fresh rewrite
Language: Vietnamese

## 1. Mục tiêu tài liệu

- Tài liệu này là bản đặc tả mới hoàn toàn cho Super Admin panel.
- Không kế thừa logic trình bày, flow, IA hay chất lượng của các bản trước.
- Dùng làm chuẩn để thiết kế lại menu, submenu, UI UX, data flow, API contract và thứ tự triển khai.
- Mỗi menu/submenu phải trả lời đủ 6 câu hỏi:
  - Trang này tồn tại để làm gì.
  - Ai dùng trang này.
  - Dữ liệu nào phải hiển thị.
  - Flow thao tác chuẩn là gì.
  - Sau khi CRUD, dữ liệu phải cập nhật như thế nào.
  - Các trạng thái loading, empty, error, permission, stale data phải xử lý ra sao.

## 2. Nguyên tắc bắt buộc

- Super Admin là control plane vận hành thật, không phải trang demo.
- Không được có menu click vào rồi ra placeholder hoặc redirect trá hình.
- Không hiển thị dữ liệu sai nghĩa chỉ để lấp UI.
- Không dùng raw ID dài làm thông tin chính trên bề mặt.
- Không lạm dụng card lớn, số to, table thô full-width nếu không có lý do nghiệp vụ.
- Mọi thao tác ghi phải có:
  - loading state
  - success state
  - error state
  - refresh hoặc invalidate đúng nguồn dữ liệu
  - audit log
- Mọi dữ liệu hệ thống phải có source of truth rõ ràng:
  - platform-level
  - workspace-level
  - user-level
  - billing-level
- Không build một page từ snapshot không cùng domain nếu page đó là page nghiệp vụ chính.

## 3. Shell Super Admin chuẩn

## 3.1 Sidebar

- Sidebar chia theo group nghiệp vụ, không chia theo tên kỹ thuật.
- Mỗi group chỉ chứa submenu có khả năng vận hành thật.
- Active state phải map đúng route và đúng nghĩa nghiệp vụ.
- Group đề xuất:
  - Command Center
  - Workspace & Identity
  - Revenue & Commerce
  - Governance & Security
  - Platform Operations
  - Support Tools

## 3.2 Topbar

- Trái:
  - breadcrumb
  - page title ngắn
  - environment badge
- Giữa:
  - global quick search
  - search được workspace, user, invoice, coupon, subscription
- Phải:
  - notifications
  - recent incidents
  - profile menu

## 3.3 Page layout chuẩn

- Page header:
  - title
  - description
  - summary chips
  - primary action
  - secondary actions
- Filter toolbar:
  - search
  - filters
  - sort
  - saved view
  - export nếu cần
- Main content:
  - list pane hoặc data table
  - detail drawer hoặc detail panel
- Mỗi page chỉ nên có 1 primary surface chính.
- Không bọc mọi thứ trong card lồng card lồng card.

## 3.4 Density và typography

- Baseline text là `text-sm`.
- Số metric không quá to nếu không phải KPI cấp 1.
- Row actions dùng `Button size="sm"` hoặc icon button nhỏ.
- Label, badge, chip, filters phải có density kiểu desktop app.
- Không render 8 dòng text khác size trong cùng một row.

## 4. Quy ước hiển thị dữ liệu

## 4.1 Hiển thị thân thiện

- Workspace:
  - hiển thị `workspace_name`
  - phụ: owner email, plan, risk, status
  - ID chỉ ở secondary metadata hoặc copy button
- User:
  - hiển thị `display_name` hoặc email
  - phụ: platform role, linked providers, last active
  - user ID không được là dòng chính
- Coupon:
  - hiển thị code, discount, validity, usage
  - không đẩy object raw lên table
- Invoice:
  - hiển thị invoice number thân thiện
  - phụ: workspace, amount, paid state, provider ref
- Subscription:
  - hiển thị workspace, plan, cycle, next renewal, provider state

## 4.2 Các trạng thái UI bắt buộc

- `loading`:
  - skeleton hàng hoặc panel
  - không chớp trắng
- `refreshing`:
  - subtle spinner ở toolbar
  - data cũ vẫn đọc được
- `empty`:
  - mô tả vì sao chưa có data
  - gợi ý action đầu tiên
- `error`:
  - banner hoặc inline error
  - có nút retry
- `permission_denied`:
  - thông báo rõ scope bị chặn
- `stale_data`:
  - badge `outdated`
  - có nút refresh

## 5. Data handling contract

## 5.1 Source of truth

- Mỗi page phải có endpoint list chính của domain đó.
- Không được build Users page bằng cách đi vòng qua Workspace Health.
- Không được build Audit page bằng invoice list.
- Không được build Revenue page từ snapshot của một workspace đang chọn.

## 5.2 Refresh rules

- Sau `create`:
  - prepend row mới hoặc refetch canonical list
  - row phải xuất hiện ngay nếu thỏa filter hiện tại
- Sau `update`:
  - patch row hiện tại hoặc refetch row detail
  - list và detail drawer phải đồng bộ
- Sau `delete/revoke/disable`:
  - cập nhật row state ngay
  - không đợi F5
- Sau bulk action:
  - optimistic update nếu an toàn
  - nếu không thì refetch canonical list
- Sau dialog submit:
  - đóng dialog chỉ khi backend trả thành công

## 5.3 Query model chuẩn

- List endpoint phải hỗ trợ:
  - pagination
  - search
  - filter
  - sort
  - date range
- Detail endpoint trả:
  - summary
  - timeline
  - related entities
  - allowed actions

## 5.4 Audit contract

- Mọi write action ghi:
  - actor
  - target
  - reason nếu là action nhạy cảm
  - before
  - after
  - timestamp

## 6. Menu map chuẩn

1. Command Center
2. Workspace & Identity
3. Revenue & Commerce
4. Governance & Security
5. Platform Operations
6. Support Tools

## 7. Group A. Command Center

## 7.1 Overview

### Mục tiêu

- Trang landing của Super Admin.
- Cho biết platform đang khỏe hay có vấn đề gì ngay trong 10 giây đầu.

### Người dùng

- Platform admin
- On-call operator
- Billing operator

### Header

- Title: `Platform Overview`
- Primary action: `Create Incident`
- Secondary:
  - refresh all
  - export daily summary

### KPI strip

- Active workspaces
- Paying workspaces
- Active users 24h
- Past due subscriptions
- Queue backlog
- Security alerts

### Widget bắt buộc

- High-risk workspaces
- Failed jobs in last hour
- Payment failures trend
- Latest critical audit actions
- Open incidents

### Data source

- `GET /admin/overview`
- Các widget không tự ý dùng endpoint workspace-level.

### Flow sử dụng

1. Vào overview.
2. Nhìn KPI và alert strip.
3. Click một KPI để jump sang page đích với filter đã áp.
4. Mở widget detail nếu cần điều tra sâu.

### Refresh

- Auto refresh nhẹ mỗi 60 giây cho metrics.
- Widget list refresh thủ công hoặc background stale-while-revalidate.

### UI notes

- Không dùng table full width cho toàn trang.
- Nên dùng dashboard blocks + compact lists.

## 7.2 Incident Board

### Mục tiêu

- Quản lý sự cố đang mở.

### Main list

- Incident code
- Title
- Severity
- Status
- Owner
- Affected services
- Started at
- Updated at

### Detail drawer

- Summary
- Timeline
- Linked workspaces
- Linked users
- Linked audit events
- Resolution checklist

### Actions

- Create incident
- Assign owner
- Change severity
- Add note
- Resolve
- Reopen

### Data source

- `GET /admin/incidents`
- `POST /admin/incidents`
- `PATCH /admin/incidents/:id`
- `GET /admin/incidents/:id`

### Flow

1. Chọn incident.
2. Xem timeline và phạm vi ảnh hưởng.
3. Update owner hoặc severity.
4. Resolve với resolution note.

## 8. Group B. Workspace & Identity

## 8.1 Workspaces

### Mục tiêu

- Trang master list của toàn bộ tenant.

### Main list columns

- Workspace
- Owner
- Plan
- Subscription status
- Entitlement state
- Profiles used / limit
- Storage used
- Risk score
- Updated at

### Filters

- Search by workspace name or owner email
- Plan
- Subscription status
- Entitlement
- Risk level
- Updated date range

### Detail drawer tabs

- Overview
- Billing
- Members
- Usage
- Security
- Audit

### Actions

- Suspend / unsuspend
- Set entitlement
- Override profile limit
- Open invoices
- Open subscriptions
- Open support console with workspace context

### Data source

- `GET /admin/workspaces`
- `GET /admin/workspaces/:id`
- `PATCH /admin/workspaces/:id/entitlement`
- `PATCH /admin/workspaces/:id/suspension`
- `PATCH /admin/workspaces/:id/profile-limit`

### Refresh rules

- Sau override hoặc suspend:
  - row cập nhật ngay
  - detail drawer sync ngay
  - audit timeline append event mới

### UI notes

- List pane + right drawer là layout mặc định.
- Không dùng modal lớn cho mọi thao tác.

## 8.2 Users

### Mục tiêu

- Quản lý identity platform-wide.

### Main list columns

- User
- Platform role
- Linked providers
- Workspace count
- Last active
- Status

### Detail drawer tabs

- Identity
- Memberships
- Auth methods
- Sessions
- Audit

### Actions

- Create user
- Reset password
- Link provider
- Unlink provider
- Promote or demote platform role
- Lock account
- Unlock account

### Data source

- `GET /admin/users`
- `POST /admin/users`
- `GET /admin/users/:id`
- `PATCH /admin/users/:id`
- `POST /admin/users/:id/link-provider`
- `POST /admin/users/:id/unlink-provider`

### Flow

1. Search user by email.
2. Open drawer.
3. Xem linked providers và memberships.
4. Chỉnh role hoặc auth method.
5. Row cập nhật ngay trong list hiện tại.

### Data handling notes

- Đây là canonical user list.
- User không thuộc workspace nào vẫn phải hiện.

## 8.3 Memberships & Access

### Mục tiêu

- Xử lý quan hệ user-workspace-role.

### Main list columns

- Workspace
- User
- Role
- Membership status
- Added by
- Added at
- Last active

### Actions

- Reassign owner
- Change role
- Revoke membership
- Revoke invite
- Revoke share grant

### Data source

- `GET /admin/memberships`
- `PATCH /admin/memberships/:id/role`
- `POST /admin/memberships/:id/reassign-owner`
- `POST /admin/memberships/:id/revoke`

### UI notes

- Page này không thay thế Users page.
- Đây là page relationship, không phải page identity.

## 8.4 Abuse & Trust

### Mục tiêu

- Điều tra và can thiệp lạm dụng.

### Main list columns

- Entity type
- Entity display value
- Risk level
- Rule triggered
- Status
- First seen
- Last seen

### Actions

- Block
- Unblock
- Trust override
- Escalate
- Add watch

### Data source

- `GET /admin/abuse-flags`
- `PATCH /admin/abuse-flags/:id`
- `POST /admin/blocklist`

### UI notes

- Cần event timeline và rule explanation trong drawer.

## 9. Group C. Revenue & Commerce

## 9.1 Plans Catalog

### Mục tiêu

- Quản lý sản phẩm giá công khai.

### Main list columns

- Plan code
- Public name
- Monthly price
- Yearly price
- Profiles limit
- Members limit
- Storage limit
- Support tier
- Visibility
- Version

### Detail drawer tabs

- Overview
- Pricing
- Limits
- Provider mappings
- Versions
- Audit

### Actions

- Create plan
- Edit metadata
- Create version
- Publish version
- Archive version

### Data source

- `GET /admin/commerce/plans`
- `POST /admin/commerce/plans`
- `PATCH /admin/commerce/plans/:id`
- `POST /admin/commerce/plans/:id/publish-version`

### UI notes

- Không redirect sang coupons.
- Đây là page độc lập và bắt buộc.

## 9.2 Campaigns

### Mục tiêu

- Quản lý chiến dịch khuyến mãi có thời gian.

### Main list columns

- Campaign name
- Discount model
- Priority
- Window
- Target plans
- Target workspaces
- Status

### Actions

- Create campaign
- Activate
- Pause
- Duplicate
- End early

### Data source

- `GET /admin/commerce/campaigns`
- `POST /admin/commerce/campaigns`
- `PATCH /admin/commerce/campaigns/:id`
- `POST /admin/commerce/campaigns/:id/activate`
- `POST /admin/commerce/campaigns/:id/deactivate`

## 9.3 Coupons

### Mục tiêu

- Quản lý coupon code.

### Main list columns

- Coupon code
- Discount
- Validity
- Redemptions
- Scope
- Status
- Created at

### Detail drawer tabs

- Overview
- Usage history
- Restrictions
- Audit

### Actions

- Create coupon
- Disable
- Extend expiry
- Change redemption cap

### Data source

- `GET /admin/coupons`
- `POST /admin/coupons`
- `PATCH /admin/coupons/:id`
- `POST /admin/coupons/:id/revoke`

### Data integrity rules

- Form fields như `max_per_user`, `max_per_workspace`, `allowlist`, `denylist` phải persist thật.
- Sau create, coupon mới phải hiện ngay nếu filter cho phép.

## 9.4 Subscriptions

### Mục tiêu

- Quản lý lifecycle subscription.

### Main list columns

- Workspace
- Plan
- Cycle
- Status
- Source
- Period end
- Cancel at period end
- MRR
- Last invoice status

### Actions

- Cancel now
- Cancel at period end
- Reactivate
- Force sync provider
- Manual entitlement override

### Data source

- `GET /admin/subscriptions`
- `POST /admin/subscriptions/:workspaceId/cancel`
- `POST /admin/subscriptions/:workspaceId/reactivate`
- `POST /admin/subscriptions/:workspaceId/sync`

## 9.5 Invoices & Payments

### Mục tiêu

- Đối soát thanh toán và lỗi charge.

### Main list columns

- Invoice number
- Workspace
- Subscription
- Amount
- Discount
- Net amount
- Method
- Provider ref
- Status
- Issued at
- Paid at

### Actions

- Open invoice detail
- Mark paid
- Issue credit
- Export CSV

### Data source

- `GET /admin/invoices`
- `GET /admin/invoices/:id`
- `POST /admin/invoices/:id/mark-paid`

## 9.6 License Keys

### Mục tiêu

- Quản lý key cấp quyền dạng license.

### Main list columns

- Key masked
- Plan
- Seats
- Bound workspace
- Bound user
- Expires at
- Status

### Actions

- Create
- Rotate
- Revoke
- Rebind nếu policy cho phép

### Data source

- `GET /admin/commerce/licenses`
- `POST /admin/commerce/licenses`
- `POST /admin/commerce/licenses/:id/rotate`
- `POST /admin/commerce/licenses/:id/revoke`

## 9.7 Price Preview

### Mục tiêu

- Tool kiểm tra giá cuối cùng trước khi checkout.

### Loại UI

- Không cần page độc lập nếu tần suất dùng thấp.
- Ưu tiên dialog tool từ Plans, Campaigns hoặc Coupons.

### Inputs

- Workspace
- Plan
- Cycle
- Campaign
- Coupon

### Output

- Line items
- Discount stack
- Final amount
- Explain applied rules

### Data source

- `POST /admin/commerce/price-preview`

## 10. Group D. Governance & Security

## 10.1 Audit Logs

### Mục tiêu

- Forensic và compliance.

### Main list columns

- Time
- Actor
- Action
- Resource type
- Resource display
- Workspace
- Reason
- Risk

### Detail drawer

- Before payload
- After payload
- Actor metadata
- IP
- User agent
- Related incident

### Actions

- Filter
- Export
- Copy event payload
- Link to resource

### Data source

- `GET /admin/audit-logs`
- Đây là source riêng, không dùng invoice list hoặc activity giả.

## 10.2 Policy Center

### Mục tiêu

- Cấu hình policy hệ thống.

### Sections

- Password policy
- Session policy
- OAuth policy
- IP/geo policy
- Workspace invite policy

### Flow

1. Chỉnh draft.
2. Xem diff.
3. Nhập reason.
4. Confirm save.
5. Ghi audit.

### Data source

- `GET /admin/policies`
- `PATCH /admin/policies/:scope`

## 10.3 Data Governance

### Mục tiêu

- Retention, legal hold, export/delete request.

### Main tables

- Retention rules
- Data requests
- Legal holds

### Actions

- Create retention policy
- Pause deletion
- Approve export
- Track delete request

### Data source

- `GET /admin/data-governance/*`
- `POST /admin/data-governance/*`

## 10.4 Feature Flags

### Mục tiêu

- Rollout an toàn theo tenant hoặc segment.

### Main list columns

- Flag key
- Description
- Scope
- Rollout
- Last changed by
- Updated at

### Actions

- Enable
- Disable
- Set percentage rollout
- Add workspace allowlist
- Kill switch

### Data source

- `GET /admin/feature-flags`
- `PATCH /admin/feature-flags/:key`

## 11. Group E. Platform Operations

## 11.1 Service Health

### Mục tiêu

- Kiểm tra readiness thực của dependency và runtime.

### Components

- Health summary strip
- Services list
- Dependency latency
- Error budget
- Recent degradation events

### Data source

- `GET /admin/system/health`
- Không dùng local state hoặc token presence để suy ra service healthy.

## 11.2 Jobs & Queues

### Mục tiêu

- Quan sát và vận hành background jobs.

### Main list columns

- Queue
- Job type
- Status
- Retry count
- Last error
- Workspace
- Started at
- Finished at

### Actions

- Retry
- Pause queue
- Resume queue
- Move to dead-letter
- Replay selected jobs

### Data source

- `GET /admin/jobs`
- `POST /admin/jobs/:id/retry`
- `POST /admin/queues/:name/pause`
- `POST /admin/queues/:name/resume`

## 11.3 Browser Update

### Mục tiêu

- Quản lý config update cho browser runtime.

### Main fields

- Release API URL
- Release API token
- Update mode
- Minimum supported version
- Update message

### Actions

- Load current config from server
- Save config to server
- Rotate token
- Preview env snippet

### Data source

- `GET /admin/browser-update-config`
- `PATCH /admin/browser-update-config`
- Không được chỉ lưu localStorage.

## 12. Group F. Support Tools

## 12.1 Support Console

### Mục tiêu

- Trang thao tác nhanh cho ticket support.

### Layout

- Search bar lớn vừa phải ở trên
- Kết quả chia tabs:
  - Users
  - Workspaces
  - Invoices
  - Coupons
  - Incidents
- Context panel bên phải

### Actions

- Open user snapshot
- Open workspace snapshot
- Reset auth session
- Trigger resync
- Open related audit trail

### Data source

- `GET /admin/support/search`
- `GET /admin/support/context`

## 12.2 Impersonation Center

### Mục tiêu

- Hỗ trợ điều tra có kiểm soát.

### Flow

1. Tìm user hoặc workspace.
2. Chọn scope impersonation.
3. Nhập reason bắt buộc.
4. Chọn TTL.
5. Confirm.
6. Toàn màn hình hiện banner cảnh báo khi đang impersonate.
7. Stop session hoặc auto-expire.

### Data source

- `POST /admin/impersonation/start`
- `POST /admin/impersonation/stop`
- `GET /admin/impersonation/sessions`

### Security rules

- Chỉ role được cấp phép mới thấy menu này.
- Mọi session phải audit start và stop.
- Không cho impersonate im lặng.

## 13. Quy tắc CRUD hiển thị lại dữ liệu

### Create

- Thành công:
  - toast success
  - row mới xuất hiện ngay
  - drawer có thể tự mở vào entity mới
- Thất bại:
  - dialog không đóng
  - giữ nguyên input
  - hiển thị error cụ thể

### Update

- Thành công:
  - patch row tại chỗ
  - detail đồng bộ
  - append audit preview nếu page có audit side panel

### Delete or revoke

- Thành công:
  - row biến mất hoặc đổi state
  - bộ đếm KPI cập nhật
  - filter và pagination giữ nguyên

### F5 contract

- Sau F5, page phải lấy đúng canonical source.
- Không phụ thuộc state tạm của client hoặc derived state sai domain.

## 14. Anti-pattern cấm tuyệt đối

- Menu có nhưng page là placeholder.
- Menu click vào redirect sang page khác để che thiếu chức năng.
- Audit dùng invoice data.
- Revenue dùng snapshot của một workspace.
- Users page không hiển thị user chưa có workspace.
- Form có field nhưng backend không persist field đó.
- Browser update config chỉ lưu localStorage.
- Table full-width với 4 cột ít dữ liệu nhưng không có detail drawer.
- Dùng raw UUID làm dòng chính.
- Dùng text to + card to để giả cảm giác dashboard.

## 15. Kế hoạch triển khai theo phase

## 15.1 Phase 1 - Foundation Shell + Data Contracts

### Mục tiêu

- Dựng lại shell Super Admin cho đúng mental model.
- Chốt API contract chuẩn cho list, detail, filters, pagination, sorting, audit.
- Xóa hoàn toàn placeholder và redirect trá hình khỏi sidebar production.

### Phạm vi

- Sidebar groups và submenu thật
- Topbar chuẩn
- Shared primitives:
  - page header
  - filter toolbar
  - data list
  - right detail drawer
  - bulk action bar
  - inline status banners
- Query contract chuẩn cho mọi page

### Data requirements

- Mọi page phải có:
  - list endpoint riêng
  - detail endpoint riêng
  - action endpoint riêng
- Chuẩn response:
  - `items`
  - `page`
  - `page_size`
  - `total`
  - `filters`
  - `sort`

### UX deliverables

- Density nhỏ theo desktop app
- Search và filter không kéo full-width vô nghĩa
- State `loading`, `refreshing`, `empty`, `error`, `permission` dùng chung

### Exit criteria

- Shell mới hoạt động với menu thật
- Không còn menu nào chỉ để lấp chỗ

## 15.2 Phase 2 - Workspace Operations Core

### Mục tiêu

- Làm `Workspaces` thành trang vận hành tenant thật sự usable.

### Phạm vi chức năng

- Workspace list quy mô lớn
- Workspace detail drawer
- Entitlement state
- Suspend / unsuspend
- Custom profile limit
- Custom member limit
- Custom expiry
- Custom owner transfer
- Billing snapshot
- Usage snapshot
- Audit timeline

### UX chuẩn

- List pane bên trái, detail drawer bên phải
- Saved views:
  - high risk
  - expiring soon
  - past due
  - read only
  - custom plan
- Row density nhỏ, scan nhanh
- Không dùng modal cho mọi thứ

### Data requirements

- `GET /admin/workspaces`
- `GET /admin/workspaces/:id`
- `PATCH /admin/workspaces/:id/owner`
- `PATCH /admin/workspaces/:id/limits`
- `PATCH /admin/workspaces/:id/expiry`
- `PATCH /admin/workspaces/:id/entitlement`
- `PATCH /admin/workspaces/:id/suspension`

### Special focus

- Custom plan không phải text label tạm.
- Phải lưu rõ:
  - plan mode: standard hoặc custom
  - profile limit
  - member limit
  - storage limit nếu có
  - proxy quota nếu có
  - expires at
  - reason
  - actor

### Exit criteria

- Workspace page dùng được cho daily ops
- Mọi thay đổi phản ánh lại list và drawer không cần F5

## 15.3 Phase 3 - User Identity + Roles

### Mục tiêu

- Làm `Users` thành trang identity platform-wide đúng nghĩa.

### Phạm vi chức năng

- User list lớn
- Create user
- Platform role management
- Lock / unlock
- Password reset
- Provider link / unlink
- Session overview
- User detail drawer
- Memberships tab
- Audit tab

### Role requirements

- Distinguish:
  - platform role
  - workspace role
  - auth provider state
  - account state

### Data requirements

- `GET /admin/users`
- `GET /admin/users/:id`
- `POST /admin/users`
- `PATCH /admin/users/:id/platform-role`
- `PATCH /admin/users/:id/account-state`
- `POST /admin/users/:id/reset-password`
- `POST /admin/users/:id/link-provider`
- `POST /admin/users/:id/unlink-provider`

### UX chuẩn

- User row không hiển thị raw UUID là nội dung chính
- Primary text là name hoặc email
- Secondary metadata:
  - linked providers
  - workspace count
  - last active
- Drawer chia tab rõ ràng

### Exit criteria

- User mới tạo hiện được ngay cả khi chưa thuộc workspace nào
- Role change và account state phản ánh ngay trên list

## 15.4 Phase 4 - Memberships, Access, Owner Transfer

### Mục tiêu

- Làm rõ toàn bộ layer quan hệ user-workspace-role.

### Phạm vi chức năng

- Membership list
- Invite list
- Share grants
- Reassign owner
- Bulk role change
- Revoke membership
- Revoke invite
- Revoke share access

### Data requirements

- `GET /admin/memberships`
- `GET /admin/invites`
- `GET /admin/share-grants`
- `PATCH /admin/memberships/:id/role`
- `POST /admin/workspaces/:id/reassign-owner`
- `POST /admin/memberships/:id/revoke`

### UX chuẩn

- Phải nhìn được access graph:
  - ai là owner
  - ai là admin
  - ai đang pending invite
  - ai có share grant

### Exit criteria

- Workspace owner transfer an toàn, audit đầy đủ
- Không còn nhập nhằng giữa Users page và Memberships page

## 15.5 Phase 5 - Revenue & Billing Core

### Mục tiêu

- Làm đúng 3 page sống còn:
  - Subscriptions
  - Invoices & Payments
  - Coupons

### Phạm vi chức năng

- Subscriptions list chuẩn
- Manual cancel/reactivate
- Force sync provider
- Invoice detail
- CSV export
- Coupon create/edit/revoke
- Restrictions và redemption analytics

### Data requirements

- `GET /admin/subscriptions`
- `GET /admin/invoices`
- `GET /admin/invoices/:id`
- `GET /admin/coupons`
- `POST /admin/coupons`
- `PATCH /admin/coupons/:id`
- `POST /admin/coupons/:id/revoke`

### Critical correctness

- Revenue page phải dùng platform-level aggregate thật
- Coupons phải persist đầy đủ:
  - discount
  - max redemption
  - max per user
  - max per workspace
  - allowlist
  - denylist
  - expires at

### Exit criteria

- Không còn CRUD “tạo được nhưng data không phản ánh”
- Billing pages có thể dùng cho operations và support

## 15.6 Phase 6 - Plans, Campaigns, License Keys, Price Engine

### Mục tiêu

- Hoàn thiện lớp commerce nâng cao.

### Phạm vi chức năng

- Plans catalog
- Versioned pricing
- Campaigns
- License keys
- Price preview tool

### UX chuẩn

- `Price Preview` ưu tiên là tool panel hoặc dialog, không bắt buộc là page riêng
- `Plans` và `Campaigns` cần detail drawer với timeline publish
- Không redirect giữa các submenu commerce

### Data requirements

- `GET/POST/PATCH /admin/commerce/plans`
- `GET/POST/PATCH /admin/commerce/campaigns`
- `GET/POST /admin/commerce/licenses`
- `POST /admin/commerce/price-preview`

### Exit criteria

- Commerce submenu nào hiện trong menu thì submenu đó phải thật

## 15.7 Phase 7 - Governance, Audit, Security

### Mục tiêu

- Làm đúng các trang compliance và forensic.

### Phạm vi chức năng

- Audit logs chuẩn
- Policy center
- Data governance
- Feature flags
- Abuse & trust

### Data requirements

- `GET /admin/audit-logs`
- `GET/PATCH /admin/policies`
- `GET/PATCH /admin/feature-flags`
- `GET/PATCH /admin/abuse-flags`
- `GET/PATCH /admin/data-governance/*`

### UX chuẩn

- Audit log có payload diff viewer
- Policy save có diff trước khi commit
- Feature flags hỗ trợ rollout theo tenant segment

### Exit criteria

- Security pages usable cho real incident và compliance review

## 15.8 Phase 8 - Platform Operations + Support Tools

### Mục tiêu

- Hoàn thiện phần vận hành hệ thống và hỗ trợ cao cấp.

### Phạm vi chức năng

- Service health
- Jobs & queues
- Browser update config server-backed
- Support console
- Impersonation center
- Incident board full flow

### Data requirements

- `GET /admin/system/health`
- `GET /admin/jobs`
- `POST /admin/jobs/:id/retry`
- `GET/PATCH /admin/browser-update-config`
- `GET /admin/support/search`
- `POST /admin/impersonation/start`
- `POST /admin/impersonation/stop`

### Exit criteria

- Super Admin panel đạt production-operable baseline

## 16. Large-scale design cho Users và Workspaces

## 16.1 Dataset cực lớn

- Phải thiết kế cho:
  - 100k+ users
  - 50k+ workspaces
  - 1M+ memberships
- Không fetch toàn bộ rồi filter ở client.
- Bắt buộc server-side:
  - pagination
  - sorting
  - search
  - faceted filters

## 16.2 List behavior

- Default page size: 25 hoặc 50
- Infinite scroll chỉ dùng nếu thật sự phù hợp
- Ưu tiên paginated table với sticky header
- Bulk select chỉ áp dụng cho page hiện tại hoặc saved selection model rõ ràng

## 16.3 Search behavior

- Search users:
  - email
  - display name
  - external auth id
- Search workspaces:
  - workspace name
  - owner email
  - plan code
  - invoice ref nếu cần

## 16.4 Workspace custom plan UX

- Không nhét hết vào 1 modal lộn xộn.
- Dùng detail drawer với section:
  - current plan
  - custom limits
  - effective period
  - owner
  - billing notes
  - audit history
- Mỗi thay đổi có reason field riêng nếu là action nhạy cảm.

## 16.5 Owner transfer UX

- Flow 2 bước:
  1. Search user mới
  2. Confirm transfer + reason
- Sau transfer:
  - memberships update đúng
  - workspace summary update
  - audit append
  - support console thấy state mới ngay

## 16.6 Role management UX

- Platform role change phải khác workspace role change.
- Không dùng cùng một select cho hai domain quyền.
- Phải nhìn rõ:
  - platform_admin
  - workspace owner
  - workspace admin
  - member
  - viewer

## 17. Definition of Done

- Mọi menu hiển thị trong sidebar đều có data thật.
- Mọi write action đều phản ánh lại UI không cần F5.
- Mọi page đều có canonical endpoint đúng domain.
- Không page nào dùng placeholder hoặc redirect để giả completeness.
- UI density và typography nhất quán theo style desktop small.
- Mọi action nhạy cảm có audit.
