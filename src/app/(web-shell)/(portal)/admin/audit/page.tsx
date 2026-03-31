"use client";

import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";

export default function AdminAuditPage() {
  const { t } = useTranslation();
  const { billingState, selectedWorkspace } = usePortalBillingData();
  const invoices = billingState?.recentInvoices ?? [];
  const statusCounts = invoices.reduce<Record<string, number>>(
    (acc, invoice) => {
      const key = invoice.status || "unknown";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.audit.title")}
      description={t("portalSite.admin.audit.description")}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {Object.entries(statusCounts)
          .slice(0, 3)
          .map(([status, count]) => (
            <Card key={status} className="border-border/70 bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-base capitalize">{status}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold text-foreground">
                  {count}
                </p>
              </CardContent>
            </Card>
          ))}
      </div>

      <Card className="border-border/70 bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {t("portalSite.admin.audit.tableTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {invoices.length === 0 ? (
            <p>{t("portalSite.account.invoiceEmpty")}</p>
          ) : (
            <div className="overflow-hidden rounded-md border border-border/70">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("portalSite.admin.columns.action")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("portalSite.admin.columns.actor")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("portalSite.admin.columns.reason")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      {t("portalSite.admin.columns.time")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.slice(0, 20).map((invoice) => (
                    <tr key={invoice.id} className="border-t border-border/70">
                      <td className="px-3 py-2 text-foreground">
                        {invoice.status}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {invoice.actorUserId}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {invoice.method}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {formatLocaleDateTime(
                          invoice.paidAt || invoice.createdAt,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedWorkspace ? (
            <p className="mt-3">{selectedWorkspace.name}</p>
          ) : null}
          <p className="mt-1">{t("portalSite.admin.audit.tableDescription")}</p>
        </CardContent>
      </Card>
    </PortalSettingsPage>
  );
}
