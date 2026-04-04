"use client";

import { ArrowRight, CreditCard, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  cancelWorkspaceSubscription,
  reactivateWorkspaceSubscription,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import {
  computeStorageUsagePercent,
  formatStorageUsagePercentLabel,
} from "@/lib/storage-usage";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

export default function AccountBillingPage() {
  const { t } = useTranslation();
  const {
    connection,
    selectedWorkspace,
    selectedWorkspaceId,
    billingState,
    refreshBilling,
  } = usePortalBillingData();
  const [pendingAction, setPendingAction] = useState<
    "period_end" | "immediate" | "reactivate" | null
  >(null);
  const usage = billingState?.usage ?? null;
  const subscription = billingState?.subscription ?? null;
  const workspaceRole = selectedWorkspace?.actorRole ?? "viewer";
  const canManageBilling = workspaceRole === "owner" || workspaceRole === "admin";
  const hasPaidPlan = Boolean(subscription?.planId);
  const canReactivate = hasPaidPlan && Boolean(subscription?.cancelAtPeriodEnd);
  const canCancel = hasPaidPlan && subscription?.status !== "canceled";

  const planLabel =
    billingState?.subscription.planLabel ??
    selectedWorkspace?.planLabel ??
    t("portalSite.account.noPlan");
  const storagePercent = computeStorageUsagePercent(usage);
  const storagePercentLabel = formatStorageUsagePercentLabel(
    storagePercent,
    usage?.storageUsedBytes ?? 0,
  );

  const statusBadgeVariant = (status: string | null | undefined) => {
    if (status === "active") return "success" as const;
    if (status === "past_due") return "destructive" as const;
    if (status === "canceled") return "warning" as const;
    return "outline" as const;
  };

  const handleSubscriptionAction = async (
    mode: "period_end" | "immediate" | "reactivate",
  ) => {
    if (!canManageBilling) {
      showErrorToast(t("billingPage.memberReadonlyHint"));
      return;
    }
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.account.actionFailed"));
      return;
    }

    setPendingAction(mode);
    try {
      if (mode === "reactivate") {
        await reactivateWorkspaceSubscription(connection, selectedWorkspaceId);
      } else {
        await cancelWorkspaceSubscription(connection, selectedWorkspaceId, mode);
      }
      await refreshBilling();
      showSuccessToast(t("portalSite.account.actionSuccess"));
    } catch (error) {
      const description =
        error instanceof Error ? error.message : t("portalSite.account.actionFailed");
      showErrorToast(t("portalSite.account.actionFailed"), { description });
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.subscriptionTitle")}
      description={t("portalSite.account.subscriptionDescription")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" disabled={!canManageBilling}>
            <Link href="/pricing">
              {t("portalSite.account.openPricing")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" disabled={!canManageBilling}>
            <Link href="/checkout">{t("portalSite.account.goToCheckout")}</Link>
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border border-border bg-card/70">
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="space-y-4 border-b border-border/70 p-4 lg:border-b-0 lg:border-r">
            <h2 className="text-sm font-semibold text-foreground">
              {t("portalSite.account.workspace")}
            </h2>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <dt className="text-xs text-muted-foreground">{t("portalSite.account.workspace")}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {selectedWorkspace?.name ?? t("portalSite.account.workspaceEmpty")}
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <dt className="text-xs text-muted-foreground">{t("portalSite.account.workspaceMode")}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {selectedWorkspace?.mode ?? t("portalSite.account.notAvailable")}
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <dt className="text-xs text-muted-foreground">{t("portalSite.account.plan")}</dt>
                <dd className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                  {planLabel}
                  <Badge variant="info" className="h-5 px-2 text-[10px]">
                    {billingState?.subscription.billingCycle ?? "--"}
                  </Badge>
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3">
                <dt className="text-xs text-muted-foreground">{t("portalSite.account.status")}</dt>
                <dd className="mt-1">
                  <Badge
                    variant={statusBadgeVariant(billingState?.subscription.status)}
                    className="h-5 px-2 text-[10px] capitalize"
                  >
                    {billingState?.subscription.status ?? t("portalSite.account.notAvailable")}
                  </Badge>
                </dd>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/70 p-3 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">{t("portalSite.account.renewal")}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {billingState?.subscription.expiresAt
                    ? formatLocaleDateTime(billingState.subscription.expiresAt)
                    : t("portalSite.account.notAvailable")}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" disabled={!canManageBilling}>
                <Link href="/checkout">{t("portalSite.account.goToCheckout")}</Link>
              </Button>
              <Button asChild size="sm" variant="outline" disabled={!canManageBilling}>
                <Link href="/pricing">{t("portalSite.account.changePlan")}</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/account/invoices">{t("portalSite.account.nav.invoices")}</Link>
              </Button>
            </div>
          </div>

          <div className="space-y-4 p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <CreditCard className="h-4 w-4 text-chart-1" />
              {t("portalSite.account.usageSnapshot")}
            </h2>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("portalSite.account.storageUsage")}</span>
                  <span className="font-medium text-foreground">
                    {storagePercentLabel}
                  </span>
                </div>
                <Progress value={storagePercent} className="h-2" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("portalSite.account.paymentMethodDescription")}
            </p>
            {!canManageBilling ? (
              <p className="text-sm text-muted-foreground">
                {t("billingPage.memberReadonlyHint")}
              </p>
            ) : null}

            {!hasPaidPlan ? (
              <Button
                asChild
                size="sm"
                variant="secondary"
                disabled={!canManageBilling}
              >
                <Link href="/pricing">{t("portalSite.account.selectPlan")}</Link>
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {canReactivate ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canManageBilling || pendingAction !== null}
                    onClick={() => void handleSubscriptionAction("reactivate")}
                  >
                    {t("portalSite.account.reactivate")}
                  </Button>
                ) : null}
                {canCancel ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canManageBilling || pendingAction !== null}
                      onClick={() => void handleSubscriptionAction("period_end")}
                    >
                      {t("portalSite.account.cancelAtPeriodEnd")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={!canManageBilling || pendingAction !== null}
                      onClick={() => void handleSubscriptionAction("immediate")}
                    >
                      {t("portalSite.account.cancelNow")}
                    </Button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-background/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 text-chart-2" />
            {t("portalSite.account.paymentSecurityNote")}
          </h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/help">{t("portalSite.nav.help")}</Link>
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("portalSite.account.paymentSecurityHint")}
        </p>
      </section>
    </PortalSettingsPage>
  );
}
