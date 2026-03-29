"use client";

import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";

export default function AdminAuditLogPage() {
  const { t } = useTranslation();
  const { workspaces } = usePortalBillingData();

  const rows = workspaces.slice(0, 10).map((workspace, index) => ({
    id: `${workspace.id}-${index}`,
    time: workspace.createdAt,
    action: workspace.subscriptionStatus,
    actor: workspace.createdBy,
    reason: `${workspace.name} · ${workspace.planLabel}`,
  }));

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.audit.title")}
      description={t("portalSite.admin.audit.description")}
    >
      <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
        <div className="space-y-2 border-b border-border/70 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("portalSite.admin.audit.tableTitle")}
          </p>
          <p className="text-sm leading-7 text-muted-foreground">
            {t("portalSite.admin.audit.tableDescription")}
          </p>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-border/70">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.time")}</th>
                <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.action")}</th>
                <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.actor")}</th>
                <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.reason")}</th>
              </tr>
            </thead>
            <tbody className="bg-background/80">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-muted-foreground" colSpan={4}>
                    {t("portalSite.account.workspaceEmpty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-border/70">
                    <td className="px-4 py-3 text-foreground">{row.time}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.action}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.actor}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
