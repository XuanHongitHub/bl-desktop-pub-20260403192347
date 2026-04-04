"use client";

import { invoke } from "@tauri-apps/api/core";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlPlane } from "@/hooks/use-control-plane";
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type {
  AppSection,
  BrowserProfile,
  CloudUser,
  EntitlementSnapshot,
  RuntimeConfigStatus,
  StoredProxy,
  TeamRole,
} from "@/types";
import type { WorkspaceAdminFlow } from "./admin/admin-workspace-tab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { PageLoader } from "./ui/page-loader";

function AdminPanelLoadingCard() {
  return (
    <Card className="border-border/70 shadow-none">
      <CardContent className="p-6">
        <PageLoader mode="inline" />
      </CardContent>
    </Card>
  );
}

const AdminOverviewTab = dynamic(
  () =>
    import("./admin/admin-overview-tab").then((mod) => mod.AdminOverviewTab),
  {
    ssr: false,
    loading: () => <AdminPanelLoadingCard />,
  },
);

const AdminWorkspaceTab = dynamic(
  () =>
    import("./admin/admin-workspace-tab").then((mod) => mod.AdminWorkspaceTab),
  {
    ssr: false,
    loading: () => <AdminPanelLoadingCard />,
  },
);

const AdminBillingTab = dynamic(
  () => import("./admin/admin-billing-tab").then((mod) => mod.AdminBillingTab),
  {
    ssr: false,
    loading: () => <AdminPanelLoadingCard />,
  },
);

const AdminTiktokCookiesTab = dynamic(
  () =>
    import("./admin/admin-tiktok-cookies-tab").then(
      (mod) => mod.AdminTiktokCookiesTab,
    ),
  {
    ssr: false,
    loading: () => <AdminPanelLoadingCard />,
  },
);

const AdminAuditTab = dynamic(
  () => import("./admin/admin-audit-tab").then((mod) => mod.AdminAuditTab),
  {
    ssr: false,
    loading: () => <AdminPanelLoadingCard />,
  },
);

interface PlatformAdminWorkspaceProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
  cloudUser?: CloudUser | null;
  platformRole?: string;
  teamRole?: TeamRole | null;
  workspaceProfiles: BrowserProfile[];
  storedProxies: StoredProxy[];
  isWorkspaceProfilesLoading?: boolean;
  isStoredProxiesLoading?: boolean;
  refreshWorkspaceProfiles: () => Promise<void>;
  refreshStoredProxies: () => Promise<void>;
  sidebarTab?: AdminTab;
  workspaceFlow?: WorkspaceAdminFlow | null;
  showWorkspaceFlowTabs?: boolean;
  workspaceScopedOnly?: boolean;
  minimalView?: boolean;
  workspaceContextId?: string | null;
  onWorkspaceContextChange?: (workspaceId: string) => void;
  onNavigateSection?: (section: AppSection) => void;
  initialPanelPage?: string | null;
}

type AdminTab = "overview" | "workspace" | "billing" | "cookies" | "audit";

type PanelScope = "super_admin" | "workspace_owner";

type PanelPageDefinition = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  tab: AdminTab | "workspace_profiles" | "workspace_billing";
  flow?: WorkspaceAdminFlow | null;
  iconTab?: AdminTab;
  platformOnly?: boolean;
};

