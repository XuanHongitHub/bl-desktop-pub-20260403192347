"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAdminWorkspaceDetail,
  getWorkspaceBillingState,
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
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");
  const [formPlanId, setFormPlanId] = useState<
    "starter" | "growth" | "scale" | "custom"
  >("starter");
  const [formBillingCycle, setFormBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [formProfileLimit, setFormProfileLimit] = useState("50");
  const [formMemberLimit, setFormMemberLimit] = useState("5");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formPlanLabel, setFormPlanLabel] = useState("");
  const [formOwnerUserId, setFormOwnerUserId] = useState("");
  const [savingWorkspaceConfig, setSavingWorkspaceConfig] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setRows([]);
        setSelectedWorkspaceId("");
        setSelectedDetail(null);
        return;
      }

      setLoading(true);
      try {
        const payload = await listAdminWorkspaces(connection, {
          q: keyword.trim() || undefined,
          page: 1,
          pageSize: 200,
        });
        const items = (payload.items ?? []).filter((item) =>
          statusFilter === "all" ? true : item.subscriptionStatus === statusFilter,
        );
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
    [connection, query, statusFilter, t],
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
        setFormPlanLabel(billingState.subscription.planLabel ?? detail.planLabel ?? "");
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
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, refresh, statusFilter]);

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
        planLabel: formPlanLabel.trim() || null,
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

      await Promise.all([refresh(query), refreshDetail(selectedDetail.workspaceId)]);
      showSuccessToast(t("portalSite.admin.workspaces.toasts.subscriptionUpdated"));
    } catch (error) {
      showErrorToast(t("portalSite.admin.workspaces.errors.updateFailed"), {
        description: extractErrorMessage(error, "update_workspace_failed"),
      });
    } finally {
      setSavingWorkspaceConfig(false);
    }
  };

  const summary = useMemo(
    () => ({
      total: rows.length,
      highRisk: rows.filter((item) => item.riskLevel === "high").length,
      active: rows.filter((item) => item.subscriptionStatus === "active").length,
    }),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.workspaces.title")}
      description={t("portalSite.admin.workspaces.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh(query)}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto grid w-full max-w-[1320px] gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card">
          <div className="space-y-3 p-4">
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
            <div className="flex items-center gap-2">
              <Badge variant="outline">{summary.total}</Badge>
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
                          {workspace.planLabel}
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
                                value as "starter" | "growth" | "scale" | "custom",
                              )
                            }
                            disabled={savingWorkspaceConfig}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="starter">Starter</SelectItem>
                              <SelectItem value="growth">Growth</SelectItem>
                              <SelectItem value="scale">Scale</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
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

                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-xs text-muted-foreground">
                            {t("portalSite.admin.workspaces.manage.planLabel")}
                          </p>
                          <Input
                            value={formPlanLabel}
                            onChange={(event) => setFormPlanLabel(event.target.value)}
                            className="h-9"
                            placeholder={t(
                              "portalSite.admin.workspaces.manage.planLabelPlaceholder",
                            )}
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
