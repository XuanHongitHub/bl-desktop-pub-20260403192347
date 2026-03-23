"use client";

import { invoke } from "@tauri-apps/api/core";
import {
  BarChart3,
  CreditCard,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlPlane } from "@/hooks/use-control-plane";
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type {
  EntitlementSnapshot,
  RuntimeConfigStatus,
  TeamRole,
} from "@/types";
import { AdminAuditTab } from "./admin/admin-audit-tab";
import { AdminBillingTab } from "./admin/admin-billing-tab";

import { AdminOverviewTab } from "./admin/admin-overview-tab";
import { AdminSystemTab } from "./admin/admin-system-tab";
import {
  AdminWorkspaceTab,
  type WorkspaceAdminFlow,
} from "./admin/admin-workspace-tab";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface PlatformAdminWorkspaceProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
  platformRole?: string;
  teamRole?: TeamRole | null;
  sidebarTab?: AdminTab;
  workspaceFlow?: WorkspaceAdminFlow | null;
  showWorkspaceFlowTabs?: boolean;
  workspaceScopedOnly?: boolean;
  workspaceContextId?: string | null;
  onWorkspaceContextChange?: (workspaceId: string) => void;
}

type AdminTab =
  | "overview"
  | "workspace"
  | "billing"
  | "audit"
  | "system"
  | "analytics";
