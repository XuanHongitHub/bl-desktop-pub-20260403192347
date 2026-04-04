"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminStatusBadge } from "@/components/admin/ui/admin-status-badge";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { resolveUnifiedPlanId } from "@/lib/plan-display";

export default function AdminSubscriptionsPage() {
  const { t } = useTranslation();
  const { workspaces, loadingWorkspaces, refreshWorkspaces } =
    usePortalBillingData();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "past_due" | "canceled"
  >("all");

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return workspaces.filter((workspace) => {
      const matchStatus =
        statusFilter === "all"
          ? true
          : workspace.subscriptionStatus === statusFilter;
      const matchQuery = keyword
        ? [
            workspace.name,
            workspace.planLabel,
            workspace.subscriptionStatus,
            workspace.subscriptionSource,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword)
        : true;
      return matchStatus && matchQuery;
    });
  }, [query, statusFilter, workspaces]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.subscriptions.title")}
      description={t("portalSite.admin.subscriptions.description")}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshWorkspaces()}
        >
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t("portalSite.admin.subscriptions.metrics.total")}</CardDescription>
            <CardTitle className="text-2xl">{filteredRows.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t("portalSite.admin.subscriptions.metrics.active")}</CardDescription>
            <CardTitle className="text-2xl">
              {filteredRows.filter((item) => item.subscriptionStatus === "active").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>{t("portalSite.admin.subscriptions.metrics.pastDue")}</CardDescription>
            <CardTitle className="text-2xl">
              {filteredRows.filter((item) => item.subscriptionStatus === "past_due").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "active", "past_due", "canceled"] as const).map(
                (status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={statusFilter === status ? "secondary" : "ghost"}
                    onClick={() => setStatusFilter(status)}
                    className="h-8 px-3 text-xs font-medium"
                  >
                    {status === "all"
                      ? t("portalSite.admin.workspaces.allStatuses")
                      : t(`portalSite.admin.subscriptions.status.${status}`)}
                  </Button>
                ),
              )}
            </div>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.subscriptions.search")}
              className="h-9 w-full sm:w-[320px]"
            />
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table className="text-sm">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-medium">
                    {t("portalSite.admin.columns.workspace")}
                  </TableHead>
                  <TableHead className="font-medium">
                    {t("portalSite.admin.columns.plan")}
                  </TableHead>
                  <TableHead className="font-medium">
                    {t("portalSite.admin.subscriptions.columns.source")}
                  </TableHead>
                  <TableHead className="font-medium">
                    {t("portalSite.admin.columns.status")}
                  </TableHead>
                  <TableHead className="font-medium">
                    {t("portalSite.admin.subscriptions.columns.expiresAt")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingWorkspaces ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("portalSite.admin.loading")}
                    </TableCell>
                  </TableRow>
                ) : filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("portalSite.admin.subscriptions.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows.map((workspace) => {
                    const unifiedPlan = resolveUnifiedPlanId({ planLabel: workspace.planLabel });
                    return (
                      <TableRow key={workspace.id} className="group">
                        <TableCell className="font-medium">
                          <p className="truncate">{workspace.name}</p>
                          <p className="truncate text-[10px] text-muted-foreground font-mono">
                            {workspace.id}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                             <AdminPlanBadge planId={unifiedPlan} />
                             <span className="text-[10px] text-muted-foreground capitalize">
                              {workspace.billingCycle ?? "--"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground capitalize text-xs">
                          {workspace.subscriptionSource}
                        </TableCell>
                        <TableCell>
                          <AdminStatusBadge status={workspace.subscriptionStatus} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {workspace.expiresAt
                            ? formatLocaleDateTime(workspace.expiresAt)
                            : "Never (Lifetime)"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </PortalSettingsPage>
  );
}
