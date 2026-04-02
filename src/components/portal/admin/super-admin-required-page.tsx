"use client";

import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";

interface SuperAdminRequiredPageProps {
  titleKey: string;
  descriptionKey?: string;
  menuGroupKey: string;
}

export function SuperAdminRequiredPage({
  titleKey,
  descriptionKey,
  menuGroupKey,
}: SuperAdminRequiredPageProps) {
  const { t } = useTranslation();

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t(titleKey)}
      description={descriptionKey ? t(descriptionKey) : t("portalSite.admin.placeholder.description")}
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{t(menuGroupKey)}</Badge>
          <Badge variant="outline">{t("portalSite.admin.placeholder.requiredNow")}</Badge>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("portalSite.admin.placeholder.scope", { section: t(titleKey) })}
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="text-sm font-semibold text-foreground">
          {t("portalSite.admin.placeholder.tableTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("portalSite.admin.placeholder.tableDescription")}
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.action")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.status")}</th>
                <th className="px-3 py-2 text-left font-medium">{t("portalSite.admin.columns.reason")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/70">
                <td className="px-3 py-2 text-foreground">{t("portalSite.admin.placeholder.todoAction")}</td>
                <td className="px-3 py-2 text-muted-foreground">{t("portalSite.admin.system.pending")}</td>
                <td className="px-3 py-2 text-muted-foreground">{t("portalSite.admin.placeholder.todoReason")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
