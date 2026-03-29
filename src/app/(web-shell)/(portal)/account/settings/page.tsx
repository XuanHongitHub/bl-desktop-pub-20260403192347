"use client";

import type { ReactNode } from "react";
import { Bell, Globe2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";

function SettingRow({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="flex items-start gap-4 rounded-2xl border border-border/70 bg-card/70 p-5">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground">
        {icon}
      </span>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </article>
  );
}

export default function AccountSettingsPage() {
  const { t } = useTranslation();
  const { session, selectedWorkspace } = usePortalBillingData();

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.nav.settings")}
      description={t("portalSite.account.settingsDescription")}
    >
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("portalSite.account.profileTitle")}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
            {session?.user.name || session?.user.email || t("portalSite.account.workspaceEmpty")}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {selectedWorkspace?.name || t("portalSite.account.workspaceEmpty")}
          </p>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("portalSite.account.securityTitle")}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">
            {t("portalSite.account.securityDescription")}
          </h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t("portalSite.account.paymentMethodDescription")}
          </p>
        </article>
      </section>

      <section className="grid gap-4">
        <SettingRow
          icon={<Globe2 className="h-4 w-4" />}
          title={t("portalSite.account.languageTitle")}
          description={t("portalSite.account.languageDescription")}
        />
        <SettingRow
          icon={<Bell className="h-4 w-4" />}
          title={t("portalSite.account.notificationsTitle")}
          description={t("portalSite.account.notificationsDescription")}
        />
        <SettingRow
          icon={<ShieldCheck className="h-4 w-4" />}
          title={t("portalSite.account.securityTitle")}
          description={t("portalSite.account.securityDescription")}
        />
      </section>
    </PortalSettingsPage>
  );
}
