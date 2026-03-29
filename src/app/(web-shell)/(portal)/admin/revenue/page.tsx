"use client";

import { useTranslation } from "react-i18next";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";

export default function AdminRevenuePage() {
  const { t } = useTranslation();
  const { workspaces } = usePortalBillingData();

  const activeSubscriptions = workspaces.filter(
    (workspace) => workspace.subscriptionStatus === "active",
  ).length;
  const pastDue = workspaces.filter(
    (workspace) => workspace.subscriptionStatus === "past_due",
  ).length;
  const entitlementActive = workspaces.filter(
    (workspace) => workspace.subscriptionSource !== "license",
  ).length;
  const couponCount = workspaces.filter(
    (workspace) => workspace.planLabel.toLowerCase() === "starter",
  ).length;

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.revenue.title")}
      description={t("portalSite.admin.revenue.description")}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {t("portalSite.admin.revenue.activeSubscriptions")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {activeSubscriptions}
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {t("portalSite.admin.revenue.coupons")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {couponCount}
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {t("portalSite.admin.revenue.entitlementActive")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {entitlementActive}
            </p>
          </article>
          <article className="rounded-2xl border border-border bg-card/70 p-4">
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              {t("portalSite.admin.revenue.pastDue")}
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{pastDue}</p>
          </article>
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-base font-semibold text-foreground">
            {t("portalSite.admin.revenue.latestTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("portalSite.admin.revenue.latestDescription")}
          </p>

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    {t("portalSite.admin.columns.workspace")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("portalSite.admin.columns.plan")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("portalSite.admin.columns.latestInvoice")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("portalSite.admin.columns.status")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {workspaces.slice(0, 8).map((workspace) => (
                  <tr key={workspace.id} className="border-t border-border/70">
                    <td className="px-4 py-3 text-foreground">{workspace.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {workspace.planLabel}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {workspace.expiresAt || t("portalSite.account.notAvailable")}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {workspace.subscriptionStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      </section>
    </PortalSettingsPage>
  );
}
