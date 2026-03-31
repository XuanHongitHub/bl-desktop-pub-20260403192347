"use client";

import { Link2, RefreshCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";

export default function AdminSystemPage() {
  const { t } = useTranslation();
  const {
    connection,
    billingState,
    refreshBilling,
    refreshWorkspaces,
    loadingBilling,
    loadingWorkspaces,
  } = usePortalBillingData();

  const usage = billingState?.usage ?? null;
  const isAuthReady = Boolean(connection?.controlToken);
  const isStripeReady = Boolean(billingState?.subscription.source);
  const isSyncReady = Boolean(usage?.updatedAt);

  const serviceChecks = useMemo(() => {
    return [
      {
        id: "auth",
        service: t("portalSite.admin.system.auth"),
        ready: isAuthReady,
        hint: t("portalSite.admin.system.hintAuthDescription"),
        href: "/signin",
        cta: t("portalSite.nav.auth"),
      },
      {
        id: "stripe",
        service: t("portalSite.admin.system.stripe"),
        ready: isStripeReady,
        hint: t("portalSite.admin.system.hintStripeDescription"),
        href: "/admin/revenue",
        cta: t("portalSite.admin.nav.revenue"),
      },
      {
        id: "sync",
        service: t("portalSite.admin.system.sync"),
        ready: isSyncReady,
        hint: t("portalSite.admin.system.hintSyncDescription"),
        href: "/admin/workspaces",
        cta: t("portalSite.admin.nav.workspaces"),
      },
    ];
  }, [isAuthReady, isStripeReady, isSyncReady, t]);

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.system.title")}
      description={t("portalSite.admin.system.description")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={loadingBilling || loadingWorkspaces}
            onClick={() => {
              void Promise.all([refreshWorkspaces(), refreshBilling()]);
            }}
          >
            <RefreshCcw className="h-4 w-4" />
            {t("portalSite.admin.refresh")}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/audit">{t("portalSite.admin.nav.audit")}</Link>
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("portalSite.admin.system.runtimeTitle")}
          </h2>
          <Badge variant="outline">
            {serviceChecks.filter((service) => service.ready).length}/
            {serviceChecks.length}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.system.serviceColumn")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.status")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.time")}
                </th>
                <th className="px-3 py-2 text-left font-medium">
                  {t("portalSite.admin.columns.action")}
                </th>
              </tr>
            </thead>
            <tbody>
              {serviceChecks.map((service) => (
                <tr
                  key={service.id}
                  className="border-t border-border/70 align-top"
                >
                  <td className="px-3 py-2">
                    <p className="font-medium text-foreground">
                      {service.service}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {service.hint}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={service.ready ? "secondary" : "outline"}>
                      {service.ready
                        ? t("portalSite.admin.system.ready")
                        : t("portalSite.admin.system.pending")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {usage?.updatedAt
                      ? formatLocaleDateTime(usage.updatedAt)
                      : t("portalSite.account.notAvailable")}
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                    >
                      <Link href={service.href}>{service.cta}</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.system.baseUrl")}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-foreground">
              {connection?.controlBaseUrl ||
                t("portalSite.account.notAvailable")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.system.controlToken")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {connection?.controlToken
                ? t("portalSite.admin.system.ready")
                : t("portalSite.admin.system.pending")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.columns.storage")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {usage
                ? `${usage.storageUsedBytes} / ${usage.storageLimitMb} MB`
                : t("portalSite.account.notAvailable")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">
              {t("portalSite.admin.columns.proxy")}
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {usage
                ? `${usage.proxyBandwidthUsedMb} MB`
                : t("portalSite.account.notAvailable")}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          {t("portalSite.admin.system.operationsTitle")}
        </h2>
        <div className="grid gap-2 md:grid-cols-3">
          <Button asChild size="sm" variant="outline" className="justify-start">
            <Link href="/admin/command-center">
              <Link2 className="h-4 w-4" />
              {t("portalSite.admin.nav.commandCenter")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="justify-start">
            <Link href="/admin/workspaces">
              {t("portalSite.admin.nav.workspaces")}
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="justify-start">
            <Link href="/admin/revenue">
              {t("portalSite.admin.nav.revenue")}
            </Link>
          </Button>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
