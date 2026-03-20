"use client";

import { invoke } from "@tauri-apps/api/core";
import {
  BarChart3,
  CreditCard,
  FileText,
  RefreshCcw,
  ShieldCheck,
  Sliders,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useControlPlane } from "@/hooks/use-control-plane";
import type { EntitlementSnapshot, RuntimeConfigStatus, TeamRole } from "@/types";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface PlatformAdminWorkspaceProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
}

type ModuleCard = {
  id: string;
  icon: typeof Users;
  titleKey: string;
  descriptionKey: string;
};

const MODULE_CARDS: ModuleCard[] = [
  {
    id: "workspaceUsers",
    icon: Users,
    titleKey: "adminWorkspace.modules.workspaceUsers.title",
    descriptionKey: "adminWorkspace.modules.workspaceUsers.description",
  },
  {
    id: "billingEntitlement",
    icon: CreditCard,
    titleKey: "adminWorkspace.modules.billingEntitlement.title",
    descriptionKey: "adminWorkspace.modules.billingEntitlement.description",
  },
  {
    id: "coupon",
    icon: Sliders,
    titleKey: "adminWorkspace.modules.coupon.title",
    descriptionKey: "adminWorkspace.modules.coupon.description",
  },
  {
    id: "audit",
    icon: FileText,
    titleKey: "adminWorkspace.modules.audit.title",
    descriptionKey: "adminWorkspace.modules.audit.description",
  },
  {
    id: "systemConfig",
    icon: ShieldCheck,
    titleKey: "adminWorkspace.modules.systemConfig.title",
    descriptionKey: "adminWorkspace.modules.systemConfig.description",
  },
  {
    id: "analytics",
    icon: BarChart3,
    titleKey: "adminWorkspace.modules.analytics.title",
    descriptionKey: "adminWorkspace.modules.analytics.description",
  },
];

