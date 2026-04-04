# Super Admin Panel Sitemap + Wireframe (Required-first)

Date: 2026-03-31  
Owner: Product + Platform Engineering  
Input spec: `docs/workflow/references/2026-03-31-super-admin-panel-required-design.vi.md`

## 1) Sitemap tổng thể

## 1.1 Sidebar level-1 (menu group)
1. Command Center
2. Workspace Operations
3. Revenue & Billing
4. Security & Compliance
5. Platform System
6. Support Tools

## 1.2 Sidebar level-2 (menu)
- Command Center
  - Overview
  - Incident Board
- Workspace Operations
  - Workspaces
  - Membership & Access
  - Abuse & Trust
- Revenue & Billing
  - Plans Catalog
  - Subscriptions
  - Invoices & Payments
  - Coupons & Promotions
- Security & Compliance
  - Audit Logs
  - Policy Center
  - Data Governance
- Platform System
  - Service Health
  - Jobs & Queues
  - Feature Flags
- Support Tools
  - Support Console
  - Impersonation Center

## 2) Shell layout chuẩn

## 2.1 Global frame
- Topbar:
  - Left: Breadcrumb + page title
  - Center: Global search (workspace/user/invoice/coupon)
  - Right: Environment badge, notifications, profile menu
- Left sidebar:
  - Collapsible
  - Group heading + item active state
  - Role-based visibility
- Main content:
  - Header row: title + summary chips + primary action
  - Body: KPI cards + data table + right detail drawer

## 2.2 Universal page regions
1. PageHeader
- `title`
- `description`
- `primary_action`
- `secondary_actions`

2. KPI strip (nếu có)
- 3-6 cards, click để apply filter table.

3. Filter toolbar
- Search
- Time range
- Status/risk/source filters
- Saved views
- Export

4. Data table
- Sticky header
- Pin column trái
- Row selection + bulk actions

5. Detail drawer (right panel)
- Entity info
- Timeline
- Quick actions

## 3) Wireframe theo menu (text)

## 3.1 Command Center > Overview
- Header:
  - Title: `Platform Overview`
  - Primary action: `Create Incident`
- Row 1 KPI cards:
  - Active Workspaces
  - Active Users (24h)
  - Paid Workspaces
  - Past Due Workspaces
- Row 2 health cards:
  - Runtime Success Rate
  - Sync Success Ratio
  - Security Alerts
  - Queue Backlog
- Row 3 widgets:
  - Risk workspaces table (top 10)
  - Latest incidents timeline

## 3.2 Command Center > Incident Board
- Header:
  - Primary action: `New Incident`
- Table:
  - Incident ID, Title, Severity, Status, Owner, StartedAt, ResolvedAt
- Detail drawer:
  - Affected services
  - Linked workspace(s)
  - Timeline notes
  - Actions: assign owner, update severity, resolve

## 3.3 Workspace Operations > Workspaces
- Header:
  - Primary action: `Export CSV`
  - Secondary: `Bulk Entitlement Update`
- KPI strip:
  - Total workspaces
  - Suspended
  - Entitlement read_only
  - High risk
- Table columns:
  - Workspace
  - Owner
  - Plan
  - Subscription status
  - Entitlement
  - Profiles used/limit
  - Storage used
  - Risk score
  - UpdatedAt
- Row actions:
  - Open detail
  - Suspend/Unsuspend
  - Set entitlement
  - Open invoices

## 3.4 Workspace Operations > Membership & Access
- Table columns:
  - Workspace
  - User email
  - Role
  - Membership status
  - Last active
- Actions:
  - Reassign owner
  - Revoke membership
  - Revoke invite/share grant

## 3.5 Workspace Operations > Abuse & Trust
- KPI:
  - Blocked today
  - New trust flags
  - Escalated throttles
- Table columns:
  - Entity type (workspace/user/ip/device)
  - Entity value
  - Risk level
  - Flag reason
  - CreatedBy
  - CreatedAt
- Actions:
  - Add/remove blocklist
  - Change trust level

## 3.6 Revenue & Billing > Plans Catalog
- Table columns:
  - Plan ID
  - Label
  - Price monthly
  - Price yearly
  - Profiles limit
  - Members limit
  - Storage limit
  - Support tier
  - Visibility
- Actions:
  - Create plan version
  - Edit metadata
  - Publish/Unpublish

