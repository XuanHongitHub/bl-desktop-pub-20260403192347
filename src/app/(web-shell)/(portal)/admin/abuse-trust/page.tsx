"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listAdminAuditLogs,
  listAdminWorkspaceHealth,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminWorkspaceHealthRow, ControlAuditLog } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminAbuseTrustPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminWorkspaceHealthRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<ControlAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      setAuditLogs([]);
      return;
    }
    setLoading(true);
    try {
      const [healthRows, audits] = await Promise.all([
        listAdminWorkspaceHealth(connection),
        listAdminAuditLogs(connection, 120),
      ]);
      setRows(healthRows);
      setAuditLogs(audits);
    } catch (error) {
      showErrorToast(t("portalSite.admin.abuseTrust.loadFailed"), {
        description: extractErrorMessage(error, "load_abuse_trust_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const flaggedRows = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            row.riskLevel === "high" ||
            row.subscriptionStatus === "past_due" ||
            row.entitlementState !== "active" ||
            row.activeInvites > 3 ||
            row.activeShareGrants > 0,
        )
        .sort((left, right) => {
          if (left.riskLevel !== right.riskLevel) {
            const rank = { high: 3, medium: 2, low: 1 } as const;
            return rank[right.riskLevel] - rank[left.riskLevel];
          }
          return right.activeShareGrants - left.activeShareGrants;
        }),
    [rows],
  );

  const sensitiveAuditLogs = useMemo(
    () =>
      auditLogs
        .filter((row) =>
          /membership|invite|share|entitlement|auth\.|billing\./u.test(row.action),
        )
        .slice(0, 20),
    [auditLogs],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.abuseTrust.title")}
      description={t("portalSite.admin.abuseTrust.description")}
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
              {t("portalSite.admin.abuseTrust.metrics.flagged")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{flaggedRows.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.abuseTrust.metrics.readOnly")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {rows.filter((row) => row.entitlementState === "read_only").length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.abuseTrust.metrics.shared")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {rows.filter((row) => row.activeShareGrants > 0).length}
            </p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.abuseTrust.queueTitle")}
              </p>
              <Badge variant="outline">{flaggedRows.length}</Badge>
            </div>
            <ScrollArea className="h-[520px]">
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </div>
                ) : flaggedRows.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.abuseTrust.empty")}
                  </div>
                ) : (
                  flaggedRows.map((row) => (
                    <div
                      key={row.workspaceId}
                      className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_160px_180px]"
                    >
                      <div className="min-w-0 space-y-1">
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
                          <Badge
                            variant={
                              row.entitlementState === "read_only" ? "destructive" : "outline"
                            }
                          >
                            {row.entitlementState}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {row.planLabel} · {row.members} members · {row.activeInvites} invites ·{" "}
                          {row.activeShareGrants} shares
                        </p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>{row.subscriptionStatus}</p>
                        <p>{Math.round(row.storagePercent)}% storage</p>
                        <p>{Math.round(row.proxyBandwidthPercent)}% proxy</p>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <p>
                          {row.latestInvoiceAt
                            ? formatLocaleDateTime(row.latestInvoiceAt)
                            : "--"}
                        </p>
                        <p>
                          {row.usageUpdatedAt
                            ? formatLocaleDateTime(row.usageUpdatedAt)
                            : "--"}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.abuseTrust.auditTitle")}
              </p>
              <Badge variant="outline">{sensitiveAuditLogs.length}</Badge>
            </div>
            <ScrollArea className="h-[520px]">
              <div className="divide-y divide-border">
                {sensitiveAuditLogs.map((row) => (
                  <div key={row.id} className="space-y-1 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{row.action}</Badge>
                      {row.workspaceId ? (
                        <span className="text-xs text-muted-foreground">{row.workspaceId}</span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{row.actor}</p>
                    <p className="text-xs text-muted-foreground">{row.reason || "--"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatLocaleDateTime(row.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
