"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getAdminOverview,
  listAdminAuditLogs,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminOverview, ControlAuditLog } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminPolicyCenterPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [overview, setOverview] = useState<ControlAdminOverview | null>(null);
  const [auditLogs, setAuditLogs] = useState<ControlAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setOverview(null);
      setAuditLogs([]);
      return;
    }
    setLoading(true);
    try {
      const [nextOverview, audits] = await Promise.all([
        getAdminOverview(connection),
        listAdminAuditLogs(connection, 80),
      ]);
      setOverview(nextOverview);
      setAuditLogs(audits.slice(0, 12));
    } catch (error) {
      showErrorToast(t("portalSite.admin.policyCenter.loadFailed"), {
        description: extractErrorMessage(error, "load_policy_center_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const policyRows = useMemo(
    () => [
      {
        id: "audit",
        label: t("portalSite.admin.policyCenter.rows.audit"),
        value: `${overview?.auditsLast24h ?? 0}`,
        status: (overview?.auditsLast24h ?? 0) > 0,
      },
      {
        id: "shares",
        label: t("portalSite.admin.policyCenter.rows.shares"),
        value: `${overview?.activeShareGrants ?? 0}`,
        status: (overview?.activeShareGrants ?? 0) === 0,
      },
      {
        id: "readOnly",
        label: t("portalSite.admin.policyCenter.rows.readOnly"),
        value: `${overview?.entitlementReadOnly ?? 0}`,
        status: (overview?.entitlementReadOnly ?? 0) === 0,
      },
    ],
    [overview, t],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.policyCenter.title")}
      description={t("portalSite.admin.policyCenter.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
              {t("portalSite.admin.policyCenter.policyTitle")}
            </div>
            <div className="divide-y divide-border">
              {policyRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="text-sm text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">{row.value}</p>
                  </div>
                  <Badge variant={row.status ? "success" : "warning"}>
                    {row.status
                      ? t("portalSite.admin.system.ready")
                      : t("portalSite.admin.system.pending")}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3 text-sm font-medium text-foreground">
              {t("portalSite.admin.policyCenter.auditTitle")}
            </div>
            <ScrollArea className="h-[360px]">
              <div className="divide-y divide-border">
                {loading && auditLogs.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </div>
                ) : (
                  auditLogs.map((row) => (
                    <div key={row.id} className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{row.action}</Badge>
                        {row.workspaceId ? (
                          <span className="text-xs text-muted-foreground">{row.workspaceId}</span>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">{row.reason || row.actor}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatLocaleDateTime(row.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
