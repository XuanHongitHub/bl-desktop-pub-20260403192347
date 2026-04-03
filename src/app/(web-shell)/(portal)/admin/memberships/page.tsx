"use client";

import { Eye, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { listAdminMemberships } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminMembershipItem, TeamRole } from "@/types";

export default function AdminMembershipsPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [rows, setRows] = useState<ControlAdminMembershipItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | TeamRole>("all");

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
        pageSize: 300,
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

  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        roleFilter === "all" ? true : row.role === roleFilter,
      ),
    [roleFilter, rows],
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
      <section className="mx-auto w-full max-w-[1280px] space-y-4 text-sm">
        <div className="rounded-xl border border-border bg-card">
          <div className="grid gap-2 border-b border-border p-4 sm:grid-cols-[minmax(0,1fr)_160px_auto]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.memberships.search")}
              className="h-9"
            />
            <Select
              value={roleFilter}
              onValueChange={(value) =>
                setRoleFilter(value as "all" | TeamRole)
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="owner">owner</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="member">member</SelectItem>
                <SelectItem value="viewer">viewer</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="w-fit">
              {t("portalSite.admin.memberships.memberCount", {
                count: filtered.length,
              })}
            </Badge>
          </div>

          <TooltipProvider>
            <div className="min-h-[62vh] max-h-[70vh] overflow-auto">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">
                      {t("portalSite.adminUsers.columns.email")}
                    </TableHead>
                    <TableHead className="w-[30%]">
                      {t("portalSite.admin.columns.workspace")}
                    </TableHead>
                    <TableHead className="w-[12%]">
                      {t("portalSite.adminUsers.columns.role")}
                    </TableHead>
                    <TableHead className="w-[18%]">
                      {t("portalSite.admin.columns.time")}
                    </TableHead>
                    <TableHead className="w-[10%] text-right">
                      {t("portalSite.admin.columns.action")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-sm text-muted-foreground"
                      >
                        {t("portalSite.admin.loading")}
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-sm text-muted-foreground"
                      >
                        {t("portalSite.admin.memberships.empty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((row) => (
                      <TableRow key={`${row.workspaceId}:${row.userId}`}>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.email}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.userId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {row.workspaceName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {row.workspaceId}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {t(`portalSite.adminUsers.roles.${row.role}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatLocaleDateTime(row.createdAt)}
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
                                    href={`/admin/workspaces/${row.workspaceId}/members`}
                                  >
                                    <Users className="h-3.5 w-3.5" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Workspace</TooltipContent>
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
