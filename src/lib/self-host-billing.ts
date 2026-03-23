import {
  BILLING_PLAN_DEFINITIONS,
  type BillingCycle,
  type BillingPlanId,
} from "@/lib/billing-plans";
import { normalizePlanId } from "@/lib/workspace-billing-logic";
import type { CloudUser, ControlCoupon } from "@/types";

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

export interface SelfHostedWorkspaceSubscription {
  accountId: string;
  workspaceId: string;
  workspaceName: string;
  planId: BillingPlanId;
  planLabel: string;
  billingCycle: BillingCycle;
  profileLimit: number;
  status: "active";
  updatedAt: string;
  lastInvoiceId: string | null;
}

interface SelfHostedBillingState {
  version: 1;
  coupons: ControlCoupon[];
  invoices: SelfHostedInvoice[];
  subscriptions: Record<string, SelfHostedWorkspaceSubscription>;
}

interface SelfHostedActivationInput {
  accountId: string;
  workspaceId: string;
  workspaceName: string;
  planId: BillingPlanId;
  planLabel: string;
  billingCycle: BillingCycle;
  profileLimit: number;
  baseAmountUsd: number;
  discountPercent?: number | null;
  method: SelfHostedPaymentMethod;
  couponCode?: string | null;
}

interface SelfHostedCouponSelectionInput {
  workspaceId: string;
  codes: string[];
}

interface SelfHostedCouponSelectionResult {
  bestCoupon: ControlCoupon | null;
  reason: string;
}

interface SelfHostedLicenseClaimInput {
  workspaceId: string;
  planId: BillingPlanId;
  code: string;
}

const SELF_HOST_BILLING_KEY = "buglogin.selfhost.billing.v1";
const SELF_HOST_BILLING_EVENT = "buglogin:selfhost-billing-updated";

const DEFAULT_COUPON_CODES = ["FREE100", "LOCAL100", "BUG100"];

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function createLocalId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultCoupon(code: string): ControlCoupon {
  const now = new Date().toISOString();
  return {
    id: createLocalId("coupon"),
    code,
    source: "internal",
    discountPercent: 100,
    workspaceAllowlist: [],
    workspaceDenylist: [],
    maxRedemptions: 0,
    redeemedCount: 0,
    expiresAt: "2099-12-31T00:00:00.000Z",
    revokedAt: null,
    createdAt: now,
    createdBy: "self-host-system",
  };
}

function createDefaultState(): SelfHostedBillingState {
  return {
    version: 1,
    coupons: DEFAULT_COUPON_CODES.map((code) => createDefaultCoupon(code)),
    invoices: [],
    subscriptions: {},
  };
}

function normalizeBillingState(
  input: Partial<SelfHostedBillingState> | null | undefined,
): SelfHostedBillingState {
  const fallback = createDefaultState();
  if (!input || typeof input !== "object") {
    return fallback;
  }
  const coupons = Array.isArray(input.coupons) ? input.coupons : [];
  const invoices = Array.isArray(input.invoices) ? input.invoices : [];
  const subscriptions =
    input.subscriptions && typeof input.subscriptions === "object"
      ? input.subscriptions
      : {};
  const state: SelfHostedBillingState = {
    version: 1,
    coupons,
    invoices,
    subscriptions,
  };
  ensureDefaultCoupons(state);
  return state;
}

function ensureDefaultCoupons(state: SelfHostedBillingState): void {
  for (const code of DEFAULT_COUPON_CODES) {
    if (state.coupons.some((coupon) => coupon.code.toUpperCase() === code)) {
      continue;
    }
    state.coupons.unshift(createDefaultCoupon(code));
  }
}

function writeState(state: SelfHostedBillingState): SelfHostedBillingState {
  if (!canUseStorage()) {
    return state;
  }
  window.localStorage.setItem(SELF_HOST_BILLING_KEY, JSON.stringify(state));
  window.dispatchEvent(
    new CustomEvent(SELF_HOST_BILLING_EVENT, { detail: state }),
  );
  return state;
}

function mutateState(
  updater: (state: SelfHostedBillingState) => void,
): SelfHostedBillingState {
  const state = readSelfHostedBillingState();
  updater(state);
  ensureDefaultCoupons(state);
  return writeState(state);
}

function toSubscriptionKey(accountId: string, workspaceId: string): string {
  return `${accountId.trim()}::${workspaceId.trim()}`;
}

function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

