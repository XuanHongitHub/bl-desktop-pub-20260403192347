(() => {
  "use strict";

  const STORAGE_KEY = "buglogin.ia.super-admin.v3";

  const TREE = [
    {
      id: "sa-01",
      label: "01. Command Center",
      summary: "Realtime platform posture và điều phối vận hành toàn hệ thống.",
      pages: [
        {
          id: "sa-01-ov-001",
          code: "SA-OV-001",
          title: "Global Operations Overview",
          priority: "p0",
          owner: "Platform Ops",
          summary: "Trang tổng quan đầu tiên khi Super Admin vào panel.",
          capabilities: [
            "Hiển thị workspace active/new/churn trong 24h, 7d, 30d.",
            "Hiển thị trạng thái dịch vụ lõi: auth, sync, billing, storage, proxy.",
            "Bản đồ health theo khu vực/cluster để nhìn bottleneck nhanh.",
            "Nút jump nhanh tới Incident, Workspace Directory, Audit Explorer.",
          ],
          content: [
            "Header metrics strip (MAU, active workspace, active subscription).",
            "Service grid (Ready/Degraded/Down) + trend 24h.",
            "Top risky workspaces (error spike, payment fail, abuse flag).",
            "Announcements/release notes rút gọn cho operator.",
          ],
          dataContracts: [
            "Platform KPI snapshot: <code>kpi_active_workspace</code>, <code>kpi_active_subscription</code>.",
            "Service health stream: <code>service_status</code> + <code>latency_p95</code>.",
            "Workspace risk score feed: <code>workspace_risk_score</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/overview</code>",
            "GET <code>/v1/control/admin/health/services</code>",
            "GET <code>/v1/control/admin/workspaces/risk</code>",
          ],
          actions: [
            "Không cho phép mutate dữ liệu ở trang này, chỉ điều hướng.",
            "Auto-refresh theo interval 30s nhưng phải có toggle pause.",
            "Khi API fail phải hiện degraded state + retry CTA.",
          ],
          kpis: [
            "TTD (time to detect) incident giảm dưới 2 phút.",
            "0 blank dashboard khi 1 service fail.",
            "Operator có thể jump đúng page trong <= 2 click.",
          ],
          checklist: [
            "Build skeleton cards + loading state.",
            "Gắn API overview + health + risk.",
            "Thêm polling + pause polling.",
            "Thêm link jump actions.",
          ],
          delivery: {
            p0: ["KPI strip", "Service grid", "Risk workspace list"],
            p1: ["Geo/cluster mini-map", "Release notice strip"],
            p2: ["Customizable widget layout"],
          },
        },
        {
          id: "sa-01-ov-002",
          code: "SA-OV-002",
          title: "Incident & Alert Center",
          priority: "p0",
          owner: "Platform Ops",
          summary: "Quản lý lifecycle sự cố theo severity và SLA response.",
          capabilities: [
            "Tổng hợp alert từ sync, billing, auth, storage.",
            "Acknowledge, assign owner, escalate ngay trong panel.",
            "Theo dõi SLA timer theo severity (P1/P2/P3).",
            "Link trực tiếp sang runbook và audit trail liên quan.",
          ],
          content: [
            "Incident queue table theo trạng thái open/ack/resolved.",
            "Severity filter + service filter + workspace filter.",
            "Timeline panel cho mỗi incident.",
            "RCA input + postmortem checklist.",
          ],
          dataContracts: [
            "Incident entity: <code>incident_id</code>, <code>severity</code>, <code>owner</code>, <code>status</code>.",
            "Alert source metadata: <code>alert_source</code>, <code>signal_payload</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/incidents</code>",
            "POST <code>/v1/control/admin/incidents/:id/ack</code>",
            "POST <code>/v1/control/admin/incidents/:id/resolve</code>",
          ],
          actions: [
            "Mọi thao tác ack/resolve bắt buộc ghi audit.",
            "Resolve yêu cầu bắt buộc nhập resolution note.",
            "Escalate yêu cầu xác nhận tránh thao tác nhầm.",
          ],
          kpis: [
            "MTTA < 5 phút cho P1.",
            "Tỉ lệ incident có owner >= 99%.",
            "Tỉ lệ incident thiếu RCA < 5%.",
          ],
          checklist: [
            "Chuẩn hóa incident schema + enum status.",
            "Build incident table + timeline drawer.",
            "Thêm actions ack/resolve/escalate.",
            "Gắn audit trail cho tất cả mutate actions.",
          ],
          delivery: {
            p0: ["Incident queue", "Ack/Resolve", "SLA timer"],
            p1: ["RCA form", "Runbook link map"],
            p2: ["Auto root-cause suggestions"],
          },
        },
        {
          id: "sa-01-ov-003",
          code: "SA-OV-003",
          title: "Release & Feature Flag Radar",
          priority: "p1",
          owner: "Platform PM",
          summary: "Theo dõi rollout build và feature flag theo workspace segment.",
          capabilities: [
            "Hiển thị release train: dev/staging/prod.",
            "Bật/tắt flag theo segment hoặc workspace cụ thể.",
            "Xem tỷ lệ adoption và rollback history.",
          ],
          content: [
            "Release cards với version, commit, deployedAt.",
            "Feature flag table với rollout %, target segment.",
            "Rollback log và lý do rollback.",
          ],
          dataContracts: [
            "Release entity: <code>version</code>, <code>channel</code>, <code>deployed_at</code>.",
            "Flag entity: <code>flag_key</code>, <code>rollout_percent</code>, <code>target_segment</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/releases</code>",
            "GET <code>/v1/control/admin/feature-flags</code>",
            "PATCH <code>/v1/control/admin/feature-flags/:key</code>",
          ],
          actions: [
            "Flag changes phải yêu cầu reason và expire time.",
            "Không cho cập nhật flag khi đang incident P1 chưa resolve.",
          ],
          kpis: [
            "Rollback rate per release.",
            "Time-to-disable risky flag.",
          ],
          checklist: [
            "Chuẩn hóa segment model.",
            "Build release + flag bảng compact.",
            "Gắn mutate guardrails + audit.",
          ],
          delivery: {
            p0: ["Read-only release feed"],
            p1: ["Flag mutate + rollback logs"],
            p2: ["Canary auto-recommendation"],
          },
        },
      ],
    },
    {
      id: "sa-02",
      label: "02. Workspace Governance",
      summary: "Quản trị workspace lifecycle, entitlement và risk policy.",
      pages: [
        {
          id: "sa-02-ws-001",
          code: "SA-WS-001",
          title: "Workspace Directory & Lifecycle",
          priority: "p0",
          owner: "Platform Ops",
          summary: "Danh mục toàn bộ workspace với trạng thái và lifecycle action.",
          capabilities: [
            "Search/filter workspace theo owner, plan, status, risk level.",
            "Create, pause, reactivate, archive workspace.",
            "View workspace quick profile: members, usage, invoice state.",
          ],
          content: [
            "Dense table + server-side pagination.",
            "Row action menu (pause/reactivate/archive/view details).",
            "Bulk actions cho nhiều workspace.",
          ],
          dataContracts: [
            "Workspace model: <code>workspace_id</code>, <code>plan_label</code>, <code>subscription_status</code>.",
            "Owner model: <code>owner_user_id</code>, <code>owner_email</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces</code>",
            "POST <code>/v1/control/workspaces</code>",
            "PATCH <code>/v1/control/workspaces/:id/status</code>",
          ],
          actions: [
            "Pause/Archive cần modal xác nhận + nhập lý do.",
            "Bulk action có dry-run preview trước khi apply.",
          ],
          kpis: [
            "Time xử lý lifecycle action < 30s.",
            "0 action không có audit log.",
          ],
          checklist: [
            "Chuẩn hóa filter model + query params.",
            "Build table + bulk action bar.",
            "Thêm status change modal + reason.",
          ],
          delivery: {
            p0: ["Workspace table", "Lifecycle actions", "Audit logging"],
            p1: ["Bulk actions", "Advanced filters"],
            p2: ["Saved views per admin"],
          },
        },
        {
          id: "sa-02-ws-002",
          code: "SA-WS-002",
          title: "Entitlement Override & Plan Governance",
          priority: "p0",
          owner: "Revenue Ops",
          summary: "Override entitlement và plan theo policy rõ ràng.",
          capabilities: [
            "Set plan/cycle/expiry thủ công cho workspace.",
            "Kích hoạt internal billing cho self-host hoặc custom deal.",
            "Track history của mọi override/revert.",
          ],
          content: [
            "Entitlement editor panel với diff before/after.",
            "Policy warning nếu vượt chuẩn plan catalog.",
            "Override history timeline.",
          ],
          dataContracts: [
            "Entitlement model: <code>plan_label</code>, <code>profile_limit</code>, <code>expires_at</code>.",
            "Billing source model: <code>subscription_source</code>, <code>billing_cycle</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:id/entitlement</code>",
            "PATCH <code>/v1/control/workspaces/:id/entitlement</code>",
            "POST <code>/v1/control/workspaces/:id/billing/internal-activate</code>",
          ],
          actions: [
            "Override cần 2-step confirmation cho plan Custom.",
            "Mọi change bắt buộc reason + operator identity.",
          ],
          kpis: [
            "Giảm support tickets do mismatch entitlement.",
            "100% override có reason + actor.",
          ],
          checklist: [
            "Build entitlement diff UI.",
            "Thêm override mutation + validation.",
            "Show mutation history timeline.",
          ],
          delivery: {
            p0: ["Entitlement editor", "Internal activate action"],
            p1: ["Override history timeline", "Policy warning"],
            p2: ["Approval workflow for high-impact overrides"],
          },
        },
        {
          id: "sa-02-ws-003",
          code: "SA-WS-003",
          title: "Workspace Risk Radar",
          priority: "p1",
          owner: "Trust & Safety",
          summary: "Đánh dấu workspace bất thường để can thiệp sớm.",
          capabilities: [
            "Score risk theo auth anomaly, billing fraud, abuse reports.",
            "Manual flag/unflag workspace.",
            "Queue review cho workspace risk cao.",
          ],
          content: [
            "Risk matrix + trend chart.",
            "Flag history table.",
            "Review queue board.",
          ],
          dataContracts: [
            "Risk model: <code>risk_score</code>, <code>risk_reason_codes</code>.",
            "Review task: <code>review_status</code>, <code>assignee</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/workspaces/risk</code>",
            "POST <code>/v1/control/admin/workspaces/:id/flag</code>",
            "POST <code>/v1/control/admin/workspaces/:id/unflag</code>",
          ],
          actions: [
            "Flag action cần reason code.",
            "Unflag yêu cầu reviewer role hoặc super admin.",
          ],
          kpis: [
            "Giảm false positive trong flagging.",
            "Tăng tốc xử lý review queue.",
          ],
          checklist: [
            "Xây score card + risk table.",
            "Kết nối flag/unflag mutation.",
            "Gắn review workflow state.",
          ],
          delivery: {
            p0: ["Risk score list"],
            p1: ["Flag/unflag + review queue"],
            p2: ["ML explainability panel"],
          },
        },
      ],
    },
    {
      id: "sa-03",
      label: "03. Revenue Operations",
      summary: "Điều hành pricing, subscription, invoice, coupon ở mức platform.",
      pages: [
        {
          id: "sa-03-rev-001",
          code: "SA-REV-001",
          title: "Subscription Control Tower",
          priority: "p0",
          owner: "Revenue Ops",
          summary: "Theo dõi toàn bộ subscription state trên nhiều plan.",
          capabilities: [
            "Filter subscriptions theo status/source/cycle.",
            "Xử lý cancel/reactivate từ panel.",
            "Track churn risk theo payment failure sequence.",
          ],
          content: [
            "Subscription table theo workspace.",
            "Batch re-activate action với guardrails.",
            "Churn funnel mini chart.",
          ],
          dataContracts: [
            "Subscription model: <code>subscription_status</code>, <code>billing_cycle</code>.",
            "Retry state model: <code>payment_retry_count</code>, <code>next_retry_at</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/subscriptions</code>",
            "POST <code>/v1/control/workspaces/:id/billing/subscription/cancel</code>",
            "POST <code>/v1/control/workspaces/:id/billing/subscription/reactivate</code>",
          ],
          actions: [
            "Cancel/reactivate bắt buộc confirmation.",
            "Batch actions yêu cầu summary preview trước khi apply.",
          ],
          kpis: [
            "Churn recovery rate.",
            "Failed payment to recovered conversion.",
          ],
          checklist: [
            "Build subscription table.",
            "Hook cancel/reactivate actions.",
            "Thêm churn indicators.",
          ],
          delivery: {
            p0: ["Subscription table", "Cancel/reactivate"],
            p1: ["Batch reactivation", "Churn indicators"],
            p2: ["Automated dunning playbooks"],
          },
        },
        {
          id: "sa-03-rev-002",
          code: "SA-REV-002",
          title: "Invoice / Refund / Coupon Operations",
          priority: "p1",
          owner: "Finance Ops",
          summary: "Điều hành nghiệp vụ tài chính và khuyến mãi.",
          capabilities: [
            "Tạo/revoke coupon theo campaign.",
            "List invoice + trạng thái thanh toán.",
            "Quản lý refund request với audit.",
          ],
          content: [
            "Coupon ledger.",
            "Invoice ledger.",
            "Refund queue.",
          ],
          dataContracts: [
            "Coupon model: <code>coupon_code</code>, <code>discount_percent</code>, <code>max_redemptions</code>.",
            "Invoice model: <code>invoice_id</code>, <code>amount</code>, <code>paid_at</code>.",
          ],
          apiContracts: [
            "POST <code>/v1/control/admin/coupons</code>",
            "POST <code>/v1/control/admin/coupons/:couponId/revoke</code>",
            "GET <code>/v1/control/admin/invoices</code>",
          ],
          actions: [
            "Coupon code phải unique toàn platform.",
            "Refund action yêu cầu reason + approver.",
          ],
          kpis: [
            "Coupon abuse rate.",
            "Refund processing time.",
          ],
          checklist: [
            "Build coupon/invoice/refund tabs.",
            "Thêm create/revoke coupon flow.",
            "Thêm refund queue actions.",
          ],
          delivery: {
            p0: ["Coupon ledger"],
            p1: ["Invoice + refund operations"],
            p2: ["Revenue anomaly detection"],
          },
        },
      ],
    },
    {
      id: "sa-04",
      label: "04. Identity & Access",
      summary: "Quản trị tài khoản quản trị và chính sách bảo mật platform.",
      pages: [
        {
          id: "sa-04-iam-001",
          code: "SA-IAM-001",
          title: "Super Admin Accounts & RBAC",
          priority: "p0",
          owner: "Security",
          summary: "Kiểm soát ai có quyền gì trong platform control plane.",
          capabilities: [
            "List super admin/operator accounts.",
            "Gán role và scope chính xác theo nhiệm vụ.",
            "Suspend/reinstate account nhanh.",
          ],
          content: [
            "Admin account table.",
            "Role matrix (permissions by capability).",
            "Recent sensitive actions by admin.",
          ],
          dataContracts: [
            "Admin model: <code>admin_id</code>, <code>role</code>, <code>status</code>.",
            "Permission model: <code>permission_key</code>, <code>scope</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/accounts</code>",
            "PATCH <code>/v1/control/admin/accounts/:id/role</code>",
            "PATCH <code>/v1/control/admin/accounts/:id/status</code>",
          ],
          actions: [
            "Role escalation cần dual confirmation.",
            "Không cho self-demote owner account cuối cùng.",
          ],
          kpis: [
            "0 orphaned super-admin account.",
            "Permission drift rate.",
          ],
          checklist: [
            "Build accounts table + role editor.",
            "Thêm suspend/reinstate.",
            "Add sensitive-action feed.",
          ],
          delivery: {
            p0: ["Account list", "Role/status mutate"],
            p1: ["Role matrix visualization"],
            p2: ["Just-in-time privilege elevation"],
          },
        },
        {
          id: "sa-04-iam-002",
          code: "SA-IAM-002",
          title: "Security Policy Center",
          priority: "p1",
          owner: "Security",
          summary: "Policy bảo mật áp dụng ở mức toàn platform.",
          capabilities: [
            "Quản lý password/MFA/session policy.",
            "Định nghĩa alert threshold cho hành vi bất thường.",
            "Audit thay đổi policy.",
          ],
          content: [
            "Policy sections theo domain (auth/session/network).",
            "Policy diff trước/sau khi update.",
            "Change history.",
          ],
          dataContracts: [
            "Policy doc: <code>policy_key</code>, <code>version</code>, <code>effective_at</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/security/policies</code>",
            "PATCH <code>/v1/control/admin/security/policies/:key</code>",
          ],
          actions: [
            "Mỗi thay đổi policy yêu cầu note + reason.",
            "Policy rollout có dry-run preview.",
          ],
          kpis: [
            "Policy compliance pass rate.",
            "Security incident reduction.",
          ],
          checklist: [
            "Build policy forms.",
            "Add policy diff + history.",
            "Hook mutation guardrails.",
          ],
          delivery: {
            p0: ["Read policies"],
            p1: ["Edit + history"],
            p2: ["Policy simulation engine"],
          },
        },
      ],
    },
    {
      id: "sa-05",
      label: "05. Reliability & Infrastructure",
      summary: "Theo dõi sync pipeline, storage cost và job queues.",
      pages: [
        {
          id: "sa-05-rel-001",
          code: "SA-REL-001",
          title: "Sync Pipeline Monitor",
          priority: "p0",
          owner: "Platform Ops",
          summary: "Quan sát realtime throughput, failures, backlog của sync service.",
          capabilities: [
            "Monitor sync job throughput và failure classes.",
            "Drill-down theo workspace hoặc job type.",
            "Retry/requeue jobs có kiểm soát.",
          ],
          content: [
            "Queue depth chart.",
            "Top failing jobs table.",
            "Retry actions + reason.",
          ],
          dataContracts: [
            "Job model: <code>job_id</code>, <code>queue</code>, <code>status</code>, <code>error_code</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/sync/jobs</code>",
            "POST <code>/v1/control/admin/sync/jobs/:id/retry</code>",
          ],
          actions: [
            "Retry action rate-limited theo workspace.",
            "Batch retry cần preview số lượng job impacted.",
          ],
          kpis: [
            "Queue latency p95.",
            "Retry success rate.",
          ],
          checklist: [
            "Build queue charts + tables.",
            "Add retry action with guardrails.",
            "Expose error code distribution.",
          ],
          delivery: {
            p0: ["Queue monitor", "Retry single job"],
            p1: ["Batch retry + filters"],
            p2: ["Auto-healing policy rules"],
          },
        },
        {
          id: "sa-05-rel-002",
          code: "SA-REL-002",
          title: "S3 Budget & Capacity Board",
          priority: "p1",
          owner: "Infra + Finance",
          summary: "Theo dõi storage usage/cost ở mức platform và theo workspace segment.",
          capabilities: [
            "Usage chart theo bucket/prefix/workspace.",
            "Cost trend theo ngày/tháng.",
            "Alert khi vượt budget threshold.",
          ],
          content: [
            "S3 usage + cost cards.",
            "Top storage consumers table.",
            "Budget threshold editor.",
          ],
          dataContracts: [
            "Storage metric: <code>bytes_used</code>, <code>object_count</code>.",
            "Cost metric: <code>daily_cost</code>, <code>monthly_forecast</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/storage/usage</code>",
            "GET <code>/v1/control/admin/storage/cost</code>",
            "PATCH <code>/v1/control/admin/storage/budget-threshold</code>",
          ],
          actions: [
            "Threshold update cần reason và effective date.",
            "Không xóa dữ liệu từ trang này, chỉ monitor/policy.",
          ],
          kpis: [
            "Sai số forecast cost.",
            "Số lần over-budget không cảnh báo trước.",
          ],
          checklist: [
            "Build usage/cost charts.",
            "Build top consumers table.",
            "Add budget threshold editor.",
          ],
          delivery: {
            p0: ["Usage + cost visibility"],
            p1: ["Threshold policies + alerts"],
            p2: ["Cost anomaly root-cause assistant"],
          },
        },
      ],
    },
    {
      id: "sa-06",
      label: "06. Audit & Compliance",
      summary: "Truy vết toàn bộ hành động nhạy cảm và xuất chứng từ compliance.",
      pages: [
        {
          id: "sa-06-aud-001",
          code: "SA-AUD-001",
          title: "Audit Explorer",
          priority: "p0",
          owner: "Security + Compliance",
          summary: "Truy vấn event log nhanh theo actor/action/workspace/time.",
          capabilities: [
            "Filter + search event logs nhiều chiều.",
            "Xem payload diff trước/sau với hành động mutate.",
            "Pin/save query presets cho team.",
          ],
          content: [
            "Audit table virtualized.",
            "Event detail drawer.",
            "Saved filter presets.",
          ],
          dataContracts: [
            "Audit event: <code>event_id</code>, <code>actor</code>, <code>action</code>, <code>resource</code>, <code>meta</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/audit-logs</code>",
            "GET <code>/v1/control/admin/audit-logs/:id</code>",
          ],
          actions: [
            "Không cho delete audit log.",
            "Mask dữ liệu nhạy cảm trong payload preview.",
          ],
          kpis: [
            "Audit query response p95.",
            "Tỉ lệ event có actor/resource đầy đủ.",
          ],
          checklist: [
            "Build virtualized audit table.",
            "Add detail drawer + payload diff.",
            "Add saved filters.",
          ],
          delivery: {
            p0: ["Audit table + filters", "Event details"],
            p1: ["Saved filters"],
            p2: ["Cross-page contextual jump graph"],
          },
        },
        {
          id: "sa-06-aud-002",
          code: "SA-AUD-002",
          title: "Compliance Export Center",
          priority: "p1",
          owner: "Compliance",
          summary: "Export dữ liệu chứng minh kiểm soát theo chuẩn nội bộ.",
          capabilities: [
            "Tạo export jobs theo khoảng thời gian.",
            "Track trạng thái export queue.",
            "Download package có integrity checksum.",
          ],
          content: [
            "Export templates list.",
            "Job queue + status.",
            "Download history.",
          ],
          dataContracts: [
            "Export job: <code>job_id</code>, <code>template</code>, <code>status</code>, <code>checksum</code>.",
          ],
          apiContracts: [
            "POST <code>/v1/control/admin/compliance/exports</code>",
            "GET <code>/v1/control/admin/compliance/exports</code>",
          ],
          actions: [
            "Exports lớn chạy async, không block UI.",
            "Download URL có expiration.",
          ],
          kpis: [
            "Export completion success rate.",
            "Average export generation time.",
          ],
          checklist: [
            "Build export template selector.",
            "Add async job list + polling.",
            "Add checksum display + download control.",
          ],
          delivery: {
            p0: ["Manual export creation"],
            p1: ["Job queue + download history"],
            p2: ["Scheduled recurring exports"],
          },
        },
      ],
    },
    {
      id: "sa-07",
      label: "07. Support & Intervention",
      summary: "Công cụ hỗ trợ xử lý ticket khách hàng ở mức platform.",
      pages: [
        {
          id: "sa-07-sup-001",
          code: "SA-SUP-001",
          title: "Workspace Support Timeline",
          priority: "p1",
          owner: "Customer Success",
          summary: "Timeline gom theo workspace: billing, auth, sync, support note.",
          capabilities: [
            "Xem lịch sử sự kiện workspace theo thời gian.",
            "Đính note nội bộ cho mỗi mốc sự kiện.",
            "Jump sang trang entitlement/audit từ timeline.",
          ],
          content: [
            "Chronological timeline.",
            "Internal notes panel.",
            "Quick links action bar.",
          ],
          dataContracts: [
            "Timeline event: <code>event_type</code>, <code>source</code>, <code>occurred_at</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/workspaces/:id/timeline</code>",
            "POST <code>/v1/control/admin/workspaces/:id/notes</code>",
          ],
          actions: [
            "Notes nội bộ không hiển thị cho customer.",
            "Mọi note edit/delete đều có revision history.",
          ],
          kpis: [
            "Time to resolve support ticket.",
            "Context completeness per ticket.",
          ],
          checklist: [
            "Build timeline renderer.",
            "Add internal note CRUD.",
            "Add quick-jump links.",
          ],
          delivery: {
            p0: ["Timeline read"],
            p1: ["Internal notes + quick jumps"],
            p2: ["AI summary for support handover"],
          },
        },
        {
          id: "sa-07-sup-002",
          code: "SA-SUP-002",
          title: "Safe Impersonation Console",
          priority: "p2",
          owner: "Security + Support",
          summary: "Hỗ trợ debug trong context customer với kiểm soát nghiêm ngặt.",
          capabilities: [
            "Tạo session impersonation có thời hạn.",
            "Read-only mặc định, elevate theo case.",
            "Tự động log full trace.",
          ],
          content: [
            "Impersonation request form.",
            "Active sessions table.",
            "Auto-expiry controls.",
          ],
          dataContracts: [
            "Impersonation session: <code>session_id</code>, <code>granted_by</code>, <code>expires_at</code>.",
          ],
          apiContracts: [
            "POST <code>/v1/control/admin/impersonation/sessions</code>",
            "GET <code>/v1/control/admin/impersonation/sessions</code>",
            "POST <code>/v1/control/admin/impersonation/sessions/:id/revoke</code>",
          ],
          actions: [
            "Bắt buộc ticket reference khi tạo session.",
            "Auto-revoke sau timeout.",
          ],
          kpis: [
            "Misuse incidents = 0.",
            "Support debug speed improvement.",
          ],
          checklist: [
            "Define approval policy.",
            "Build session lifecycle UI.",
            "Add full audit integration.",
          ],
          delivery: {
            p0: ["Policy + backend controls"],
            p1: ["Session console UI"],
            p2: ["Context-aware safe mode automation"],
          },
        },
      ],
    },
    {
      id: "sa-08",
      label: "08. Platform Settings",
      summary: "Thiết lập cấu hình hệ thống và default policy ở mức nền tảng.",
      pages: [
        {
          id: "sa-08-set-001",
          code: "SA-SET-001",
          title: "Integration Config Registry",
          priority: "p0",
          owner: "Platform Ops",
          summary: "Quản lý endpoint/token/key references cho control plane.",
          capabilities: [
            "Xem trạng thái config Stripe/S3/Auth/Sync.",
            "Rotate secret theo chuẩn zero-downtime.",
            "Validate config trước khi apply.",
          ],
          content: [
            "Integration cards + health indicator.",
            "Secret rotation flow.",
            "Validation log.",
          ],
          dataContracts: [
            "Config status model: <code>configured</code>, <code>connected</code>, <code>last_checked_at</code>.",
          ],
          apiContracts: [
            "GET <code>/config-status</code>",
            "POST <code>/v1/control/admin/integrations/:key/rotate</code>",
          ],
          actions: [
            "Không hiển thị raw secret trên UI.",
            "Rotation flow cần confirmation + rollback plan.",
          ],
          kpis: [
            "Configuration error rate.",
            "Mean time to recover after key rotation.",
          ],
          checklist: [
            "Build integration status cards.",
            "Add rotate/validate actions.",
            "Mask sensitive outputs.",
          ],
          delivery: {
            p0: ["Status visibility", "Config validation"],
            p1: ["Secret rotation workflow"],
            p2: ["Automated drift detection"],
          },
        },
        {
          id: "sa-08-set-002",
          code: "SA-SET-002",
          title: "Policy Templates & Defaults",
          priority: "p1",
          owner: "Platform PM",
          summary: "Mẫu policy mặc định áp cho workspace mới hoặc segment cụ thể.",
          capabilities: [
            "Quản lý template permission, billing, retention.",
            "Apply template cho segment workspace.",
            "Versioning template + rollback.",
          ],
          content: [
            "Template list.",
            "Template editor.",
            "Version timeline.",
          ],
          dataContracts: [
            "Template model: <code>template_id</code>, <code>template_type</code>, <code>version</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/admin/policy-templates</code>",
            "POST <code>/v1/control/admin/policy-templates</code>",
            "POST <code>/v1/control/admin/policy-templates/:id/apply</code>",
          ],
          actions: [
            "Apply template yêu cầu impact preview.",
            "Rollback phải chọn version cụ thể.",
          ],
          kpis: [
            "Template adoption rate.",
            "Configuration consistency across new workspaces.",
          ],
          checklist: [
            "Build template CRUD UI.",
            "Build apply preview modal.",
            "Add version rollback flow.",
          ],
          delivery: {
            p0: ["Template read"],
            p1: ["Template CRUD + apply preview"],
            p2: ["Policy simulation sandbox"],
          },
        },
      ],
    },
  ];

  const refs = {
    treeRoot: document.getElementById("treeRoot"),
    treeCount: document.getElementById("treeCount"),
    treeSearch: document.getElementById("treeSearch"),
    expandAll: document.getElementById("expandAll"),
    collapseAll: document.getElementById("collapseAll"),
    detailTitle: document.getElementById("detailTitle"),
    detailSummary: document.getElementById("detailSummary"),
    detailMeta: document.getElementById("detailMeta"),
    capabilities: document.getElementById("capabilities"),
    pageContent: document.getElementById("pageContent"),
    dataContracts: document.getElementById("dataContracts"),
    apiContracts: document.getElementById("apiContracts"),
    actions: document.getElementById("actions"),
    kpis: document.getElementById("kpis"),
    checklist: document.getElementById("checklist"),
    laneP0: document.getElementById("laneP0"),
    laneP1: document.getElementById("laneP1"),
    laneP2: document.getElementById("laneP2"),
  };

  const allPages = TREE.flatMap((branch) => branch.pages.map((page) => ({ ...page, branchId: branch.id, branchLabel: branch.label })));

  const ui = loadUI();
  ensureValidState();
  bindEvents();
  render();

  function loadUI() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return {
          activePageId: allPages[0]?.id || "",
          search: "",
          collapsed: {},
        };
      }
      const parsed = JSON.parse(raw);
      return {
        activePageId: parsed.activePageId || allPages[0]?.id || "",
        search: parsed.search || "",
        collapsed: parsed.collapsed || {},
      };
    } catch (_error) {
      return {
        activePageId: allPages[0]?.id || "",
        search: "",
        collapsed: {},
      };
    }
  }

  function saveUI() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ui));
  }

  function ensureValidState() {
    if (!allPages.some((page) => page.id === ui.activePageId)) {
      ui.activePageId = allPages[0]?.id || "";
    }
  }

  function bindEvents() {
    refs.treeSearch.value = ui.search;

    refs.treeSearch.addEventListener("input", (event) => {
      ui.search = String(event.target.value || "").trim().toLowerCase();
      saveUI();
      renderTree();
    });

    refs.expandAll.addEventListener("click", () => {
      TREE.forEach((branch) => {
        ui.collapsed[branch.id] = false;
      });
      saveUI();
      renderTree();
    });

    refs.collapseAll.addEventListener("click", () => {
      TREE.forEach((branch) => {
        ui.collapsed[branch.id] = true;
      });
      saveUI();
      renderTree();
    });
  }

  function render() {
    renderTree();
    renderDetails();
  }

  function renderTree() {
    const query = ui.search;
    let visibleCount = 0;

    refs.treeRoot.innerHTML = "";

    TREE.forEach((branch) => {
      const branchMatches = !query || `${branch.label} ${branch.summary}`.toLowerCase().includes(query);

      const pages = branch.pages.filter((page) => {
        if (!query) {
          return true;
        }
        return pageMatches(page, query) || branchMatches;
      });

      if (!pages.length) {
        return;
      }

      visibleCount += pages.length;

      const group = document.createElement("section");
      group.className = "tree-group";

      const headBtn = document.createElement("button");
      headBtn.type = "button";
      const isCollapsed = Boolean(ui.collapsed[branch.id]);
      headBtn.textContent = `${isCollapsed ? "▸" : "▾"} ${branch.label}`;
      headBtn.addEventListener("click", () => {
        ui.collapsed[branch.id] = !Boolean(ui.collapsed[branch.id]);
        saveUI();
        renderTree();
      });

      group.appendChild(headBtn);

      if (!isCollapsed) {
        const list = document.createElement("ul");
        list.className = "tree-items";

        pages.forEach((page) => {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.classList.toggle("active", page.id === ui.activePageId);
          button.innerHTML = `<strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.code)} · ${escapeHtml(page.priority.toUpperCase())}</small>`;
          button.addEventListener("click", () => {
            ui.activePageId = page.id;
            saveUI();
            renderDetails();
            renderTree();
          });
          item.appendChild(button);
          list.appendChild(item);
        });

        group.appendChild(list);
      }

      refs.treeRoot.appendChild(group);
    });

    refs.treeCount.textContent = `${visibleCount} pages`;

    const activeVisible = allPages.some((page) => page.id === ui.activePageId && (!query || pageMatches(page, query)));
    if (!activeVisible) {
      const firstVisible = TREE.flatMap((branch) => branch.pages).find((page) => !query || pageMatches(page, query));
      if (firstVisible) {
        ui.activePageId = firstVisible.id;
        saveUI();
        renderDetails();
      }
    }
  }

  function renderDetails() {
    const page = allPages.find((item) => item.id === ui.activePageId);
    if (!page) {
      return;
    }

    refs.detailTitle.textContent = page.title;
    refs.detailSummary.textContent = page.summary;

    refs.detailMeta.innerHTML = "";
    const metaTags = [
      { label: page.code, cls: "" },
      { label: page.branchLabel, cls: "" },
      { label: `Owner: ${page.owner}`, cls: "" },
      { label: page.priority.toUpperCase(), cls: `priority-${page.priority}` },
    ];

    metaTags.forEach((tag) => {
      const span = document.createElement("span");
      span.className = `tag ${tag.cls}`.trim();
      span.textContent = tag.label;
      refs.detailMeta.appendChild(span);
    });

    setList(refs.capabilities, page.capabilities);
    setList(refs.pageContent, page.content);
    setList(refs.dataContracts, page.dataContracts);
    setList(refs.apiContracts, page.apiContracts);
    setList(refs.actions, page.actions);
    setList(refs.kpis, page.kpis);
    setList(refs.checklist, page.checklist);

    setList(refs.laneP0, page.delivery?.p0 || []);
    setList(refs.laneP1, page.delivery?.p1 || []);
    setList(refs.laneP2, page.delivery?.p2 || []);
  }

  function pageMatches(page, query) {
    return [
      page.title,
      page.code,
      page.summary,
      page.priority,
      page.owner,
      ...(page.capabilities || []),
      ...(page.content || []),
      ...(page.dataContracts || []),
      ...(page.apiContracts || []),
      ...(page.actions || []),
      ...(page.kpis || []),
      ...(page.checklist || []),
      ...(page.delivery?.p0 || []),
      ...(page.delivery?.p1 || []),
      ...(page.delivery?.p2 || []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }

  function setList(node, items) {
    node.innerHTML = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.textContent = "Chưa có dữ liệu.";
      node.appendChild(li);
      return;
    }

    items.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = item;
      node.appendChild(li);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
