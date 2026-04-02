"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { listAdminMemberships } from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminMembershipItem } from "@/types";

export default function AdminMembershipsPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminMembershipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const payload = await listAdminMemberships(connection, {
        q: query.trim() || undefined,
        page: 1,
        pageSize: 200,
      });
      setRows(payload.items ?? []);
    } catch (error) {
      showErrorToast(t("portalSite.admin.memberships.loadFailed"), {
        description:
          error instanceof Error ? error.message : "memberships_load_failed",
      });
    } finally {
      setLoading(false);
    }
  }, [connection, query, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.memberships.title")}
      description={t("portalSite.admin.memberships.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.memberships.search")}
              className="h-9 w-full sm:max-w-sm"
            />
            <Badge variant="outline">
              {t("portalSite.admin.memberships.memberCount", { count: rows.length })}
            </Badge>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <ScrollArea className="h-[680px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.memberships.empty")}
                </div>
              ) : (
                rows.map((row) => (
                  <div
                    key={`${row.workspaceId}:${row.userId}`}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_112px_160px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.userId}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {row.workspaceName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.workspaceId}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="outline" className="capitalize">
                        {t(`portalSite.adminUsers.roles.${row.role}`)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{formatLocaleDateTime(row.createdAt)}</p>
                      <p>{row.authProvider}</p>
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
