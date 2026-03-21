"use client";

import { Check, Crown, Receipt, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBillingPlanPrice, BILLING_PLAN_DEFINITIONS, type BillingCycle } from "@/lib/billing-plans";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { CloudUser, EntitlementSnapshot, RuntimeConfigStatus, TeamRole } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

interface WorkspaceBillingPageProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
  user: CloudUser;
  teamRole: TeamRole | null;
  onOpenAdminWorkspace: () => void;
  onOpenSyncConfig: () => void;
}

function toIntegerOrZero(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

export function WorkspaceBillingPage({
  runtimeConfig,
  entitlement,
  user,
  teamRole,
  onOpenAdminWorkspace,
  onOpenSyncConfig,
}: WorkspaceBillingPageProps) {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<"starter" | "growth" | "scale">(
    "growth",
  );
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const selectedPlan =
    BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === selectedPlanId) ??
    BILLING_PLAN_DEFINITIONS[1];

  const isStripeReady = runtimeConfig?.stripe === "ready";
  const isSyncReady = runtimeConfig?.s3_sync === "ready";
  const isAuthReady = runtimeConfig?.auth === "ready";
  const isReadOnly = entitlement?.state === "read_only";
  const canManageBilling =
    user.platformRole === "platform_admin" || teamRole === "owner" || teamRole === "admin";
  const usageLimit = toIntegerOrZero(user.profileLimit);
  const usageUsed = toIntegerOrZero(user.cloudProfilesUsed);
  const usagePercent =
    usageLimit > 0 ? Math.min(100, Math.round((usageUsed / usageLimit) * 100)) : 0;
  const currentPlanLabel = useMemo(() => {
    const userPlan = user.plan?.toLowerCase();
    if (userPlan === "starter" || userPlan === "growth" || userPlan === "scale") {
      return t(`authLanding.plans.${userPlan}.name`);
    }
    return t("billingPage.planFallback");
  }, [t, user.plan]);

  const invoiceRows = useMemo(
    () => [
      {
        id: "INV-2026-03",
        period: t("billingPage.invoice.currentPeriod"),
        amount: `$${getBillingPlanPrice(selectedPlan, billingCycle)}`,
        status: t("billingPage.invoice.statusOpen"),
      },
      {
        id: "INV-2026-02",
        period: t("billingPage.invoice.previousPeriod"),
        amount: `$${getBillingPlanPrice(selectedPlan, billingCycle)}`,
        status: t("billingPage.invoice.statusPaid"),
      },
      {
        id: "INV-2026-01",
        period: t("billingPage.invoice.twoMonthsAgo"),
        amount: `$${getBillingPlanPrice(selectedPlan, billingCycle)}`,
        status: t("billingPage.invoice.statusPaid"),
      },
    ],
    [billingCycle, selectedPlan, t],
  );

  const handleSelectPlan = (planId: "starter" | "growth" | "scale") => {
    setSelectedPlanId(planId);
    const plan = BILLING_PLAN_DEFINITIONS.find((row) => row.id === planId);
    if (!plan) {
      return;
    }
    const price = getBillingPlanPrice(plan, billingCycle);
    showSuccessToast(t("billingPage.planSelected"), {
      description: `${t(`authLanding.plans.${plan.id}.name`)} • $${price}/${billingCycle === "monthly" ? t("authLanding.perMonth") : t("authLanding.perYear")}`,
    });
  };

  const handleApplyCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) {
      showErrorToast(t("billingPage.couponRequired"));
      return;
    }
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) {
      showErrorToast(t("billingPage.couponInvalid"));
      return;
    }

    try {
      setIsApplyingCoupon(true);
      await new Promise((resolve) => {
        window.setTimeout(resolve, 350);
      });
      if (!isStripeReady) {
        showSuccessToast(t("billingPage.couponQueued"), {
          description: t("billingPage.couponQueuedDescription"),
        });
      } else {
        showSuccessToast(t("billingPage.couponApplied"), {
          description: t("billingPage.couponAppliedDescription"),
        });
      }
      setCouponCode("");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("billingPage.title")}</CardTitle>
          <CardDescription>{t("billingPage.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t("billingPage.currentPlan")}</p>
            <p className="mt-2 text-sm font-medium text-foreground">{currentPlanLabel}</p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t("billingPage.entitlement")}</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {entitlement?.state === "grace_active"
                ? t("adminWorkspace.status.entitlementGrace")
                : isReadOnly
                  ? t("adminWorkspace.status.entitlementReadOnly")
                  : t("adminWorkspace.status.entitlementActive")}
            </p>
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t("billingPage.profileUsage")}</p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {usageLimit > 0
                ? t("billingPage.profileUsageValue", {
                    used: usageUsed,
                    limit: usageLimit,
                  })
                : t("billingPage.unlimited")}
            </p>
            {usageLimit > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("billingPage.profileUsagePercent", { percent: usagePercent })}
              </p>
            )}
          </div>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">{t("billingPage.runtimeStatus")}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant={isAuthReady ? "secondary" : "outline"}>
                {t(isAuthReady ? "billingPage.authReady" : "billingPage.authPending")}
              </Badge>
              <Badge variant={isStripeReady ? "secondary" : "outline"}>
                {t(isStripeReady ? "billingPage.stripeReady" : "billingPage.stripePending")}
              </Badge>
              <Badge variant={isSyncReady ? "secondary" : "outline"}>
                {t(isSyncReady ? "billingPage.syncReady" : "billingPage.syncPending")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("authLanding.pricingTitle")}</CardTitle>
          <CardDescription>{t("billingPage.pricingDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={billingCycle === "monthly" ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle("monthly")}
            >
              {t("authLanding.monthly")}
            </Button>
            <Button
              type="button"
              variant={billingCycle === "yearly" ? "default" : "outline"}
              size="sm"
              onClick={() => setBillingCycle("yearly")}
            >
              {t("authLanding.yearly")}
            </Button>
            <Badge variant="secondary">{t("authLanding.yearlySave")}</Badge>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {BILLING_PLAN_DEFINITIONS.map((plan) => {
              const price = getBillingPlanPrice(plan, billingCycle);
              const isSelected = selectedPlanId === plan.id;
              return (
                <Card key={plan.id} className={isSelected ? "border-primary" : undefined}>
                  <CardHeader className="space-y-2 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{t(`authLanding.plans.${plan.id}.name`)}</CardTitle>
                      {plan.recommended && (
                        <Badge variant="secondary">
                          <Crown className="mr-1 h-3 w-3" />
                          {t("authLanding.recommended")}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{t(`authLanding.plans.${plan.id}.description`)}</CardDescription>
                    <div className="text-lg font-semibold text-foreground">
                      ${price}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        /{billingCycle === "monthly" ? t("authLanding.perMonth") : t("authLanding.perYear")}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("authLanding.featureProfiles", { count: plan.profiles })}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("authLanding.featureMembers", { count: plan.members })}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("authLanding.featureStorage", { count: plan.storageGb })}
                    </p>
                    <p className="flex items-center gap-2 text-xs text-foreground">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                      {t("authLanding.featureSupport", {
                        level: t(`authLanding.support.${plan.support}`),
                      })}
                    </p>
                    <Button
                      type="button"
                      className="mt-2 w-full"
                      variant={isSelected ? "default" : "outline"}
                      onClick={() => handleSelectPlan(plan.id)}
                    >
                      {isSelected ? t("authLanding.selectedPlan") : t("authLanding.selectPlan")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {isReadOnly && (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {t("entitlement.readOnlyDescription")}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("billingPage.couponTitle")}</CardTitle>
            <CardDescription>{t("billingPage.couponDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder={t("billingPage.couponPlaceholder")}
              disabled={isApplyingCoupon}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => {
                  void handleApplyCoupon();
                }}
                disabled={isApplyingCoupon}
              >
                {t("billingPage.applyCoupon")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onOpenSyncConfig}
              >
                {t("authLanding.openSyncConfig")}
              </Button>
              {canManageBilling && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenAdminWorkspace}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  {t("billingPage.openAdminWorkspace")}
                </Button>
              )}
            </div>
            {!isStripeReady && (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("authLanding.stripePending")}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("billingPage.invoice.title")}</CardTitle>
            <CardDescription>{t("billingPage.invoice.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 pr-2">
              <div className="space-y-2">
                {invoiceRows.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{invoice.id}</p>
                      <p className="text-[11px] text-muted-foreground">{invoice.period}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground">{invoice.amount}</p>
                      <p className="text-[11px] text-muted-foreground">{invoice.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Receipt className="h-3.5 w-3.5" />
              {t("billingPage.invoice.note")}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
