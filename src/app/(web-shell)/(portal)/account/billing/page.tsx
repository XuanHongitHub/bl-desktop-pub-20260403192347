"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CreditCard, Database, ExternalLink, HardDrive, Receipt, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  cancelWorkspaceSubscription,
  createWorkspaceStripeCheckout,
  reactivateWorkspaceSubscription,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatMb(value: number): string {
  return `${Math.max(value, 0).toFixed(0)} MB`;
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const amount = value / 1024 ** index;
  return `${amount.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

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

function BillingMetricCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}) {
  return (
    <article className="rounded-[24px] border border-border bg-card/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-[-0.04em] text-foreground">
            {value}
          </p>
          {detail ? (
            <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
          ) : null}
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
          {icon}
        </span>
      </div>
    </article>
  );
}

export default function AccountBillingPage() {
  const { t } = useTranslation();
  const [busyAction, setBusyAction] = useState<
    "" | "checkout" | "cancel_period" | "cancel_now" | "reactivate"
  >("");

  const {
    connection,
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    workspaces,
    billingState,
    loadingWorkspaces,
    loadingBilling,
    workspacesError,
    billingError,
    refreshBilling,
    refreshWorkspaces,
  } = usePortalBillingData();

  const subscription = billingState?.subscription ?? null;
  const usage = billingState?.usage ?? null;
  const invoices = billingState?.recentInvoices ?? [];
  const isRefreshing = loadingWorkspaces || loadingBilling;

  const handleOpenCheckout = async () => {
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.checkout.workspaceRequired"));
      return;
    }

    setBusyAction("checkout");
    try {
      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = `${window.location.origin}/checkout/cancel`;
      const response = await createWorkspaceStripeCheckout(
        connection,
        selectedWorkspaceId,
        {
          planId: subscription?.planId ?? "starter",
          billingCycle: subscription?.billingCycle ?? "yearly",
          successUrl,
          cancelUrl,
        },
      );
      window.location.assign(response.checkoutUrl);
    } catch {
      showErrorToast(t("portalSite.checkout.createFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const handleCancel = async (mode: "period_end" | "immediate") => {
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.account.workspaceEmpty"));
      return;
    }

    setBusyAction(mode === "period_end" ? "cancel_period" : "cancel_now");
    try {
      await cancelWorkspaceSubscription(connection, selectedWorkspaceId, mode);
      showSuccessToast(t("portalSite.account.actionSuccess"));
      await refreshBilling();
    } catch {
      showErrorToast(t("portalSite.account.actionFailed"));
    } finally {
      setBusyAction("");
    }
  };

  const handleReactivate = async () => {
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.account.workspaceEmpty"));
      return;
    }

    setBusyAction("reactivate");
    try {
      await reactivateWorkspaceSubscription(connection, selectedWorkspaceId);
      showSuccessToast(t("portalSite.account.actionSuccess"));
      await refreshBilling();
    } catch {
      showErrorToast(t("portalSite.account.actionFailed"));
    } finally {
      setBusyAction("");
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.nav.billing")}
      description={t("portalSite.account.description")}
      actions={
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/pricing">{t("portalSite.account.changePlan")}</Link>
        </Button>
      }
      className="space-y-6"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.06fr)_360px]">
        <section className="overflow-hidden rounded-[32px] border border-border bg-card/90 shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
          <div className="space-y-8 px-6 py-8 sm:px-8 sm:py-10">
            <section className="grid gap-4 rounded-[28px] border border-border bg-background/70 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="space-y-3">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("portalSite.account.workspace")}
                  </p>
                  <Select
                    value={selectedWorkspaceId || undefined}
                    onValueChange={(nextWorkspaceId) => {
                      if (nextWorkspaceId === selectedWorkspaceId) {
                        return;
                      }
                      setSelectedWorkspaceId(nextWorkspaceId);
                    }}
                    disabled={loadingWorkspaces || workspaces.length === 0}
                  >
                    <SelectTrigger className="h-12 w-full rounded-2xl lg:w-[360px]">
                      <SelectValue
                        placeholder={t("portalSite.account.workspacePlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("portalSite.account.workspaceHint")}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-border bg-transparent px-4 text-sm font-medium hover:bg-muted"
                  onClick={() => {
                    void refreshWorkspaces();
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("portalSite.account.refresh")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-full border-border bg-transparent px-4 text-sm font-medium hover:bg-muted"
                  onClick={() => {
                    void refreshBilling();
                  }}
                  disabled={!selectedWorkspaceId}
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("portalSite.account.refresh")}
                </Button>
              </div>
            </section>

            {workspacesError || billingError ? (
              <div className="rounded-[24px] border border-border bg-background/70 p-5 text-sm text-muted-foreground">
                {workspacesError ? (
                  <p>{t("portalSite.account.loadWorkspacesFailed")}</p>
                ) : null}
                {billingError ? (
                  <p>{t("portalSite.account.loadBillingFailed")}</p>
                ) : null}
              </div>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <BillingMetricCard
                label={t("portalSite.account.plan")}
                value={subscription?.planLabel || t("portalSite.account.noPlan")}
                detail={selectedWorkspace?.name || t("portalSite.account.workspaceEmpty")}
                icon={<CreditCard className="h-4 w-4" />}
              />
              <BillingMetricCard
                label={t("portalSite.account.status")}
                value={subscription?.status || t("portalSite.account.notAvailable")}
                detail={
                  subscription?.expiresAt
                    ? formatDate(
                        subscription.expiresAt,
                        t("portalSite.account.notAvailable"),
                      )
                    : t("portalSite.account.notAvailable")
                }
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <BillingMetricCard
                label={t("portalSite.account.storageUsage")}
                value={
                  usage
                    ? `${formatBytes(usage.storageUsedBytes)} / ${formatMb(usage.storageLimitMb)}`
                    : t("portalSite.account.notAvailable")
                }
                detail={t("portalSite.account.subscriptionDescription")}
                icon={<HardDrive className="h-4 w-4" />}
              />
              <BillingMetricCard
                label={t("portalSite.account.proxyUsage")}
                value={
                  usage
                    ? `${formatMb(usage.proxyBandwidthUsedMb)} / ${formatMb(usage.proxyBandwidthLimitMb)}`
                    : t("portalSite.account.notAvailable")
                }
                detail={t("portalSite.account.paymentMethodDescription")}
                icon={<Database className="h-4 w-4" />}
              />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
              <article className="rounded-[28px] border border-border bg-background/70 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t("portalSite.account.invoiceTitle")}
                    </p>
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                      {t("portalSite.account.subscriptionTitle")}
                    </h2>
                    <p className="max-w-[56ch] text-sm leading-7 text-muted-foreground">
                      {t("portalSite.account.subscriptionDescription")}
                    </p>
                  </div>
                  <span className="inline-flex h-10 items-center rounded-full border border-border bg-card px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {subscription?.billingCycle || t("portalSite.account.cycle")}
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("portalSite.account.plan")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {subscription?.planLabel || t("portalSite.account.noPlan")}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("portalSite.account.cycle")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {subscription?.billingCycle || t("portalSite.account.notAvailable")}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("portalSite.account.renewal")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {formatDate(
                        subscription?.expiresAt,
                        t("portalSite.account.notAvailable"),
                      )}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-border bg-background/70 p-5 sm:p-6">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("portalSite.account.paymentMethodTitle")}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                    {t("portalSite.account.managePayment")}
                  </h2>
                  <p className="text-sm leading-7 text-muted-foreground">
                    {t("portalSite.account.paymentMethodDescription")}
                  </p>
                </div>

                <div className="mt-6 grid gap-3">
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-foreground text-[15px] font-medium text-background hover:opacity-90"
                    onClick={() => {
                      void handleOpenCheckout();
                    }}
                    disabled={!selectedWorkspace || busyAction !== ""}
                  >
                    <ExternalLink className="h-4 w-4" />
                    {busyAction === "checkout"
                      ? t("portalSite.checkout.loading")
                      : t("portalSite.account.managePayment")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-border bg-transparent text-[15px] font-medium hover:bg-muted"
                    onClick={() => {
                      void handleCancel("period_end");
                    }}
                    disabled={!selectedWorkspace || busyAction !== ""}
                  >
                    {t("portalSite.account.cancelAtPeriodEnd")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-border bg-transparent text-[15px] font-medium hover:bg-muted"
                    onClick={() => {
                      void handleCancel("immediate");
                    }}
                    disabled={!selectedWorkspace || busyAction !== ""}
                  >
                    {t("portalSite.account.cancelNow")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-border bg-transparent text-[15px] font-medium hover:bg-muted"
                    onClick={() => {
                      void handleReactivate();
                    }}
                    disabled={!selectedWorkspace || busyAction !== ""}
                  >
                    {t("portalSite.account.reactivate")}
                  </Button>
                </div>
              </article>
            </section>

            <article className="rounded-[28px] border border-border bg-background/70 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t("portalSite.account.invoiceTitle")}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
                    {t("portalSite.account.invoiceDescription")}
                  </h2>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground">
                  <Receipt className="h-4 w-4" />
                </span>
              </div>

              {invoices.length === 0 ? (
                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  {t("portalSite.account.invoiceEmpty")}
                </p>
              ) : (
                <div className="mt-6 overflow-x-auto rounded-[22px] border border-border">
                  <table className="min-w-full table-fixed border-collapse text-left text-sm">
                    <thead className="bg-muted/35 text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3 font-medium">
                          {t("portalSite.account.invoiceDate")}
                        </th>
                        <th className="px-4 py-3 font-medium">
                          {t("portalSite.account.invoicePlan")}
                        </th>
                        <th className="px-4 py-3 font-medium">
                          {t("portalSite.account.invoiceAmount")}
                        </th>
                        <th className="px-4 py-3 font-medium">
                          {t("portalSite.account.invoiceMethod")}
                        </th>
                        <th className="px-4 py-3 font-medium">
                          {t("portalSite.account.invoiceStatus")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-card/80">
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-3 text-foreground">
                            {formatDate(invoice.paidAt, invoice.paidAt)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {invoice.planLabel}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            ${invoice.amountUsd}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {invoice.method}
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {invoice.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        </section>

        <aside className="space-y-4 lg:pt-2">
          <article className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.1)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
                <Users className="h-4 w-4" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("portalSite.account.workspace")}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {selectedWorkspace?.name || t("portalSite.account.workspaceEmpty")}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.1)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("portalSite.account.workspaceStatus")}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {subscription?.status || t("portalSite.account.notAvailable")}
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.1)]">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                {t("portalSite.account.changePlan")}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {t("portalSite.checkout.planDescription")}
              </p>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-full border-border bg-transparent px-4 text-sm font-medium hover:bg-muted"
              >
                <Link href="/pricing">{t("portalSite.account.changePlan")}</Link>
              </Button>
            </div>
          </article>

          {isRefreshing ? (
            <article className="rounded-[28px] border border-border bg-card/90 p-5 text-sm text-muted-foreground shadow-[0_18px_60px_rgba(0,0,0,0.1)]">
              {t("portalSite.account.loading")}
            </article>
          ) : null}
        </aside>
      </div>
    </PortalSettingsPage>
  );
}
