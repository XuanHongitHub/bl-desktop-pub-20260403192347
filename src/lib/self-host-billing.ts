import type { BillingCycle, BillingPlanId } from "@/lib/billing-plans";

export type SelfHostedPaymentMethod =
  | "self_host_checkout"
  | "coupon"
  | "license"
  | "stripe";

export interface SelfHostedInvoice {
  id: string;
  accountId: string;
  workspaceId: string;
  workspaceName: string;
  planId: BillingPlanId;
  planLabel: string;
  billingCycle: BillingCycle;
  amountUsd: number;
  baseAmountUsd: number;
  discountPercent: number;
  method: SelfHostedPaymentMethod;
  couponCode: string | null;
  status: "paid";
  createdAt: string;
  paidAt: string;
}

function toWorkspaceSlug(workspaceId: string): string {
  return (
    workspaceId
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "WORKSPACE"
  );
}

export function buildSelfHostedLicenseCode(
  workspaceId: string,
  planId: BillingPlanId,
): string {
  const planTag = planId.toUpperCase();
  const slug = toWorkspaceSlug(workspaceId);
  return `BUG-${slug}-${planTag}`;
}
