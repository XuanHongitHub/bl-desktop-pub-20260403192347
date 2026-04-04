"use client";

import { ArrowRight, KeyRound, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  redeemWorkspaceCoupon,
  redeemWorkspaceLicense,
} from "@/components/web-billing/control-api";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime } from "@/lib/locale-format";
import {
  computeStorageUsagePercent,
  formatStorageUsagePercentLabel,
} from "@/lib/storage-usage";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

function buildErrorDescription(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function AccountPlanPage() {
  const { t } = useTranslation();
  const {
    connection,
    selectedWorkspaceId,
    selectedWorkspace,
    billingState,
    refreshBilling,
  } = usePortalBillingData();
  const [couponCode, setCouponCode] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [submittingCoupon, setSubmittingCoupon] = useState(false);
  const [submittingLicense, setSubmittingLicense] = useState(false);

  const subscription = billingState?.subscription ?? null;
  const usage = billingState?.usage ?? null;
  const workspaceRole = selectedWorkspace?.actorRole ?? "viewer";
  const canManagePlan = workspaceRole === "owner" || workspaceRole === "admin";
  const storagePercent = useMemo(
    () => computeStorageUsagePercent(usage),
    [usage],
  );
  const storagePercentLabel = useMemo(
    () =>
      formatStorageUsagePercentLabel(storagePercent, usage?.storageUsedBytes ?? 0),
    [storagePercent, usage?.storageUsedBytes],
  );

  const redeemCoupon = async () => {
    if (!canManagePlan) {
      showErrorToast(t("billingPage.memberReadonlyHint"));
      return;
    }
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    if (!couponCode.trim()) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    setSubmittingCoupon(true);
    try {
      await redeemWorkspaceCoupon(connection, selectedWorkspaceId, {
        code: couponCode.trim().toUpperCase(),
      });
      setCouponCode("");
      showSuccessToast(t("portalSite.commerce.toasts.couponRedeemed"));
      await refreshBilling();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "redeem_coupon_failed"),
      });
    } finally {
      setSubmittingCoupon(false);
    }
  };

  const redeemLicense = async () => {
    if (!canManagePlan) {
      showErrorToast(t("billingPage.memberReadonlyHint"));
      return;
    }
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.commerce.errors.connectionMissing"));
      return;
    }
    if (!licenseKey.trim()) {
      showErrorToast(t("portalSite.commerce.errors.requiredFields"));
      return;
    }
    setSubmittingLicense(true);
    try {
      await redeemWorkspaceLicense(connection, selectedWorkspaceId, {
        key: licenseKey.trim(),
      });
      setLicenseKey("");
      showSuccessToast(t("portalSite.commerce.toasts.licenseRedeemed"));
      await refreshBilling();
    } catch (error) {
      showErrorToast(t("portalSite.commerce.errors.actionFailed"), {
        description: buildErrorDescription(error, "redeem_license_failed"),
      });
    } finally {
      setSubmittingLicense(false);
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.account.eyebrow")}
      title={t("portalSite.account.planMenu")}
      description={t("portalSite.commerce.accountPlan.description")}
      actions={
        <Button asChild size="sm" variant="outline" disabled={!canManagePlan}>
          <Link href="/pricing">
            {t("portalSite.account.changePlan")}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.plan")}</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {subscription?.planLabel ?? t("portalSite.account.noPlan")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.status")}</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {subscription?.status ?? t("portalSite.account.notAvailable")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.cycle")}</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {subscription?.billingCycle ?? t("portalSite.account.notAvailable")}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.renewal")}</p>
            <p className="mt-1 text-base font-semibold text-foreground">
              {subscription?.expiresAt
                ? formatLocaleDateTime(subscription.expiresAt)
                : t("portalSite.account.notAvailable")}
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border/70 bg-background/70 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t("portalSite.account.storageUsage")}</p>
            <Badge variant="outline">{storagePercentLabel}</Badge>
          </div>
          <Progress value={storagePercent} />
        </div>
        {!canManagePlan ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {t("billingPage.memberReadonlyHint")}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/70 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TicketPercent className="h-4 w-4 text-muted-foreground" />
            {t("portalSite.commerce.accountPlan.couponTitle")}
          </h2>
          <div className="flex gap-2">
            <Input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder={t("portalSite.commerce.fields.couponCode")}
              className="h-9"
              disabled={!canManagePlan || submittingCoupon}
            />
            <Button
              onClick={() => void redeemCoupon()}
              disabled={!canManagePlan || submittingCoupon}
            >
              {t("portalSite.commerce.actions.redeemCoupon")}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/70 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            {t("portalSite.commerce.accountPlan.licenseTitle")}
          </h2>
          <div className="flex gap-2">
            <Input
              value={licenseKey}
              onChange={(event) => setLicenseKey(event.target.value)}
              placeholder={t("portalSite.commerce.fields.licenseKey")}
              className="h-9"
              disabled={!canManagePlan || submittingLicense}
            />
            <Button
              onClick={() => void redeemLicense()}
              disabled={!canManagePlan || submittingLicense}
            >
              {t("portalSite.commerce.actions.redeemLicense")}
            </Button>
          </div>
        </div>
      </section>
    </PortalSettingsPage>
  );
}
