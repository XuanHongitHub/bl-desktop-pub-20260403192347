"use client";

import { Eye, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminUsersPage } from "@/components/portal/admin/admin-users-page";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode")?.trim();

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

  if (mode === "detail" || mode === "manage") {
    return <AdminUsersPage />;
  }

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
            <Link href="/admin/users?mode=manage">
              {t("portalSite.adminUsers.actions.manage")}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1280px] gap-4">
        <div className="rounded-xl border border-border bg-card">
          <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.adminUsers.search")}
              className="h-9 md:max-w-md"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="h-9 px-3 text-xs">
                {t("portalSite.adminUsers.stats.filtered", {
                  count: rows.length,
                })}
              </Badge>
              <Badge variant="outline" className="h-9 px-3 text-xs">
                {t("portalSite.adminUsers.stats.platformAdmins")}:{" "}
                {stats.admins}
              </Badge>
              <Badge variant="outline" className="h-9 px-3 text-xs">
                Google: {stats.google}
              </Badge>
            </div>
          </div>

          <TooltipProvider>
            <div className="min-h-[62vh] max-h-[70vh] overflow-auto">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[38%]">
                      {t("portalSite.adminUsers.columns.user")}
                    </TableHead>
                    <TableHead className="w-[14%]">
                      {t("portalSite.adminUsers.columns.provider")}
                    </TableHead>
                    <TableHead className="w-[14%]">
                      {t("portalSite.adminUsers.columns.role")}
                    </TableHead>
                    <TableHead className="w-[10%]">
                      {t("portalSite.adminUsers.columns.workspaceCount")}
                    </TableHead>
                    <TableHead className="w-[18%]">
                      {t("portalSite.adminUsers.columns.lastActive")}
                    </TableHead>
                    <TableHead className="w-[6%] text-right">
                      {t("portalSite.admin.columns.action")}
                    </TableHead>
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
                          <div className="min-w-0 max-w-full">
                            <p className="truncate text-sm font-medium">
                              {user.email}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user.userId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {formatAuthProvider(user.authProvider)}
                        </TableCell>
                        <TableCell>
                          {user.platformRole === "platform_admin" ? (
                            <Badge variant="outline">
                              {t(
                                "portalSite.adminUsers.create.rolePlatformAdmin",
                              )}
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {t("portalSite.adminUsers.create.roleUser")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{user.workspaceCount}</TableCell>
                        <TableCell className="truncate">
                          {user.lastActiveAt
                            ? formatLocaleDateTime(user.lastActiveAt)
                            : "--"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  asChild
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                >
                                  <Link
                                    href={`/admin/users?userId=${encodeURIComponent(user.userId)}&mode=detail`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("portalSite.adminUsers.actions.manage")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  asChild
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                >
                                  <Link
                                    href={`/admin/memberships?q=${encodeURIComponent(user.email)}`}
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("portalSite.adminUsers.actions.memberships")}
                              </TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  asChild
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                >
                                  <Link
                                    href={`/admin/impersonation-center/manage/${user.userId}?section=checklist`}
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {t("portalSite.adminUsers.actions.review")}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
