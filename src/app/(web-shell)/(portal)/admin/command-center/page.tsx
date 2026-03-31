"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";

type QueueStatusFilter = "all" | "past_due" | "unpaid" | "canceled";

export default function AdminCommandCenterPage() {
  const { t } = useTranslation();
  const { workspaces, loadingWorkspaces, refreshWorkspaces } =
    usePortalBillingData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<QueueStatusFilter>("all");

  const stats = useMemo(() => {
    return {
      total: workspaces.length,
      pastDue: workspaces.filter(
        (workspace) => workspace.subscriptionStatus === "past_due",
      ).length,
      active: workspaces.filter(
        (workspace) => workspace.subscriptionStatus === "active",
      ).length,
      canceled: workspaces.filter(
        (workspace) => workspace.subscriptionStatus === "canceled",
      ).length,
    };
  }, [workspaces]);

  const attentionQueue = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return workspaces
      .filter((workspace) =>
        ["past_due", "unpaid", "canceled"].includes(
          workspace.subscriptionStatus,
        ),
      )
      .filter((workspace) => {
        const statusMatch =
          statusFilter === "all"
            ? true
            : workspace.subscriptionStatus === statusFilter;
        const keywordMatch = keyword
          ? [workspace.name, workspace.planLabel, workspace.subscriptionStatus]
              .join(" ")
              .toLowerCase()
              .includes(keyword)
          : true;
        return statusMatch && keywordMatch;
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [query, statusFilter, workspaces]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.commandCenter.title")}
      description={t("portalSite.admin.commandCenter.description")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refreshWorkspaces()}
          >
            {t("portalSite.admin.refresh")}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/workspaces">
              {t("portalSite.admin.nav.workspaces")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border border-border bg-card/70">
        <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
          <div className="border-b border-border/70 p-4 sm:border-r xl:border-b-0">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.nav.workspaces")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.total}
            </p>
          </div>
          <div className="border-b border-border/70 p-4 xl:border-b-0 xl:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.activeSubscriptions")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.active}
            </p>
          </div>
          <div className="border-b border-border/70 p-4 sm:border-r xl:border-b-0 xl:border-r">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.pastDue")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.pastDue}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.workspaces.canceled")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              {stats.canceled}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.workspaces.searchPlaceholder")}
              className="h-9 pl-8"
            />
          </div>

          <div className="flex items-center gap-1">
            {(["all", "past_due", "unpaid", "canceled"] as const).map(
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
            {attentionQueue.length}
          </Badge>
        </div>

        {loadingWorkspaces ? (
          <p className="text-sm text-muted-foreground">
            {t("portalSite.admin.loading")}
          </p>
        ) : attentionQueue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("portalSite.admin.commandCenter.queueEmpty")}
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
                    {t("portalSite.admin.columns.time")}
                  </th>
                  <th className="px-3 py-2 text-left font-medium">
                    {t("portalSite.admin.columns.action")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attentionQueue.map((workspace) => (
                  <tr key={workspace.id} className="border-t border-border/70">
                    <td className="px-3 py-2 text-foreground">
                      {workspace.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {workspace.planLabel}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="capitalize">
                        {workspace.subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatLocaleDateTime(workspace.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                        >
                          <Link
                            href={`/account/billing?workspaceId=${workspace.id}`}
                          >
                            {t("portalSite.account.nav.billing")}
                          </Link>
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                        >
                          <Link href="/admin/revenue">
                            {t("portalSite.admin.nav.revenue")}
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("portalSite.admin.commandCenter.runbookTitle")}
        </h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            {stats.pastDue > 0 ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 text-chart-5" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-2" />
            )}
            <p className="text-muted-foreground">
              {t("portalSite.admin.commandCenter.runbookBilling")}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-2" />
            <p className="text-muted-foreground">
              {t("portalSite.admin.commandCenter.runbookAudit")}
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-background/70 px-3 py-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-chart-2" />
            <p className="text-muted-foreground">
              {t("portalSite.admin.commandCenter.runbookSync")}
            </p>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
