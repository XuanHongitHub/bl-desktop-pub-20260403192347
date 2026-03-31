"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";

export default function AdminRevenuePage() {
  const { t } = useTranslation();
  const { workspaces, billingState } = usePortalBillingData();
  const recentInvoices = billingState?.recentInvoices ?? [];

  const metrics = useMemo(() => {
    const active = workspaces.filter((w) => w.subscriptionStatus === "active").length;
    const pastDue = workspaces.filter((w) => w.subscriptionStatus === "past_due").length;
    const revenue = recentInvoices.reduce((sum, invoice) => sum + invoice.amountUsd, 0);
    return { active, pastDue, revenue };
  }, [recentInvoices, workspaces]);

  const planMix = useMemo(() => {
    const buckets = new Map<string, number>();
    for (const workspace of workspaces) {
      const key = workspace.planLabel || "Unknown";
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [workspaces]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.revenue.title")}
      description={t("portalSite.admin.revenue.description")}
    >
      <section className="rounded-xl border border-border bg-card/70">
        <div className="grid gap-0 md:grid-cols-3">
          <div className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.revenue.activeSubscriptions")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.active}</p>
          </div>
          <div className="border-b border-border/70 p-4 md:border-b-0 md:border-r">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.revenue.pastDue")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{metrics.pastDue}</p>
          </div>
          <div className="p-4">
            <p className="text-xs text-muted-foreground">{t("portalSite.admin.columns.latestInvoice")}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">
              $
              {formatLocaleNumber(metrics.revenue, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-border bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {t("portalSite.admin.revenue.latestTitle")}
            </h2>
            <Badge variant="outline">{recentInvoices.length}</Badge>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portalSite.account.invoiceEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceDate")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoicePlan")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceAmount")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.account.invoiceStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.slice(0, 12).map((invoice) => (
                    <tr key={invoice.id} className="border-t border-border/70">
                      <td className="px-3 py-2 text-muted-foreground">
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
                      <td className="px-3 py-2">
                        <Badge variant="outline">{invoice.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {t("portalSite.admin.revenue.planMixTitle")}
            </h2>
            <Badge variant="outline">{planMix.length}</Badge>
          </div>
          {planMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("portalSite.account.workspaceEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.plan")}</th>
                    <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.workspaces")}</th>
                  </tr>
                </thead>
                <tbody>
                  {planMix.map(([plan, count]) => (
                    <tr key={plan} className="border-t border-border/70">
                      <td className="px-3 py-2 text-foreground">{plan}</td>
                      <td className="px-3 py-2 text-muted-foreground">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PortalSettingsPage>
  );
}
