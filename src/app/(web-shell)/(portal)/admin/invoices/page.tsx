"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminPlanBadge } from "@/components/admin/ui/admin-plan-badge";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAdminInvoices } from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { extractRootError } from "@/lib/error-utils";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";
import { resolveUnifiedPlanId } from "@/lib/plan-display";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminInvoiceListItem } from "@/types";

export default function AdminInvoicesPage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ControlAdminInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(
    async (keyword = query) => {
      if (!connection) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const payload = await listAdminInvoices(connection, {
          q: keyword.trim() || undefined,
          page: 1,
          pageSize: 200,
        });
        setRows(payload.items ?? []);
      } catch (error) {
        showErrorToast(t("portalSite.admin.invoices.loadFailed"), {
          description: extractRootError(error),
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

  const summary = useMemo(() => {
    const totalRevenue = rows.reduce(
      (sum, invoice) => sum + invoice.amountUsd,
      0,
    );
    return {
      count: rows.length,
      revenue: totalRevenue,
      average: rows.length > 0 ? totalRevenue / rows.length : 0,
    };
  }, [rows]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.invoices.title")}
      description={t("portalSite.admin.invoices.description")}
      actions={
        <Button size="sm" variant="outline" onClick={() => void refresh(query)}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3 mb-4">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>
              {t("portalSite.admin.invoices.metrics.count")}
            </CardDescription>
            <CardTitle className="text-2xl">{summary.count}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>
              {t("portalSite.admin.invoices.metrics.revenue")}
            </CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              ${formatLocaleNumber(summary.revenue)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription>
              {t("portalSite.admin.invoices.metrics.average")}
            </CardDescription>
            <CardTitle className="text-2xl">
              ${formatLocaleNumber(summary.average)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.invoices.search")}
              className="h-9 w-full sm:w-[320px]"
            />
            <Badge variant="outline">{summary.count}</Badge>
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table className="text-sm">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-medium text-left">
                    {t("portalSite.admin.columns.workspace")} // Người dùng
                  </TableHead>
                  <TableHead className="font-medium text-left">
                    Gói Đăng ký
                  </TableHead>
                  <TableHead className="font-medium text-left">
                    Doanh thu (USD)
                  </TableHead>
                  <TableHead className="font-medium text-left">
                    Thông tin thanh toán
                  </TableHead>
                  <TableHead className="font-medium text-left">
                    Ngày hoàn tất
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("portalSite.admin.loading")}
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {t("portalSite.admin.invoices.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((invoice) => {
                    const unifiedPlan = resolveUnifiedPlanId({
                      planLabel: invoice.planLabel,
                    });
                    const email = invoice.actorEmail || "--";
                    return (
                      <TableRow key={invoice.id} className="group">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8 border border-border/50">
                              <AvatarFallback className="bg-primary/10 text-primary uppercase text-xs">
                                {email.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {invoice.workspaceName}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground font-mono">
                                {invoice.actorEmail ?? invoice.actorUserId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <AdminPlanBadge planId={unifiedPlan} />
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {invoice.billingCycle}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ${formatLocaleNumber(invoice.amountUsd)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-muted-foreground">
                            <span className="capitalize">
                              {invoice.method} • {invoice.source}
                            </span>
                            {invoice.couponCode && (
                              <span className="font-mono text-[10px] mt-0.5 px-1 py-0.5 bg-muted rounded w-fit">
                                {invoice.couponCode}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatLocaleDateTime(
                            invoice.paidAt || invoice.createdAt,
                          )}
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