export function PlatformAdminWorkspace({
  runtimeConfig,
  entitlement,
}: PlatformAdminWorkspaceProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<"personal" | "team">(
    "team",
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("member");
  const [shareResourceType, setShareResourceType] =
    useState<"profile" | "group">("profile");
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

  useEffect(() => {
    const nextDrafts: Record<string, TeamRole> = {};
    for (const member of memberships) {
      nextDrafts[member.userId] = member.role;
    }
    setMembershipRoleDrafts(nextDrafts);
  }, [memberships]);

  const configSummary = useMemo(() => {
    if (!runtimeConfig) {
      return t("adminWorkspace.status.unknown");
    }

    const issues: string[] = [];
    if (runtimeConfig.auth === "pending_config") {
      issues.push(t("adminWorkspace.status.authPending"));
    }
    if (runtimeConfig.stripe === "pending_config") {
      issues.push(t("adminWorkspace.status.stripePending"));
    }
    if (runtimeConfig.s3_sync === "pending_config") {
      issues.push(t("adminWorkspace.status.syncPending"));
    }

    if (issues.length === 0) {
      return t("adminWorkspace.status.allReady");
    }

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
    if (!runtime.baseUrl) {
      return t("adminWorkspace.controlPlane.pending");
    }
    if (!serverConfigStatus) {
      return t("adminWorkspace.controlPlane.securityUnknown");
    }
    const tokenStatus = serverConfigStatus.control.controlApiTokenConfigured
      ? t("adminWorkspace.controlPlane.controlTokenReady")
      : t("adminWorkspace.controlPlane.controlTokenPending");
    const stateFileStatus = serverConfigStatus.control.controlStateFileConfigured
      ? t("adminWorkspace.controlPlane.stateFileReady")
      : t("adminWorkspace.controlPlane.stateFilePending");
    return `${tokenStatus} • ${stateFileStatus}`;
  }, [runtime.baseUrl, serverConfigStatus, t]);

  const handleSetEntitlement = async (
    nextState: "active" | "grace_active" | "read_only",
  ) => {
    if (!reason.trim()) {
      showErrorToast(t("adminWorkspace.reasonRequired"));
      return;
    }

    try {
      setIsUpdatingEntitlement(true);
      await invoke("set_entitlement_state", {
        state: nextState,
        reason,
      });
      showSuccessToast(t("adminWorkspace.entitlementUpdated"));
    } catch {
      showErrorToast(t("adminWorkspace.entitlementUpdateFailed"));
    } finally {
      setIsUpdatingEntitlement(false);
    }
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

  const requireWorkspaceAndReason = () => {
    if (!selectedWorkspaceId) {
      showErrorToast(t("adminWorkspace.controlPlane.workspaceSelectRequired"));
      return null;
    }
    if (!reason.trim()) {
      showErrorToast(t("adminWorkspace.reasonRequired"));
      return null;
    }
    return selectedWorkspaceId;
  };

  const handleCreateInvite = async () => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) {
      return;
    }
    if (!inviteEmail.trim()) {
      showErrorToast(t("adminWorkspace.members.inviteEmailRequired"));
      return;
    }

    try {
      await createInvite(workspaceId, inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      showSuccessToast(t("adminWorkspace.members.inviteCreated"));
    } catch {
      showErrorToast(t("adminWorkspace.members.inviteCreateFailed"));
    }
  };

  const handleUpdateRole = async (targetUserId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) {
      return;
    }

    const nextRole = membershipRoleDrafts[targetUserId];
    if (!nextRole) {
      return;
    }

    try {
      await updateMembershipRole(workspaceId, targetUserId, nextRole, reason.trim());
      showSuccessToast(t("adminWorkspace.members.roleUpdated"));
    } catch {
      showErrorToast(t("adminWorkspace.members.roleUpdateFailed"));
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) {
      return;
    }

    try {
      await removeMembership(workspaceId, targetUserId, reason.trim());
      showSuccessToast(t("adminWorkspace.members.memberRemoved"));
    } catch {
      showErrorToast(t("adminWorkspace.members.memberRemoveFailed"));
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) {
      return;
    }

    try {
      await revokeInvite(workspaceId, inviteId, reason.trim());
      showSuccessToast(t("adminWorkspace.members.inviteRevoked"));
    } catch {
      showErrorToast(t("adminWorkspace.members.inviteRevokeFailed"));
    }
  };

  const handleCreateShare = async () => {
    const workspaceId = requireWorkspaceAndReason();
    if (!workspaceId) {
      return;
    }
    if (!shareResourceId.trim() || !shareRecipientEmail.trim()) {
      showErrorToast(t("adminWorkspace.share.fieldsRequired"));
      return;
    }

    try {
      await createShareGrant(
        workspaceId,
        shareResourceType,
        shareResourceId.trim(),
        shareRecipientEmail.trim(),
        reason.trim(),
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
    if (!workspaceId) {
      return;
    }

    try {
      await revokeShareGrant(workspaceId, shareGrantId, reason.trim());
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

    const discount = Number(couponDiscount);
    const maxRedemptions = Number(couponMaxRedemptions);

    if (!Number.isFinite(discount) || !Number.isFinite(maxRedemptions)) {
      showErrorToast(t("adminWorkspace.billing.couponInvalidNumber"));
      return;
    }

    try {
      const parseList = (value: string) =>
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

      await createCoupon({
        code: couponCode.trim(),
        source: couponSource,
        discountPercent: discount,
        maxRedemptions,
        expiresAt: new Date(couponExpiresAt).toISOString(),
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
    if (!reason.trim()) {
      showErrorToast(t("adminWorkspace.reasonRequired"));
      return;
    }

    try {
      await revokeCoupon(couponId, reason.trim());
      showSuccessToast(t("adminWorkspace.billing.couponRevoked"));
    } catch {
      showErrorToast(t("adminWorkspace.billing.couponRevokeFailed"));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("adminWorkspace.overview.title")}</CardTitle>
          <CardDescription>{t("adminWorkspace.overview.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-md border border-border bg-card p-3 xl:col-span-2">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.configStatus")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{configSummary}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 xl:col-span-2">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.entitlement")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{entitlementLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 xl:col-span-2">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.controlPlane")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">{controlPlaneStatus}</p>
            <p className="mt-1 text-xs text-muted-foreground">{controlSecuritySummary}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3 xl:col-span-2">
            <div className="text-xs text-muted-foreground">
              {t("adminWorkspace.overview.auditRetention")}
            </div>
            <p className="mt-2 text-sm font-medium text-foreground">
              {t("adminWorkspace.overview.auditRetentionValue")}
            </p>
          </div>
          {adminOverview && (
            <>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{t("adminWorkspace.metrics.workspaces")}</div>
                <p className="mt-2 text-sm font-medium text-foreground">{adminOverview.workspaces}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{t("adminWorkspace.metrics.members")}</div>
                <p className="mt-2 text-sm font-medium text-foreground">{adminOverview.members}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{t("adminWorkspace.metrics.invites")}</div>
                <p className="mt-2 text-sm font-medium text-foreground">{adminOverview.activeInvites}</p>
              </div>
              <div className="rounded-md border border-border bg-card p-3">
                <div className="text-xs text-muted-foreground">{t("adminWorkspace.metrics.audits24h")}</div>
                <p className="mt-2 text-sm font-medium text-foreground">{adminOverview.auditsLast24h}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("adminWorkspace.controlPlane.title")}</CardTitle>
          <CardDescription>{t("adminWorkspace.controlPlane.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refreshRuntime();
                void refreshWorkspaceList();
                void refreshAdminData();
                void refreshServerConfigStatus();
              }}
              disabled={isBusy}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${isBusy ? "animate-spin" : ""}`} />
              {t("common.buttons.refresh")}
            </Button>
            {error && (
              <Badge variant="secondary" className="max-w-full truncate">
                {error}
              </Badge>
            )}
            {error && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearError}
              >
                {t("common.buttons.clear")}
              </Button>
            )}
          </div>

          {!runtime.baseUrl ? (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("adminWorkspace.controlPlane.pendingHelp")}
            </div>
          ) : (
            <Tabs defaultValue="workspace">
              <TabsList>
                <TabsTrigger value="workspace">{t("adminWorkspace.tabs.workspace")}</TabsTrigger>
                <TabsTrigger value="billing">{t("adminWorkspace.tabs.billing")}</TabsTrigger>
                <TabsTrigger value="audit">{t("adminWorkspace.tabs.audit")}</TabsTrigger>
              </TabsList>

              <TabsContent value="workspace" className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_160px_auto]">
                  <Input
                    value={workspaceName}
                    onChange={(event) => {
                      setWorkspaceName(event.target.value);
                    }}
                    placeholder={t("adminWorkspace.controlPlane.workspaceNamePlaceholder")}
                    disabled={isBusy}
                  />
                  <Select
                    value={workspaceMode}
                    onValueChange={(value) => {
                      setWorkspaceMode(value as "personal" | "team");
                    }}
                    disabled={isBusy}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">{t("adminWorkspace.controlPlane.modeTeam")}</SelectItem>
                      <SelectItem value="personal">{t("adminWorkspace.controlPlane.modePersonal")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      void handleCreateWorkspace();
                    }}
                  >
                    {t("common.buttons.create")}
                  </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("adminWorkspace.controlPlane.workspaceList")}
                    </div>
                    <Select
                      value={selectedWorkspaceId ?? undefined}
                      onValueChange={(value) => {
                        setSelectedWorkspaceId(value);
                      }}
                      disabled={isBusy}
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={t("adminWorkspace.controlPlane.workspaceSelectPlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("adminWorkspace.controlPlane.workspaceCount", {
                        count: workspaces.length,
                      })}
                    </p>
                  </div>

                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">
                      {t("adminWorkspace.controlPlane.workspaceDetails")}
                    </div>
                    {selectedWorkspace && overview ? (
                      <div className="space-y-1 text-sm text-foreground">
                        <p>
                          {t("adminWorkspace.controlPlane.modeLabel")}: {selectedWorkspace.mode}
                        </p>
                        <p>
                          {t("adminWorkspace.controlPlane.memberCount", {
                            count: overview.members,
                          })}
                        </p>
                        <p>
                          {t("adminWorkspace.controlPlane.inviteCount", {
                            count: overview.activeInvites,
                          })}
                        </p>
                        <p>
                          {t("adminWorkspace.controlPlane.shareCount", {
                            count: overview.activeShareGrants,
                          })}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("adminWorkspace.controlPlane.noWorkspaceSelected")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-card p-3">
                  <div className="text-xs text-muted-foreground">
                    {t("adminWorkspace.reasonLabel")}
                  </div>
                  <Input
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                    }}
                    placeholder={t("adminWorkspace.reasonPlaceholder")}
                    disabled={isBusy}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div className="mb-1 text-xs text-muted-foreground">
                      {t("adminWorkspace.members.title")}
                    </div>
                    <ScrollArea className="h-44 pr-2">
                      <div className="space-y-2">
                        {memberships.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("adminWorkspace.controlPlane.noMembers")}
                          </p>
                        ) : (
                          memberships.map((member) => (
                            <div
                              key={member.userId}
                              className="rounded-md border border-border bg-muted p-2"
                            >
                              <div className="text-xs text-foreground">{member.email}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Select
                                  value={membershipRoleDrafts[member.userId] ?? member.role}
                                  onValueChange={(value) => {
                                    setMembershipRoleDrafts((prev) => ({
                                      ...prev,
                                      [member.userId]: value as TeamRole,
                                    }));
                                  }}
                                  disabled={isBusy}
                                >
                                  <SelectTrigger className="h-8 w-[130px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="owner">owner</SelectItem>
                                    <SelectItem value="admin">admin</SelectItem>
                                    <SelectItem value="member">member</SelectItem>
                                    <SelectItem value="viewer">viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleUpdateRole(member.userId);
                                  }}
                                >
                                  {t("adminWorkspace.members.updateRole")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleRemoveMember(member.userId);
                                  }}
                                >
                                  {t("adminWorkspace.members.removeMember")}
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-2 rounded-md border border-border bg-card p-3">
                    <div className="mb-1 text-xs text-muted-foreground">
                      {t("adminWorkspace.members.invites")}
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_130px_auto]">
                      <Input
                        value={inviteEmail}
                        onChange={(event) => {
                          setInviteEmail(event.target.value);
                        }}
                        placeholder={t("adminWorkspace.members.inviteEmailPlaceholder")}
                        disabled={isBusy}
                      />
                      <Select
                        value={inviteRole}
                        onValueChange={(value) => {
                          setInviteRole(value as TeamRole);
                        }}
                        disabled={isBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="member">member</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          void handleCreateInvite();
                        }}
                      >
                        {t("common.buttons.add")}
                      </Button>
                    </div>
                    <ScrollArea className="h-36 pr-2">
                      <div className="space-y-2">
                        {invites.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("adminWorkspace.controlPlane.noInvites")}
                          </p>
                        ) : (
                          invites.map((invite) => (
                            <div
                              key={invite.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted p-2"
                            >
                              <div>
                                <p className="text-xs text-foreground">{invite.email}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {invite.role} • {invite.consumedAt ? t("adminWorkspace.members.inviteUsed") : t("adminWorkspace.members.invitePending")}
                                </p>
                              </div>
                              {!invite.consumedAt && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleRevokeInvite(invite.id);
                                  }}
                                >
                                  {t("adminWorkspace.members.revokeInvite")}
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-card p-3">
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("adminWorkspace.share.title")}
                  </div>
                  <div className="grid gap-2 md:grid-cols-[130px_1fr_1fr_auto]">
                    <Select
                      value={shareResourceType}
                      onValueChange={(value) => {
                        setShareResourceType(value as "profile" | "group");
                      }}
                      disabled={isBusy}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profile">profile</SelectItem>
                        <SelectItem value="group">group</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={shareResourceId}
                      onChange={(event) => {
                        setShareResourceId(event.target.value);
                      }}
                      placeholder={t("adminWorkspace.share.resourceIdPlaceholder")}
                      disabled={isBusy}
                    />
                    <Input
                      value={shareRecipientEmail}
                      onChange={(event) => {
                        setShareRecipientEmail(event.target.value);
                      }}
                      placeholder={t("adminWorkspace.share.recipientPlaceholder")}
                      disabled={isBusy}
                    />
                    <Button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        void handleCreateShare();
                      }}
                    >
                      {t("common.buttons.grant")}
                    </Button>
                  </div>
                  <ScrollArea className="h-36 pr-2">
                    <div className="space-y-2">
                      {shareGrants.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("adminWorkspace.share.none")}
                        </p>
                      ) : (
                        shareGrants.map((share) => (
                          <div
                            key={share.id}
                            className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted p-2"
                          >
                            <div>
                              <p className="text-xs text-foreground">
                                {share.resourceType}:{share.resourceId} → {share.recipientEmail}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {share.accessMode} • {share.revokedAt ? t("adminWorkspace.share.revokedStatus") : t("adminWorkspace.share.activeStatus")}
                              </p>
                            </div>
                            {!share.revokedAt && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => {
                                  void handleRevokeShare(share.id);
                                }}
                              >
                                {t("adminWorkspace.share.revoke")}
                              </Button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="billing" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("adminWorkspace.entitlementControl.title")}</CardTitle>
                    <CardDescription>{t("adminWorkspace.entitlementControl.description")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                      }}
                      placeholder={t("adminWorkspace.entitlementControl.reasonPlaceholder")}
                      disabled={isBusy}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => {
                          void handleSetEntitlement("active");
                        }}
                      >
                        {t("adminWorkspace.entitlementControl.setActive")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => {
                          void handleSetEntitlement("grace_active");
                        }}
                      >
                        {t("adminWorkspace.entitlementControl.setGrace")}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isBusy}
                        onClick={() => {
                          void handleSetEntitlement("read_only");
                        }}
                      >
                        {t("adminWorkspace.entitlementControl.setReadOnly")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("adminWorkspace.billing.couponTitle")}</CardTitle>
                    <CardDescription>{t("adminWorkspace.billing.couponDescription")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <Input
                        value={couponCode}
                        onChange={(event) => {
                          setCouponCode(event.target.value);
                        }}
                        placeholder={t("adminWorkspace.billing.couponCode")}
                        disabled={isBusy}
                      />
                      <Select
                        value={couponSource}
                        onValueChange={(value) => {
                          setCouponSource(value as "internal" | "stripe");
                        }}
                        disabled={isBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal">internal</SelectItem>
                          <SelectItem value="stripe">stripe</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={couponDiscount}
                        onChange={(event) => {
                          setCouponDiscount(event.target.value);
                        }}
                        placeholder={t("adminWorkspace.billing.couponDiscount")}
                        disabled={isBusy}
                      />
                      <Input
                        value={couponMaxRedemptions}
                        onChange={(event) => {
                          setCouponMaxRedemptions(event.target.value);
                        }}
                        placeholder={t("adminWorkspace.billing.couponMax")}
                        disabled={isBusy}
                      />
                      <Input
                        type="datetime-local"
                        value={couponExpiresAt}
                        onChange={(event) => {
                          setCouponExpiresAt(event.target.value);
                        }}
                        disabled={isBusy}
                      />
                      <Input
                        value={couponAllowlist}
                        onChange={(event) => {
                          setCouponAllowlist(event.target.value);
                        }}
                        placeholder={t("adminWorkspace.billing.couponAllowlist")}
                        disabled={isBusy}
                      />
                      <Input
                        value={couponDenylist}
                        onChange={(event) => {
                          setCouponDenylist(event.target.value);
                        }}
                        placeholder={t("adminWorkspace.billing.couponDenylist")}
                        disabled={isBusy}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          void handleCreateCoupon();
                        }}
                      >
                        {t("adminWorkspace.billing.createCoupon")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => {
                          void refreshAdminData();
                        }}
                      >
                        {t("common.buttons.refresh")}
                      </Button>
                    </div>
                    <ScrollArea className="h-44 pr-2">
                      <div className="space-y-2">
                        {coupons.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("adminWorkspace.billing.noCoupons")}
                          </p>
                        ) : (
                          coupons.map((coupon) => (
                            <div
                              key={coupon.id}
                              className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted p-2"
                            >
                              <div>
                                <p className="text-xs text-foreground">
                                  {coupon.code} • {coupon.discountPercent}%
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  {coupon.redeemedCount}/{coupon.maxRedemptions || "∞"} • {coupon.revokedAt ? t("adminWorkspace.billing.revokedStatus") : t("adminWorkspace.billing.activeStatus")}
                                </p>
                              </div>
                              {!coupon.revokedAt && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() => {
                                    void handleRevokeCoupon(coupon.id);
                                  }}
                                >
                                  {t("adminWorkspace.billing.revokeCoupon")}
                                </Button>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="audit" className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => {
                      void refreshAdminData();
                    }}
                  >
                    {t("common.buttons.refresh")}
                  </Button>
                </div>
                <ScrollArea className="h-[360px] rounded-md border border-border bg-card p-3">
                  <div className="space-y-2">
                    {auditLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("adminWorkspace.audit.none")}
                      </p>
                    ) : (
                      auditLogs.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-md border border-border bg-muted p-2"
                        >
                          <p className="text-xs font-medium text-foreground">{entry.action}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.actor} • {new Date(entry.createdAt).toLocaleString()}
                          </p>
                          {entry.reason && (
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {entry.reason}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {MODULE_CARDS.map((module) => {
          const Icon = module.icon;
          return (
            <Card key={module.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-muted text-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge variant="secondary">{t("adminWorkspace.modules.statusReady")}</Badge>
                </div>
                <CardTitle className="text-base">{t(module.titleKey)}</CardTitle>
                <CardDescription>{t(module.descriptionKey)}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
