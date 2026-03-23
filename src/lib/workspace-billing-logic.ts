import {
  BILLING_PLAN_DEFINITIONS,
  type BillingCycle,
  type BillingPlan,
  type BillingPlanId,
  type CustomPlanOverride,
  getBillingPlanPrice,
  mergeCustomPlanOverride,
} from "@/lib/billing-plans";
import {
  EXTRA_MEMBER_PRICE_MONTHLY,
  EXTRA_PROFILE_BUNDLE_PRICE_MONTHLY,
  type PlanAddonConfig,
  type PlanAddonState,
  PROFILE_BUNDLE_SIZE,
} from "@/lib/plan-addon-config";

export function normalizePlanId(
  plan: string | null | undefined,
): BillingPlanId | null {
  const normalized = plan?.toLowerCase();
  if (
    normalized === "starter" ||
    normalized === "growth" ||
    normalized === "scale" ||
    normalized === "custom"
  ) {
    return normalized;
  }
  return null;
}

export function getPlanRank(planId: BillingPlanId | null | undefined): number {
  if (planId === "starter") {
    return 1;
  }
  if (planId === "growth") {
    return 2;
  }
  if (planId === "scale") {
    return 3;
  }
  if (planId === "custom") {
    return 4;
  }
  return 0;
}

export function comparePlanRank(
  leftPlanId: BillingPlanId | null | undefined,
  rightPlanId: BillingPlanId | null | undefined,
): number {
  return getPlanRank(leftPlanId) - getPlanRank(rightPlanId);
}

export function normalizePlanIdFromLabel(
  planLabel: string | null | undefined,
): BillingPlanId | null {
  const normalized = planLabel?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return null;
  }
  if (normalized.includes("custom") || normalized.includes("enterprise")) {
    return "custom";
  }
  if (normalized.includes("scale") || normalized.includes("business")) {
    return "scale";
  }
  if (normalized.includes("growth") || normalized.includes("pro")) {
    return "growth";
  }
  if (
    normalized.includes("starter") ||
    normalized.includes("mini") ||
    normalized.includes("basic")
  ) {
    return "starter";
  }
  return normalizePlanId(normalized);
}

export function isFreePlanLabel(planLabel: string | null | undefined): boolean {
  const normalized = planLabel?.trim().toLowerCase() ?? "";
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("free") ||
    normalized.includes("miễn") ||
    normalized.includes("không trả")
  );
}

export function buildEffectivePlans(
  customPlanOverride: CustomPlanOverride,
): BillingPlan[] {
  return mergeCustomPlanOverride(BILLING_PLAN_DEFINITIONS, customPlanOverride);
}

export function getPlanById(
  plans: BillingPlan[],
  planId: BillingPlanId | null,
  fallbackId: BillingPlanId = "growth",
): BillingPlan {
  return (
    plans.find((plan) => plan.id === planId) ??
    plans.find((plan) => plan.id === fallbackId) ??
    plans[0]
  );
}

export function getAddonState(
  planAddons: PlanAddonConfig,
  planId: BillingPlanId,
): PlanAddonState {
  return planAddons[planId] ?? { extraMembers: 0, extraProfileBundles: 0 };
}

export function getAddonMonthlyCost(addon: PlanAddonState): number {
  return (
    addon.extraMembers * EXTRA_MEMBER_PRICE_MONTHLY +
    addon.extraProfileBundles * EXTRA_PROFILE_BUNDLE_PRICE_MONTHLY
  );
}

export function getAddonCost(
  addon: PlanAddonState,
  billingCycle: BillingCycle,
): number {
  const monthlyCost = getAddonMonthlyCost(addon);
  if (billingCycle === "monthly") {
    return monthlyCost;
  }
  if (monthlyCost <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(monthlyCost * 0.8));
}

export function getEffectivePlanPrice(
  plan: BillingPlan,
  addon: PlanAddonState,
  billingCycle: BillingCycle,
): number {
  return (
    getBillingPlanPrice(plan, billingCycle) + getAddonCost(addon, billingCycle)
  );
}

export function getTotalProfiles(
  plan: BillingPlan,
  addon: PlanAddonState,
): number {
  return plan.profiles + addon.extraProfileBundles * PROFILE_BUNDLE_SIZE;
}

export function getTotalMembers(
  plan: BillingPlan,
  addon: PlanAddonState,
): number {
  return plan.members + addon.extraMembers;
}

export function getEffectiveProfileLimit(
  baseLimit: number,
  addon: PlanAddonState,
): number {
  return baseLimit + addon.extraProfileBundles * PROFILE_BUNDLE_SIZE;
}