function isCouponEligible(
  coupon: ControlCoupon,
  workspaceId: string,
  nowMs: number,
): boolean {
  if (coupon.revokedAt) {
    return false;
  }
  if (Date.parse(coupon.expiresAt) <= nowMs) {
    return false;
  }
  if (
    coupon.workspaceAllowlist.length > 0 &&
    !coupon.workspaceAllowlist.includes(workspaceId)
  ) {
    return false;
  }
  if (coupon.workspaceDenylist.includes(workspaceId)) {
    return false;
  }
  if (
    coupon.maxRedemptions > 0 &&
    coupon.redeemedCount >= coupon.maxRedemptions
  ) {
    return false;
  }
  return true;
}

function toWorkspaceSlug(workspaceId: string): string {
  const normalized = workspaceId.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (normalized.length >= 6) {
    return normalized.slice(-6);
  }
  return normalized.padEnd(6, "X");
}

export function buildSelfHostedLicenseCode(
  workspaceId: string,
  planId: BillingPlanId,
): string {
  const slug = toWorkspaceSlug(workspaceId);
  return `BUG-${slug}-${planId.toUpperCase()}-SELF`;
}

export function validateSelfHostedLicense(
  input: SelfHostedLicenseClaimInput,
): boolean {
  const normalizedCode = normalizeCouponCode(input.code);
  const planTag = input.planId.toUpperCase();
  const slug = toWorkspaceSlug(input.workspaceId);
  const candidates = [
    `BUG-${slug}-${planTag}`,
    `BUG-${slug}-${planTag}-SELF`,
    `BUG-${slug}-${planTag}-M`,
    `BUG-${slug}-${planTag}-Y`,
  ];
  return candidates.includes(normalizedCode);
}

export function readSelfHostedBillingState(): SelfHostedBillingState {
  if (!canUseStorage()) {
    return createDefaultState();
  }
  try {
    const raw = window.localStorage.getItem(SELF_HOST_BILLING_KEY);
    if (!raw) {
      return createDefaultState();
    }
    const parsed = JSON.parse(raw) as Partial<SelfHostedBillingState>;
    return normalizeBillingState(parsed);
  } catch {
    return createDefaultState();
  }
}

export function subscribeSelfHostedBillingState(
  callback: (state: SelfHostedBillingState) => void,
): () => void {
  if (!canUseStorage()) {
    return () => undefined;
  }
  const onStorage = () => callback(readSelfHostedBillingState());
  const onCustom = (event: Event) => {
    const customEvent = event as CustomEvent<SelfHostedBillingState>;
    callback(customEvent.detail ?? readSelfHostedBillingState());
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(SELF_HOST_BILLING_EVENT, onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SELF_HOST_BILLING_EVENT, onCustom);
  };
}

export function seedSelfHostedBillingForUser(user: CloudUser | null): void {
  if (!user) {
    return;
  }
  mutateState((state) => {
    const seeds = user.workspaceSeeds ?? [];
    const now = new Date().toISOString();
    for (const seed of seeds) {
      const planId =
        normalizePlanId(seed.planLabel) ??
        normalizePlanId(user.plan) ??
        "starter";
      const key = toSubscriptionKey(user.id, seed.id);
      if (state.subscriptions[key]) {
        continue;
      }
      state.subscriptions[key] = {
        accountId: user.id,
        workspaceId: seed.id,
        workspaceName: seed.name,
        planId,
        planLabel: seed.planLabel,
        billingCycle: user.planPeriod === "yearly" ? "yearly" : "monthly",
        profileLimit: seed.profileLimit ?? user.profileLimit,
        status: "active",
        updatedAt: now,
        lastInvoiceId: null,
      };
    }
  });
}

