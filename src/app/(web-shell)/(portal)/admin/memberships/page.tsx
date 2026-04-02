"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listWorkspaceMembers } from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlMembership } from "@/types";

type MembershipRow = ControlMembership & { workspaceName: string };

export default function AdminMembershipsPage() {
  const { t } = useTranslation();
  const { connection, workspaces } = usePortalBillingData();
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    if (!connection) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const data = await Promise.all(
        workspaces.map(async (workspace) => {
          const members = await listWorkspaceMembers(connection, workspace.id);
          return members.map((member) => ({
            ...member,
            workspaceName: workspace.name,
          }));
        }),
      );
      setRows(data.flat());
    } catch (error) {
      showErrorToast(t("portalSite.admin.memberships.loadFailed"), {
        description:
          error instanceof Error ? error.message : "memberships_load_failed",
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t, workspaces]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return rows;
    }
    return rows.filter((item) =>
      [item.email, item.userId, item.workspaceName, item.role]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, rows]);

  const workspaceCount = useMemo(
    () => new Set(filteredRows.map((row) => row.workspaceId)).size,
    [filteredRows],
  );

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
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portalSite.admin.memberships.search")}
            className="h-9 w-full sm:max-w-sm"
          />
          <Badge variant="outline">
            {t("portalSite.admin.memberships.memberCount", { count: filteredRows.length })}
          </Badge>
          <Badge variant="secondary">
            {t("portalSite.admin.memberships.workspaceCount", { count: workspaceCount })}
          </Badge>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("portalSite.admin.memberships.tableTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("portalSite.admin.memberships.tableDescription")}
        </p>

        <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.user")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.workspace")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.role")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.adminUsers.columns.joinedAt")}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.admin.loading")}
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t("portalSite.admin.memberships.empty")}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={`${row.workspaceId}:${row.userId}`} className="border-t border-border/70">
                    <td className="px-3 py-2">
                      <p className="font-medium text-foreground">{row.email}</p>
                      <p className="text-xs text-muted-foreground">{row.userId}</p>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.workspaceName}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{t(`portalSite.adminUsers.roles.${row.role}`)}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.createdAt ? formatLocaleDateTime(row.createdAt) : "--"}
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
