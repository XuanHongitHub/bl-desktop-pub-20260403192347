"use client";

import { ReceiptText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function AccountInvoicesPage() {
  const { t } = useTranslation();
  const { billingState } = usePortalBillingData();
  const invoices = billingState?.recentInvoices ?? [];

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.nav.invoices")}
      description={t("portalSite.account.invoiceDescription")}
    >
      <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 pb-4">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("portalSite.account.invoiceTitle")}
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
              {t("portalSite.account.invoiceDescription")}
            </h2>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground">
            <ReceiptText className="h-4 w-4" />
          </span>
        </div>

        {invoices.length === 0 ? (
          <p className="pt-5 text-sm leading-7 text-muted-foreground">
            {t("portalSite.account.invoiceEmpty")}
          </p>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-border/70">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("portalSite.account.invoiceDate")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.account.invoicePlan")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.account.invoiceAmount")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.account.invoiceMethod")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.account.invoiceStatus")}</th>
                </tr>
              </thead>
              <tbody className="bg-background/80">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-t border-border/70">
                    <td className="px-4 py-3 text-foreground">
                      {formatDate(invoice.paidAt, invoice.paidAt)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{invoice.planLabel}</td>
                    <td className="px-4 py-3 text-muted-foreground">${invoice.amountUsd}</td>
                    <td className="px-4 py-3 text-muted-foreground">{invoice.method}</td>
                    <td className="px-4 py-3 text-foreground">{invoice.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PortalSettingsPage>
  );
}
