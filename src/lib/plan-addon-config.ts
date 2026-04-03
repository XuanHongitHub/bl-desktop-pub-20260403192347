import type { BillingPlanId } from "@/lib/billing-plans";

export type PlanAddonState = {
  extraMembers: number;
  extraProfileBundles: number;
};

export type PlanAddonConfig = Record<BillingPlanId, PlanAddonState>;

const PLAN_ADDON_STORAGE_KEY = "buglogin.billing.planAddons.v1";
const PLAN_ADDON_EVENT_NAME = "buglogin:plan-addons-updated";

export const PROFILE_BUNDLE_SIZE = 100;
export const EXTRA_MEMBER_PRICE_MONTHLY = 3;
export const EXTRA_PROFILE_BUNDLE_PRICE_MONTHLY = 2;

const DEFAULT_PLAN_ADDONS: PlanAddonConfig = {
  starter: { extraMembers: 0, extraProfileBundles: 0 },
  team: { extraMembers: 0, extraProfileBundles: 0 },
  scale: { extraMembers: 0, extraProfileBundles: 0 },
  enterprise: { extraMembers: 0, extraProfileBundles: 0 },
};

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function toInt(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.round(numeric);
}

function sanitize(raw: unknown): PlanAddonConfig {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_PLAN_ADDONS };
  }
  const record = raw as Record<string, unknown>;
  const next: PlanAddonConfig = { ...DEFAULT_PLAN_ADDONS };
  for (const planId of Object.keys(DEFAULT_PLAN_ADDONS) as BillingPlanId[]) {
    const item = record[planId];
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const row = item as Record<string, unknown>;
    next[planId] = {
      extraMembers: toInt(row.extraMembers),
      extraProfileBundles: toInt(row.extraProfileBundles),
    };
  }
  return next;
}

export function readPlanAddonConfig(): PlanAddonConfig {
  if (!canUseStorage()) {
    return { ...DEFAULT_PLAN_ADDONS };
  }
  const raw = window.localStorage.getItem(PLAN_ADDON_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_PLAN_ADDONS };
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_PLAN_ADDONS };
  }
}

export function writePlanAddonConfig(next: PlanAddonConfig): PlanAddonConfig {
  const normalized = sanitize(next);
  if (!canUseStorage()) {
    return normalized;
  }
  window.localStorage.setItem(
    PLAN_ADDON_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  window.dispatchEvent(new Event(PLAN_ADDON_EVENT_NAME));
  return normalized;
}

export function subscribePlanAddonConfig(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PLAN_ADDON_STORAGE_KEY) {
      onChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(PLAN_ADDON_EVENT_NAME, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PLAN_ADDON_EVENT_NAME, onChange);
  };
}
