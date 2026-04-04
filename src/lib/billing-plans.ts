import {
  PAID_PLAN_IDS,
  PLAN_CATALOG,
  type PaidPlanId,
  type PlanSupportTier,
} from "@/lib/plan-catalog";

export type BillingCycle = "monthly" | "yearly";
export type BillingPlanId = PaidPlanId;

export type BillingPlan = {
  id: BillingPlanId;
  monthlyPrice: number;
  yearlyPrice: number;
  profiles: number;
  members: number;
  storageGb: number;
  support: PlanSupportTier;
  recommended?: boolean;
};

export type CustomPlanOverride = {
  enabled: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  profiles: number;
  members: number;
  storageGb: number;
  support: PlanSupportTier;
  recommended: boolean;
};

export const BILLING_PLAN_DEFINITIONS: readonly BillingPlan[] = PAID_PLAN_IDS.map(
  (id) => {
    const item = PLAN_CATALOG[id];
    return {
      id,
      monthlyPrice: item.monthlyPriceUsd ?? 0,
      yearlyPrice: item.yearlyPriceUsd ?? 0,
      profiles: item.profiles,
      members: item.members,
      storageGb: item.storageGb,
      support: item.support,
      recommended: item.recommended,
    } satisfies BillingPlan;
  },
);

export function getBillingPlanPrice(
  plan: BillingPlan,
  cycle: BillingCycle,
): number {
  return cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
}

export function mergeCustomPlanOverride(
  plans: readonly BillingPlan[],
  customOverride: CustomPlanOverride | null,
): BillingPlan[] {
  if (!customOverride) {
    return [...plans];
  }
  if (!customOverride.enabled) {
    return plans.filter((plan) => plan.id !== "enterprise");
  }
  return plans.map((plan) =>
    plan.id === "enterprise"
      ? {
          ...plan,
          monthlyPrice: customOverride.monthlyPrice,
          yearlyPrice: customOverride.yearlyPrice,
          profiles: customOverride.profiles,
          members: customOverride.members,
          storageGb: customOverride.storageGb,
          support: customOverride.support,
          recommended: customOverride.recommended,
        }
      : plan,
  );
}
