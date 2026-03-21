export type BillingCycle = "monthly" | "yearly";

export type BillingPlan = {
  id: "starter" | "growth" | "scale";
  monthlyPrice: number;
  yearlyPrice: number;
  profiles: number;
  members: number;
  storageGb: number;
  support: "email" | "priority" | "dedicated";
  recommended?: boolean;
};

export const BILLING_PLAN_DEFINITIONS: readonly BillingPlan[] = [
  {
    id: "starter",
    monthlyPrice: 9,
    yearlyPrice: 7,
    profiles: 30,
    members: 1,
    storageGb: 5,
    support: "email",
  },
  {
    id: "growth",
    monthlyPrice: 19,
    yearlyPrice: 15,
    profiles: 120,
    members: 5,
    storageGb: 20,
    support: "priority",
    recommended: true,
  },
  {
    id: "scale",
    monthlyPrice: 39,
    yearlyPrice: 31,
    profiles: 500,
    members: 25,
    storageGb: 80,
    support: "dedicated",
  },
];

export function getBillingPlanPrice(plan: BillingPlan, cycle: BillingCycle): number {
  return cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
}
