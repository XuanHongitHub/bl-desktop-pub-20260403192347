"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";

export default function AdminWorkspacesPage() {
  const { t } = useTranslation();
  const { workspaces, loadingWorkspaces, refreshWorkspaces } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");

  const filteredWorkspaces = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const matchStatus =
        statusFilter === "all" ? true : workspace.subscriptionStatus === statusFilter;
      const matchKeyword = keyword
        ? [workspace.name, workspace.planLabel, workspace.subscriptionStatus]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchStatus && matchKeyword;
    });
  }, [query, statusFilter, workspaces]);

  const activeCount = workspaces.filter((w) => w.subscriptionStatus === "active").length;
  const pastDueCount = workspaces.filter((w) => w.subscriptionStatus === "past_due").length;
  const canceledCount = workspaces.filter((w) => w.subscriptionStatus === "canceled").length;

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
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.revenue.activeSubscriptions")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{activeCount}</p>
          </div>
          <div className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.revenue.pastDue")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{pastDueCount}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.workspaces.canceled")}</p>
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
            {(["all", "active", "past_due", "canceled"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={statusFilter === status ? "secondary" : "outline"}
                onClick={() => setStatusFilter(status)}
                className="h-8 px-2.5 text-xs capitalize"
              >
                {status === "all" ? t("portalSite.admin.workspaces.allStatuses") : status}
              </Button>
            ))}
          </div>
          <Badge variant="outline" className="ml-auto">
            {filteredWorkspaces.length}
          </Badge>
        </div>

        {loadingWorkspaces ? (
          <p className="text-sm text-muted-foreground">{t("portalSite.admin.loading")}</p>
        ) : filteredWorkspaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("portalSite.account.workspaceEmpty")}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.workspace")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.plan")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.status")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.members")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.time")}</th>
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
                    <td className="px-3 py-2 text-muted-foreground">{workspace.profileLimit}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatLocaleDateTime(workspace.createdAt)}
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
    </PortalSettingsPage>
  );
}
