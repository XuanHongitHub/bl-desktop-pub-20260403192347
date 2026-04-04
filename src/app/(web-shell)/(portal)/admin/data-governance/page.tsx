"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  getAdminOverview,
  listAdminWorkspaceHealth,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { showErrorToast } from "@/lib/toast-utils";
import type {
  ControlAdminOverview,
  ControlAdminWorkspaceHealthRow,
} from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminDataGovernancePage() {
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
      showErrorToast(t("portalSite.admin.dataGovernance.loadFailed"), {
        description: extractErrorMessage(error, "load_data_governance_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exposureRows = useMemo(
    () =>
      [...rows]
        .sort((left, right) => {
          const leftScore =
            left.activeShareGrants * 100 +
            left.activeInvites * 10 +
            left.storagePercent;
          const rightScore =
            right.activeShareGrants * 100 +
            right.activeInvites * 10 +
            right.storagePercent;
          return rightScore - leftScore;
        })
        .slice(0, 20),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.dataGovernance.title")}
      description={t("portalSite.admin.dataGovernance.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.dataGovernance.metrics.invites")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {overview?.activeInvites ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.dataGovernance.metrics.shares")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {overview?.activeShareGrants ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.dataGovernance.metrics.readOnly")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {overview?.entitlementReadOnly ?? 0}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {t("portalSite.admin.dataGovernance.hotspotsTitle")}
            </p>
            <Badge variant="outline">{exposureRows.length}</Badge>
          </div>
          <ScrollArea className="h-[520px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : (
                exposureRows.map((row) => (
                  <div
                    key={row.workspaceId}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_150px_170px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.workspaceName}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <AdminPlanBadge planId={row.planLabel.toLowerCase()} />
                        <span>· {row.members} members</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{row.activeInvites} invites</p>
                      <p>{row.activeShareGrants} shares</p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{Math.round(row.storagePercent)}% storage</p>
                      <p>{Math.round(row.proxyBandwidthPercent)}% proxy</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
