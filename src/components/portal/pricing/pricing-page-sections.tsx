"use client";

import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PORTAL_NARROW_CONTENT_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { Button } from "@/components/ui/button";
import { usePortalSessionStore } from "@/hooks/use-portal-session-store";
import {
  BILLING_PLAN_DEFINITIONS,
  type BillingPlanId,
} from "@/lib/billing-plans";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import {
  getPlanRank,
  isFreePlanLabel,
  normalizePlanId,
  normalizePlanIdFromLabel,
} from "@/lib/workspace-billing-logic";

type BillingCycle = "monthly" | "yearly";
const FEATURE_ROWS = ["profiles", "members", "storage"] as const;

type PricingPlanCard = {
  id: BillingPlanId | "free";
  nameKey: string;
  audienceKey: string;
  annualSavings: number;
  values: [string, string, string];
  supportKey: "email" | "priority" | "dedicated";
  highlight: boolean;
  isCustomPlan: boolean;
  isFreePlan: boolean;
  monthlyPriceLabel: string;
  yearlyPriceLabel: string;
};

export function PricingPageSections() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = usePortalSessionStore();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [pendingPlanId, setPendingPlanId] = useState<string>("");

  const currentPlanId = useMemo(() => {
    return (
      normalizePlanId(session?.current?.planId ?? null) ??
      normalizePlanIdFromLabel(session?.current?.planLabel ?? null)
    );
  }, [session?.current?.planId, session?.current?.planLabel]);

  const currentWorkspaceName = session?.current?.workspaceName?.trim() ?? "";
  const currentSubscriptionStatus =
    session?.current?.subscriptionStatus?.trim() ?? "";
  const isCurrentFreePlan =
    currentPlanId == null &&
    isFreePlanLabel(session?.current?.planLabel ?? null) &&
    currentSubscriptionStatus !== "canceled";

  const plans = useMemo<PricingPlanCard[]>(() => {
    const paidPlans = BILLING_PLAN_DEFINITIONS.map((plan) => ({
      id: plan.id,
      nameKey: `portalSite.pricing.plans.${plan.id}.name`,
      audienceKey: `portalSite.pricing.plans.${plan.id}.audience`,
      annualSavings:
        plan.id === "custom"
          ? 0
          : Math.max(0, (plan.monthlyPrice - plan.yearlyPrice) * 12),
      values: [
        plan.profiles.toLocaleString("en-US"),
        String(plan.members),
        `${plan.storageGb.toLocaleString("en-US")} GB`,
      ] as [string, string, string],
      supportKey: plan.support,
      highlight: Boolean(plan.recommended),
      isCustomPlan: plan.id === "custom",
      isFreePlan: false,
      monthlyPriceLabel: `$${plan.monthlyPrice}`,
      yearlyPriceLabel: `$${plan.yearlyPrice}`,
    }));

    const freePlan: PricingPlanCard = {
      id: "free",
      nameKey: "portalSite.pricing.plans.free.name",
      audienceKey: "portalSite.pricing.plans.free.audience",
      annualSavings: 0,
      values: ["3", "1", "1 GB"],
      supportKey: "email",
      highlight: false,
      isCustomPlan: false,
      isFreePlan: true,
      monthlyPriceLabel: "$0",
      yearlyPriceLabel: "$0",
    };

    return [freePlan, ...paidPlans];
  }, []);

  const primaryPlans = plans.slice(0, 3);
  const secondaryPlans = plans.slice(3);

  const openCheckoutReview = (planId: BillingPlanId) => {
    const workspaceId = session?.current?.workspaceId?.trim() ?? "";
    const params = new URLSearchParams();
    params.set("plan", planId);
    params.set("cycle", billingCycle);
    if (workspaceId) {
      params.set("workspaceId", workspaceId);
    }
    router.push(`/checkout?${params.toString()}`);
  };

  const handlePlanIntent = async (planId: BillingPlanId) => {
    if (planId === "custom") {
      router.push("/help");
      return;
    }

    if (currentPlanId && getPlanRank(planId) < getPlanRank(currentPlanId)) {
      showErrorToast(t("portalSite.pricing.downgradeDisabled"));
      return;
    }

    if (!session) {
      const params = new URLSearchParams();
      params.set("next", `/checkout?plan=${planId}&cycle=${billingCycle}`);
      router.push(`/signin?${params.toString()}`);
      return;
    }

    setPendingPlanId(planId);
    openCheckoutReview(planId);
  };

  return (
    <section className="relative min-h-[calc(100vh-4.5rem)] py-10 md:py-14">
      <div className="w-full space-y-10 px-3 md:space-y-12 md:px-6 xl:px-10">
        <div
          className={cn(
            "mx-auto space-y-5 text-center",
            PORTAL_NARROW_CONTENT_WIDTH_CLASS,
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("portalSite.pricing.eyebrow")}
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
            {t("portalSite.pricing.title")}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            {t("portalSite.pricing.description")}
          </p>
          <div className="mx-auto inline-flex h-9 items-center rounded-full border border-border bg-card p-1">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition-colors",
                billingCycle === "monthly"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("portalSite.checkout.cycleMonthly")}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition-colors",
                billingCycle === "yearly"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t("portalSite.checkout.cycleYearly")}
            </button>
          </div>
        </div>

        <div className="w-full px-3 md:px-6 xl:px-10">
          <div className="mx-auto w-full max-w-[1060px] space-y-6">
            {[primaryPlans, secondaryPlans].map((row, rowIndex) => {
              if (row.length === 0) {
                return null;
              }
              return (
                <div
                  key={`plan-row-${rowIndex}`}
                  className={cn(
                    "mx-auto grid w-full grid-cols-1 gap-5 md:grid-cols-2",
                    rowIndex === 0 ? "xl:grid-cols-3" : "max-w-[660px]",
                  )}
                >
                  {row.map((plan) => {
                    const billingPlanId: BillingPlanId | null =
                      plan.id === "free" ? null : plan.id;
                    const isCurrentPlan =
                      plan.id === "free"
                        ? isCurrentFreePlan
                        : currentPlanId === plan.id &&
                          currentSubscriptionStatus !== "canceled";
                    const isDowngrade =
                      billingPlanId == null ||
                      currentPlanId == null ||
                      plan.isCustomPlan ||
                      isCurrentFreePlan
                        ? false
                        : getPlanRank(billingPlanId) <
                          getPlanRank(currentPlanId);
                    const basePrice =
                      billingCycle === "yearly"
                        ? Number.parseFloat(
                            plan.yearlyPriceLabel.replace("$", ""),
                          )
                        : Number.parseFloat(
                            plan.monthlyPriceLabel.replace("$", ""),
                          );
                    const price = plan.isCustomPlan
                      ? plan.monthlyPriceLabel
                      : plan.isFreePlan
                        ? t("portalSite.pricing.freeLabel")
                        : `$${new Intl.NumberFormat("en-US", {
                            maximumFractionDigits: 2,
                          }).format(basePrice)}`;
                    const accent =
                      plan.id === "free"
                        ? "var(--chart-1)"
                        : plan.id === "starter"
                          ? "var(--chart-2)"
                          : plan.id === "growth"
                            ? "var(--chart-3)"
                            : plan.id === "scale"
                              ? "var(--chart-4)"
                              : "var(--chart-5)";
                    const cycleLabel =
                      billingCycle === "yearly"
                        ? t("portalSite.pricing.perMonthBilledYearly")
                        : t("portalSite.pricing.perMonthBilledMonthly");

                    return (
                      <article
                        key={plan.id}
                        style={{
                          backgroundImage: `linear-gradient(to bottom, oklch(${accent} / 0.14), transparent 40%)`,
                        }}
                        className={cn(
                          "flex h-full min-h-[480px] w-full max-w-[320px] flex-col rounded-2xl border bg-card/90 p-5 shadow-sm",
                          plan.highlight
                            ? "border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]"
                            : "border-border/70",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-lg font-semibold text-foreground">
                              {t(plan.nameKey)}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t(plan.audienceKey)}
                            </p>
                          </div>
                          {isCurrentPlan ? (
                            <span className="inline-flex min-h-6 items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-foreground">
                              {t("portalSite.pricing.currentPlanBadge")}
                            </span>
                          ) : plan.highlight ? (
                            <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-foreground">
                              <Sparkles className="h-3 w-3" />
                              {t("portalSite.pricing.mostPopular")}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-5 border-y border-border/70 py-4">
                          <p className="text-3xl font-semibold tracking-[-0.04em] text-foreground">
                            {plan.isCustomPlan
                              ? t("portalSite.pricing.customPriceLabel")
                              : price}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {plan.isCustomPlan
                              ? t("portalSite.pricing.contactSales")
                              : plan.isFreePlan
                                ? t("portalSite.pricing.freePlanPriceLine")
                                : cycleLabel}
                          </p>
                          {billingCycle === "yearly" &&
                          plan.annualSavings > 0 ? (
                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                              {t("portalSite.pricing.saveBadge")} $
                              {plan.annualSavings.toLocaleString("en-US")}
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-4 space-y-2.5 text-sm">
                          {FEATURE_ROWS.map((rowKey, index) => (
                            <div
                              key={`${plan.id}-${rowKey}`}
                              className="flex items-center gap-2"
                            >
                              <Check className="h-4 w-4 text-foreground/80" />
                              <span className="font-semibold text-foreground">
                                {plan.values[index]}
                              </span>
                              <span className="text-muted-foreground">
                                {t(`portalSite.pricing.table.${rowKey}`)}
                              </span>
                            </div>
                          ))}
                          <div className="flex items-center gap-2">
                            <Check className="h-4 w-4 text-foreground/80" />
                            <span className="text-muted-foreground">
                              {t(
                                `portalSite.pricing.support.${plan.supportKey}`,
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="mt-auto pt-5">
                          <Button
                            className={cn(
                              "h-10 w-full rounded-full text-sm font-semibold",
                              plan.highlight || plan.isCustomPlan
                                ? "bg-foreground text-background hover:opacity-90"
                                : "bg-muted text-foreground hover:bg-muted/80",
                            )}
                            disabled={
                              (plan.id !== "free" &&
                                pendingPlanId === plan.id) ||
                              isDowngrade
                            }
                            onClick={() => {
                              if (isCurrentPlan) {
                                router.push("/account/billing");
                                return;
                              }
                              if (plan.isFreePlan) {
                                if (!session) {
                                  const params = new URLSearchParams();
                                  params.set("next", "/pricing");
                                  router.push(`/signin?${params.toString()}`);
                                  return;
                                }
                                router.push("/account/billing");
                                return;
                              }
                              if (isDowngrade) {
                                showErrorToast(
                                  t("portalSite.pricing.downgradeDisabled"),
                                );
                                return;
                              }
                              if (plan.isCustomPlan) {
                                router.push("/help");
                                return;
                              }
                              if (billingPlanId != null) {
                                void handlePlanIntent(billingPlanId);
                              }
                            }}
                          >
                            {isCurrentPlan
                              ? t("portalSite.pricing.managePlanCta")
                              : plan.isCustomPlan
                                ? t("portalSite.pricing.contactSales")
                                : t("portalSite.pricing.selectPlan")}
                            {!isCurrentPlan ? (
                              <ArrowRight className="h-4 w-4" />
                            ) : null}
                          </Button>
                          {isCurrentPlan && currentWorkspaceName ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t(
                                "portalSite.pricing.currentWorkspacePlanHint",
                                {
                                  workspace: currentWorkspaceName,
                                  plan: t(plan.nameKey),
                                },
                              )}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
