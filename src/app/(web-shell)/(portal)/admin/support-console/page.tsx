"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listAdminAuditLogs,
  listAdminUsers,
  listAdminWorkspaces,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type {
  ControlAdminUserListItem,
  ControlAdminWorkspaceDetail,
  ControlAuditLog,
} from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminSupportConsolePage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ControlAdminUserListItem[]>([]);
  const [workspaces, setWorkspaces] = useState<ControlAdminWorkspaceDetail[]>([]);
  const [auditLogs, setAuditLogs] = useState<ControlAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setUsers([]);
        setWorkspaces([]);
        setAuditLogs([]);
        return;
      }
      setLoading(true);
      try {
        const [userPayload, workspacePayload, audits] = await Promise.all([
          listAdminUsers(connection, {
            q: keyword.trim() || undefined,
            page: 1,
            pageSize: 50,
          }),
          listAdminWorkspaces(connection, {
            q: keyword.trim() || undefined,
            page: 1,
            pageSize: 50,
          }),
          listAdminAuditLogs(connection, 80),
        ]);
        setUsers(userPayload.items ?? []);
        setWorkspaces(workspacePayload.items ?? []);
        setAuditLogs(audits.slice(0, 20));
      } catch (error) {
        showErrorToast(t("portalSite.admin.supportConsole.loadFailed"), {
          description: extractErrorMessage(error, "load_support_console_failed"),
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
      users: users.length,
      workspaces: workspaces.length,
      flagged: workspaces.filter(
        (workspace) =>
          workspace.riskLevel === "high" ||
          workspace.subscriptionStatus === "past_due" ||
          workspace.entitlementState !== "active",
      ).length,
    }),
    [users, workspaces],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.supportConsole.title")}
      description={t("portalSite.admin.supportConsole.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh(query)}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1240px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4 sm:col-span-2">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.supportConsole.search")}
              className="h-9"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.supportConsole.metrics.users")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{summary.users}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.supportConsole.metrics.flagged")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{summary.flagged}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.supportConsole.usersTitle")}
              </p>
              <Badge variant="outline">{summary.users}</Badge>
            </div>
            <ScrollArea className="h-[420px]">
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.supportConsole.emptyUsers")}
                  </div>
                ) : (
                  users.map((user) => (
                    <div
                      key={user.userId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {user.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.workspaceCount} ws · {user.authProvider}
                        </p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="h-8 px-2.5 text-xs">
                        <Link href="/admin/users">{t("portalSite.admin.supportConsole.openUser")}</Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.supportConsole.workspacesTitle")}
              </p>
              <Badge variant="outline">{summary.workspaces}</Badge>
            </div>
            <ScrollArea className="h-[420px]">
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </div>
                ) : workspaces.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    {t("portalSite.admin.supportConsole.emptyWorkspaces")}
                  </div>
                ) : (
                  workspaces.map((workspace) => (
                    <div
                      key={workspace.workspaceId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {workspace.workspaceName}
                          </p>
                          <Badge
                            variant={
                              workspace.riskLevel === "high"
                                ? "destructive"
                                : workspace.riskLevel === "medium"
                                  ? "warning"
                                  : "outline"
                            }
                          >
                            {workspace.riskLevel}
                          </Badge>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {workspace.planLabel} · {workspace.members} members
                        </p>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8 px-2.5 text-xs"
                      >
                        <Link href="/admin/workspaces">
                          {t("portalSite.admin.supportConsole.openWorkspace")}
                        </Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {t("portalSite.admin.supportConsole.activityTitle")}
            </p>
            <Badge variant="outline">{auditLogs.length}</Badge>
          </div>
          <ScrollArea className="h-[220px]">
            <div className="divide-y divide-border">
              {auditLogs.map((row) => (
                <div key={row.id} className="grid gap-2 px-4 py-3 md:grid-cols-[160px_minmax(0,1fr)_180px]">
                  <Badge variant="outline" className="w-fit">
                    {row.action}
                  </Badge>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    <p className="truncate">{row.actor}</p>
                    <p className="truncate">{row.reason || "--"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatLocaleDateTime(row.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
