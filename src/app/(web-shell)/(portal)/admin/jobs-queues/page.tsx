"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listAdminAutomationRuns } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminAutomationRunListItem } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function _statusVariant(
  status: ControlAdminAutomationRunListItem["status"],
): "success" | "warning" | "destructive" | "info" | "outline" {
  if (status === "completed") return "success";
  if (status === "running" || status === "queued") return "info";
  if (status === "paused" || status === "stopped") return "warning";
  if (status === "failed") return "destructive";
  return "outline";
}

export default function AdminJobsQueuesPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ControlAdminAutomationRunListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const payload = await listAdminAutomationRuns(connection, {
          q: keyword.trim() || undefined,
          page: 1,
          pageSize: 200,
        });
        setRows(payload.items ?? []);
      } catch (error) {
        showErrorToast(t("portalSite.admin.jobsQueues.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_jobs_failed"),
        });
      } finally {
        setLoading(false);
      }
    },
    [connection, query, t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(query);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      running: rows.filter(
        (row) => row.status === "running" || row.status === "queued",
      ).length,
      blocked: rows.reduce((sum, row) => sum + row.blockedCount, 0),
    }),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.jobsQueues.title")}
      description={t("portalSite.admin.jobsQueues.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh(query)}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.jobsQueues.metrics.total")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.total}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.jobsQueues.metrics.running")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.running}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.jobsQueues.metrics.blocked")}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {summary.blocked}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.jobsQueues.search")}
              className="h-9 w-full sm:max-w-sm"
            />
            <Badge variant="outline">{summary.total}</Badge>
          </div>
          <ScrollArea className="h-[620px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.jobsQueues.empty")}
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={row.runId}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.1fr)_150px_180px]"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {row.workspaceName}
                        </p>
                        <AdminStatusBadge status={row.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.flowType} · {row.mode} · {row.createdBy}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>
                        {row.doneCount}/{row.totalCount} ·{" "}
                        {t("portalSite.admin.jobsQueues.failed")}{" "}
                        {row.failedCount}
                      </p>
                      <p>
                        {t("portalSite.admin.jobsQueues.blocked")}{" "}
                        {row.blockedCount}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{formatLocaleDateTime(row.updatedAt)}</p>
                      {row.finishedAt ? (
                        <p>{formatLocaleDateTime(row.finishedAt)}</p>
                      ) : null}
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
