"use client";

import { Eye, ShieldCheck } from "lucide-react";
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

export default function AdminImpersonationCenterOverviewPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ControlAdminUserListItem[]>([]);
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
        showErrorToast(t("portalSite.admin.impersonationCenter.loadFailed"), {
          description: extractErrorMessage(
            error,
            "load_impersonation_targets_failed",
          ),
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
      active: rows.filter((item) => item.accountState === "active").length,
    }),
    [rows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.impersonationCenter.title")}
      description={t("portalSite.admin.impersonationCenter.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refresh(query)}
          >
            {t("portalSite.admin.refresh")}
          </Button>
          <Button asChild size="sm">
            <Link href="/admin/impersonation-center/manage">
              {t("portalSite.admin.workspaces.actions.manage")}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1320px] gap-4 text-sm">
        <div className="rounded-xl border border-border bg-card">
          <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.impersonationCenter.search")}
              className="h-9 md:max-w-md"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning" className="h-9 px-3 text-xs">
                {t("portalSite.admin.impersonationCenter.disabledBadge")}
              </Badge>
              <Badge variant="outline" className="h-9 px-3 text-xs">
                {stats.total}
              </Badge>
              <Badge variant="outline" className="h-9 px-3 text-xs">
                admin: {stats.admins}
              </Badge>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-9 px-3 text-xs"
              >
                <Link href="/admin/support-console">
                  {t("portalSite.admin.impersonationCenter.openSupportConsole")}
                </Link>
              </Button>
            </div>
          </div>

          <TooltipProvider>
            <div className="min-h-[62vh] max-h-[70vh] overflow-auto">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">
                      {t("portalSite.adminUsers.columns.email")}
                    </TableHead>
                    <TableHead className="w-[14%]">
                      {t("portalSite.adminUsers.columns.provider")}
                    </TableHead>
                    <TableHead className="w-[14%]">
                      {t("portalSite.adminUsers.columns.role")}
                    </TableHead>
                    <TableHead className="w-[14%]">
                      {t("portalSite.admin.impersonationCenter.accountState")}
                    </TableHead>
                    <TableHead className="w-[18%]">
                      {t("portalSite.admin.impersonationCenter.lastActive")}
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
                        {t("portalSite.admin.impersonationCenter.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.userId}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.email}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.userId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{row.authProvider}</TableCell>
                        <TableCell>{row.platformRole ?? "--"}</TableCell>
                        <TableCell>{row.accountState}</TableCell>
                        <TableCell>
                          {row.lastActiveAt
                            ? formatLocaleDateTime(row.lastActiveAt)
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
                                    href={`/admin/impersonation-center/manage/${row.userId}?section=checklist`}
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Review</TooltipContent>
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
                                    href={`/admin/users/manage/${row.userId}`}
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>User</TooltipContent>
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