export function listSelfHostedCoupons(): ControlCoupon[] {
  return [...readSelfHostedBillingState().coupons].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function createSelfHostedCoupon(input: {
  code: string;
  source: "internal" | "stripe";
  discountPercent: number;
  maxRedemptions: number;
  expiresAt: string;
  workspaceAllowlist?: string[];
  workspaceDenylist?: string[];
  actorUserId: string;
}): ControlCoupon {
  const normalizedCode = normalizeCouponCode(input.code);
  let created: ControlCoupon | null = null;
  mutateState((state) => {
    if (
      state.coupons.some(
        (coupon) => coupon.code.toUpperCase() === normalizedCode,
      )
    ) {
      throw new Error("coupon_code_exists");
    }
    created = {
      id: createLocalId("coupon"),
      code: normalizedCode,
      source: input.source,
      discountPercent: input.discountPercent,
      workspaceAllowlist: input.workspaceAllowlist ?? [],
      workspaceDenylist: input.workspaceDenylist ?? [],
      maxRedemptions: input.maxRedemptions,
      redeemedCount: 0,
      expiresAt: input.expiresAt,
      revokedAt: null,
      createdAt: new Date().toISOString(),
      createdBy: input.actorUserId,
    };
    state.coupons.unshift(created);
  });
  if (!created) {
    throw new Error("coupon_create_failed");
  }
  return created;
}

export function revokeSelfHostedCoupon(couponId: string): ControlCoupon {
  let revoked: ControlCoupon | null = null;
  mutateState((state) => {
    const now = new Date().toISOString();
    state.coupons = state.coupons.map((coupon) => {
      if (coupon.id !== couponId) {
        return coupon;
      }
      revoked = {
        ...coupon,
        revokedAt: coupon.revokedAt ?? now,
      };
      return revoked;
    });
  });
  if (!revoked) {
    throw new Error("coupon_not_found");
  }
  return revoked;
}

export function selectBestSelfHostedCoupon(
  input: SelfHostedCouponSelectionInput,
): SelfHostedCouponSelectionResult {
  const normalizedCodes = input.codes.map(normalizeCouponCode);
  const now = Date.now();
  const coupons = readSelfHostedBillingState().coupons.filter((coupon) =>
    normalizedCodes.includes(coupon.code.toUpperCase()),
  );
  const eligible = coupons.filter((coupon) =>
    isCouponEligible(coupon, input.workspaceId, now),
  );
  if (eligible.length === 0) {
    return {
      bestCoupon: null,
      reason: "no_eligible_coupon",
    };
  }
  eligible.sort((left, right) => right.discountPercent - left.discountPercent);
  return {
    bestCoupon: eligible[0] ?? null,
    reason: "eligible",
  };
}

export function listSelfHostedInvoices(
  accountId: string,
  workspaceId: string | null | undefined,
): SelfHostedInvoice[] {
  const normalizedWorkspaceId = workspaceId?.trim();
  return readSelfHostedBillingState()
    .invoices.filter((invoice) => {
      if (invoice.accountId !== accountId) {
        return false;
      }
      if (!normalizedWorkspaceId) {
        return true;
      }
      return invoice.workspaceId === normalizedWorkspaceId;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listSelfHostedSubscriptions(
  accountId: string,
): SelfHostedWorkspaceSubscription[] {
  return Object.values(readSelfHostedBillingState().subscriptions)
    .filter((subscription) => subscription.accountId === accountId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function activateSelfHostedPlan(input: SelfHostedActivationInput): {
  subscription: SelfHostedWorkspaceSubscription;
  invoice: SelfHostedInvoice;
} {
  let subscription: SelfHostedWorkspaceSubscription | null = null;
  let invoice: SelfHostedInvoice | null = null;

  mutateState((state) => {
    const discount = Math.max(0, Math.min(100, input.discountPercent ?? 0));
    const baseAmount = Math.max(0, Math.round(input.baseAmountUsd));
    const amount = Math.max(0, Math.round(baseAmount * (1 - discount / 100)));
    const now = new Date().toISOString();
    const nextInvoice: SelfHostedInvoice = {
      id: createLocalId("inv"),
      accountId: input.accountId,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      planId: input.planId,
      planLabel: input.planLabel,
      billingCycle: input.billingCycle,
      amountUsd: amount,
      baseAmountUsd: baseAmount,
      discountPercent: discount,
      method: input.method,
      couponCode: input.couponCode?.trim() || null,
      status: "paid",
      createdAt: now,
      paidAt: now,
    };
    state.invoices.unshift(nextInvoice);

    if (nextInvoice.couponCode) {
      const couponCode = nextInvoice.couponCode.toUpperCase();
      state.coupons = state.coupons.map((coupon) =>
        coupon.code.toUpperCase() === couponCode
          ? {
              ...coupon,
              redeemedCount: coupon.redeemedCount + 1,
            }
          : coupon,
      );
    }

    const subscriptionKey = toSubscriptionKey(
      input.accountId,
      input.workspaceId,
    );
    const nextSubscription: SelfHostedWorkspaceSubscription = {
      accountId: input.accountId,
      workspaceId: input.workspaceId,
      workspaceName: input.workspaceName,
      planId: input.planId,
      planLabel: input.planLabel,
      billingCycle: input.billingCycle,
      profileLimit: input.profileLimit,
      status: "active",
      updatedAt: now,
      lastInvoiceId: nextInvoice.id,
    };
    state.subscriptions[subscriptionKey] = nextSubscription;
    subscription = nextSubscription;
    invoice = nextInvoice;
  });

  if (!subscription || !invoice) {
    throw new Error("self_host_activation_failed");
  }
  return {
    subscription,
    invoice,
  };
}

export function resolvePlanProxyBandwidthLimitMb(
  planId: BillingPlanId,
): number {
  const plan =
    BILLING_PLAN_DEFINITIONS.find((item) => item.id === planId) ??
    BILLING_PLAN_DEFINITIONS[0];
  return Math.max(0, Math.round(plan.proxyGb * 1024));
}