type PanelGroupDefinition = {
  id: string;
  titleKey: string;
  pages: PanelPageDefinition[];
};
const INVITABLE_ROLES: TeamRole[] = ["member", "viewer"];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function PlatformAdminWorkspace({
  runtimeConfig,
  entitlement,
  cloudUser,
  platformRole,
  teamRole,
  workspaceProfiles,
  storedProxies,
  isWorkspaceProfilesLoading = false,
  isStoredProxiesLoading = false,
  refreshWorkspaceProfiles,
  refreshStoredProxies,
  sidebarTab,
  workspaceFlow,
  showWorkspaceFlowTabs,
  workspaceScopedOnly = false,
  minimalView = false,
  workspaceContextId,
  onWorkspaceContextChange,
  onNavigateSection,
  initialPanelPage = null,
}: PlatformAdminWorkspaceProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"personal" | "team">(
    "team",
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [shareResourceType, setShareResourceType] = useState<
    "profile" | "group"
  >("profile");
  const [shareResourceId, setShareResourceId] = useState("");
  const [shareRecipientEmail, setShareRecipientEmail] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponSource, setCouponSource] = useState<"internal" | "stripe">(
    "internal",
  );
  const [couponDiscount, setCouponDiscount] = useState("25");
  const [couponMaxRedemptions, setCouponMaxRedemptions] = useState("0");
  const [couponExpiresAt, setCouponExpiresAt] = useState("");
  const [couponAllowlist, setCouponAllowlist] = useState("");
  const [couponDenylist, setCouponDenylist] = useState("");
  const [isUpdatingEntitlement, setIsUpdatingEntitlement] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [membershipRoleDrafts, setMembershipRoleDrafts] = useState<
    Record<string, TeamRole>
  >({});
  const shouldLoadTiktokData =
    minimalView ||
    sidebarTab === "cookies" ||
    initialPanelPage?.includes("cookies") === true;

  const {
    runtime,
    isLoading,
    isTiktokDataBootstrapping,
    isTiktokDataReady,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    overview,
    memberships,
    invites,
    shareGrants,
    coupons,
    auditLogs,
    tiktokCookies,
    adminOverview,
    adminWorkspaceHealth,
    serverConfigStatus,
    setSelectedWorkspaceId,
    refreshWorkspaceDetails,
    refreshAdminData,
    refreshTiktokCookies,
    tiktokCookieSources,
    tiktokAutomationAccounts,
    tiktokAutomationRuns,
    refreshTiktokCookieSources,
    refreshTiktokAutomationAccounts,
    refreshTiktokAutomationRuns,
    createWorkspace,
    createInvite,
    revokeInvite,
    updateMembershipRole,
    removeMembership,
    createShareGrant,
    revokeShareGrant,
    createCoupon,
    revokeCoupon,
    createTiktokCookie,
    updateTiktokCookie,
    deleteTiktokCookie,
    testTiktokCookie,
    bulkCreateTiktokCookies,
    replaceTiktokCookieSources,
    importTiktokAutomationAccounts,
    deleteTiktokAutomationAccount,
    createTiktokAutomationRun,
    getTiktokAutomationRun,
    startTiktokAutomationRun,
    pauseTiktokAutomationRun,
    resumeTiktokAutomationRun,
    stopTiktokAutomationRun,
    updateTiktokAutomationRunItem,
    pollTiktokAutomationRunEvents,
    adminTiktokState,
    refreshAdminTiktokState,
    saveAdminTiktokState,
  } = useControlPlane({
    includeAdminData: !minimalView,
    includeServerConfigStatus: !minimalView,
    includeWorkspaceDetails: !minimalView,
    includeTiktokData: shouldLoadTiktokData,
    actorUser: cloudUser,
    actorWorkspaceRole: teamRole ?? null,
    preferredWorkspaceId: workspaceContextId ?? null,
  });

  const isBusy = isLoading || isCreatingWorkspace || isUpdatingEntitlement;
  const isPlatformAdmin = platformRole === "platform_admin";
  const isTeamOperator = teamRole === "owner" || teamRole === "admin";
  const canAccessBugIdeaTab = isPlatformAdmin;
  const panelScope: PanelScope = workspaceScopedOnly
    ? "workspace_owner"
    : "super_admin";

  const panelGroups = useMemo<PanelGroupDefinition[]>(() => {
    if (panelScope === "workspace_owner") {
      return [
        {
          id: "owner-group-command",
          titleKey: "adminWorkspace.panelTree.owner.groupCommand",
          pages: [
            {
              id: "owner-overview",
              titleKey: "adminWorkspace.panelTree.owner.pages.overview.title",
              descriptionKey:
                "adminWorkspace.panelTree.owner.pages.overview.description",
              tab: "overview",
              iconTab: "overview",
            },
          ],
        },
        {
          id: "owner-group-team-access",
          titleKey: "adminWorkspace.panelTree.owner.groupTeamAccess",
          pages: [
            {
              id: "owner-members",
              titleKey: "adminWorkspace.panelTree.owner.pages.members.title",
              descriptionKey:
                "adminWorkspace.panelTree.owner.pages.members.description",
              tab: "workspace",
              flow: "directory",
              iconTab: "workspace",
            },
            {
              id: "owner-share-access",
              titleKey: "adminWorkspace.panelTree.owner.pages.share.title",
              descriptionKey:
                "adminWorkspace.panelTree.owner.pages.share.description",
              tab: "workspace",
              flow: "permissions",
              iconTab: "workspace",
            },
          ],
        },
        {
          id: "owner-group-assets",
          titleKey: "adminWorkspace.panelTree.owner.groupAssets",
          pages: [
            {
              id: "owner-profile-governance",
              titleKey:
                "adminWorkspace.panelTree.owner.pages.profileGovernance.title",
              descriptionKey:
                "adminWorkspace.panelTree.owner.pages.profileGovernance.description",
              tab: "workspace_profiles",
              iconTab: "workspace",
            },
            {
              id: "owner-billing-entitlement",
              titleKey: "adminWorkspace.panelTree.owner.pages.billing.title",
              descriptionKey:
                "adminWorkspace.panelTree.owner.pages.billing.description",
              tab: "workspace",
              flow: "plan",
              iconTab: "workspace",
            },
          ],
        },
      ];
    }

    const superAdminPages: PanelGroupDefinition[] = [
      {
        id: "super-group-command",
        titleKey: "adminWorkspace.panelTree.super.groupCommand",
        pages: [
          {
            id: "super-command-center",
            titleKey: "adminWorkspace.panelTree.super.pages.command.title",
            descriptionKey:
              "adminWorkspace.panelTree.super.pages.command.description",
            tab: "overview",
            iconTab: "overview",
          },
          {
            id: "super-workspace-governance",
            titleKey: "adminWorkspace.panelTree.super.pages.workspace.title",
            descriptionKey:
              "adminWorkspace.panelTree.super.pages.workspace.description",
            tab: "workspace",
            iconTab: "workspace",
          },
        ],
      },
      {
        id: "super-group-revenue",
        titleKey: "adminWorkspace.panelTree.super.groupRevenue",
        pages: [
          {
            id: "super-revenue-ops",
            titleKey: "adminWorkspace.panelTree.super.pages.billing.title",
            descriptionKey:
              "adminWorkspace.panelTree.super.pages.billing.description",
            tab: "billing",
            iconTab: "billing",
          },
        ],
      },
      {
        id: "super-group-governance",
        titleKey: "adminWorkspace.panelTree.super.groupGovernance",
        pages: [
          {
            id: "super-audit-compliance",
            titleKey: "adminWorkspace.panelTree.super.pages.audit.title",
            descriptionKey:
              "adminWorkspace.panelTree.super.pages.audit.description",
            tab: "audit",
            iconTab: "audit",
          },
          {
            id: "super-bugidea-ops",
            titleKey: "adminWorkspace.panelTree.super.pages.cookies.title",
            descriptionKey:
              "adminWorkspace.panelTree.super.pages.cookies.description",
            tab: "cookies",
            iconTab: "cookies",
            platformOnly: true,
          },
        ],
      },
    ];

    return superAdminPages
      .map((group) => ({
        ...group,
        pages: group.pages.filter(
          (page) => !page.platformOnly || canAccessBugIdeaTab,
        ),
      }))
      .filter((group) => group.pages.length > 0);
  }, [canAccessBugIdeaTab, panelScope]);

  const panelPages = useMemo(
    () => panelGroups.flatMap((group) => group.pages),
    [panelGroups],
  );

  const sidebarDrivenPageId = useMemo(() => {
    if (!sidebarTab) {
      return null;
    }
    if (panelScope === "workspace_owner") {
      if (sidebarTab === "workspace" && workspaceFlow === "overview")
        return "owner-overview";
      if (sidebarTab === "overview") return "owner-overview";
      if (sidebarTab === "workspace" && workspaceFlow === "plan")
        return "owner-billing-entitlement";
      if (sidebarTab === "workspace" && workspaceFlow === "permissions")
        return "owner-share-access";
      if (sidebarTab === "workspace") return "owner-members";
      return "owner-overview";
    }

    if (sidebarTab === "overview") return "super-command-center";
    if (sidebarTab === "workspace") return "super-workspace-governance";
    if (sidebarTab === "billing") return "super-revenue-ops";
    if (sidebarTab === "audit") return "super-audit-compliance";
    if (sidebarTab === "cookies") return "super-bugidea-ops";
    return "super-command-center";
  }, [panelScope, sidebarTab, workspaceFlow]);

  const activePageId = sidebarDrivenPageId ?? initialPanelPage ?? null;
  const activePanelPage = useMemo(() => {
    return (
      panelPages.find((page) => page.id === activePageId) ??
      panelPages[0] ??
      null
    );
  }, [activePageId, panelPages]);

  const activeTab = useMemo<
    AdminTab | "workspace_profiles" | "workspace_billing"
  >(() => activePanelPage?.tab ?? "overview", [activePanelPage]);

  const resolvedWorkspaceFlow =
    activePanelPage?.flow ?? workspaceFlow ?? undefined;

  useEffect(() => {
    if (INVITABLE_ROLES.includes(inviteRole)) {
      return;
    }
    setInviteRole("member");
  }, [inviteRole]);

  useEffect(() => {
    const nextDrafts: Record<string, TeamRole> = {};
    for (const member of memberships) {
      nextDrafts[member.userId] = member.role;
    }
    setMembershipRoleDrafts((current) => {
      const currentKeys = Object.keys(current);
      const nextKeys = Object.keys(nextDrafts);
      if (currentKeys.length === nextKeys.length) {
        let unchanged = true;
        for (const key of nextKeys) {
          if (current[key] !== nextDrafts[key]) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) {
          return current;
        }
      }
      return nextDrafts;
    });
  }, [memberships]);

  useEffect(() => {
    if (!workspaceContextId || workspaces.length === 0) return;
    const directMatch = workspaces.find((w) => w.id === workspaceContextId);
    const resolvedWorkspace =
      directMatch ??
      (workspaceContextId === "personal"
        ? workspaces.find((w) => w.mode === "personal")
        : workspaces.find((w) => w.mode === "team"));
    if (!resolvedWorkspace || resolvedWorkspace.id === selectedWorkspaceId)
      return;
    setSelectedWorkspaceId(resolvedWorkspace.id);
  }, [
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    workspaceContextId,
    workspaces,
  ]);

  const handleWorkspaceSelectionChange = useCallback(
    (workspaceId: string | null) => {
      if (!workspaceId || workspaceId === selectedWorkspaceId) {
        return;
      }
      setSelectedWorkspaceId(workspaceId);
      onWorkspaceContextChange?.(workspaceId);
    },
    [onWorkspaceContextChange, selectedWorkspaceId, setSelectedWorkspaceId],
  );

  const configSummary = useMemo(() => {
    if (!runtimeConfig) return t("adminWorkspace.status.unknown");
    const issues: string[] = [];
    if (runtimeConfig.auth === "pending_config")
      issues.push(t("adminWorkspace.status.authPending"));
    if (runtimeConfig.stripe === "pending_config")
      issues.push(t("adminWorkspace.status.stripePending"));
    if (runtimeConfig.s3_sync === "pending_config")
      issues.push(t("adminWorkspace.status.syncPending"));
    if (issues.length === 0) return t("adminWorkspace.status.allReady");
    return issues.join(" • ");
  }, [runtimeConfig, t]);

  const entitlementLabel =
    entitlement?.state === "read_only"
      ? t("adminWorkspace.status.entitlementReadOnly")
      : entitlement?.state === "grace_active"
        ? t("adminWorkspace.status.entitlementGrace")
        : t("adminWorkspace.status.entitlementActive");

  const controlPlaneStatus = runtime.baseUrl
    ? t("adminWorkspace.controlPlane.connected", { url: runtime.baseUrl })
    : t("adminWorkspace.controlPlane.pending");

  const controlSecuritySummary = useMemo(() => {
    if (!runtime.baseUrl) return t("adminWorkspace.controlPlane.pending");
    if (!serverConfigStatus)
      return t("adminWorkspace.controlPlane.securityUnknown");
    const tokenStatus = serverConfigStatus.control.controlApiTokenConfigured
      ? t("adminWorkspace.controlPlane.controlTokenReady")
      : t("adminWorkspace.controlPlane.controlTokenPending");
    const statePersistenceReady = Boolean(
      serverConfigStatus.control.sqliteFileConfigured ||
        serverConfigStatus.control.controlStateFileConfigured,
    );
    const stateFileStatus = statePersistenceReady
      ? t("adminWorkspace.controlPlane.stateFileReady")
      : t("adminWorkspace.controlPlane.stateFilePending");
    return `${tokenStatus} • ${stateFileStatus}`;
  }, [runtime.baseUrl, serverConfigStatus, t]);

  const authReady = runtimeConfig?.auth === "ready";
  const stripeReady = runtimeConfig?.stripe === "ready";
  const syncReady = runtimeConfig?.s3_sync === "ready";

  /* Handlers */
  const handleSetEntitlement = async (
    nextState: "active" | "grace_active" | "read_only",
  ) => {
    if (!reason.trim()) {
      showErrorToast(t("adminWorkspace.reasonRequired"));
      return;
    }
    try {
      setIsUpdatingEntitlement(true);
      await invoke("set_entitlement_state", { state: nextState, reason });
      showSuccessToast(t("adminWorkspace.entitlementUpdated"));
    } catch {
      showErrorToast(t("adminWorkspace.entitlementUpdateFailed"));
    } finally {
      setIsUpdatingEntitlement(false);
    }
  };

  const requireWorkspaceAndReason = () => {
    if (!selectedWorkspaceId) {
      showErrorToast(t("adminWorkspace.controlPlane.workspaceSelectRequired"));
      return null;
    }
    // Optional requirement based on context, here we just return the ID to simplify for the redesign.
    return selectedWorkspaceId;
  };

  const handleCreateWorkspace = async () => {
    const nextName = workspaceName.trim();
    if (!nextName) {
      showErrorToast(t("adminWorkspace.controlPlane.workspaceNameRequired"));
      return;
    }
    try {
      setIsCreatingWorkspace(true);
      const created = await createWorkspace(nextName, workspaceMode);
      setWorkspaceName("");
      await refreshWorkspaceDetails(created.id);
      showSuccessToast(t("adminWorkspace.controlPlane.workspaceCreated"));
    } catch {
      showErrorToast(t("adminWorkspace.controlPlane.workspaceCreateFailed"));
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleCreateInvite = async () => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) return;
    if (!inviteEmail.trim()) {
      showErrorToast(t("adminWorkspace.members.inviteEmailRequired"));
      return;
    }
    if (!isValidEmail(inviteEmail.trim().toLowerCase())) {
      showErrorToast(t("adminWorkspace.members.inviteEmailInvalid"));
      return;
    }
    if (!INVITABLE_ROLES.includes(inviteRole)) {
      showErrorToast(t("adminWorkspace.members.inviteRoleRestricted"));
      return;
    }
    try {
      await createInvite(workspaceId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      showSuccessToast(t("adminWorkspace.members.inviteCreated"));
    } catch (error) {
      const rootError = extractRootError(error);
      if (rootError.includes("invalid_invite_role")) {
        showErrorToast(t("adminWorkspace.members.inviteRoleRestricted"));
        return;
      }
      showErrorToast(t("adminWorkspace.members.inviteCreateFailed"));
    }
  };

  const handleUpdateRole = async (targetUserId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) return;
    const nextRole = membershipRoleDrafts[targetUserId];
    if (!nextRole) return;
    try {
      await updateMembershipRole(
        workspaceId,
        targetUserId,
        nextRole,
        reason.trim() || "Role Update",
      );
      showSuccessToast(t("adminWorkspace.members.roleUpdated"));
    } catch {
      showErrorToast(t("adminWorkspace.members.roleUpdateFailed"));
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) return;
    try {
      await removeMembership(
        workspaceId,
        targetUserId,
        reason.trim() || "User Removal",
      );
      showSuccessToast(t("adminWorkspace.members.memberRemoved"));
    } catch {
      showErrorToast(t("adminWorkspace.members.memberRemoveFailed"));
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) return;
    try {
      await revokeInvite(
        workspaceId,
        inviteId,
        reason.trim() || "Invite Revocation",
      );
      showSuccessToast(t("adminWorkspace.members.inviteRevoked"));
    } catch {
      showErrorToast(t("adminWorkspace.members.inviteRevokeFailed"));
    }
  };

  const handleCreateShare = async () => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) return;
    if (!shareResourceId.trim() || !shareRecipientEmail.trim()) {
      showErrorToast(t("adminWorkspace.share.fieldsRequired"));
      return;
    }
    if (!isValidEmail(shareRecipientEmail.trim().toLowerCase())) {
      showErrorToast(t("adminWorkspace.share.recipientInvalid"));
      return;
    }
    try {
      await createShareGrant(
        workspaceId,
        shareResourceType,
        shareResourceId.trim(),
        shareRecipientEmail.trim(),
        reason.trim() || "Share Grant",
      );
      setShareResourceId("");
      setShareRecipientEmail("");
      showSuccessToast(t("adminWorkspace.share.created"));
    } catch {
      showErrorToast(t("adminWorkspace.share.createFailed"));
    }
  };

  const handleRevokeShare = async (shareGrantId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) return;
    try {
      await revokeShareGrant(
        workspaceId,
        shareGrantId,
        reason.trim() || "Share Revoke",
      );
      showSuccessToast(t("adminWorkspace.share.revoked"));
    } catch {
      showErrorToast(t("adminWorkspace.share.revokeFailed"));
    }
  };

  const handleCreateCoupon = async () => {
    if (!couponCode.trim() || !couponExpiresAt.trim()) {
      showErrorToast(t("adminWorkspace.billing.couponFieldsRequired"));
      return;
    }
    if (!/^[A-Za-z0-9_-]{3,40}$/.test(couponCode.trim())) {
      showErrorToast(t("adminWorkspace.billing.couponCodeInvalid"));
      return;
    }
    const discount = Number(couponDiscount);
    const maxRedemptions = Number(couponMaxRedemptions);
    if (!Number.isFinite(discount) || !Number.isFinite(maxRedemptions)) {
      showErrorToast(t("adminWorkspace.billing.couponInvalidNumber"));
      return;
    }
    if (discount <= 0 || discount > 100) {
      showErrorToast(t("adminWorkspace.billing.couponDiscountRange"));
      return;
    }
    if (!Number.isInteger(maxRedemptions) || maxRedemptions < 0) {
      showErrorToast(t("adminWorkspace.billing.couponMaxInvalid"));
      return;
    }
    const expiresDate = new Date(couponExpiresAt);
    if (
      Number.isNaN(expiresDate.getTime()) ||
      expiresDate.getTime() <= Date.now()
    ) {
      showErrorToast(t("adminWorkspace.billing.couponExpiryInvalid"));
      return;
    }
    try {
      const parseList = (value: string) =>
        Array.from(
          new Set(
            value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          ),
        );
      await createCoupon({
        code: couponCode.trim().toUpperCase(),
        source: couponSource,
        discountPercent: discount,
        maxRedemptions,
        expiresAt: expiresDate.toISOString(),
        workspaceAllowlist: parseList(couponAllowlist),
        workspaceDenylist: parseList(couponDenylist),
      });
      setCouponCode("");
      setCouponDiscount("25");
      setCouponMaxRedemptions("0");
      setCouponExpiresAt("");
      setCouponAllowlist("");
      setCouponDenylist("");
      showSuccessToast(t("adminWorkspace.billing.couponCreated"));
    } catch {
      showErrorToast(t("adminWorkspace.billing.couponCreateFailed"));
    }
  };

  const handleRevokeCoupon = async (couponId: string) => {
    try {
      await revokeCoupon(couponId, reason.trim() || "Coupon Revocation");
      showSuccessToast(t("adminWorkspace.billing.couponRevoked"));
    } catch {
      showErrorToast(t("adminWorkspace.billing.couponRevokeFailed"));
    }
  };

  if (minimalView) {
    if (!canAccessBugIdeaTab) {
      return (
        <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-[13px] text-muted-foreground">
          {t("adminWorkspace.bugideaDevOnlyDescription")}
        </div>
      );
    }
    return (
      <AdminTiktokCookiesTab
        isPlatformAdmin={isPlatformAdmin}
        isBusy={isBusy}
        isTiktokDataBootstrapping={isTiktokDataBootstrapping}
        isTiktokDataReady={isTiktokDataReady}
        workspaceId={selectedWorkspaceId}
        adminTiktokState={adminTiktokState}
        tiktokCookies={tiktokCookies}
        tiktokCookieSources={tiktokCookieSources}
        tiktokAutomationAccounts={tiktokAutomationAccounts}
        tiktokAutomationRuns={tiktokAutomationRuns}
        workspaceProfiles={workspaceProfiles}
        storedProxies={storedProxies}
        isWorkspaceProfilesLoading={isWorkspaceProfilesLoading}
        isStoredProxiesLoading={isStoredProxiesLoading}
        refreshWorkspaceProfiles={refreshWorkspaceProfiles}
        refreshStoredProxies={refreshStoredProxies}
        refreshTiktokCookies={refreshTiktokCookies}
        refreshTiktokCookieSources={refreshTiktokCookieSources}
        refreshTiktokAutomationAccounts={refreshTiktokAutomationAccounts}
        refreshTiktokAutomationRuns={refreshTiktokAutomationRuns}
        refreshAdminTiktokState={refreshAdminTiktokState}
        saveAdminTiktokState={saveAdminTiktokState}
        createTiktokCookie={createTiktokCookie}
        updateTiktokCookie={updateTiktokCookie}
        deleteTiktokCookie={deleteTiktokCookie}
        testTiktokCookie={testTiktokCookie}
        bulkCreateTiktokCookies={bulkCreateTiktokCookies}
        replaceTiktokCookieSources={replaceTiktokCookieSources}
        importTiktokAutomationAccounts={importTiktokAutomationAccounts}
        deleteTiktokAutomationAccount={deleteTiktokAutomationAccount}
        createTiktokAutomationRun={createTiktokAutomationRun}
        getTiktokAutomationRun={getTiktokAutomationRun}
        startTiktokAutomationRun={startTiktokAutomationRun}
        pauseTiktokAutomationRun={pauseTiktokAutomationRun}
        resumeTiktokAutomationRun={resumeTiktokAutomationRun}
        stopTiktokAutomationRun={stopTiktokAutomationRun}
        updateTiktokAutomationRunItem={updateTiktokAutomationRunItem}
        pollTiktokAutomationRunEvents={pollTiktokAutomationRunEvents}
      />
    );
  }

  const totalProfiles = workspaceProfiles.length;
  const runningProfiles = workspaceProfiles.filter(
    (profile) => profile.runtime_state === "Running",
  ).length;
  const archivedProfiles = workspaceProfiles.filter(
    (profile) => profile.runtime_state === "Parked",
  ).length;
  const stoppedProfiles = workspaceProfiles.filter(
    (profile) => profile.runtime_state === "Stopped",
  ).length;

  const renderMainPanelContent = () => {
    if (activeTab === "overview") {
      return (
        <AdminOverviewTab
          isPlatformAdmin={isPlatformAdmin}
          workspaceScopedOnly={workspaceScopedOnly}
          configSummary={configSummary}
          entitlementLabel={entitlementLabel}
          controlPlaneStatus={controlPlaneStatus}
          controlSecuritySummary={controlSecuritySummary}
          selectedWorkspace={selectedWorkspace}
          adminOverview={adminOverview}
          auditLogs={auditLogs}
          workspaces={workspaces}
          memberships={memberships}
          invites={invites}
          shareGrants={shareGrants}
          overview={overview}
          adminWorkspaceHealth={adminWorkspaceHealth}
          authReady={authReady}
          stripeReady={stripeReady}
          syncReady={syncReady}
        />
      );
    }

    if (activeTab === "workspace") {
      return (
        <AdminWorkspaceTab
          isBusy={isBusy}
          runtimeBaseUrl={runtime.baseUrl}
          isPlatformAdmin={isPlatformAdmin}
          isTeamOperator={isTeamOperator}
          workspaceRole={teamRole}
          workspaces={workspaces}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedWorkspace={selectedWorkspace}
          overview={overview}
          memberships={memberships}
          invites={invites}
          shareGrants={shareGrants}
          workspaceName={workspaceName}
          setWorkspaceName={setWorkspaceName}
          workspaceMode={workspaceMode}
          setWorkspaceMode={setWorkspaceMode}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          shareResourceType={shareResourceType}
          setShareResourceType={setShareResourceType}
          shareResourceId={shareResourceId}
          setShareResourceId={setShareResourceId}
          shareRecipientEmail={shareRecipientEmail}
          setShareRecipientEmail={setShareRecipientEmail}
          handleCreateWorkspace={handleCreateWorkspace}
          setSelectedWorkspaceId={handleWorkspaceSelectionChange}
          handleCreateInvite={handleCreateInvite}
          handleRevokeInvite={handleRevokeInvite}
          membershipRoleDrafts={membershipRoleDrafts}
          setMembershipRoleDrafts={setMembershipRoleDrafts}
          handleUpdateRole={handleUpdateRole}
          handleRemoveMember={handleRemoveMember}
          handleCreateShare={handleCreateShare}
          handleRevokeShare={handleRevokeShare}
          currentUserEmail={cloudUser?.email ?? null}
          currentUserId={cloudUser?.id ?? null}
          workspaceScopedOnly={workspaceScopedOnly}
          forcedFlow={resolvedWorkspaceFlow}
          showFlowTabs={showWorkspaceFlowTabs ?? resolvedWorkspaceFlow == null}
        />
      );
    }

    if (activeTab === "billing") {
      return (
        <AdminBillingTab
          isPlatformAdmin={isPlatformAdmin}
          isBusy={isBusy}
          reason={reason}
          setReason={setReason}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          couponSource={couponSource}
          setCouponSource={setCouponSource}
          couponDiscount={couponDiscount}
          setCouponDiscount={setCouponDiscount}
          couponMaxRedemptions={couponMaxRedemptions}
          setCouponMaxRedemptions={setCouponMaxRedemptions}
          couponExpiresAt={couponExpiresAt}
          setCouponExpiresAt={setCouponExpiresAt}
          couponAllowlist={couponAllowlist}
          setCouponAllowlist={setCouponAllowlist}
          couponDenylist={couponDenylist}
          setCouponDenylist={setCouponDenylist}
          handleCreateCoupon={handleCreateCoupon}
          handleRevokeCoupon={handleRevokeCoupon}
          handleSetEntitlement={handleSetEntitlement}
          refreshAdminData={refreshAdminData}
          coupons={coupons}
        />
      );
    }

    if (activeTab === "cookies") {
      return (
        <AdminTiktokCookiesTab
          isPlatformAdmin={isPlatformAdmin}
          isBusy={isBusy}
          isTiktokDataBootstrapping={isTiktokDataBootstrapping}
          isTiktokDataReady={isTiktokDataReady}
          workspaceId={selectedWorkspaceId}
          adminTiktokState={adminTiktokState}
          tiktokCookies={tiktokCookies}
          tiktokCookieSources={tiktokCookieSources}
          tiktokAutomationAccounts={tiktokAutomationAccounts}
          tiktokAutomationRuns={tiktokAutomationRuns}
          workspaceProfiles={workspaceProfiles}
          storedProxies={storedProxies}
          isWorkspaceProfilesLoading={isWorkspaceProfilesLoading}
          isStoredProxiesLoading={isStoredProxiesLoading}
          refreshWorkspaceProfiles={refreshWorkspaceProfiles}
          refreshStoredProxies={refreshStoredProxies}
          refreshTiktokCookies={refreshTiktokCookies}
          refreshTiktokCookieSources={refreshTiktokCookieSources}
          refreshTiktokAutomationAccounts={refreshTiktokAutomationAccounts}
          refreshTiktokAutomationRuns={refreshTiktokAutomationRuns}
          refreshAdminTiktokState={refreshAdminTiktokState}
          saveAdminTiktokState={saveAdminTiktokState}
          createTiktokCookie={createTiktokCookie}
          updateTiktokCookie={updateTiktokCookie}
          deleteTiktokCookie={deleteTiktokCookie}
          testTiktokCookie={testTiktokCookie}
          bulkCreateTiktokCookies={bulkCreateTiktokCookies}
          replaceTiktokCookieSources={replaceTiktokCookieSources}
          importTiktokAutomationAccounts={importTiktokAutomationAccounts}
          deleteTiktokAutomationAccount={deleteTiktokAutomationAccount}
          createTiktokAutomationRun={createTiktokAutomationRun}
          getTiktokAutomationRun={getTiktokAutomationRun}
          startTiktokAutomationRun={startTiktokAutomationRun}
          pauseTiktokAutomationRun={pauseTiktokAutomationRun}
          resumeTiktokAutomationRun={resumeTiktokAutomationRun}
          stopTiktokAutomationRun={stopTiktokAutomationRun}
          updateTiktokAutomationRunItem={updateTiktokAutomationRunItem}
          pollTiktokAutomationRunEvents={pollTiktokAutomationRunEvents}
        />
      );
    }

    if (activeTab === "workspace_billing") {
      return (
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">
              {t("adminWorkspace.panelTree.owner.billingCardTitle")}
            </CardTitle>
            <CardDescription className="text-[12px]">
              {t("adminWorkspace.panelTree.owner.billingCardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.ui.planLabel")}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-foreground">
                  {selectedWorkspace?.planLabel ??
                    t("adminWorkspace.ui.noPlanLabel")}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("adminWorkspace.ui.snapshotEntitlement")}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-foreground">
                  {entitlementLabel}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("pricingPage.heroStatProfiles")}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-foreground">
                  {selectedWorkspace?.profileLimit ?? "-"}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("shell.workspaceSwitcher.expiresOn", {
                    date: selectedWorkspace?.expiresAt ?? "-",
                  })}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-foreground">
                  {selectedWorkspace?.expiresAt ?? "-"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateSection?.("billing")}
                className="rounded-md border border-border bg-background px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                {t("shell.sections.billingManagement")}
              </button>
              <button
                type="button"
                onClick={() => onNavigateSection?.("pricing")}
                className="rounded-md border border-border bg-background px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                {t("shell.sections.pricing")}
              </button>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (activeTab === "workspace_profiles") {
      return (
        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-[14px] font-semibold">
              {t("adminWorkspace.panelTree.owner.profileCardTitle")}
            </CardTitle>
            <CardDescription className="text-[12px]">
              {t("adminWorkspace.panelTree.owner.profileCardDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("profiles.totalProfiles")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-foreground">
                  {totalProfiles}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("profiles.status.running")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-foreground">
                  {runningProfiles}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("profiles.status.stopped")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-foreground">
                  {stoppedProfiles}
                </p>
              </div>
              <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  {t("shell.proxyPage.proxyCount")}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-foreground">
                  {storedProxies.length}
                </p>
              </div>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">
                {t("adminWorkspace.panelTree.owner.profileRuntimeHint", {
                  running: runningProfiles,
                  parked: archivedProfiles,
                })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigateSection?.("profiles")}
                className="rounded-md border border-border bg-background px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                {t("shell.sections.profiles")}
              </button>
              <button
                type="button"
                onClick={() => onNavigateSection?.("proxies")}
                className="rounded-md border border-border bg-background px-3 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/60"
              >
                {t("shell.sections.proxies")}
              </button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <AdminAuditTab
        isPlatformAdmin={isPlatformAdmin}
        isBusy={isBusy}
        refreshAdminData={refreshAdminData}
        auditLogs={auditLogs}
      />
    );
  };

  return <div className="space-y-4 pb-10">{renderMainPanelContent()}</div>;
}
