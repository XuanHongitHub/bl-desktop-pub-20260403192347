"use client";

import { useTranslation } from "react-i18next";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";

export default function AdminSystemPage() {
  const { t } = useTranslation();
  const { connection, workspaces } = usePortalBillingData();

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.system.title")}
      description={t("portalSite.admin.system.description")}
    >
      <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-base font-semibold text-foreground">
            {t("portalSite.admin.system.runtimeTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("portalSite.admin.system.runtimeDescription")}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.system.baseUrl")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {connection?.controlBaseUrl || t("portalSite.account.notAvailable")}
              </p>
            </article>
            <article className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.system.controlToken")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {connection?.controlToken
                  ? `${connection.controlToken.slice(0, 6)}...`
                  : t("portalSite.account.notAvailable")}
              </p>
            </article>
          </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <h2 className="text-base font-semibold text-foreground">
            {t("portalSite.admin.commandCenter.systemTitle")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("portalSite.admin.commandCenter.systemDescription")}
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.system.auth")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {connection ? t("portalSite.admin.system.ready") : t("portalSite.admin.system.pending")}
              </p>
            </article>
            <article className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.system.stripe")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {workspaces.length > 0
                  ? t("portalSite.admin.system.ready")
                  : t("portalSite.admin.system.pending")}
              </p>
            </article>
            <article className="rounded-lg border border-border/70 bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                {t("portalSite.admin.system.sync")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {connection ? t("portalSite.admin.system.ready") : t("portalSite.admin.system.pending")}
              </p>
            </article>
          </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("portalSite.admin.system.hintAuthTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("portalSite.admin.system.hintAuthDescription")}
            </p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("portalSite.admin.system.hintStripeTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("portalSite.admin.system.hintStripeDescription")}
            </p>
          </article>
          <article className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("portalSite.admin.system.hintSyncTitle")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("portalSite.admin.system.hintSyncDescription")}
            </p>
          </article>
      </section>
    </PortalSettingsPage>
  );
}
