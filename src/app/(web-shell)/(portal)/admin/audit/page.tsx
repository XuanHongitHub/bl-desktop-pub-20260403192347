"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listAdminAuditLogs } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAuditLog } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function toneForAction(
  action: string,
): "outline" | "warning" | "destructive" | "info" {
  if (action.startsWith("billing.") || action.startsWith("entitlement.")) {
    return "warning";
  }
  if (action.startsWith("auth.") || action.startsWith("membership.")) {
    return "info";
  }
  if (action.startsWith("share.") || action.startsWith("invite.")) {
    return "destructive";
  }
  return "outline";
}

export default function AdminAuditPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ControlAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await listAdminAuditLogs(connection, 250);
      setRows(data);
    } catch (error) {
      showErrorToast(t("portalSite.admin.audit.loadFailed"), {
        description: extractErrorMessage(error, "load_admin_audit_failed"),
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return rows;
    }
    return rows.filter((row) =>
      [
        row.action,
        row.actor,
        row.workspaceId ?? "",
        row.targetId ?? "",
        row.reason ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, rows]);

  const summary = useMemo(() => {
    const last24h = filteredRows.filter((row) => {
      const at = Date.parse(row.createdAt);
      return Number.isFinite(at) && Date.now() - at <= 24 * 60 * 60 * 1000;
    }).length;
    return {
      total: filteredRows.length,
      last24h,
      billing: filteredRows.filter((row) => row.action.startsWith("billing."))
        .length,
    };
  }, [filteredRows]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.audit.title")}
      description={t("portalSite.admin.audit.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.audit.metrics.total")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.audit.metrics.last24h")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.last24h}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.audit.metrics.billing")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.billing}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.audit.search")}
              className="h-9 w-full sm:max-w-sm"
            />
            <Badge variant="outline">{summary.total}</Badge>
          </div>
          <ScrollArea className="h-[640px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.audit.empty")}
                </div>
              ) : (
                filteredRows.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_160px_180px]"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={toneForAction(row.action)}>
                          {row.action}
                        </Badge>
                        {row.workspaceId ? (
                          <span className="truncate text-xs text-muted-foreground">
                            {row.workspaceId}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-sm text-foreground">
                        {row.reason || "--"}
                      </p>
                      {row.targetId ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {row.targetId}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{row.actor}</p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{formatLocaleDateTime(row.createdAt)}</p>
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
