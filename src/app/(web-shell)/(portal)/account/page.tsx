"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CreditCard, ExternalLink, HardDrive, ReceiptText, ShieldCheck, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { Button } from "@/components/ui/button";

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value?.trim()) {
    return fallback;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-border/70 bg-card/70 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </p>
          <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-background/80 text-muted-foreground">
          {icon}
        </span>
      </div>
    </article>
  );
}

export default function AccountPage() {
  const { t } = useTranslation();
  const { selectedWorkspace, billingState } = usePortalBillingData();
  const subscription = billingState?.subscription ?? null;
  const invoices = billingState?.recentInvoices ?? [];

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.dashboardTitle")}
      description={t("portalSite.account.dashboardDescription")}
      actions={
        <>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/account/invoices">{t("portalSite.account.nav.invoices")}</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link href="/account/billing">{t("portalSite.account.nav.billing")}</Link>
          </Button>
        </>
      }
    >
      <section className="grid gap-4 xl:grid-cols-4">
        <Metric
          label={t("portalSite.account.plan")}
          value={subscription?.planLabel || t("portalSite.account.noPlan")}
          detail={selectedWorkspace?.name || t("portalSite.account.workspaceEmpty")}
          icon={<CreditCard className="h-4 w-4" />}
        />
        <Metric
          label={t("portalSite.account.status")}
          value={subscription?.status || t("portalSite.account.notAvailable")}
          detail={formatDate(subscription?.expiresAt, t("portalSite.account.notAvailable"))}
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <Metric
          label={t("portalSite.account.membersLabel")}
          value={selectedWorkspace ? String(selectedWorkspace.profileLimit) : t("portalSite.account.notAvailable")}
          detail={t("portalSite.account.membersDetail")}
          icon={<Users className="h-4 w-4" />}
        />
        <Metric
          label={t("portalSite.account.invoiceTitle")}
          value={String(invoices.length)}
          detail={t("portalSite.account.invoiceDescription")}
          icon={<ReceiptText className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {t("portalSite.account.subscriptionTitle")}
              </p>
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                {selectedWorkspace?.name || t("portalSite.account.workspaceEmpty")}
              </h2>
              <p className="text-sm leading-7 text-muted-foreground">
                {t("portalSite.account.subscriptionDescription")}
              </p>
            </div>
            <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {subscription?.billingCycle || t("portalSite.account.cycle")}
            </span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("portalSite.account.plan")}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {subscription?.planLabel || t("portalSite.account.noPlan")}
              </p>
            </article>
            <article className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("portalSite.account.renewal")}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {formatDate(subscription?.expiresAt, t("portalSite.account.notAvailable"))}
              </p>
            </article>
            <article className="rounded-xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs font-medium text-muted-foreground">{t("portalSite.account.storageUsage")}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {billingState?.usage ? `${billingState.usage.storageUsedBytes} B` : t("portalSite.account.notAvailable")}
              </p>
            </article>
          </div>
        </article>

        <article className="rounded-2xl border border-border/70 bg-card/70 p-6">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t("portalSite.account.quickActions")}
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
              {t("portalSite.account.managePayment")}
            </h2>
            <p className="text-sm leading-7 text-muted-foreground">
              {t("portalSite.account.paymentMethodDescription")}
            </p>
          </div>
          <div className="mt-6 grid gap-3">
            <Button asChild className="justify-between rounded-full">
              <Link href="/account/billing">
                {t("portalSite.account.nav.billing")}
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between rounded-full">
              <Link href="/account/invoices">
                {t("portalSite.account.nav.invoices")}
                <ReceiptText className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-between rounded-full">
              <Link href="/account/settings">
                {t("portalSite.account.nav.settings")}
                <HardDrive className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </article>
      </section>
    </PortalSettingsPage>
  );
}
