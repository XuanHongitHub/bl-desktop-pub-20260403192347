"use client";

import {
  Building2,
  Check,
  ChevronRight,
  Crown,
  Gem,
  Minus,
  Plus,
  Rocket,
  Sparkles,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearBillingCheckoutIntent,
  readBillingCheckoutIntent,
  resolveBillingCheckoutIntentForContext,
  subscribeBillingCheckoutIntent,
  writeBillingCheckoutIntent,
} from "@/lib/billing-checkout-intent";
import {
  type BillingCycle,
  type BillingPlan,
  type BillingPlanId,
} from "@/lib/billing-plans";
import {
  readCustomPlanOverride,
  subscribeCustomPlanOverride,
} from "@/lib/custom-plan-config";
import {
  readPlanAddonConfig,
  subscribePlanAddonConfig,
  writePlanAddonConfig,
} from "@/lib/plan-addon-config";
import { getPlanTierByBillingPlanId, getPlanTierTone } from "@/lib/plan-tier";
import { showErrorToast } from "@/lib/toast-utils";
import {
  buildEffectivePlans,
  comparePlanRank,
  getAddonCost,
  getAddonState,
  getEffectivePlanPrice,
  getPlanById,
  getTotalMembers,
  getTotalProfiles,
  normalizePlanId,
  normalizePlanIdFromLabel,
} from "@/lib/workspace-billing-logic";
import type { CloudUser, TeamRole } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

interface WorkspacePricingPageProps {
  user: CloudUser;
  teamRole: TeamRole | null;
  workspaceId?: string | null;
  workspaceMode?: "personal" | "team" | null;
  workspaceName?: string | null;
  workspacePlanLabel?: string | null;
  workspaceCount?: number;
  onOpenBillingManagement: () => void;
}

const FREE_PLAN_PROFILE_LIMIT = 3;
const FREE_PLAN_MEMBER_LIMIT = 1;

function getPlanVisualTone(planId: BillingPlanId) {
  const tone = getPlanTierTone(getPlanTierByBillingPlanId(planId));
  if (planId === "starter") {
    return { ...tone, icon: User };
  }
  if (planId === "growth") {
    return { ...tone, icon: Rocket };
  }
  if (planId === "scale") {
    return { ...tone, icon: Building2 };
  }
  if (planId === "custom") {
    return { ...tone, icon: Gem };
  }
  return { ...tone, icon: Sparkles };
}

function getPlanColumnTone(planId: BillingPlanId): string {
  return getPlanTierTone(getPlanTierByBillingPlanId(planId)).columnTone;
}

function getYearlyDiscountPercent(plan: BillingPlan): number {
  if (plan.monthlyPrice <= 0 || plan.yearlyPrice <= 0) {
    return 0;
  }
  const percent = Math.round((1 - plan.yearlyPrice / plan.monthlyPrice) * 100);
  return percent > 0 ? percent : 0;
}

