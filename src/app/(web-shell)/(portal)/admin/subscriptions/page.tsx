"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { getUnifiedPlanLabel } from "@/lib/plan-display";

export default function AdminSubscriptionsPage() {
  const { t } = useTranslation();
  const { workspaces, loadingWorkspaces, refreshWorkspaces } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const matchStatus =
        statusFilter === "all" ? true : workspace.subscriptionStatus === statusFilter;
      const matchQuery = keyword
        ? [
            workspace.name,
            workspace.planLabel,
            workspace.subscriptionStatus,
            workspace.subscriptionSource,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchStatus && matchQuery;
    });
  }, [query, statusFilter, workspaces]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.subscriptions.title")}
      description={t("portalSite.admin.subscriptions.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refreshWorkspaces()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.subscriptions.metrics.total")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{filteredRows.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.subscriptions.metrics.active")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {filteredRows.filter((item) => item.subscriptionStatus === "active").length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.subscriptions.metrics.pastDue")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {filteredRows.filter((item) => item.subscriptionStatus === "past_due").length}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portalSite.admin.subscriptions.search")}
            className="h-9 w-full sm:max-w-sm"
          />
          <div className="flex items-center gap-1">
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
                  : t(`portalSite.admin.subscriptions.status.${status}`)}
              </Button>
            ))}
          </div>
        </div>

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
                  {t("portalSite.admin.subscriptions.columns.source")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.status")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.subscriptions.columns.expiresAt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loadingWorkspaces ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.admin.subscriptions.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((workspace) => (
                  <tr key={workspace.id} className="border-t border-border/70">
                    <td className="px-3 py-2 text-foreground">{workspace.name}</td>
                    <td className="px-3 py-2">
                      <p className="text-foreground">
                        {getUnifiedPlanLabel({ planLabel: workspace.planLabel })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {workspace.billingCycle
                          ? t(`portalSite.admin.subscriptions.cycle.${workspace.billingCycle}`)
                          : "--"}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{workspace.subscriptionSource}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">
                        {t(`portalSite.admin.subscriptions.status.${workspace.subscriptionStatus}`)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {workspace.expiresAt ? formatLocaleDateTime(workspace.expiresAt) : "--"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
