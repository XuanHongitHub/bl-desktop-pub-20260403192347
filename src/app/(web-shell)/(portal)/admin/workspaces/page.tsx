"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getWorkspaceBillingState,
  overrideWorkspaceSubscriptionAsAdmin,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

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

export default function AdminWorkspacesPage() {
  const { t } = useTranslation();
  const { connection, workspaces, loadingWorkspaces, refreshWorkspaces } =
    usePortalBillingData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");

  const [isManageDialogOpen, setIsManageDialogOpen] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [formPlanId, setFormPlanId] = useState<
    "starter" | "growth" | "scale" | "custom"
  >("starter");
  const [formBillingCycle, setFormBillingCycle] = useState<
    "monthly" | "yearly"
  >("monthly");
  const [formProfileLimit, setFormProfileLimit] = useState("50");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formPlanLabel, setFormPlanLabel] = useState("");
  const [savingWorkspaceConfig, setSavingWorkspaceConfig] = useState(false);

  const filteredWorkspaces = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const matchStatus =
        statusFilter === "all"
          ? true
          : workspace.subscriptionStatus === statusFilter;
      const matchKeyword = keyword
        ? [workspace.name, workspace.planLabel, workspace.subscriptionStatus]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchStatus && matchKeyword;
    });
  }, [query, statusFilter, workspaces]);

  const activeCount = workspaces.filter(
    (w) => w.subscriptionStatus === "active",
  ).length;
  const pastDueCount = workspaces.filter(
    (w) => w.subscriptionStatus === "past_due",
  ).length;
  const canceledCount = workspaces.filter(
    (w) => w.subscriptionStatus === "canceled",
  ).length;

  const selectedWorkspace = useMemo(
    () =>
      selectedWorkspaceId
        ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
          null
        : null,
    [selectedWorkspaceId, workspaces],
  );

  const handleOpenManageDialog = async (workspaceId: string) => {
    const workspace = workspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      return;
    }

    setSelectedWorkspaceId(workspace.id);
    setFormBillingCycle(workspace.billingCycle ?? "monthly");
    setFormProfileLimit(String(workspace.profileLimit ?? 50));
    setFormPlanLabel(workspace.planLabel ?? "");
    setFormExpiresAt(toDatetimeLocalValue(workspace.expiresAt));

    const normalizedPlanLabel = workspace.planLabel.toLowerCase();
    if (normalizedPlanLabel.includes("growth")) {
      setFormPlanId("growth");
    } else if (normalizedPlanLabel.includes("scale")) {
      setFormPlanId("scale");
    } else if (normalizedPlanLabel.includes("custom")) {
      setFormPlanId("custom");
    } else {
      setFormPlanId("starter");
    }

    setIsManageDialogOpen(true);

    if (!connection) {
      return;
    }

    try {
      const state = await getWorkspaceBillingState(connection, workspace.id);
      if (!state?.subscription) {
        return;
      }
      if (state.subscription.planId) {
        setFormPlanId(state.subscription.planId);
      }
      if (state.subscription.billingCycle) {
        setFormBillingCycle(state.subscription.billingCycle);
      }
      setFormProfileLimit(String(state.subscription.profileLimit));
      setFormPlanLabel(state.subscription.planLabel ?? "");
      setFormExpiresAt(toDatetimeLocalValue(state.subscription.expiresAt));
    } catch {
      // Keep existing snapshot values if detailed billing fetch fails.
    }
  };

  const handleSaveWorkspaceSubscription = async () => {
    if (!connection || !selectedWorkspace) {
      showErrorToast(t("portalSite.admin.workspaces.errors.connectionMissing"));
      return;
    }

    const normalizedProfileLimit = Number.parseInt(formProfileLimit, 10);
    if (!Number.isFinite(normalizedProfileLimit) || normalizedProfileLimit <= 0) {
      showErrorToast(t("portalSite.admin.workspaces.errors.invalidProfileLimit"));
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
      await overrideWorkspaceSubscriptionAsAdmin(connection, selectedWorkspace.id, {
        planId: formPlanId,
        billingCycle: formBillingCycle,
        profileLimit: normalizedProfileLimit,
        expiresAt,
        planLabel: formPlanLabel.trim() || null,
      });
      await refreshWorkspaces();
      showSuccessToast(t("portalSite.admin.workspaces.toasts.subscriptionUpdated"));
      setIsManageDialogOpen(false);
    } catch (error) {
      showErrorToast(t("portalSite.admin.workspaces.errors.updateFailed"), {
        description:
          error instanceof Error
            ? error.message
            : "workspace_subscription_update_failed",
      });
    } finally {
      setSavingWorkspaceConfig(false);
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.workspaces.title")}
      description={t("portalSite.admin.workspaces.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refreshWorkspaces()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70">
        <div className="grid gap-0 md:grid-cols-3">
          <div className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.activeSubscriptions")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{activeCount}</p>
          </div>
          <div className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.pastDue")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{pastDueCount}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.workspaces.canceled")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{canceledCount}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portalSite.admin.workspaces.searchPlaceholder")}
            className="h-9 w-full sm:max-w-xs"
          />
          <div className="flex items-center gap-1">
            {(["all", "active", "past_due", "canceled"] as const).map(
              (status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? "secondary" : "outline"}
                  onClick={() => setStatusFilter(status)}
                  className="h-8 px-2.5 text-xs capitalize"
                >
                  {status === "all"
                    ? t("portalSite.admin.workspaces.allStatuses")
                    : status}
                </Button>
              ),
            )}
          </div>
          <Badge variant="outline" className="ml-auto">
            {filteredWorkspaces.length}
          </Badge>
        </div>

        {loadingWorkspaces ? (
          <p className="text-sm text-muted-foreground">{t("portalSite.admin.loading")}</p>
        ) : filteredWorkspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("portalSite.account.workspaceEmpty")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.workspace")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.plan")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.status")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.members")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.time")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWorkspaces.map((workspace) => (
                  <tr key={workspace.id} className="border-t border-border/70">
                    <td className="px-3 py-2 text-foreground">{workspace.name}</td>
                    <td className="px-3 py-2 text-foreground">{workspace.planLabel}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize">
                        {workspace.subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {workspace.profileLimit}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatLocaleDateTime(workspace.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleOpenManageDialog(workspace.id)}
                      >
                        {t("portalSite.admin.workspaces.actions.manage")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          {t("portalSite.admin.workspaces.tableDescription")}
        </p>
      </section>

      <Dialog
        open={isManageDialogOpen}
        onOpenChange={(nextOpen) => {
          setIsManageDialogOpen(nextOpen);
          if (!nextOpen) {
            setSelectedWorkspaceId(null);
          }
        }}
      >
        <DialogContent className="max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{t("portalSite.admin.workspaces.manage.title")}</DialogTitle>
            <DialogDescription>
              {t("portalSite.admin.workspaces.manage.description", {
                workspace: selectedWorkspace?.name ?? "--",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("portalSite.admin.workspaces.manage.plan")}
              </p>
              <Select
                value={formPlanId}
                onValueChange={(value) =>
                  setFormPlanId(value as "starter" | "growth" | "scale" | "custom")
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
                onValueChange={(value) => setFormBillingCycle(value as "monthly" | "yearly")}
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
                placeholder={t("portalSite.admin.workspaces.manage.planLabelPlaceholder")}
                disabled={savingWorkspaceConfig}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsManageDialogOpen(false)}
              disabled={savingWorkspaceConfig}
            >
              {t("common.buttons.cancel")}
            </Button>
            <Button
              onClick={() => void handleSaveWorkspaceSubscription()}
              disabled={savingWorkspaceConfig}
            >
              {t("portalSite.admin.workspaces.actions.saveSubscription")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PortalSettingsPage>
  );
}
