import type { BillingCycle, BillingPlanId } from "@/lib/billing-plans";

export interface BillingCheckoutIntent {
  accountId?: string | null;
  planId: BillingPlanId;
  billingCycle: BillingCycle;
  requestedAt: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  couponCode?: string | null;
  couponDiscountPercent?: number | null;
  checkoutStartedAt?: string | null;
  checkoutCompletedAt?: string | null;
  activationMethod?: "stripe" | "coupon" | "license" | null;
}

const BILLING_CHECKOUT_INTENT_KEY = "buglogin.billing.checkout-intent.v1";
const BILLING_CHECKOUT_INTENT_EVENT = "buglogin:billing-checkout-intent";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readBillingCheckoutIntent(): BillingCheckoutIntent | null {
  if (!canUseStorage()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(BILLING_CHECKOUT_INTENT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as BillingCheckoutIntent;
    if (!parsed?.planId || !parsed?.billingCycle || !parsed?.requestedAt) {
      return null;
    }
    return {
      ...parsed,
      accountId: parsed.accountId?.trim() || null,
      workspaceId: parsed.workspaceId?.trim() || null,
      workspaceName: parsed.workspaceName?.trim() || null,
      couponCode: parsed.couponCode ?? null,
      couponDiscountPercent:
        typeof parsed.couponDiscountPercent === "number"
          ? parsed.couponDiscountPercent
          : null,
      checkoutStartedAt: parsed.checkoutStartedAt ?? null,
      checkoutCompletedAt: parsed.checkoutCompletedAt ?? null,
      activationMethod: parsed.activationMethod ?? null,
    };
  } catch {
    return null;
  }
}

export function resolveBillingCheckoutIntentForContext(
  intent: BillingCheckoutIntent | null,
  context: {
    accountId?: string | null;
    workspaceId?: string | null;
  },
): BillingCheckoutIntent | null {
  if (!intent) {
    return null;
  }

  const accountId = context.accountId?.trim() || null;
  const workspaceId = context.workspaceId?.trim() || null;
  if (!accountId || !workspaceId) {
    return null;
  }

  const intentAccountId = intent.accountId?.trim() || null;
  const intentWorkspaceId = intent.workspaceId?.trim() || null;
  if (!intentAccountId || !intentWorkspaceId) {
    return null;
  }

  if (intentAccountId !== accountId) {
    return null;
  }
  if (intentWorkspaceId !== workspaceId) {
    return null;
  }

  return intent;
}

export function writeBillingCheckoutIntent(intent: BillingCheckoutIntent): BillingCheckoutIntent {
  if (!canUseStorage()) {
    return intent;
  }
  window.localStorage.setItem(BILLING_CHECKOUT_INTENT_KEY, JSON.stringify(intent));
  window.dispatchEvent(new CustomEvent(BILLING_CHECKOUT_INTENT_EVENT, { detail: intent }));
  return intent;
}

export function clearBillingCheckoutIntent(): void {
  if (!canUseStorage()) {
    return;
  }
  window.localStorage.removeItem(BILLING_CHECKOUT_INTENT_KEY);
  window.dispatchEvent(new CustomEvent(BILLING_CHECKOUT_INTENT_EVENT, { detail: null }));
}

export function subscribeBillingCheckoutIntent(
  callback: (intent: BillingCheckoutIntent | null) => void,
): () => void {
  if (!canUseStorage()) {
    return () => undefined;
  }
  const onChange = () => {
    callback(readBillingCheckoutIntent());
  };
  const onCustom = (event: Event) => {
    const customEvent = event as CustomEvent<BillingCheckoutIntent | null>;
    callback(customEvent.detail ?? null);
  };
  window.addEventListener("storage", onChange);
  window.addEventListener(BILLING_CHECKOUT_INTENT_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(BILLING_CHECKOUT_INTENT_EVENT, onCustom);
  };
}
