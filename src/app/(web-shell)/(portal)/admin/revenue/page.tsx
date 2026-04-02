"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAdminRevenue, listAdminInvoices } from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminInvoiceListItem, ControlAdminRevenueSummary } from "@/types";

export default function AdminRevenuePage() {
  const { t } = useTranslation();
  const { connection } = usePortalBillingData();
  const [summary, setSummary] = useState<ControlAdminRevenueSummary | null>(null);
  const [invoices, setInvoices] = useState<ControlAdminInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!connection) {
      setSummary(null);
      setInvoices([]);
      return;
    }
    setLoading(true);
    try {
      const [summaryPayload, invoicePayload] = await Promise.all([
        getAdminRevenue(connection),
        listAdminInvoices(connection, { page: 1, pageSize: 20 }),
      ]);
      setSummary(summaryPayload);
      setInvoices(invoicePayload.items ?? []);
    } catch (error) {
      showErrorToast(t("portalSite.admin.revenue.loadFailed"), {
        description: error instanceof Error ? error.message : "admin_revenue_load_failed",
      });
    } finally {
      setLoading(false);
    }
  }, [connection, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.revenue.title")}
      description={t("portalSite.admin.revenue.description")}
      actions={
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {t("portalSite.admin.refresh")}
        </Button>
      }
    >
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.activeSubscriptions")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary?.activeSubscriptions ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.pastDue")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary?.pastDueSubscriptions ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.grossRevenue")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              ${formatLocaleNumber(summary?.grossRevenueUsd ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.revenue.payingWorkspaces")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {summary?.payingWorkspaces ?? 0}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              {t("portalSite.admin.revenue.latestTitle")}
            </p>
            <Badge variant="outline">{summary?.invoiceCount ?? invoices.length}</Badge>
          </div>
          <ScrollArea className="h-[560px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.account.invoiceEmpty")}
                </div>
              ) : (
                invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_120px_120px_180px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {invoice.workspaceName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invoice.actorEmail ?? invoice.actorUserId}
                      </p>
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      ${formatLocaleNumber(invoice.amountUsd)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {invoice.planLabel}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{formatLocaleDateTime(invoice.paidAt || invoice.createdAt)}</p>
                      <p>{invoice.method}</p>
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
