"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";

export default function AccountInvoicesPage() {
  const { t } = useTranslation();
  const { billingState, selectedWorkspace } = usePortalBillingData();
  const [query, setQuery] = useState("");
  const invoices = billingState?.recentInvoices ?? [];
  const filteredInvoices = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return invoices;
    }
    return invoices.filter((invoice) =>
      [invoice.id, invoice.planLabel, invoice.method, invoice.status]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [invoices, query]);
  const totalPaid = invoices.reduce((acc, invoice) => acc + invoice.amountUsd, 0);
  const latestPaidAt = invoices[0]?.paidAt || invoices[0]?.createdAt || null;

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.invoiceTitle")}
      description={t("portalSite.account.invoiceDescription")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/account/billing">{t("portalSite.account.nav.billing")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/checkout">{t("portalSite.account.goToCheckout")}</Link>
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border border-border bg-card/70">
        <div className="grid gap-0 sm:grid-cols-3">
          <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.invoicesCount")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{invoices.length}</p>
          </div>
          <div className="border-b border-border/70 p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.totalPaid")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              $
              {formatLocaleNumber(totalPaid, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.lastInvoiceAt")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {latestPaidAt
                ? formatLocaleDateTime(latestPaidAt)
                : t("portalSite.account.notAvailable")}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("portalSite.account.searchInvoices")}
            className="h-9 w-full sm:max-w-xs"
          />
          <Badge variant="outline" className="ml-auto">
            {filteredInvoices.length} {t("portalSite.account.invoicesCount")}
          </Badge>
        </div>
        {filteredInvoices.length === 0 ? (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              {invoices.length === 0
                ? t("portalSite.account.noInvoicesYet")
                : t("portalSite.account.noMatchInvoices")}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/pricing">{t("portalSite.account.openPricing")}</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/70">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceDate")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoicePlan")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceAmount")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceMethod")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.slice(0, 20).map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border/70">
                    <td className="px-3 py-2 text-foreground">
                      {formatLocaleDateTime(invoice.paidAt || invoice.createdAt)}
                    </td>
                    <td className="px-3 py-2 text-foreground">{invoice.planLabel}</td>
                    <td className="px-3 py-2 text-foreground">
                      $
                      {formatLocaleNumber(invoice.amountUsd, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{invoice.method}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{invoice.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selectedWorkspace ? (
          <p className="mt-3 text-xs text-muted-foreground">{selectedWorkspace.name}</p>
        ) : null}
      </section>
    </PortalSettingsPage>
  );
}
