"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PortalHeaderControls } from "@/components/portal/portal-header-controls";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";

export default function AccountSettingsPage() {
  const { t } = useTranslation();
  const { session, selectedWorkspace, billingState } = usePortalBillingData();

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.nav.settings")}
      description={t("portalSite.account.settingsDescription")}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link href="/account">{t("portalSite.account.nav.overview")}</Link>
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("portalSite.account.profileTitle")}
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.profileTitle")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {session?.user.name || "BugLogin"}
            </p>
            <p className="text-xs text-muted-foreground">
              {session?.user.email || t("portalSite.account.notAvailable")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.accountRole")}</p>
            <div className="mt-1">
              <Badge variant="secondary">
                {session?.user.platformRole === "platform_admin"
                  ? t("shell.roles.platform_admin")
                  : t("shell.roles.member")}
              </Badge>
            </div>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3 md:col-span-2">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.currentWorkspace")}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {selectedWorkspace?.name || t("portalSite.account.workspaceEmpty")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.status")}:{" "}
              <span className="text-foreground">
                {billingState?.subscription.status || t("portalSite.account.notAvailable")}
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          {t("portalSite.account.preferencesTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("portalSite.account.languageDescription")}</p>
        <PortalHeaderControls showAccount={false} />
        <div className="mt-3 rounded-lg border border-border/70 bg-background/70 px-3 py-2.5 text-sm text-muted-foreground">
          {t("portalSite.account.notificationsDescription")}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/account/billing">{t("portalSite.account.nav.billing")}</Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/account/invoices">{t("portalSite.account.nav.invoices")}</Link>
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background/70 p-4">
        <h2 className="text-sm font-semibold text-foreground">{t("portalSite.account.securityTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("portalSite.account.securityDescription")}</p>
      </section>
    </PortalSettingsPage>
  );
}