## 3.7 Revenue & Billing > Subscriptions
- KPI:
  - Active
  - Past due
  - Canceled this month
  - MRR
- Table columns:
  - Workspace
  - Plan
  - Cycle
  - Status
  - Source
  - Period end
  - Cancel at period end
  - MRR
- Actions:
  - Cancel now
  - Cancel at period end
  - Reactivate
  - Force sync provider

## 3.8 Revenue & Billing > Invoices & Payments
- Table columns:
  - Invoice ID
  - Workspace
  - Amount
  - Discount
  - Net amount
  - Status
  - Method
  - Provider ref
  - IssuedAt
  - PaidAt
- Actions:
  - Open invoice detail
  - Mark paid (manual)
  - Export

## 3.9 Revenue & Billing > Coupons & Promotions
- Table columns:
  - Code
  - Type
  - Value
  - Max redemptions
  - Redeemed
  - ExpiresAt
  - RevokedAt
- Actions:
  - Create coupon
  - Revoke coupon
  - Open usage detail

## 3.10 Security & Compliance > Audit Logs
- Table columns:
  - Timestamp
  - Actor
  - Action
  - Resource type
  - Resource ID
  - Workspace
  - Risk tag
- Drawer:
  - payload_before / payload_after
  - request metadata (ip, ua)

## 3.11 Security & Compliance > Policy Center
- Sections:
  - Auth policy (password, MFA)
  - Session policy
  - Access policy (IP/geo)
- UX:
  - Diff view before save
  - Reason required
  - Effective-from time

## 3.12 Security & Compliance > Data Governance
- Tables:
  - Retention rules
  - Data subject requests
  - Legal hold records
- Actions:
  - Create/update retention
  - Mark request complete

## 3.13 Platform System > Service Health
- Grid services:
  - Auth, Billing, Sync, Queue, Notification
- Fields:
  - Status, latency p95, error rate, updated_at
- Actions:
  - Open dependency detail
  - Trigger diagnostics

## 3.14 Platform System > Jobs & Queues
- Table columns:
  - Queue
  - Pending
  - Processing
  - Failed
  - DLQ
  - Worker count
- Actions:
  - Retry failed
  - Clear DLQ item
  - Pause/resume queue

## 3.15 Platform System > Feature Flags
- Table columns:
  - Flag key
  - Description
  - Scope
  - Rollout
  - Status
  - UpdatedBy
- Actions:
  - Enable/disable
  - Set rollout %
  - Kill switch

## 3.16 Support Tools > Support Console
- Layout:
  - Left: search results workspace/user
  - Right: consolidated timeline
- Actions:
  - Open workspace detail
  - Open subscription/invoices
  - Copy support bundle

## 3.17 Support Tools > Impersonation Center
- Table columns:
  - Session ID
  - Target workspace/user
  - Mode
  - StartedAt
  - ExpiresAt
  - StartedBy
- Actions:
  - Start session (reason required)
  - Stop session
- Banner bắt buộc khi impersonating:
  - `You are in impersonation mode` + `End session`

## 4) UI component inventory bắt buộc
- `AdminShellLayout`
- `AdminSidebar`
- `PageHeader`
- `KpiCardGrid`
- `FilterToolbar`
- `DataTable`
- `BulkActionBar`
- `RightDetailDrawer`
- `ActionConfirmDialog` (reason required)
- `AuditTimeline`
- `ServiceHealthGrid`

## 5) UX rules bắt buộc
- Mọi destructive action phải qua `ActionConfirmDialog`.
- Mọi action write phải có `reason` + ghi audit.
- Không route jump để xem detail; dùng drawer để giữ context bảng.
- Trạng thái loading/error/empty phải có chuẩn hiển thị thống nhất.

## 6) Responsive behavior
- >= 1280px: full sidebar + table + drawer.
- 1024-1279px: sidebar compact, drawer overlay.
- < 1024px: read-focused mode, tắt bulk action phức tạp.

## 7) Done criteria cho wireframe
- [ ] Có đủ wireframe text cho 17 menu ở mục 3.
- [ ] Mỗi menu có header/actions/table columns rõ ràng.
- [ ] Có định nghĩa reusable component ở mục 4.
- [ ] Có rule UX bắt buộc để team FE bám triển khai.
