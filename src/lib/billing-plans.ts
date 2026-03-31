export type BillingCycle = "monthly" | "yearly";
export type BillingPlanId = "starter" | "growth" | "scale" | "custom";

export type BillingPlan = {
  id: BillingPlanId;
  monthlyPrice: number;
  yearlyPrice: number;
  profiles: number;
  members: number;
  storageGb: number;
  support: "email" | "priority" | "dedicated";
  recommended?: boolean;
};

export type CustomPlanOverride = {
  enabled: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  profiles: number;
  members: number;
  storageGb: number;
  support: "email" | "priority" | "dedicated";
  recommended: boolean;
};

export const BILLING_PLAN_DEFINITIONS: readonly BillingPlan[] = [
  {
    id: "starter",
    monthlyPrice: 9,
    yearlyPrice: 9,
    profiles: 50,
    members: 1,
    storageGb: 5,
    support: "email",
  },
  {
    id: "growth",
    monthlyPrice: 29,
    yearlyPrice: 29,
    profiles: 300,
    members: 5,
    storageGb: 30,
    support: "priority",
    recommended: true,
  },
  {
    id: "scale",
    monthlyPrice: 79,
    yearlyPrice: 79,
    profiles: 1000,
    members: 15,
    storageGb: 120,
    support: "dedicated",
  },
  {
    id: "custom",
    monthlyPrice: 0,
    yearlyPrice: 0,
    profiles: 5000,
    members: 50,
    storageGb: 500,
    support: "dedicated",
  },
];

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
    return plans.filter((plan) => plan.id !== "custom");
  }
  return plans.map((plan) =>
    plan.id === "custom"
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