const INVITABLE_ROLES: TeamRole[] = ["member", "viewer"];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function PlatformAdminWorkspace({
  runtimeConfig,
  entitlement,
  platformRole,
  teamRole,
  sidebarTab,
  workspaceFlow,
  showWorkspaceFlowTabs,
  workspaceScopedOnly = false,
  workspaceContextId,
  onWorkspaceContextChange,
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

  const {
    runtime,
    isLoading,
    error,
    clearError,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    overview,
    memberships,
    invites,
    shareGrants,
    coupons,
    auditLogs,
    adminOverview,
    serverConfigStatus,
    setSelectedWorkspaceId,
    refreshRuntime,
    refreshWorkspaceList,
    refreshWorkspaceDetails,
    refreshAdminData,
    refreshServerConfigStatus,
    createWorkspace,
    createInvite,
    revokeInvite,
    updateMembershipRole,
    removeMembership,
    createShareGrant,
    revokeShareGrant,
    createCoupon,
    revokeCoupon,
  } = useControlPlane();

  const isBusy = isLoading || isCreatingWorkspace || isUpdatingEntitlement;
  const isPlatformAdmin = platformRole === "platform_admin";
  const isTeamOperator = teamRole === "owner" || teamRole === "admin";

  const availableTabs = useMemo<AdminTab[]>(() => {
    if (workspaceScopedOnly) {
      return ["overview", "workspace"];
    }
    if (isPlatformAdmin)
      return [
        "overview",
        "workspace",
        "billing",
        "system",
        "audit",
        "analytics",
      ];
    if (isTeamOperator) return ["overview", "workspace", "analytics"];
    return ["overview", "workspace", "analytics"];
  }, [isPlatformAdmin, isTeamOperator, workspaceScopedOnly]);

  const [internalActiveTab, setInternalActiveTab] =
    useState<AdminTab>("overview");
  const showInternalNavigation = !sidebarTab;

  const activeTab = useMemo<AdminTab>(() => {
    if (sidebarTab && availableTabs.includes(sidebarTab)) return sidebarTab;
    if (availableTabs.includes(internalActiveTab)) return internalActiveTab;
    return availableTabs[0];
  }, [availableTabs, internalActiveTab, sidebarTab]);

  useEffect(() => {
    if (!showInternalNavigation) return;
    if (!availableTabs.includes(internalActiveTab))
      setInternalActiveTab(availableTabs[0]);
  }, [availableTabs, internalActiveTab, showInternalNavigation]);

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
  const panelTitle = isPlatformAdmin
    ? t("adminWorkspace.panel.platformTitle")
    : t("adminWorkspace.panel.workspaceTitle");
  const panelDescription = isPlatformAdmin
    ? t("adminWorkspace.subtitle")
    : t("adminWorkspace.workspaceSubtitle");
  const workspaceGovernanceScope = isPlatformAdmin
    ? t("adminWorkspace.ui.scopePlatform")
    : isTeamOperator
      ? t("adminWorkspace.ui.scopeTeam")
      : t("adminWorkspace.ui.scopeReadOnly");
  const contextPanelTitle = workspaceScopedOnly
    ? t("shell.sections.workspaceGovernance")
    : t("shell.sections.adminPanel");
  const contextPanelDescription = workspaceScopedOnly
    ? t("adminWorkspace.ui.workspaceOpsDescription")
    : t("adminWorkspace.ui.workspaceDirectoryOpsDescription");

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

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        if (showInternalNavigation) setInternalActiveTab(value as AdminTab);
      }}
      className={
        showInternalNavigation
          ? "grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)] max-w-[1400px] mx-auto"
          : "space-y-4 max-w-[1400px] mx-auto"
      }
    >
      {showInternalNavigation && (
        <div className="flex flex-col gap-6 sticky top-6">
          <div className="px-2">
            <h2 className="text-[16px] font-semibold tracking-tight">
              {panelTitle}
            </h2>
            <p className="text-[12px] text-muted-foreground mt-1">
              {panelDescription}
            </p>
          </div>

          <TabsList className="flex flex-col h-auto w-full gap-1.5 bg-transparent p-0">
            {availableTabs.includes("overview") && (
              <TabsTrigger
                value="overview"
                className="justify-start gap-3 px-3.5 py-2.5 h-10 text-[13px] w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/20"
              >
                <BarChart3 className="w-4 h-4 opacity-70" />
                {t("adminWorkspace.tabs.overview")}
              </TabsTrigger>
            )}
            {availableTabs.includes("workspace") && (
              <TabsTrigger
                value="workspace"
                className="justify-start gap-3 px-3.5 py-2.5 h-10 text-[13px] w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/20"
              >
                <Users className="w-4 h-4 opacity-70" />
                {t("adminWorkspace.tabs.workspace")}
              </TabsTrigger>
            )}
            {availableTabs.includes("billing") && (
              <TabsTrigger
                value="billing"
                className="justify-start gap-3 px-3.5 py-2.5 h-10 text-[13px] w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/20"
              >
                <CreditCard className="w-4 h-4 opacity-70" />
                {t("adminWorkspace.tabs.billing")}
              </TabsTrigger>
            )}
            {availableTabs.includes("system") && (
              <TabsTrigger
                value="system"
                className="justify-start gap-3 px-3.5 py-2.5 h-10 text-[13px] w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/20"
              >
                <ShieldCheck className="w-4 h-4 opacity-70" />
                {t("adminWorkspace.tabs.system")}
              </TabsTrigger>
            )}
            {availableTabs.includes("audit") && (
              <TabsTrigger
                value="audit"
                className="justify-start gap-3 px-3.5 py-2.5 h-10 text-[13px] w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/20"
              >
                <FileText className="w-4 h-4 opacity-70" />
                {t("adminWorkspace.tabs.audit")}
              </TabsTrigger>
            )}
            {availableTabs.includes("analytics") && (
              <TabsTrigger
                value="analytics"
                className="justify-start gap-3 px-3.5 py-2.5 h-10 text-[13px] w-full rounded-lg text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:font-medium data-[state=active]:shadow-none border border-transparent data-[state=active]:border-primary/20"
              >
                <BarChart3 className="w-4 h-4 opacity-70" />
                {t("adminWorkspace.tabs.analytics")}
              </TabsTrigger>
            )}
          </TabsList>

          <Card className="shadow-none border-border/40 bg-card rounded-xl overflow-hidden mt-4">
            <div className="h-1 w-full bg-gradient-to-r from-primary/40 to-primary" />
            <CardContent className="p-4 bg-muted/10">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t("adminWorkspace.ui.currentWorkspace")}
              </p>
              <p className="mt-1.5 text-[14px] font-semibold text-foreground line-clamp-1">
                {selectedWorkspace?.name ??
                  t("adminWorkspace.controlPlane.noWorkspaceSelected")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="space-y-4 pt-1 pb-10 min-w-0">
        {!showInternalNavigation && (
          <Card className="border-border/70 shadow-none">
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    {contextPanelTitle}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {contextPanelDescription}
                  </p>
                  <p className="text-[14px] font-semibold text-foreground">
                    {selectedWorkspace?.name ??
                      t("adminWorkspace.controlPlane.noWorkspaceSelected")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <TabsList className="h-6 rounded-md bg-muted/30 px-1 text-[10px]">
                    <TabsTrigger
                      value={activeTab}
                      className="h-5 cursor-default px-2 py-0 text-[10px] data-[state=active]:bg-background"
                      disabled
                    >
                      {t(`adminWorkspace.tabs.${activeTab}`)}
                    </TabsTrigger>
                  </TabsList>
                  <span className="rounded-md border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {workspaceGovernanceScope}
                  </span>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.ui.currentWorkspace")}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-foreground">
                    {selectedWorkspace?.name ??
                      t("adminWorkspace.controlPlane.noWorkspaceSelected")}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.ui.workspaceId")}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-foreground">
                    {selectedWorkspaceId ?? "-"}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.ui.snapshotEntitlement")}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold text-foreground">
                    {entitlementLabel}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        <TabsContent value="overview" className="mt-0 outline-none">
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
            authReady={authReady}
            stripeReady={stripeReady}
            syncReady={syncReady}
          />
        </TabsContent>

        <TabsContent value="workspace" className="mt-0 outline-none">
          <AdminWorkspaceTab
            isBusy={isBusy}
            runtimeBaseUrl={runtime.baseUrl}
            isPlatformAdmin={isPlatformAdmin}
            isTeamOperator={isTeamOperator}
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
            workspaceScopedOnly={workspaceScopedOnly}
            forcedFlow={workspaceFlow ?? undefined}
            showFlowTabs={showWorkspaceFlowTabs ?? true}
          />
        </TabsContent>

        <TabsContent value="billing" className="mt-0 outline-none">
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
        </TabsContent>

        <TabsContent value="system" className="mt-0 outline-none">
          <AdminSystemTab
            isPlatformAdmin={isPlatformAdmin}
            isBusy={isBusy}
            refreshServerConfigStatus={refreshServerConfigStatus}
            authReady={authReady}
            stripeReady={stripeReady}
            syncReady={syncReady}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-0 outline-none">
          <AdminAuditTab
            isPlatformAdmin={isPlatformAdmin}
            isBusy={isBusy}
            refreshAdminData={refreshAdminData}
            auditLogs={auditLogs}
          />
        </TabsContent>

        <TabsContent value="analytics" className="mt-0 outline-none">
          <Card className="border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-[14px] font-semibold">
                {t("adminWorkspace.modules.analytics.title")}
              </CardTitle>
              <CardDescription className="text-[12px]">
                {t("adminWorkspace.modules.analytics.description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.metrics.workspaces")}
                </p>
                <p className="mt-1 text-[18px] font-semibold text-foreground">
                  {adminOverview?.workspaces ?? workspaces.length}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.metrics.members")}
                </p>
                <p className="mt-1 text-[18px] font-semibold text-foreground">
                  {adminOverview?.members ?? memberships.length}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.metrics.invites")}
                </p>
                <p className="mt-1 text-[18px] font-semibold text-foreground">
                  {adminOverview?.activeInvites ?? invites.length}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background p-3">
                <p className="text-[12px] text-muted-foreground">
                  {t("adminWorkspace.metrics.audits24h")}
                </p>
                <p className="mt-1 text-[18px] font-semibold text-foreground">
                  {adminOverview?.auditsLast24h ?? auditLogs.length}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </div>
    </Tabs>
  );
}
