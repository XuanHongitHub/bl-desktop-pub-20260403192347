import type { BillingPlanId } from "@/lib/billing-plans";

export type PlanTier = "free" | "bronze" | "silver" | "gold" | "platinum";

type BadgeVariant = "default" | "secondary" | "outline";

export interface PlanBadgeStyle {
  variant: BadgeVariant;
  className: string;
}

export interface PlanTierTone {
  card: string;
  ring: string;
  iconWrap: string;
  period: string;
  columnTone: string;
  accentBar: string;
  recommendedBadge: string;
}

function normalizePlanValue(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

export function getPlanTier(planLabel?: string | null): PlanTier {
  const normalized = normalizePlanValue(planLabel);
  if (!normalized) {
    return "free";
  }

  if (
    normalized.includes("self-host") ||
    normalized.includes("self host") ||
    normalized.includes("local")
  ) {
    return "free";
  }

  if (
    normalized.includes("platinum") ||
    normalized.includes("enterprise") ||
    normalized.includes("custom")
  ) {
    return "platinum";
  }
  if (
    normalized.includes("gold") ||
    normalized.includes("scale") ||
    normalized.includes("business")
  ) {
    return "gold";
  }
  if (
    normalized.includes("silver") ||
    normalized.includes("growth") ||
    normalized.includes("pro") ||
    normalized.includes("ag")
  ) {
    return "silver";
  }
  if (
    normalized.includes("bronze") ||
    normalized.includes("starter") ||
    normalized.includes("basic")
  ) {
    return "bronze";
  }
  return normalized.includes("free") ? "free" : "bronze";
}

export function getPlanTierByBillingPlanId(planId: BillingPlanId): PlanTier {
  if (planId === "starter") {
    return "bronze";
  }
  if (planId === "growth") {
    return "silver";
  }
  if (planId === "scale") {
    return "gold";
  }
  return "platinum";
}

export function getPlanBadgeStyle(planLabel?: string | null): PlanBadgeStyle {
  const tier = getPlanTier(planLabel);
  switch (tier) {
    case "platinum":
      return {
        variant: "secondary",
        className:
          "min-h-5 shrink-0 border border-chart-4/35 bg-chart-4/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-chart-4",
      };
    case "gold":
      return {
        variant: "secondary",
        className:
          "min-h-5 shrink-0 border border-chart-3/35 bg-chart-3/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-chart-3",
      };
    case "silver":
      return {
        variant: "secondary",
        className:
          "min-h-5 shrink-0 border border-chart-2/30 bg-chart-2/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-chart-2",
      };
    case "bronze":
      return {
        variant: "secondary",
        className:
          "min-h-5 shrink-0 border border-chart-1/35 bg-chart-1/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-chart-1",
      };
    default:
      return {
        variant: "secondary",
        className:
          "min-h-5 shrink-0 border border-border/80 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground",
      };
  }
}

export function getPlanTierDisplayLabel(planLabel?: string | null): string {
  const tier = getPlanTier(planLabel);
  switch (tier) {
    case "bronze":
      return "Bronze";
    case "silver":
      return "Ag";
    case "gold":
      return "Gold";
    case "platinum":
      return "Platinum";
    default:
      return "Free";
  }
}

export function getPlanTierTone(tier: PlanTier): PlanTierTone {
  switch (tier) {
    case "platinum":
      return {
        card: "border-chart-4/25 bg-card",
        ring: "ring-chart-4/35",
        iconWrap: "bg-chart-4/10 text-chart-4 border-chart-4/20",
        period: "text-chart-4",
        columnTone: "bg-chart-4/12 text-chart-4",
        accentBar: "bg-chart-4/70",
        recommendedBadge:
          "h-5 border border-chart-4/30 bg-chart-4/12 px-1.5 text-[9px] uppercase text-chart-4 hover:bg-chart-4/15",
      };
    case "gold":
      return {
        card: "border-chart-3/30 bg-card",
        ring: "ring-chart-3/35",
        iconWrap: "bg-chart-3/10 text-chart-3 border-chart-3/22",
        period: "text-chart-3",
        columnTone: "bg-chart-3/10 text-chart-3",
        accentBar: "bg-chart-3/70",
        recommendedBadge:
          "h-5 border border-chart-3/30 bg-chart-3/10 px-1.5 text-[9px] uppercase text-chart-3 hover:bg-chart-3/12",
      };
    case "silver":
      return {
        card: "border-chart-2/30 bg-card",
        ring: "ring-chart-2/30",
        iconWrap: "bg-chart-2/10 text-chart-2 border-chart-2/20",
        period: "text-chart-2",
        columnTone: "bg-chart-2/10 text-chart-2",
        accentBar: "bg-chart-2/70",
        recommendedBadge:
          "h-5 border border-chart-2/30 bg-chart-2/10 px-1.5 text-[9px] uppercase text-chart-2 hover:bg-chart-2/10",
      };
    case "bronze":
      return {
        card: "border-chart-1/28 bg-card",
        ring: "ring-chart-1/30",
        iconWrap: "bg-chart-1/10 text-chart-1 border-chart-1/20",
        period: "text-chart-1",
        columnTone: "bg-chart-1/10 text-chart-1",
        accentBar: "bg-chart-1/60",
        recommendedBadge:
          "h-5 border border-chart-1/30 bg-chart-1/10 px-1.5 text-[9px] uppercase text-chart-1 hover:bg-chart-1/12",
      };
    default:
      return {
        card: "border-border/75 bg-card",
        ring: "ring-border",
        iconWrap: "bg-muted text-foreground border-border/70",
        period: "text-foreground",
        columnTone: "bg-muted/70 text-foreground",
        accentBar: "bg-border",
        recommendedBadge:
          "h-5 border border-border/80 bg-muted/60 px-1.5 text-[9px] uppercase text-foreground hover:bg-muted/70",
      };
  }
}
