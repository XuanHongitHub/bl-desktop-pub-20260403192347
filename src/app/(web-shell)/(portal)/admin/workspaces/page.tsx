"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  createWorkspace,
  getAdminWorkspaceDetail,
  getWorkspaceBillingState,
  inviteWorkspaceMember,
  listAdminUsers,
  listAdminWorkspaces,
  overrideWorkspaceSubscriptionAsAdmin,
  transferAdminWorkspaceOwner,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import {
  getUnifiedPlanLabel,
  getUnifiedPlanToneClass,
  resolveUnifiedPlanId,
} from "@/lib/plan-display";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlAdminWorkspaceDetail } from "@/types";

function toDatetimeLocalValue(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  const hh = String(parsed.getHours()).padStart(2, "0");
  const mi = String(parsed.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminWorkspacesPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminWorkspaceDetail[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedDetail, setSelectedDetail] =
    useState<ControlAdminWorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");
  const [planFilter, setPlanFilter] = useState<
    "all" | "free" | "starter" | "team" | "scale" | "enterprise"
  >("all");
  const [formPlanId, setFormPlanId] = useState<
    "starter" | "team" | "scale" | "enterprise"
  >("starter");
  const [formBillingCycle, setFormBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [formProfileLimit, setFormProfileLimit] = useState("50");
  const [formMemberLimit, setFormMemberLimit] = useState("5");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formOwnerUserId, setFormOwnerUserId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">(
    "member",
  );
  const [inviteSuggestions, setInviteSuggestions] = useState<string[]>([]);
  const [invitingMember, setInvitingMember] = useState(false);
  const [createWorkspaceName, setCreateWorkspaceName] = useState("");
  const [createWorkspaceMode, setCreateWorkspaceMode] = useState<"team" | "personal">(
    "team",
  );
  const [createOwnerQuery, setCreateOwnerQuery] = useState("");
  const [createOwnerUserId, setCreateOwnerUserId] = useState("");
  const [createOwnerOptions, setCreateOwnerOptions] = useState<
    Array<{ userId: string; email: string }>
  >([]);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [savingWorkspaceConfig, setSavingWorkspaceConfig] = useState(false);

  const refresh = useCallback(
    async (keyword = query, targetPage = page) => {
      if (!connection) {
        setRows([]);
        setTotalRows(0);
        setSelectedWorkspaceId("");
        setSelectedDetail(null);
        return;
      }

      setLoading(true);
      try {
        const payload = await listAdminWorkspaces(connection, {
          q: keyword.trim() || undefined,
          page: targetPage,
          pageSize,
          status: statusFilter === "all" ? undefined : statusFilter,
          planIdFilter: planFilter === "all" ? undefined : planFilter,
        });
        const items = payload.items ?? [];
        setTotalRows(payload.total ?? items.length);
        setPage(payload.page ?? targetPage);
        setRows(items);
        setSelectedWorkspaceId((current) => {
          if (current && items.some((item) => item.workspaceId === current)) {
            return current;
          }
          return items[0]?.workspaceId ?? "";
        });
      } catch (error) {
        showErrorToast(t("portalSite.admin.workspaces.errors.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_workspaces_failed"),
        });
      } finally {
        setLoading(false);
      }
    },
    [connection, page, pageSize, planFilter, query, statusFilter, t],
  );

  const refreshDetail = useCallback(
    async (workspaceId: string) => {
      if (!connection || !workspaceId.trim()) {
        setSelectedDetail(null);
        return;
      }
      setDetailLoading(true);
      try {
        const detail = await getAdminWorkspaceDetail(connection, workspaceId);
        const billingState = await getWorkspaceBillingState(connection, workspaceId);
        setSelectedDetail(detail);
        setFormPlanId(billingState.subscription.planId ?? "starter");
        setFormBillingCycle(billingState.subscription.billingCycle ?? "monthly");
        setFormProfileLimit(String(billingState.subscription.profileLimit));
        setFormMemberLimit(String(billingState.subscription.memberLimit));
        setFormExpiresAt(toDatetimeLocalValue(billingState.subscription.expiresAt));
        setFormOwnerUserId(detail.owner?.userId ?? "");
      } catch (error) {
        setSelectedDetail(null);
        showErrorToast(t("portalSite.admin.workspaces.errors.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_workspace_detail_failed"),
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [connection, t],
  );

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, planFilter, pageSize]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(query, page);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setSelectedDetail(null);
      return;
    }
    void refreshDetail(selectedWorkspaceId);
  }, [refreshDetail, selectedWorkspaceId]);

  const handleSaveWorkspace = async () => {
    if (!connection || !selectedDetail) {
      showErrorToast(t("portalSite.admin.workspaces.errors.connectionMissing"));
      return;
    }

    const normalizedProfileLimit = Number.parseInt(formProfileLimit, 10);
    if (!Number.isFinite(normalizedProfileLimit) || normalizedProfileLimit <= 0) {
      showErrorToast(t("portalSite.admin.workspaces.errors.invalidProfileLimit"));
      return;
    }

    const normalizedMemberLimit = Number.parseInt(formMemberLimit, 10);
    if (!Number.isFinite(normalizedMemberLimit) || normalizedMemberLimit <= 0) {
      showErrorToast(t("portalSite.admin.workspaces.errors.invalidMemberLimit"));
      return;
    }

    let expiresAt: string | null = null;
    if (formExpiresAt.trim()) {
      const parsed = Date.parse(formExpiresAt.trim());
      if (!Number.isFinite(parsed) || parsed <= Date.now()) {
        showErrorToast(t("portalSite.admin.workspaces.errors.invalidExpiry"));
        return;
      }
      expiresAt = new Date(parsed).toISOString();
    }

    setSavingWorkspaceConfig(true);
    try {
      await overrideWorkspaceSubscriptionAsAdmin(connection, selectedDetail.workspaceId, {
        planId: formPlanId,
        billingCycle: formBillingCycle,
        profileLimit: normalizedProfileLimit,
        memberLimit: normalizedMemberLimit,
        expiresAt,
        planLabel: getUnifiedPlanLabel({ planId: formPlanId }),
      });

      if (
        formOwnerUserId.trim() &&
        formOwnerUserId.trim() !== (selectedDetail.owner?.userId ?? "")
      ) {
        await transferAdminWorkspaceOwner(
          connection,
          selectedDetail.workspaceId,
          formOwnerUserId.trim(),
          "updated_from_super_admin_workspace_panel",
        );
      }

      await Promise.all([
        refresh(query, page),
        refreshDetail(selectedDetail.workspaceId),
      ]);
      showSuccessToast(t("portalSite.admin.workspaces.toasts.subscriptionUpdated"));
    } catch (error) {
      showErrorToast(t("portalSite.admin.workspaces.errors.updateFailed"), {
        description: extractErrorMessage(error, "update_workspace_failed"),
      });
    } finally {
      setSavingWorkspaceConfig(false);
    }
  };

  useEffect(() => {
    if (!connection) {
      setCreateOwnerOptions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const payload = await listAdminUsers(connection, {
          q: createOwnerQuery.trim() || undefined,
          page: 1,
          pageSize: 20,
        });
        const items = (payload.items ?? []).map((item) => ({
          userId: item.userId,
          email: item.email,
        }));
        setCreateOwnerOptions(items);
      } catch {
        setCreateOwnerOptions([]);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [connection, createOwnerQuery]);

  useEffect(() => {
    if (!connection || !inviteEmail.trim()) {
      setInviteSuggestions([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const payload = await listAdminUsers(connection, {
          q: inviteEmail.trim(),
          page: 1,
          pageSize: 8,
        });
        const emails = (payload.items ?? [])
          .map((item) => item.email)
          .filter((value) => value.includes("@"));
        setInviteSuggestions(emails);
      } catch {
        setInviteSuggestions([]);
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [connection, inviteEmail]);

  const handleCreateWorkspace = async () => {
    if (!connection) {
      showErrorToast(t("portalSite.admin.workspaces.errors.connectionMissing"));
      return;
    }
    const name = createWorkspaceName.trim();
    if (!name) {
      showErrorToast(t("portalSite.admin.workspaces.errors.createNameRequired"));
      return;
    }
    setCreatingWorkspace(true);
    try {
      const created = await createWorkspace(connection, {
        name,
        mode: createWorkspaceMode,
      });
      if (createOwnerUserId.trim() && createOwnerUserId.trim() !== created.createdBy) {
        await transferAdminWorkspaceOwner(
          connection,
          created.id,
          createOwnerUserId.trim(),
          "created_from_super_admin_workspace_panel",
        );
      }
      setCreateWorkspaceName("");
      setCreateOwnerQuery("");
      setCreateOwnerUserId("");
      setPage(1);
      await refresh(name, 1);
      setSelectedWorkspaceId(created.id);
      showSuccessToast(t("portalSite.admin.workspaces.toasts.workspaceCreated"));
    } catch (error) {
      showErrorToast(t("portalSite.admin.workspaces.errors.createFailed"), {
        description: extractErrorMessage(error, "create_workspace_failed"),
      });
    } finally {
      setCreatingWorkspace(false);
    }
  };

  const handleInviteMember = async () => {
    if (!connection || !selectedDetail) {
      showErrorToast(t("portalSite.admin.workspaces.errors.connectionMissing"));
      return;
    }
    const normalizedEmail = inviteEmail.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      showErrorToast(t("portalSite.admin.workspaces.errors.inviteInvalidEmail"));
      return;
    }
    setInvitingMember(true);
    try {
      await inviteWorkspaceMember(connection, selectedDetail.workspaceId, {
        email: normalizedEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      setInviteSuggestions([]);
      await Promise.all([
        refreshDetail(selectedDetail.workspaceId),
        refresh(query, page),
      ]);
      showSuccessToast(t("portalSite.admin.workspaces.toasts.memberInvited"));
    } catch (error) {
      showErrorToast(t("portalSite.admin.workspaces.errors.inviteFailed"), {
        description: extractErrorMessage(error, "invite_workspace_member_failed"),
      });
    } finally {
      setInvitingMember(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: totalRows,
      visible: rows.length,
      highRisk: rows.filter((item) => item.riskLevel === "high").length,
      active: rows.filter((item) => item.subscriptionStatus === "active").length,
    }),
    [rows, totalRows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.workspaces.title")}
      description={t("portalSite.admin.workspaces.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh(query, page)}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto grid w-full max-w-[1320px] gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card">
          <div className="space-y-3 p-4">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_120px_120px_auto]">
              <Input
                value={createWorkspaceName}
                onChange={(event) => setCreateWorkspaceName(event.target.value)}
                placeholder={t("portalSite.admin.workspaces.create.name")}
                className="h-9"
                disabled={creatingWorkspace}
              />
              <Select
                value={createWorkspaceMode}
                onValueChange={(value) =>
                  setCreateWorkspaceMode(value as "team" | "personal")
                }
                disabled={creatingWorkspace}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">
                    {t("portalSite.admin.workspaces.create.modeTeam")}
                  </SelectItem>
                  <SelectItem value="personal">
                    {t("portalSite.admin.workspaces.create.modePersonal")}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={createOwnerUserId}
                onValueChange={setCreateOwnerUserId}
                disabled={creatingWorkspace}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={t("portalSite.admin.workspaces.create.owner")} />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1.5">
                    <Input
                      value={createOwnerQuery}
                      onChange={(event) => setCreateOwnerQuery(event.target.value)}
                      className="h-8"
                      placeholder={t("portalSite.admin.workspaces.create.ownerSearch")}
                    />
                  </div>
                  {createOwnerOptions.map((item) => (
                    <SelectItem key={item.userId} value={item.userId}>
                      {item.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => void handleCreateWorkspace()}
                disabled={creatingWorkspace}
                className="h-9"
              >
                {t("portalSite.admin.workspaces.create.action")}
              </Button>
            </div>

            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.workspaces.searchPlaceholder")}
              className="h-9"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "active", "past_due", "canceled"] as const).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? "secondary" : "outline"}
                  onClick={() => setStatusFilter(status)}
                  className="h-8 px-2.5 text-xs"
                >
                  {status === "all"
                    ? t("portalSite.admin.workspaces.allStatuses")
                    : status}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(
                ["all", "free", "starter", "team", "scale", "enterprise"] as const
              ).map((plan) => (
                <Button
                  key={plan}
                  size="sm"
                  variant={planFilter === plan ? "secondary" : "outline"}
                  onClick={() => setPlanFilter(plan)}
                  className="h-8 px-2.5 text-xs"
                >
                  {plan === "all"
                    ? t("portalSite.admin.workspaces.allPlans")
                    : getUnifiedPlanLabel({ planId: plan })}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-xs"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
              >
                {t("portalSite.admin.workspaces.pagination.prev")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2.5 text-xs"
                onClick={() => setPage((current) => current + 1)}
                disabled={loading || page * pageSize >= totalRows}
              >
                {t("portalSite.admin.workspaces.pagination.next")}
              </Button>
              <Badge variant="outline" className="ml-auto">
                {t("portalSite.admin.workspaces.pagination.page", { page })}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{summary.total}</Badge>
              <Badge variant="outline">{summary.visible}</Badge>
              <Badge variant="outline">{summary.active}</Badge>
              <Badge variant="secondary">{summary.highRisk}</Badge>
            </div>
          </div>
          <Separator />
          <ScrollArea className="h-[700px]">
            <div className="p-2">
              {loading ? (
                <div className="p-3 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">
                  {t("portalSite.account.workspaceEmpty")}
                </div>
              ) : (
                rows.map((workspace) => {
                  const selected = workspace.workspaceId === selectedWorkspaceId;
                  return (
                    <button
                      key={workspace.workspaceId}
                      type="button"
                      onClick={() => setSelectedWorkspaceId(workspace.workspaceId)}
                      className={[
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-border bg-muted"
                          : "border-transparent bg-background hover:border-border hover:bg-muted/60",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {workspace.workspaceName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {workspace.workspaceId}
                          </p>
                        </div>
                        <Badge
                          variant={workspace.riskLevel === "high" ? "destructive" : "outline"}
                          className="shrink-0 capitalize"
                        >
                          {workspace.riskLevel}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="font-normal">
                          <span
                            className={getUnifiedPlanToneClass(
                              resolveUnifiedPlanId({
                                planId: workspace.planId,
                                planLabel: workspace.planLabel,
                              }),
                            )}
                          >
                            {getUnifiedPlanLabel({
                              planId: workspace.planId,
                              planLabel: workspace.planLabel,
                            })}
                          </span>
                        </Badge>
                        <span>{workspace.members}</span>
                        <span>{workspace.profileLimit}</span>
                        <span>{workspace.memberLimit}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {!selectedWorkspaceId ? (
            <div className="flex min-h-[700px] items-center justify-center p-6 text-sm text-muted-foreground">
              {t("portalSite.admin.workspaces.panel.emptySelection")}
            </div>
          ) : detailLoading || !selectedDetail ? (
            <div className="flex min-h-[700px] items-center justify-center p-6 text-sm text-muted-foreground">
              {t("portalSite.admin.loading")}
            </div>
          ) : (
            <div className="grid min-h-[700px] grid-rows-[auto_minmax(0,1fr)]">
              <div className="grid gap-0 border-b border-border md:grid-cols-4">
                <div className="p-4">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.admin.columns.workspace")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedDetail.workspaceName}
                  </p>
                </div>
                <div className="p-4 md:border-l md:border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.admin.columns.status")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground capitalize">
                    {selectedDetail.subscriptionStatus}
                  </p>
                </div>
                <div className="p-4 md:border-l md:border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.admin.workspaces.panel.owner")}
                  </p>
                  <p className="mt-1 truncate text-sm font-medium text-foreground">
                    {selectedDetail.owner?.email ?? "--"}
                  </p>
                </div>
                <div className="p-4 md:border-l md:border-border">
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.admin.columns.time")}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {formatLocaleDateTime(selectedDetail.createdAt)}
                  </p>
                </div>
              </div>

              <div className="grid min-h-0 gap-0 xl:grid-cols-[minmax(0,1.1fr)_400px]">
                <div className="min-h-0">
                  <div className="grid gap-0 border-b border-border md:grid-cols-4">
                    <div className="p-4">
                      <p className="text-xs text-muted-foreground">
                        {t("portalSite.admin.workspaces.manage.profileLimit")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedDetail.profileLimit}
                      </p>
                    </div>
                    <div className="p-4 md:border-l md:border-border">
                      <p className="text-xs text-muted-foreground">
                        {t("portalSite.admin.workspaces.manage.memberLimit")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedDetail.memberLimit}
                      </p>
                    </div>
                    <div className="p-4 md:border-l md:border-border">
                      <p className="text-xs text-muted-foreground">
                        {t("portalSite.admin.columns.members")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedDetail.members}
                      </p>
                    </div>
                    <div className="p-4 md:border-l md:border-border">
                      <p className="text-xs text-muted-foreground">
                        {t("portalSite.admin.workspaces.panel.entitlement")}
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedDetail.entitlementState}
                      </p>
                    </div>
                  </div>

                  <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                    {t("portalSite.admin.workspaces.panel.memberships")}
                  </div>
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border">
                      {selectedDetail.memberships.map((membership) => (
                        <div
                          key={`${membership.workspaceId}:${membership.userId}`}
                          className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_112px_156px]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {membership.email}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {membership.userId}
                            </p>
                          </div>
                          <Badge variant="outline" className="w-fit capitalize">
                            {membership.role}
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            {formatLocaleDateTime(membership.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t border-border xl:border-l xl:border-t-0">
                  <div className="space-y-4 p-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {t("portalSite.admin.workspaces.manage.title")}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t("portalSite.admin.workspaces.manage.description", {
                          workspace: selectedDetail.workspaceName,
                        })}
                      </p>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.plan")}
                          </p>
                          <Select
                            value={formPlanId}
                            onValueChange={(value) =>
                              setFormPlanId(
                                value as "starter" | "team" | "scale" | "enterprise",
                              )
                            }
                            disabled={savingWorkspaceConfig}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="starter">
                                {getUnifiedPlanLabel({ planId: "starter" })}
                              </SelectItem>
                              <SelectItem value="team">
                                {getUnifiedPlanLabel({ planId: "team" })}
                              </SelectItem>
                              <SelectItem value="scale">
                                {getUnifiedPlanLabel({ planId: "scale" })}
                              </SelectItem>
                              <SelectItem value="enterprise">
                                {getUnifiedPlanLabel({ planId: "enterprise" })}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.billingCycle")}
                          </p>
                          <Select
                            value={formBillingCycle}
                            onValueChange={(value) =>
                              setFormBillingCycle(value as "monthly" | "yearly")
                            }
                            disabled={savingWorkspaceConfig}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">
                                {t("portalSite.admin.subscriptions.cycle.monthly")}
                              </SelectItem>
                              <SelectItem value="yearly">
                                {t("portalSite.admin.subscriptions.cycle.yearly")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.profileLimit")}
                          </p>
                          <Input
                            value={formProfileLimit}
                            onChange={(event) => setFormProfileLimit(event.target.value)}
                            type="number"
                            min={1}
                            className="h-9"
                            disabled={savingWorkspaceConfig}
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.memberLimit")}
                          </p>
                          <Input
                            value={formMemberLimit}
                            onChange={(event) => setFormMemberLimit(event.target.value)}
                            type="number"
                            min={1}
                            className="h-9"
                            disabled={savingWorkspaceConfig}
                          />
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.owner")}
                          </p>
                          <Select
                            value={formOwnerUserId}
                            onValueChange={setFormOwnerUserId}
                            disabled={savingWorkspaceConfig}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {selectedDetail.memberships.map((membership) => (
                                <SelectItem key={membership.userId} value={membership.userId}>
                                  {membership.email}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.expiresAt")}
                          </p>
                          <Input
                            value={formExpiresAt}
                            onChange={(event) => setFormExpiresAt(event.target.value)}
                            type="datetime-local"
                            className="h-9"
                            disabled={savingWorkspaceConfig}
                          />
                        </div>

                      </div>

                      <Button
                        onClick={() => void handleSaveWorkspace()}
                        disabled={savingWorkspaceConfig}
                      >
                        {t("portalSite.admin.workspaces.actions.saveSubscription")}
                      </Button>

                      <Separator />
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          {t("portalSite.admin.workspaces.actions.quickAddMember")}
                        </p>
                        <Input
                          value={inviteEmail}
                          onChange={(event) => setInviteEmail(event.target.value)}
                          className="h-9"
                          list="workspace-member-email-suggestions"
                          placeholder={t("portalSite.admin.workspaces.actions.memberEmail")}
                          disabled={invitingMember}
                        />
                        <datalist id="workspace-member-email-suggestions">
                          {inviteSuggestions.map((item) => (
                            <option key={item} value={item} />
                          ))}
                        </datalist>
                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                          <Select
                            value={inviteRole}
                            onValueChange={(value) =>
                              setInviteRole(value as "admin" | "member" | "viewer")
                            }
                            disabled={invitingMember}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                {t("portalSite.adminUsers.roles.admin")}
                              </SelectItem>
                              <SelectItem value="member">
                                {t("portalSite.adminUsers.roles.member")}
                              </SelectItem>
                              <SelectItem value="viewer">
                                {t("portalSite.adminUsers.roles.viewer")}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => void handleInviteMember()}
                            disabled={invitingMember}
                            className="h-9"
                          >
                            {t("portalSite.admin.workspaces.actions.invite")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />
                  <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
                    {t("portalSite.admin.workspaces.panel.activity")}
                  </div>
                  <ScrollArea className="h-[232px]">
                    <div className="divide-y divide-border">
                      {selectedDetail.recentAuditLogs.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">
                          {t("portalSite.admin.workspaces.panel.emptyActivity")}
                        </div>
                      ) : (
                        selectedDetail.recentAuditLogs.map((log) => (
                          <div key={log.id} className="space-y-1 px-4 py-3">
                            <p className="text-sm font-medium text-foreground">{log.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatLocaleDateTime(log.createdAt)}
                            </p>
                            {log.targetId ? (
                              <p className="text-xs text-muted-foreground">{log.targetId}</p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </PortalSettingsPage>
  );
}