export function WorkspacePricingPage({
  user,
  teamRole,
  workspaceId = null,
  workspaceName = null,
  workspacePlanLabel = null,
  workspaceCount,
  onOpenBillingManagement,
}: WorkspacePricingPageProps) {
  const { t } = useTranslation();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [hasManualPlanSelection, setHasManualPlanSelection] = useState(false);
  const [customPlanOverride, setCustomPlanOverride] = useState(
    readCustomPlanOverride,
  );
  const [planAddons, setPlanAddons] = useState(readPlanAddonConfig);
  const [checkoutIntent, setCheckoutIntent] = useState(
    readBillingCheckoutIntent,
  );

  useEffect(
    () =>
      subscribeCustomPlanOverride(() =>
        setCustomPlanOverride(readCustomPlanOverride()),
      ),
    [],
  );
  useEffect(
    () => subscribePlanAddonConfig(() => setPlanAddons(readPlanAddonConfig())),
    [],
  );
  useEffect(
    () => subscribeBillingCheckoutIntent((intent) => setCheckoutIntent(intent)),
    [],
  );
  useEffect(() => {
    if (!checkoutIntent) {
      return;
    }
    if (!checkoutIntent.accountId || !checkoutIntent.workspaceId) {
      clearBillingCheckoutIntent();
    }
  }, [checkoutIntent]);

  const planDefinitions = useMemo(
    () => buildEffectivePlans(customPlanOverride),
    [customPlanOverride],
  );
  const canManageBilling =
    user.platformRole === "platform_admin" ||
    teamRole === "owner" ||
    teamRole === "admin";
  const normalizedWorkspacePlanLabel = workspacePlanLabel?.trim() ?? "";
  const hasWorkspacePlanLabel = normalizedWorkspacePlanLabel.length > 0;

  const currentPlanId = useMemo(() => {
    if (hasWorkspacePlanLabel) {
      return normalizePlanIdFromLabel(normalizedWorkspacePlanLabel);
    }
    return normalizePlanId(user.plan);
  }, [hasWorkspacePlanLabel, normalizedWorkspacePlanLabel, user.plan]);

  const currentPlanDisplayName = useMemo(() => {
    if (currentPlanId) {
      return t(`authLanding.plans.${currentPlanId}.name`);
    }
    if (hasWorkspacePlanLabel) {
      return normalizedWorkspacePlanLabel;
    }
    return t("pricingPage.freePlanLabel");
  }, [currentPlanId, hasWorkspacePlanLabel, normalizedWorkspacePlanLabel, t]);

  const resolvedWorkspaceCount = Math.max(
    1,
    workspaceCount ?? user.workspaceSeeds?.length ?? 1,
  );
  const allowSelfServiceDowngrade = resolvedWorkspaceCount <= 1;
  const [selectedPlanId, setSelectedPlanId] = useState<BillingPlanId>(
    () => currentPlanId ?? "growth",
  );

  const selectedPlan = getPlanById(planDefinitions, selectedPlanId);
  const currentPlan = useMemo(
    () => (currentPlanId ? getPlanById(planDefinitions, currentPlanId) : null),
    [currentPlanId, planDefinitions],
  );
  const currentPlanProfiles = currentPlan?.profiles ?? FREE_PLAN_PROFILE_LIMIT;
  const currentPlanMembers = currentPlan?.members ?? FREE_PLAN_MEMBER_LIMIT;

  const activeCheckoutIntent = useMemo(() => {
    return resolveBillingCheckoutIntentForContext(checkoutIntent, {
      accountId: user.id,
      workspaceId,
    });
  }, [checkoutIntent, user.id, workspaceId]);

  const targetPlanId = useMemo(
    () => activeCheckoutIntent?.planId ?? currentPlanId ?? "growth",
    [activeCheckoutIntent?.planId, currentPlanId],
  );
  const pendingCheckoutPlanId = activeCheckoutIntent?.planId ?? null;

  useEffect(() => {
    setSelectedPlanId(targetPlanId);
    if (pendingCheckoutPlanId) {
      setHasManualPlanSelection(true);
      return;
    }
    setHasManualPlanSelection(false);
  }, [targetPlanId, pendingCheckoutPlanId, currentPlanId]);

  useEffect(() => {
    if (planDefinitions.some((plan) => plan.id === selectedPlanId)) {
      return;
    }
    setSelectedPlanId(planDefinitions[0]?.id ?? "growth");
  }, [planDefinitions, selectedPlanId]);

  const comparisonRows = useMemo(() => {
    const valueMap = (
      picker: (plan: (typeof planDefinitions)[number]) => string,
    ) =>
      planDefinitions.reduce(
        (accumulator, plan) => ({
          ...accumulator,
          [plan.id]: picker(plan),
        }),
        {} as Record<BillingPlanId, string>,
      );

    return [
      {
        label: t("pricingPage.compareProfiles"),
        values: valueMap((plan) => String(plan.profiles)),
      },
      {
        label: t("pricingPage.compareMembers"),
        values: valueMap((plan) => String(plan.members)),
      },
      {
        label: t("pricingPage.compareStorage"),
        values: valueMap((plan) => `${plan.storageGb} GB`),
      },
      {
        label: t("pricingPage.compareProxy"),
        values: valueMap((plan) => `${plan.proxyGb} GB`),
      },
      {
        label: t("pricingPage.compareAutomation"),
        values: {
          starter: t("pricingPage.compareAutomationStarter"),
          growth: t("pricingPage.compareAutomationGrowth"),
          scale: t("pricingPage.compareAutomationScale"),
          custom: t("pricingPage.compareAutomationCustom"),
        } as Record<BillingPlanId, string>,
      },
      {
        label: t("pricingPage.compareSecurity"),
        values: {
          starter: t("pricingPage.compareSecurityStarter"),
          growth: t("pricingPage.compareSecurityGrowth"),
          scale: t("pricingPage.compareSecurityScale"),
          custom: t("pricingPage.compareSecurityCustom"),
        } as Record<BillingPlanId, string>,
      },
      {
        label: t("pricingPage.compareSupport"),
        values: {
          starter: t("authLanding.support.email"),
          growth: t("authLanding.support.priority"),
          scale: t("authLanding.support.dedicated"),
          custom: t("authLanding.support.dedicated"),
        } as Record<BillingPlanId, string>,
      },
    ];
  }, [planDefinitions, t]);

  const queuePlanForWorkspace = (planId: BillingPlanId) => {
    if (!workspaceId) {
      showErrorToast(t("billingPage.workspaceRequiredForBilling"));
      return;
    }
    const plan = planDefinitions.find((row) => row.id === planId);
    if (!plan) {
      return;
    }
    writeBillingCheckoutIntent({
      accountId: user.id,
      planId,
      billingCycle,
      requestedAt: new Date().toISOString(),
      workspaceId,
      workspaceName: workspaceName ?? undefined,
      couponCode: null,
      couponDiscountPercent: null,
      checkoutStartedAt: null,
      checkoutCompletedAt: null,
      activationMethod: null,
      checkoutAmountUsd: null,
      prorationCreditUsd: null,
      prorationRemainingDays: null,
      autoStartStripeCheckout: false,
    });
    onOpenBillingManagement();
  };

  const handleSelectPlan = (planId: BillingPlanId) => {
    if (!canManageBilling) {
      showErrorToast(t("pricingPage.memberUpgradeBlocked"));
      return;
    }
    if (!workspaceId) {
      showErrorToast(t("billingPage.workspaceRequiredForBilling"));
      return;
    }
    if (currentPlanId && planId === currentPlanId) {
      onOpenBillingManagement();
      return;
    }

    const isDowngrade = comparePlanRank(planId, currentPlanId) < 0;
    if (isDowngrade && !allowSelfServiceDowngrade) {
      showErrorToast(t("pricingPage.downgradeDisabled"));
      return;
    }

    setHasManualPlanSelection(true);
    setSelectedPlanId(planId);
    queuePlanForWorkspace(planId);
  };

  const handleAddonChange = (
    planId: BillingPlanId,
    key: "extraMembers" | "extraProfileBundles",
    delta: number,
  ) => {
    const current = planAddons[planId];
    const nextValue = Math.max(0, (current?.[key] ?? 0) + delta);
    const next = {
      ...planAddons,
      [planId]: {
        ...current,
        [key]: nextValue,
      },
    };
    setPlanAddons(writePlanAddonConfig(next));
  };

  if (!canManageBilling) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-10">
        <section className="rounded-2xl border border-border/80 bg-card p-6">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t("pricingPage.heroTitle")}
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-6 px-3 text-[11px]">
              {workspaceName ?? t("shell.workspaceSwitcher.current")}
            </Badge>
          </div>
        </section>

        <Card className="overflow-hidden rounded-2xl border border-border/80 shadow-none">
          <div className="h-1 w-full bg-border" />
          <CardHeader className="space-y-2 pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-xl font-semibold text-foreground">
                {currentPlanDisplayName}
              </CardTitle>
              <Badge
                variant="secondary"
                className="h-6 px-2 text-[10px] uppercase"
              >
                {t("pricingPage.currentPlanBadge")}
              </Badge>
            </div>
            <CardDescription className="text-sm text-muted-foreground">
              {t("pricingPage.memberReadonlyDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-6">
            <p className="text-[13px] text-muted-foreground">
              {t("pricingPage.memberReadonlyWorkspacePlan", {
                workspace:
                  workspaceName ?? t("shell.workspaceSwitcher.current"),
                plan: currentPlanDisplayName,
              })}
            </p>
            <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 sm:grid-cols-2">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary" />
                {t("authLanding.featureProfiles", {
                  count: currentPlanProfiles,
                })}
              </p>
              <p className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary" />
                {t("authLanding.featureMembers", { count: currentPlanMembers })}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("pricingPage.memberReadonlyHint")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-muted/35 via-background to-muted/25" />
        <div className="relative space-y-4">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            {t("pricingPage.heroTitle")}
          </h2>
          <p className="max-w-3xl text-[13px] text-muted-foreground">
            {t("pricingPage.heroDescription")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="h-6 px-3 text-[11px]">
              {workspaceName ?? t("shell.workspaceSwitcher.current")}
            </Badge>
            <Badge variant="outline" className="h-6 px-3 text-[11px]">
              {t("pricingPage.currentPlanHint", {
                plan: currentPlanDisplayName,
              })}
            </Badge>
          </div>
          <div className="flex items-center">
            <div className="inline-flex items-center rounded-full border border-border/80 bg-muted/35 p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  billingCycle === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("authLanding.monthly")}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                  billingCycle === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("authLanding.yearly")}
                <Badge
                  variant="secondary"
                  className="h-4 border border-chart-3/30 bg-chart-3/12 px-1.5 text-[9px] text-chart-3 hover:bg-chart-3/18"
                >
                  {t("authLanding.yearlySave")}
                </Badge>
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {!allowSelfServiceDowngrade ? (
          <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
            <p className="text-[12px] text-muted-foreground">
              {t("pricingPage.downgradeDisabledHint")}
            </p>
          </div>
        ) : null}

        {currentPlanId && selectedPlanId !== currentPlanId && (
          <div className="md:col-span-2 xl:col-span-4 rounded-lg border border-border/80 bg-muted/30 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-muted-foreground">
                {t("pricingPage.currentWorkspacePlanHint", {
                  workspace:
                    workspaceName ?? t("shell.workspaceSwitcher.current"),
                  plan: t(`authLanding.plans.${currentPlanId}.name`),
                })}{" "}
                <span className="font-semibold text-foreground">
                  {t("authLanding.selectedPlan")}:{" "}
                  {t(`authLanding.plans.${selectedPlanId}.name`)}
                </span>
              </p>
              {canManageBilling ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={onOpenBillingManagement}
                >
                  {t("pricingPage.ctaSecondary")}
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {planDefinitions.map((plan) => {
          const tone = getPlanVisualTone(plan.id);
          const PlanIcon = tone.icon;
          const isRecommended = Boolean(plan.recommended);
          const isSelected = selectedPlanId === plan.id;
          const isCurrent = currentPlanId === plan.id;
          const isPending = activeCheckoutIntent?.planId === plan.id;
          const showSelectedState =
            isSelected &&
            (hasManualPlanSelection || Boolean(activeCheckoutIntent?.planId));
          const isHighlighted = isCurrent || isPending;
          const isDowngrade = comparePlanRank(plan.id, currentPlanId) < 0;
          const isDowngradeDisabled = isDowngrade && !allowSelfServiceDowngrade;
          const isPlanActionDisabled =
            (!canManageBilling && !isCurrent) || isDowngradeDisabled;
          const planActionVariant =
            isCurrent
              ? "outline"
              : isPending || showSelectedState
                ? "default"
                : isPlanActionDisabled
                  ? "outline"
                  : "default";
          const planActionClassName =
            planActionVariant === "default"
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "";
          const yearlyDiscountPercent = getYearlyDiscountPercent(plan);
          const addon = getAddonState(planAddons, plan.id);
          const addonPrice = getAddonCost(addon, billingCycle);
          const totalPrice = getEffectivePlanPrice(plan, addon, billingCycle);
          const totalProfiles = getTotalProfiles(plan, addon);
          const totalMembers = getTotalMembers(plan, addon);
          const crossedPrice =
            billingCycle === "yearly" && yearlyDiscountPercent > 0
              ? plan.monthlyPrice + getAddonCost(addon, "monthly")
              : null;

          return (
            <Card
              key={plan.id}
              className={`relative h-full overflow-hidden rounded-2xl border shadow-none transition-all duration-200 hover:border-primary/40 ${tone.card} ${isHighlighted ? `ring-1 ${tone.ring} border-primary/40` : ""}`}
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-muted/25 via-transparent to-background/70" />
              <CardHeader className="space-y-3 pb-2 pt-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="inline-flex items-center gap-2.5 text-lg font-semibold">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${tone.iconWrap}`}
                    >
                      <PlanIcon className="h-4 w-4" />
                    </span>
                    {t(`authLanding.plans.${plan.id}.name`)}
                  </CardTitle>
                  {isCurrent ? (
                    <Badge
                      variant="secondary"
                      className="h-5 border-none bg-primary/15 px-1.5 text-[9px] uppercase text-primary hover:bg-primary/15"
                    >
                      {t("pricingPage.currentPlanBadge")}
                    </Badge>
                  ) : isPending ? (
                    <Badge
                      variant="secondary"
                      className="h-5 border-none bg-chart-1/15 px-1.5 text-[9px] uppercase text-chart-1 hover:bg-chart-1/15"
                    >
                      {t("billingPage.pendingPlanBadge")}
                    </Badge>
                  ) : isRecommended ? (
                    <Badge
                      variant="secondary"
                      className={tone.recommendedBadge}
                    >
                      <Crown className="mr-1 h-3 w-3" />
                      {t("authLanding.recommended")}
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 px-1.5 text-[9px] uppercase text-muted-foreground"
                    >
                      {plan.id === "custom"
                        ? t("pricingPage.customPlanBadge")
                        : billingCycle === "yearly"
                          ? t("authLanding.yearly")
                          : t("authLanding.monthly")}
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-[12px]">
                  {t(`authLanding.plans.${plan.id}.description`)}
                </CardDescription>
                {billingCycle === "yearly" && yearlyDiscountPercent > 0 ? (
                  <Badge
                    variant="secondary"
                    className="h-5 w-fit border border-chart-3/30 bg-chart-3/12 px-2 text-[10px] text-chart-3"
                  >
                    -{yearlyDiscountPercent}%
                  </Badge>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1 rounded-xl border border-border/70 bg-background/40 p-3">
                  <div className="flex items-end gap-2">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      ${totalPrice}
                    </p>
                    <p className="pb-1 text-[12px] font-medium text-muted-foreground">
                      /{" "}
                      {billingCycle === "monthly"
                        ? t("authLanding.perMonth")
                        : t("authLanding.perYear")}
                    </p>
                  </div>
                  {crossedPrice !== null ? (
                    <p className="text-[11px] text-muted-foreground line-through">
                      ${crossedPrice} / {t("authLanding.perMonth")}
                    </p>
                  ) : null}
                  {addonPrice > 0 ? (
                    <p className="text-[11px] text-primary">
                      +${addonPrice} {t("pricingPage.addonApplied")}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {t("pricingPage.priceLine", {
                      period:
                        billingCycle === "monthly"
                          ? t("authLanding.perMonth")
                          : t("authLanding.perYear"),
                    })}{" "}
                    <span className={`font-medium ${tone.period}`}>
                      {billingCycle === "monthly"
                        ? t("authLanding.monthly")
                        : t("authLanding.yearly")}
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Check className={`mt-0.5 h-3.5 w-3.5 ${tone.period}`} />
                    {t("authLanding.featureProfiles", { count: totalProfiles })}
                  </p>
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Check className={`mt-0.5 h-3.5 w-3.5 ${tone.period}`} />
                    {t("authLanding.featureMembers", { count: totalMembers })}
                  </p>
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Check className={`mt-0.5 h-3.5 w-3.5 ${tone.period}`} />
                    {t("authLanding.featureStorage", { count: plan.storageGb })}
                  </p>
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Check className={`mt-0.5 h-3.5 w-3.5 ${tone.period}`} />
                    {t("authLanding.featureProxy", { count: plan.proxyGb })}
                  </p>
                  <p className="flex items-start gap-2 text-[12px] text-muted-foreground">
                    <Check className={`mt-0.5 h-3.5 w-3.5 ${tone.period}`} />
                    {t("authLanding.featureSupport", {
                      level: t(`authLanding.support.${plan.support}`),
                    })}
                  </p>
                </div>

                <div className="rounded-xl border border-border/80 bg-background/70 p-3">
                  <p className="text-[11px] font-medium text-foreground">
                    {t("pricingPage.addonTitle")}
                  </p>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("pricingPage.addonMembers")}</span>
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            handleAddonChange(plan.id, "extraMembers", -1)
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-6 text-center text-foreground">
                          {addon.extraMembers}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            handleAddonChange(plan.id, "extraMembers", 1)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t("pricingPage.addonProfiles")}</span>
                      <div className="inline-flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            handleAddonChange(
                              plan.id,
                              "extraProfileBundles",
                              -1,
                            )
                          }
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-6 text-center text-foreground">
                          {addon.extraProfileBundles}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() =>
                            handleAddonChange(plan.id, "extraProfileBundles", 1)
                          }
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  type="button"
                  className={`w-full ${planActionClassName}`.trim()}
                  variant={planActionVariant}
                  onClick={() => {
                    if (isPending || isCurrent) {
                      onOpenBillingManagement();
                      return;
                    }
                    handleSelectPlan(plan.id);
                  }}
                  disabled={isPlanActionDisabled}
                >
                  {isCurrent
                    ? canManageBilling
                      ? t("pricingPage.managePlanCta")
                      : t("pricingPage.viewPlanCta")
                    : isPending
                      ? t("pricingPage.pendingPlanCta")
                      : !canManageBilling
                        ? t("pricingPage.ownerOnlyUpgradeCta")
                        : isDowngrade
                          ? t("pricingPage.downgradeTo", {
                              plan: t(`authLanding.plans.${plan.id}.name`),
                            })
                          : t("authLanding.upgradeTo", {
                              plan: t(`authLanding.plans.${plan.id}.name`),
                            })}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="border-border/80 bg-card shadow-none">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground">
              {t("pricingPage.enterpriseLabel", "Enterprise")}
            </span>{" "}
            {t(
              "pricingPage.enterpriseLine",
              "For teams that need custom limits, enterprise security, and dedicated support.",
            )}
          </p>
          <Button type="button" variant="outline" size="sm">
            {t("pricingPage.enterpriseCta", "Request trial")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {t("pricingPage.compareTitle")}
          </CardTitle>
          <CardDescription className="text-[12px]">
            {t("pricingPage.compareDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div
            className="grid gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold text-muted-foreground"
            style={{
              gridTemplateColumns: `minmax(0,1.6fr) repeat(${planDefinitions.length}, minmax(0,1fr))`,
            }}
          >
            <span>{t("pricingPage.compareColumnFeature")}</span>
            {planDefinitions.map((plan) => (
              <span
                key={`head-${plan.id}`}
                className={`rounded-md px-1.5 py-1 text-center ${getPlanColumnTone(plan.id)}`}
              >
                {t(`authLanding.plans.${plan.id}.name`)}
              </span>
            ))}
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.label}
              className="grid gap-2 rounded-lg border border-border/60 px-3 py-2 text-[12px]"
              style={{
                gridTemplateColumns: `minmax(0,1.6fr) repeat(${planDefinitions.length}, minmax(0,1fr))`,
              }}
            >
              <span className="text-muted-foreground">{row.label}</span>
              {planDefinitions.map((plan) => (
                <span
                  key={`${row.label}-${plan.id}`}
                  className={`rounded px-1 py-0.5 text-center ${getPlanColumnTone(plan.id)}`}
                >
                  {row.values[plan.id]}
                </span>
              ))}
            </div>
          ))}
          <p className="pt-1 text-[11px] text-muted-foreground">
            {t("pricingPage.comparisonNote")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t("pricingPage.faqTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { q: t("pricingPage.faq1Q"), a: t("pricingPage.faq1A") },
              { q: t("pricingPage.faq2Q"), a: t("pricingPage.faq2A") },
              { q: t("pricingPage.faq3Q"), a: t("pricingPage.faq3A") },
            ].map((row) => (
              <div
                key={row.q}
                className="rounded-lg border border-border/70 bg-background/80 p-3"
              >
                <p className="text-[13px] font-semibold text-foreground">
                  {row.q}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                  {row.a}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-gradient-to-b from-card to-muted/30 shadow-none">
          <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
            <div>
              <Badge
                variant="secondary"
                className="h-5 px-2 text-[10px] uppercase tracking-wide"
              >
                {t("pricingPage.ctaBadge")}
              </Badge>
              <h3 className="mt-3 text-base font-semibold">
                {t("pricingPage.ctaTitle")}
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {t("pricingPage.ctaDescription")}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t("pricingPage.currentWorkspacePlanHint", {
                  workspace:
                    workspaceName ?? t("shell.workspaceSwitcher.current"),
                  plan: currentPlanDisplayName,
                })}
              </p>
            </div>
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full"
                onClick={() => handleSelectPlan(selectedPlan.id)}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t("pricingPage.ctaPrimary")}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Button>
              {canManageBilling ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={onOpenBillingManagement}
                >
                  {t("pricingPage.ctaSecondary")}
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
