"use client";

import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";

function resolveRisk(
  status: "active" | "past_due" | "canceled",
): "low" | "medium" | "high" {
  if (status === "past_due") {
    return "high";
  }
  if (status === "canceled") {
    return "medium";
  }
  return "low";
}

export default function AdminWorkspacesPage() {
  const { t } = useTranslation();
  const { workspaces, loadingWorkspaces, workspacesError } = usePortalBillingData();

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.workspaces.title")}
      description={t("portalSite.admin.workspaces.description")}
    >
      <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-base font-semibold text-foreground">
            {t("portalSite.admin.workspaces.tableTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("portalSite.admin.workspaces.tableDescription")}
          </p>

          {loadingWorkspaces ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {t("portalSite.admin.loading")}
            </p>
          ) : null}

          {workspacesError ? (
            <p className="mt-2 text-sm text-destructive">
              {t("portalSite.account.loadWorkspacesFailed")}
            </p>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-2xl border border-border/70">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.workspace")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.plan")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.risk")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.status")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.members")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.storage")}</th>
                  <th className="px-4 py-3 font-medium">{t("portalSite.admin.columns.proxy")}</th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {workspaces.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 text-muted-foreground"
                      colSpan={7}
                    >
                      {t("portalSite.account.workspaceEmpty")}
                    </td>
                  </tr>
                ) : (
                  workspaces.map((workspace) => (
                    <tr key={workspace.id} className="border-t border-border/70">
                      <td className="px-4 py-3 text-foreground">{workspace.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {workspace.planLabel}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {t(
                          `portalSite.admin.risk.${resolveRisk(
                            workspace.subscriptionStatus,
                          )}`,
                        )}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {workspace.subscriptionStatus}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {workspace.mode}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {workspace.profileLimit}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {workspace.billingCycle || t("portalSite.account.notAvailable")}
                      </td>
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
