(() => {
  "use strict";

  const STORAGE_KEY = "buglogin.ia.workspace-owner.v3";

  const TREE = [
    {
      id: "wo-01",
      label: "01. Workspace Command",
      summary: "Trang điều phối tổng quan cho owner của workspace hiện tại.",
      pages: [
        {
          id: "wo-01-cmd-001",
          code: "WO-CMD-001",
          title: "Workspace Overview",
          priority: "p0",
          owner: "Workspace Owner",
          summary: "Trang landing cho owner với sức khỏe vận hành và usage tổng hợp.",
          capabilities: [
            "Hiển thị plan/entitlement, profile usage, storage usage, proxy bandwidth.",
            "Hiển thị trạng thái service ảnh hưởng trực tiếp workspace hiện tại.",
            "Quick actions tới Members, Billing, Sharing, Audit.",
          ],
          content: [
            "Compact KPI strip: profiles, members, pending invites, sync success.",
            "Usage bars: profile/s3/proxy.",
            "Recent incidents/alerts chỉ trong workspace hiện tại.",
            "Quick action bar.",
          ],
          dataContracts: [
            "Workspace overview payload: <code>workspace_id</code>, <code>plan_label</code>, <code>profile_limit</code>.",
            "Usage payload: <code>profiles_used</code>, <code>s3_used_mb</code>, <code>proxy_used_gb</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/overview</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/billing/state</code>",
          ],
          actions: [
            "Read-only dashboard, không mutate trực tiếp.",
            "Khi thiếu entitlement data phải có fallback state rõ ràng.",
          ],
          kpis: [
            "Owner nắm tình trạng workspace trong <= 10 giây.",
            "0 blank states khi API partial fail.",
          ],
          checklist: [
            "Build compact overview layout.",
            "Hook overview + billing state APIs.",
            "Thêm quick-jump actions.",
          ],
          delivery: {
            p0: ["Overview KPIs", "Usage bars", "Quick actions"],
            p1: ["Incident mini-feed"],
            p2: ["Customizable owner widgets"],
          },
        },
        {
          id: "wo-01-cmd-002",
          code: "WO-CMD-002",
          title: "Workspace Health Timeline",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Timeline sự kiện quan trọng của workspace để debug nhanh.",
          capabilities: [
            "Timeline theo sync/billing/member/share events.",
            "Filter theo event type và thời gian.",
            "Drill-down tới page tương ứng.",
          ],
          content: [
            "Chronological timeline list.",
            "Event badges + severity.",
            "Jump links.",
          ],
          dataContracts: [
            "Timeline event: <code>event_type</code>, <code>severity</code>, <code>occurred_at</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/timeline</code>",
          ],
          actions: [
            "Không hiển thị dữ liệu workspace khác.",
            "Severity mapping thống nhất với audit stream.",
          ],
          kpis: [
            "Giảm thời gian debug owner-side.",
            "Event trace completeness.",
          ],
          checklist: [
            "Build timeline UI + filters.",
            "Hook timeline API.",
            "Add deep-link jumps.",
          ],
          delivery: {
            p0: ["Timeline read"],
            p1: ["Filters + deep links"],
            p2: ["Auto incident summary"],
          },
        },
      ],
    },
    {
      id: "wo-02",
      label: "02. Members & Roles",
      summary: "Quản lý thành viên và quyền trong workspace hiện tại.",
      pages: [
        {
          id: "wo-02-mem-001",
          code: "WO-MEM-001",
          title: "Member Directory",
          priority: "p0",
          owner: "Workspace Owner",
          summary: "Danh sách thành viên với role/status/action rõ ràng.",
          capabilities: [
            "Search/filter member theo email, role, status.",
            "Update role (theo quyền được phép).",
            "Disable/remove member không phải owner cuối cùng.",
          ],
          content: [
            "Dense member table.",
            "Role inline editor.",
            "Status badges + last active.",
          ],
          dataContracts: [
            "Member model: <code>user_id</code>, <code>email</code>, <code>role</code>, <code>status</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/members</code>",
            "PATCH <code>/v1/control/workspaces/:workspaceId/members/:targetUserId/role</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/members/:targetUserId/remove</code>",
          ],
          actions: [
            "Không cho remove owner cuối cùng.",
            "Role changes phải phản ánh permission matrix ngay.",
          ],
          kpis: [
            "Role update success rate.",
            "Unauthorized mutation attempts = 0.",
          ],
          checklist: [
            "Build member table + inline role edit.",
            "Add remove/disable flows.",
            "Add action confirmations + error states.",
          ],
          delivery: {
            p0: ["Member table", "Role update", "Remove member"],
            p1: ["Advanced filters"],
            p2: ["Bulk role operations"],
          },
        },
        {
          id: "wo-02-mem-002",
          code: "WO-MEM-002",
          title: "Invite Management",
          priority: "p0",
          owner: "Workspace Owner",
          summary: "Quản lý lifecycle invite và trạng thái chấp nhận.",
          capabilities: [
            "Create invite với role mặc định.",
            "Resend/revoke invite.",
            "Theo dõi pending/accepted/expired.",
          ],
          content: [
            "Invite create form.",
            "Invite table with statuses.",
            "Quick resend/revoke actions.",
          ],
          dataContracts: [
            "Invite model: <code>invite_id</code>, <code>email</code>, <code>role</code>, <code>status</code>.",
          ],
          apiContracts: [
            "POST <code>/v1/control/workspaces/:workspaceId/members/invite</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/invites</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/invites/:inviteId/revoke</code>",
          ],
          actions: [
            "Validate email + duplicate invite check.",
            "Revoke phải cập nhật UI ngay không cần reload.",
          ],
          kpis: [
            "Invite acceptance rate.",
            "Duplicate invite error rate.",
          ],
          checklist: [
            "Build create invite form.",
            "Build invite list + actions.",
            "Hook optimistic update for revoke.",
          ],
          delivery: {
            p0: ["Create/revoke invites", "Invite status list"],
            p1: ["Resend + invite analytics"],
            p2: ["Scheduled reminder automation"],
          },
        },
      ],
    },
    {
      id: "wo-03",
      label: "03. Resource Access Governance",
      summary: "Cấp quyền chia sẻ tài nguyên profile/group ở mức workspace.",
      pages: [
        {
          id: "wo-03-shr-001",
          code: "WO-SHR-001",
          title: "Share Grants",
          priority: "p0",
          owner: "Workspace Owner / Admin",
          summary: "Tạo/cập nhật/revoke share grant theo resource và recipient.",
          capabilities: [
            "Grant access theo profile/group.",
            "Chọn scope: view, launch, manage.",
            "Revoke/reactivate grant.",
          ],
          content: [
            "Grant create form compact.",
            "Grant table với status/scope.",
            "Filter theo recipient/resource.",
          ],
          dataContracts: [
            "Share grant: <code>share_grant_id</code>, <code>resource_id</code>, <code>access_scope</code>.",
          ],
          apiContracts: [
            "POST <code>/v1/control/workspaces/:workspaceId/share-grants</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/share-grants</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/share-grants/:shareGrantId/revoke</code>",
          ],
          actions: [
            "Prevent grant nếu recipient không thuộc workspace.",
            "Revoke phải ghi audit event.",
          ],
          kpis: [
            "Grant provisioning latency.",
            "Unauthorized share attempts.",
          ],
          checklist: [
            "Build grant form + validations.",
            "Build grants table.",
            "Hook revoke/reactivate flows.",
          ],
          delivery: {
            p0: ["Grant CRUD core"],
            p1: ["Recipient/resource filters"],
            p2: ["Grant expiration policy"],
          },
        },
        {
          id: "wo-03-shr-002",
          code: "WO-SHR-002",
          title: "Access Review Queue",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Rà soát grant định kỳ để giảm permission drift.",
          capabilities: [
            "List grants cần review.",
            "Approve continue / revoke.",
            "Track review completion rate.",
          ],
          content: [
            "Review queue list.",
            "Review action controls.",
            "Review completion KPI.",
          ],
          dataContracts: [
            "Review task: <code>review_id</code>, <code>due_at</code>, <code>decision</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/share-grants/review</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/share-grants/review/:reviewId/decision</code>",
          ],
          actions: [
            "Decision phải có note khi revoke.",
            "Overdue review hiển thị cảnh báo rõ.",
          ],
          kpis: [
            "Review completion rate.",
            "Permission drift reduction.",
          ],
          checklist: [
            "Build review queue.",
            "Add approve/revoke actions.",
            "Add review metrics card.",
          ],
          delivery: {
            p0: ["Review list"],
            p1: ["Decision workflow + metrics"],
            p2: ["Auto review reminders"],
          },
        },
      ],
    },
    {
      id: "wo-04",
      label: "04. Profile & Group Governance",
      summary: "Quản trị inventory profile/group thuộc workspace hiện tại.",
      pages: [
        {
          id: "wo-04-prf-001",
          code: "WO-PRF-001",
          title: "Profile Inventory Governance",
          priority: "p0",
          owner: "Workspace Owner / Operator",
          summary: "Theo dõi profile count, ownership và trạng thái profile-level.",
          capabilities: [
            "List profile theo group/owner/status.",
            "Detect profile orphan hoặc profile vượt policy.",
            "Bulk assign owner/group.",
          ],
          content: [
            "Inventory table with tags.",
            "Policy violation markers.",
            "Bulk action toolbar.",
          ],
          dataContracts: [
            "Profile model: <code>profile_id</code>, <code>group_id</code>, <code>owner_user_id</code>, <code>status</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/profiles</code>",
            "PATCH <code>/v1/control/workspaces/:workspaceId/profiles/bulk-owner</code>",
          ],
          actions: [
            "Bulk action có preview trước khi apply.",
            "Không cho assign owner ngoài workspace.",
          ],
          kpis: [
            "Orphan profile count.",
            "Bulk update success rate.",
          ],
          checklist: [
            "Build profile inventory table.",
            "Add policy markers.",
            "Add bulk owner/group actions.",
          ],
          delivery: {
            p0: ["Inventory table", "Bulk assign"],
            p1: ["Violation markers + saved filters"],
            p2: ["Profile lifecycle automation"],
          },
        },
        {
          id: "wo-04-prf-002",
          code: "WO-PRF-002",
          title: "Group Policy & Quota",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Theo dõi quota theo group và điều chỉnh chính sách group-level.",
          capabilities: [
            "Set quota per group.",
            "Track group utilization.",
            "Flag group vượt quota.",
          ],
          content: [
            "Group quota table.",
            "Utilization bars.",
            "Policy notes per group.",
          ],
          dataContracts: [
            "Group quota model: <code>group_id</code>, <code>quota_limit</code>, <code>quota_used</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/groups/quota</code>",
            "PATCH <code>/v1/control/workspaces/:workspaceId/groups/:groupId/quota</code>",
          ],
          actions: [
            "Quota giảm dưới used phải yêu cầu confirm.",
            "Quota change lưu history.",
          ],
          kpis: [
            "Quota violation rate.",
            "Group-level utilization balance.",
          ],
          checklist: [
            "Build quota table.",
            "Add quota edit flow.",
            "Add change history panel.",
          ],
          delivery: {
            p0: ["Quota visibility"],
            p1: ["Quota edit + warnings"],
            p2: ["Quota forecasting"],
          },
        },
      ],
    },
    {
      id: "wo-05",
      label: "05. Billing & Entitlement",
      summary: "Quản trị plan và theo dõi usage/invoice trong scope workspace.",
      pages: [
        {
          id: "wo-05-bil-001",
          code: "WO-BIL-001",
          title: "Plan & Entitlement Detail",
          priority: "p0",
          owner: "Workspace Owner",
          summary: "Trang xem plan hiện tại, entitlement và expiry.",
          capabilities: [
            "Xem plan label, cycle, expiry, source.",
            "CTA checkout/reactivate/cancel theo trạng thái.",
            "Hiển thị entitlement diff khi có thay đổi gần đây.",
          ],
          content: [
            "Plan card + entitlement chip.",
            "Subscription action buttons.",
            "Entitlement change timeline.",
          ],
          dataContracts: [
            "Entitlement state: <code>plan_label</code>, <code>expires_at</code>, <code>subscription_status</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/entitlement</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/billing/stripe-checkout</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/billing/subscription/cancel</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/billing/subscription/reactivate</code>",
          ],
          actions: [
            "Cancel/reactivate bắt buộc confirm.",
            "Không hiển thị admin-only override action.",
          ],
          kpis: [
            "Checkout completion rate.",
            "Failed self-service billing actions.",
          ],
          checklist: [
            "Build plan detail card.",
            "Hook cancel/reactivate/checkout actions.",
            "Add action feedback states.",
          ],
          delivery: {
            p0: ["Plan detail + actions"],
            p1: ["Entitlement change history"],
            p2: ["In-app plan comparison wizard"],
          },
        },
        {
          id: "wo-05-bil-002",
          code: "WO-BIL-002",
          title: "Usage & Invoice Feed",
          priority: "p0",
          owner: "Workspace Owner / Finance",
          summary: "Hiển thị usage metrics và hóa đơn để owner tự quản chi phí.",
          capabilities: [
            "Usage chart theo profile/s3/proxy.",
            "Invoice list + payment status.",
            "Download invoice và kiểm tra charge.",
          ],
          content: [
            "Usage trend chart.",
            "Invoice table.",
            "Upcoming charge summary.",
          ],
          dataContracts: [
            "Usage timeline: <code>date</code>, <code>profiles_used</code>, <code>s3_used_mb</code>.",
            "Invoice item: <code>invoice_id</code>, <code>amount</code>, <code>status</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/billing/state</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/invoices</code>",
          ],
          actions: [
            "Invoice data phải phù hợp timezone user.",
            "Không render invoice của workspace khác.",
          ],
          kpis: [
            "Invoice visibility accuracy.",
            "Usage alert lead time.",
          ],
          checklist: [
            "Build usage chart.",
            "Build invoice table + download action.",
            "Add upcoming charge panel.",
          ],
          delivery: {
            p0: ["Usage + invoice feed"],
            p1: ["Download & reconciliation helpers"],
            p2: ["Cost prediction panel"],
          },
        },
      ],
    },
    {
      id: "wo-06",
      label: "06. Security & Tokens",
      summary: "Quản trị access token và session ở mức workspace.",
      pages: [
        {
          id: "wo-06-sec-001",
          code: "WO-SEC-001",
          title: "Workspace API Tokens",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Quản lý token dùng cho integrations của workspace.",
          capabilities: [
            "Create/rotate/revoke workspace token.",
            "Scope token theo module.",
            "Track token usage history.",
          ],
          content: [
            "Token list.",
            "Create token dialog.",
            "Usage history mini-feed.",
          ],
          dataContracts: [
            "Token model: <code>token_id</code>, <code>scope</code>, <code>last_used_at</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/tokens</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/tokens</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/tokens/:id/revoke</code>",
          ],
          actions: [
            "Chỉ hiển thị token plaintext 1 lần khi tạo.",
            "Revoke token cần confirmation.",
          ],
          kpis: [
            "Compromised token incidents.",
            "Unused token cleanup rate.",
          ],
          checklist: [
            "Build token list + create flow.",
            "Add revoke/rotate actions.",
            "Add token usage feed.",
          ],
          delivery: {
            p0: ["Token CRUD core"],
            p1: ["Scope controls + usage feed"],
            p2: ["Automatic token expiry policy"],
          },
        },
        {
          id: "wo-06-sec-002",
          code: "WO-SEC-002",
          title: "Session & Access Control",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Kiểm soát session user trong workspace để giảm rủi ro.",
          capabilities: [
            "List active sessions theo user/device.",
            "Force logout theo user.",
            "Theo dõi login anomalies cấp workspace.",
          ],
          content: [
            "Active sessions table.",
            "Force logout actions.",
            "Anomaly alerts.",
          ],
          dataContracts: [
            "Session model: <code>session_id</code>, <code>user_id</code>, <code>device</code>, <code>last_seen</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/sessions</code>",
            "POST <code>/v1/control/workspaces/:workspaceId/sessions/:id/revoke</code>",
          ],
          actions: [
            "Force logout phải có warning rõ ràng.",
            "Không hiển thị IP đầy đủ nếu policy không cho phép.",
          ],
          kpis: [
            "Mean time to revoke risky sessions.",
            "Anomaly triage completion.",
          ],
          checklist: [
            "Build session table.",
            "Add revoke actions.",
            "Hook anomaly indicators.",
          ],
          delivery: {
            p0: ["Session visibility"],
            p1: ["Revoke + anomalies"],
            p2: ["Adaptive access policies"],
          },
        },
      ],
    },
    {
      id: "wo-07",
      label: "07. Workspace Audit",
      summary: "Audit trail và export logs trong phạm vi workspace hiện tại.",
      pages: [
        {
          id: "wo-07-aud-001",
          code: "WO-AUD-001",
          title: "Workspace Activity Explorer",
          priority: "p0",
          owner: "Workspace Owner / Admin",
          summary: "Truy vấn hoạt động member/share/billing/sync của workspace.",
          capabilities: [
            "Filter theo actor/action/resource/time.",
            "Xem event details.",
            "Pin filter presets.",
          ],
          content: [
            "Activity table.",
            "Event detail drawer.",
            "Preset filter bar.",
          ],
          dataContracts: [
            "Activity event: <code>event_id</code>, <code>actor</code>, <code>action</code>, <code>resource</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/activity</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/activity/:eventId</code>",
          ],
          actions: [
            "Mask dữ liệu nhạy cảm.",
            "Không cho delete activity event.",
          ],
          kpis: [
            "Audit query speed.",
            "Event completeness ratio.",
          ],
          checklist: [
            "Build activity table + filters.",
            "Add detail drawer.",
            "Add saved presets.",
          ],
          delivery: {
            p0: ["Activity table + detail"],
            p1: ["Saved presets"],
            p2: ["Behavior anomaly hints"],
          },
        },
        {
          id: "wo-07-aud-002",
          code: "WO-AUD-002",
          title: "Workspace Export Center",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Export dữ liệu activity/share/member cho kiểm soát nội bộ.",
          capabilities: [
            "Export CSV/JSON theo khoảng thời gian.",
            "Track export jobs.",
            "Download history.",
          ],
          content: [
            "Export form.",
            "Export job queue.",
            "Download history table.",
          ],
          dataContracts: [
            "Export job model: <code>job_id</code>, <code>type</code>, <code>status</code>, <code>expires_at</code>.",
          ],
          apiContracts: [
            "POST <code>/v1/control/workspaces/:workspaceId/exports</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/exports</code>",
          ],
          actions: [
            "Exports async + progress state.",
            "Download links phải có expiry.",
          ],
          kpis: [
            "Export success rate.",
            "Average export completion time.",
          ],
          checklist: [
            "Build export form + queue.",
            "Add status polling.",
            "Add download history list.",
          ],
          delivery: {
            p0: ["Manual export"],
            p1: ["Queue + history"],
            p2: ["Scheduled exports"],
          },
        },
      ],
    },
    {
      id: "wo-08",
      label: "08. Workspace Preferences",
      summary: "Cài đặt metadata, notifications và chính sách vận hành nội bộ workspace.",
      pages: [
        {
          id: "wo-08-pref-001",
          code: "WO-PREF-001",
          title: "Workspace Profile Settings",
          priority: "p1",
          owner: "Workspace Owner",
          summary: "Quản trị thông tin cơ bản của workspace và mô tả vận hành.",
          capabilities: [
            "Update workspace display name/info.",
            "Update timezone/locale cho billing + logs.",
            "Quản lý internal notes.",
          ],
          content: [
            "Workspace info form.",
            "Locale/timezone controls.",
            "Internal note field.",
          ],
          dataContracts: [
            "Workspace settings: <code>display_name</code>, <code>timezone</code>, <code>locale</code>.",
          ],
          apiContracts: [
            "PATCH <code>/v1/control/workspaces/:workspaceId/settings</code>",
            "GET <code>/v1/control/workspaces/:workspaceId/settings</code>",
          ],
          actions: [
            "Validate timezone/locale values.",
            "Track settings change history.",
          ],
          kpis: [
            "Settings save success rate.",
            "Support tickets do timezone mismatch.",
          ],
          checklist: [
            "Build settings form.",
            "Hook read/update APIs.",
            "Add save feedback states.",
          ],
          delivery: {
            p0: ["Settings read/write"],
            p1: ["Change history"],
            p2: ["Multi-env workspace profiles"],
          },
        },
        {
          id: "wo-08-pref-002",
          code: "WO-PREF-002",
          title: "Notification & Policy Toggles",
          priority: "p2",
          owner: "Workspace Owner",
          summary: "Cấu hình thông báo và policy toggles cho team trong workspace.",
          capabilities: [
            "Enable/disable alerts (usage, invite, sync errors).",
            "Set notification channels.",
            "Policy toggles cho workspace-level defaults.",
          ],
          content: [
            "Notification toggle list.",
            "Channel selectors.",
            "Policy toggle matrix.",
          ],
          dataContracts: [
            "Notification prefs: <code>alert_type</code>, <code>channel</code>, <code>enabled</code>.",
          ],
          apiContracts: [
            "GET <code>/v1/control/workspaces/:workspaceId/notifications</code>",
            "PATCH <code>/v1/control/workspaces/:workspaceId/notifications</code>",
          ],
          actions: [
            "Không cho disable mọi critical alert cùng lúc.",
            "Toggles phải có default reset option.",
          ],
          kpis: [
            "Critical alert coverage.",
            "Notification delivery success rate.",
          ],
          checklist: [
            "Build toggle groups.",
            "Hook update API + validation.",
            "Add reset-to-default action.",
          ],
          delivery: {
            p0: ["Read notification prefs"],
            p1: ["Update toggles + channel selectors"],
            p2: ["Per-role notification templates"],
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
