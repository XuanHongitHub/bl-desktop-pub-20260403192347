"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { listAdminInvoices } from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import type { ControlAdminInvoiceListItem } from "@/types";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

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
          description: extractErrorMessage(error, "load_admin_invoices_failed"),
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
    const totalRevenue = rows.reduce((sum, invoice) => sum + invoice.amountUsd, 0);
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
      <section className="mx-auto w-full max-w-[1180px] space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.invoices.metrics.count")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{summary.count}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.invoices.metrics.revenue")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              ${formatLocaleNumber(summary.revenue)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.invoices.metrics.average")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              ${formatLocaleNumber(summary.average)}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("portalSite.admin.invoices.search")}
              className="h-9 w-full sm:max-w-sm"
            />
            <Badge variant="outline">{summary.count}</Badge>
          </div>
          <ScrollArea className="h-[620px]">
            <div className="divide-y divide-border">
              {loading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.loading")}
                </div>
              ) : rows.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  {t("portalSite.admin.invoices.empty")}
                </div>
              ) : (
                rows.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.2fr)_140px_160px_160px]"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {invoice.workspaceName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invoice.actorEmail ?? invoice.actorUserId}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        ${formatLocaleNumber(invoice.amountUsd)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.planLabel}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{invoice.method}</p>
                      <p>{invoice.source}</p>
                      {invoice.couponCode ? <p>{invoice.couponCode}</p> : null}
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <p>{formatLocaleDateTime(invoice.paidAt || invoice.createdAt)}</p>
                      <p>{invoice.billingCycle}</p>
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
