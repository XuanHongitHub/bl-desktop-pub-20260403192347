"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Button } from "@/components/ui/button";
import { listAdminWorkspaceHealth } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminWorkspaceHealthRow } from "@/types";

const INCIDENT_LIMIT = 30;

export default function AdminIncidentBoardPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminWorkspaceHealthRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listAdminWorkspaceHealth(connection);
      setRows(data);
    } catch (error) {
      showErrorToast(t("portalSite.admin.incidentBoard.loadFailed"), {
        description:
          error instanceof Error ? error.message : "incident_board_load_failed",
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const incidentRows = useMemo(() => {
    const ranked = rows
      .filter(
        (item) =>
          item.riskLevel === "high" ||
          item.subscriptionStatus === "past_due" ||
          item.entitlementState === "read_only",
      )
      .map((item) => {
        const score =
          (item.riskLevel === "high"
            ? 100
            : item.riskLevel === "medium"
              ? 60
              : 20) +
          (item.subscriptionStatus === "past_due" ? 40 : 0) +
          (item.entitlementState === "read_only" ? 35 : 0) +
          item.storagePercent / 4;
        return { ...item, score };
      })
      .sort((a, b) => b.score - a.score);
    return ranked.slice(0, INCIDENT_LIMIT);
  }, [rows]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.incidentBoard.title")}
      description={t("portalSite.admin.incidentBoard.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.incidentBoard.metrics.total")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {incidentRows.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.incidentBoard.metrics.highRisk")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {incidentRows.filter((item) => item.riskLevel === "high").length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.incidentBoard.metrics.pastDue")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {
                incidentRows.filter(
                  (item) => item.subscriptionStatus === "past_due",
                ).length
              }
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("portalSite.admin.incidentBoard.tableTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("portalSite.admin.incidentBoard.tableDescription")}
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.workspace")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.risk")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.status")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.storage")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.time")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    {t("portalSite.admin.loading")}
                  </td>
                </tr>
              ) : incidentRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-muted-foreground"
                  >
                    {t("portalSite.admin.incidentBoard.empty")}
                  </td>
                </tr>
              ) : (
                incidentRows.map((item) => (
                  <tr
                    key={item.workspaceId}
                    className="border-t border-border/70"
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">
                        {item.workspaceName}
                      </p>
                      <p className="mt-0.5">
                        <AdminPlanBadge planId={item.planLabel.toLowerCase()} />
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.riskLevel} />
                    </td>
                    <td className="px-3 py-2">
                      <AdminStatusBadge status={item.subscriptionStatus} />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {Math.round(item.storagePercent)}%
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {item.usageUpdatedAt
                        ? formatLocaleDateTime(item.usageUpdatedAt)
                        : "--"}
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
