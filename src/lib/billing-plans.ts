export type BillingCycle = "monthly" | "yearly";
export type BillingPlanId = "starter" | "growth" | "scale" | "custom";

export type BillingPlan = {
  id: BillingPlanId;
  monthlyPrice: number;
  yearlyPrice: number;
  profiles: number;
  members: number;
  storageGb: number;
  proxyGb: number;
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
  proxyGb: number;
  support: "email" | "priority" | "dedicated";
  recommended: boolean;
};

export const BILLING_PLAN_DEFINITIONS: readonly BillingPlan[] = [
  {
    id: "starter",
    monthlyPrice: 5,
    yearlyPrice: 4,
    profiles: 100,
    members: 2,
    storageGb: 2,
    proxyGb: 2,
    support: "email",
  },
  {
    id: "growth",
    monthlyPrice: 15,
    yearlyPrice: 12,
    profiles: 300,
    members: 5,
    storageGb: 10,
    proxyGb: 2,
    support: "priority",
    recommended: true,
  },
  {
    id: "scale",
    monthlyPrice: 49,
    yearlyPrice: 39,
    profiles: 1000,
    members: 10,
    storageGb: 30,
    proxyGb: 2,
    support: "dedicated",
  },
  {
    id: "custom",
    monthlyPrice: 99,
    yearlyPrice: 79,
    profiles: 2000,
    members: 25,
    storageGb: 80,
    proxyGb: 2,
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
          proxyGb: customOverride.proxyGb,
          support: customOverride.support,
          recommended: customOverride.recommended,
        }
      : plan,
  );
}
