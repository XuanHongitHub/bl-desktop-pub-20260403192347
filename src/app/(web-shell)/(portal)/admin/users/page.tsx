"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminUsers } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminUserListItem } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function formatAuthProvider(
  value: ControlAdminUserListItem["authProvider"],
): string {
  if (value === "password_google") {
    return "password + google";
  }
  return value;
}

export default function AdminUsersOverviewPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();

  const [rows, setRows] = useState<ControlAdminUserListItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const payload = await listAdminUsers(connection, {
          q: keyword.trim() || undefined,
          page: 1,
          pageSize: 200,
        });
        setRows(payload.items ?? []);
      } catch (error) {
        showErrorToast(t("portalSite.adminUsers.errors.loadFailed"), {
          description: extractErrorMessage(error, "load_admin_users_failed"),
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

  const stats = useMemo(
    () => ({
      total: rows.length,
      admins: rows.filter((item) => item.platformRole === "platform_admin")
        .length,
      google: rows.filter((item) => item.hasGoogleAuth).length,
      password: rows.filter((item) => item.hasPasswordAuth).length,
    }),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.adminUsers.eyebrow")}
      title={t("portalSite.adminUsers.title")}
      description={t("portalSite.adminUsers.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh(query)}
          >
            {t("portalSite.adminUsers.actions.refresh")}
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/users/manage">
              {t("portalSite.adminUsers.actions.manage")}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1280px] gap-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Total users</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {stats.total}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Platform admins</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {stats.admins}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Google auth</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {stats.google}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Password auth</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {stats.password}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.adminUsers.searchPlaceholder")}
              className="h-9 w-full sm:max-w-sm"
            />
          </div>

          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>
                  {t("portalSite.adminUsers.columns.email")}
                </TableHead>
                <TableHead>
                  {t("portalSite.adminUsers.columns.provider")}
                </TableHead>
                <TableHead>{t("portalSite.adminUsers.columns.role")}</TableHead>
                <TableHead>
                  {t("portalSite.adminUsers.columns.workspaceCount")}
                </TableHead>
                <TableHead>
                  {t("portalSite.adminUsers.columns.lastActive")}
                </TableHead>
                <TableHead>{t("portalSite.admin.columns.action")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-sm text-muted-foreground"
                  >
                    {t("portalSite.admin.loading")}
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-sm text-muted-foreground"
                  >
                    {t("portalSite.adminUsers.panel.emptyUsers")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{user.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {user.userId}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatAuthProvider(user.authProvider)}
                    </TableCell>
                    <TableCell>
                      {user.platformRole === "platform_admin" ? (
                        <Badge variant="outline">
                          {t("portalSite.adminUsers.create.rolePlatformAdmin")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {t("portalSite.adminUsers.create.roleUser")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{user.workspaceCount}</TableCell>
                    <TableCell>
                      {user.lastActiveAt
                        ? formatLocaleDateTime(user.lastActiveAt)
                        : "--"}
                    </TableCell>
                    <TableCell>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-8"
                      >
                        <Link href={`/admin/users/manage/${user.userId}`}>
                          {t("portalSite.adminUsers.actions.manage")}
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
