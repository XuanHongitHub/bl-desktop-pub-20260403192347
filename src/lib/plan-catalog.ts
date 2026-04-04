export type PlanId = "free" | "starter" | "team" | "scale" | "enterprise";
export type PaidPlanId = Exclude<PlanId, "free">;
export type PlanSupportTier = "email" | "priority" | "dedicated";

export type PlanCatalogItem = {
  id: PlanId;
  displayName: string;
  audience: string;
  profiles: number;
  members: number;
  storageGb: number;
  support: PlanSupportTier;
  monthlyPriceUsd: number | null;
  yearlyPriceUsd: number | null;
  recommended?: boolean;
};

export const PLAN_CATALOG: Record<PlanId, PlanCatalogItem> = {
  free: {
    id: "free",
    displayName: "Free",
    audience: "Thử nghiệm cá nhân và setup profile ban đầu",
    profiles: 3,
    members: 1,
    storageGb: 1,
    support: "email",
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
  },
  starter: {
    id: "starter",
    displayName: "Starter",
    audience: "Team operator nhỏ chạy chung một workspace",
    profiles: 50,
    members: 1,
    storageGb: 5,
    support: "email",
    monthlyPriceUsd: 9,
    yearlyPriceUsd: 90,
  },
  team: {
    id: "team",
    displayName: "Team",
    audience:
      "Team nhỏ và vừa cần workspace chung, quota rộng hơn để vận hành ổn định",
    profiles: 300,
    members: 5,
    storageGb: 30,
    support: "priority",
    monthlyPriceUsd: 29,
    yearlyPriceUsd: 290,
    recommended: true,
  },
  scale: {
    id: "scale",
    displayName: "Scale",
    audience: "Vận hành production với concurrency cao hơn và cloud sync",
    profiles: 1000,
    members: 15,
    storageGb: 120,
    support: "dedicated",
    monthlyPriceUsd: 79,
    yearlyPriceUsd: 790,
  },
  enterprise: {
    id: "enterprise",
    displayName: "Enterprise",
    audience:
      "Tổ chức cần quota, governance và chính sách billing theo hợp đồng",
    profiles: 5000,
    members: 50,
    storageGb: 500,
    support: "dedicated",
    monthlyPriceUsd: null,
    yearlyPriceUsd: null,
  },
};

export const PAID_PLAN_IDS: readonly PaidPlanId[] = [
  "starter",
  "team",
  "scale",
  "enterprise",
];
