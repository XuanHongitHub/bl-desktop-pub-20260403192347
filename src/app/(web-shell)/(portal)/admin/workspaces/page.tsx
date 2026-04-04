"use client";

import { CreditCard, Eye, Plus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { listAdminWorkspaces } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { getUnifiedPlanLabel, resolveUnifiedPlanId } from "@/lib/plan-display";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminWorkspaceDetail } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AdminWorkspacesOverviewPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();

  const [rows, setRows] = useState<ControlAdminWorkspaceDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalRows, setTotalRows] = useState(0);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");
  const [planFilter, setPlanFilter] = useState<
    "all" | "free" | "starter" | "team" | "scale" | "enterprise"
  >("all");

  const refresh = useCallback(
    async (keyword = query, targetPage = page) => {
      if (!connection) {
        setRows([]);
        setTotalRows(0);
        return;
      }

      setLoading(true);
      try {
        const payload = await listAdminWorkspaces(connection, {
          q: keyword.trim() || undefined,
          page: targetPage,
          pageSize,
          status: statusFilter === "all" ? undefined : statusFilter,
          planIdFilter: planFilter === "all" ? undefined : planFilter,
        });
        const items = payload.items ?? [];
        setRows(items);
        setTotalRows(payload.total ?? items.length);
        setPage(payload.page ?? targetPage);
      } catch (error) {
        showErrorToast(t("portalSite.admin.workspaces.errors.loadFailed"), {
          description: extractErrorMessage(
            error,
            "load_admin_workspaces_failed",
          ),
        });
      } finally {
        setLoading(false);
      }
    },
    [connection, page, pageSize, planFilter, query, statusFilter, t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh(query, page);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [page, query, refresh]);

  const summary = useMemo(
    () => ({
      total: totalRows,
      showing: rows.length,
      active: rows.filter((item) => item.subscriptionStatus === "active")
        .length,
      highRisk: rows.filter((item) => item.riskLevel === "high").length,
    }),
    [rows, totalRows],
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.workspaces.title")}
      description={t("portalSite.admin.workspaces.description")}
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refresh(query, page)}
          >
            {t("portalSite.admin.refresh")}
          </Button>
          <Button asChild size="sm" variant="default">
            <Link href="/admin/workspaces/create">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("portalSite.admin.workspaces.create.action")}
            </Link>
          </Button>
        </div>
      }
    >
      <section className="mx-auto grid w-full max-w-[1320px] gap-4 text-sm">
        <div className="rounded-xl border border-border bg-card">
          <div className="grid gap-2 border-b border-border p-4 lg:grid-cols-[minmax(0,1fr)_150px_170px_130px]">
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={t("portalSite.admin.workspaces.searchPlaceholder")}
              className="h-9"
            />
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(
                  value as "all" | "active" | "past_due" | "canceled",
                );
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("portalSite.admin.workspaces.allStatuses")}
                </SelectItem>
                <SelectItem value="active">active</SelectItem>
                <SelectItem value="past_due">past_due</SelectItem>
                <SelectItem value="canceled">canceled</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={planFilter}
              onValueChange={(value) => {
                setPlanFilter(
                  value as
                    | "all"
                    | "free"
                    | "starter"
                    | "team"
                    | "scale"
                    | "enterprise",
                );
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {t("portalSite.admin.workspaces.allPlans")}
                </SelectItem>
                <SelectItem value="free">
                  {getUnifiedPlanLabel({ planId: "free" })}
                </SelectItem>
                <SelectItem value="starter">
                  {getUnifiedPlanLabel({ planId: "starter" })}
                </SelectItem>
                <SelectItem value="team">
                  {getUnifiedPlanLabel({ planId: "team" })}
                </SelectItem>
                <SelectItem value="scale">
                  {getUnifiedPlanLabel({ planId: "scale" })}
                </SelectItem>
                <SelectItem value="enterprise">
                  {getUnifiedPlanLabel({ planId: "enterprise" })}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <Badge variant="outline">
              {t("portalSite.admin.workspaces.table.total", {
                count: summary.total,
              })}
            </Badge>
            <Badge variant="outline">
              {t("portalSite.admin.workspaces.table.showing", {
                count: summary.showing,
              })}
            </Badge>
            <Badge variant="outline">
              {t("portalSite.admin.workspaces.table.active", {
                count: summary.active,
              })}
            </Badge>
            <Badge variant="outline">
              {t("portalSite.admin.workspaces.table.highRisk", {
                count: summary.highRisk,
              })}
            </Badge>
          </div>

          <TooltipProvider>
            <div className="min-h-[62vh] max-h-[70vh] overflow-auto">
              <Table className="table-fixed text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[28%]">
                      {t("portalSite.admin.columns.workspace")}
                    </TableHead>
                    <TableHead className="w-[20%]">
                      {t("portalSite.admin.workspaces.panel.owner")}
                    </TableHead>
                    <TableHead className="w-[12%]">
                      {t("portalSite.admin.columns.plan")}
                    </TableHead>
                    <TableHead className="w-[10%]">
                      {t("portalSite.admin.columns.status")}
                    </TableHead>
                    <TableHead className="w-[8%]">
                      {t("portalSite.admin.columns.members")}
                    </TableHead>
                    <TableHead className="w-[16%]">
                      {t("portalSite.admin.columns.time")}
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
                        colSpan={7}
                        className="text-sm text-muted-foreground"
                      >
                        {t("portalSite.admin.loading")}
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-sm text-muted-foreground"
                      >
                        {t("portalSite.account.workspaceEmpty")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((workspace) => {
                      const unifiedPlan = resolveUnifiedPlanId({
                        planId: workspace.planId,
                        planLabel: workspace.planLabel,
                      });
                      return (
                        <TableRow key={workspace.workspaceId}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {workspace.workspaceName}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {workspace.workspaceId}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate">
                            <div className="flex items-center gap-2">
                              {workspace.owner?.email && (
                                <Avatar className="h-6 w-6 border border-border/50">
                                  <AvatarFallback className="text-[10px] bg-primary/10 text-primary uppercase">
                                    {workspace.owner.email.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <span className="truncate">
                                {workspace.owner?.email ?? "--"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <AdminPlanBadge planId={unifiedPlan} />
                          </TableCell>
                          <TableCell>
                            <AdminStatusBadge
                              status={workspace.subscriptionStatus}
                            />
                          </TableCell>
                          <TableCell>{workspace.members}</TableCell>
                          <TableCell>
                            {formatLocaleDateTime(workspace.createdAt)}
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
                                      href={`/admin/workspaces/${workspace.workspaceId}`}
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t(
                                    "portalSite.admin.workspaces.actions.details",
                                  )}
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
                                      href={`/admin/workspaces/${workspace.workspaceId}/members`}
                                    >
                                      <Users className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t(
                                    "portalSite.admin.workspaces.actions.members",
                                  )}
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
                                      href={`/admin/workspaces/${workspace.workspaceId}/billing`}
                                    >
                                      <CreditCard className="h-3.5 w-3.5" />
                                    </Link>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {t(
                                    "portalSite.admin.workspaces.actions.billing",
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>

          <div className="flex items-center gap-2 border-t border-border p-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
            >
              {t("portalSite.admin.workspaces.pagination.prev")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((current) => current + 1)}
              disabled={loading || page * pageSize >= totalRows}
            >
              {t("portalSite.admin.workspaces.pagination.next")}
            </Button>
            <Badge variant="outline" className="ml-auto">
              {t("portalSite.admin.workspaces.pagination.page", { page })}
            </Badge>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
