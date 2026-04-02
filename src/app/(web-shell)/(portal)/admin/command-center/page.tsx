"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAdminOverview,
  listAdminWorkspaceHealth,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminOverview, ControlAdminWorkspaceHealthRow } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminCommandCenterPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [overview, setOverview] = useState<ControlAdminOverview | null>(null);
  const [rows, setRows] = useState<ControlAdminWorkspaceHealthRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setOverview(null);
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const [nextOverview, workspaceHealth] = await Promise.all([
        getAdminOverview(connection),
        listAdminWorkspaceHealth(connection),
      ]);
      setOverview(nextOverview);
      setRows(workspaceHealth);
    } catch (error) {
      showErrorToast(t("portalSite.admin.commandCenter.loadFailed"), {
        description: extractErrorMessage(error, "load_command_center_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const priorityRows = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.riskLevel === "high" ||
            row.subscriptionStatus === "past_due" ||
            row.entitlementState !== "active",
        )
        .slice(0, 12),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.commandCenter.title")}
      description={t("portalSite.admin.commandCenter.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.metrics.workspaces")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{overview?.workspaces ?? 0}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.metrics.activeRevenue")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {overview?.entitlementActive ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.metrics.highRisk")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {rows.filter((row) => row.riskLevel === "high").length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.metrics.audits")}</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{overview?.auditsLast24h ?? 0}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.commandCenter.queueTitle")}
              </p>
              <Badge variant="outline">{priorityRows.length}</Badge>
            </div>
            <ScrollArea className="h-[520px]">
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </div>
                ) : priorityRows.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.commandCenter.queueEmpty")}
                  </div>
                ) : (
                  priorityRows.map((row) => (
                    <div
                      key={row.workspaceId}
                      className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_160px_180px]"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {row.workspaceName}
                          </p>
                          <Badge
                            variant={
                              row.riskLevel === "high"
                                ? "destructive"
                                : row.riskLevel === "medium"
                                  ? "warning"
                                  : "outline"
                            }
                          >
                            {row.riskLevel}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {row.planLabel} · {row.subscriptionStatus} · {row.entitlementState}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <p>{Math.round(row.storagePercent)}% storage</p>
                        <p>{Math.round(row.proxyBandwidthPercent)}% proxy</p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          {row.latestInvoiceAt
                            ? formatLocaleDateTime(row.latestInvoiceAt)
                            : "--"}
                        </p>
                        <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                          <Link href="/admin/workspaces">
                            {t("portalSite.admin.workspaces.actions.manage")}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("portalSite.admin.commandCenter.runbookTitle")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("portalSite.admin.commandCenter.queueDescription")}
                </p>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t("portalSite.admin.commandCenter.runbookBilling")}</p>
                <p>{t("portalSite.admin.commandCenter.runbookAudit")}</p>
                <p>{t("portalSite.admin.commandCenter.runbookSync")}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
