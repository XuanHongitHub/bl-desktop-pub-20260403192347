import type { BillingPlanId } from "@/lib/billing-plans";
import { PLAN_CATALOG } from "@/lib/plan-catalog";
import {
  isFreePlanLabel,
  normalizePlanId,
  normalizePlanIdFromLabel,
} from "@/lib/workspace-billing-logic";

export type UnifiedPlanId = BillingPlanId | "free";

export function resolveUnifiedPlanId(input: {
  planId?: string | null;
  planLabel?: string | null;
}): UnifiedPlanId {
  const normalizedById = normalizePlanId(input.planId);
  if (normalizedById) {
    return normalizedById;
  }

  const normalizedByLabel = normalizePlanIdFromLabel(input.planLabel);
  if (normalizedByLabel) {
    return normalizedByLabel;
  }

  if (isFreePlanLabel(input.planLabel)) {
    return "free";
  }
  return "free";
}

export function getUnifiedPlanLabel(input: {
  planId?: string | null;
  planLabel?: string | null;
}): string {
  const planId = resolveUnifiedPlanId(input);
  return PLAN_CATALOG[planId].displayName;
}

export function getUnifiedPlanToneClass(planId: UnifiedPlanId): string {
  if (planId === "enterprise") return "plan-badge-tier-enterprise";
  if (planId === "scale") return "plan-badge-tier-scale";
  if (planId === "team") return "plan-badge-tier-team";
  if (planId === "starter") return "plan-badge-tier-starter";
  return "plan-badge-tier-free";
}
