import type { CustomPlanOverride } from "@/lib/billing-plans";

const CUSTOM_PLAN_STORAGE_KEY = "buglogin.billing.customPlan.v1";
const CUSTOM_PLAN_EVENT_NAME = "buglogin:custom-plan-updated";

const DEFAULT_CUSTOM_PLAN: CustomPlanOverride = {
  enabled: true,
  monthlyPrice: 79,
  yearlyPrice: 79,
  profiles: 5000,
  members: 50,
  storageGb: 500,
  support: "dedicated",
  recommended: false,
};

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function toPositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function sanitize(raw: unknown): CustomPlanOverride {
  if (typeof raw !== "object" || raw === null) {
    return { ...DEFAULT_CUSTOM_PLAN };
  }
  const record = raw as Record<string, unknown>;
  const support =
    record.support === "email" ||
    record.support === "priority" ||
    record.support === "dedicated"
      ? record.support
      : DEFAULT_CUSTOM_PLAN.support;

  return {
    enabled:
      typeof record.enabled === "boolean"
        ? record.enabled
        : DEFAULT_CUSTOM_PLAN.enabled,
    monthlyPrice: toPositiveInteger(
      record.monthlyPrice,
      DEFAULT_CUSTOM_PLAN.monthlyPrice,
    ),
    yearlyPrice: toPositiveInteger(
      record.yearlyPrice,
      DEFAULT_CUSTOM_PLAN.yearlyPrice,
    ),
    profiles: toPositiveInteger(record.profiles, DEFAULT_CUSTOM_PLAN.profiles),
    members: toPositiveInteger(record.members, DEFAULT_CUSTOM_PLAN.members),
    storageGb: toPositiveInteger(
      record.storageGb,
      DEFAULT_CUSTOM_PLAN.storageGb,
    ),
    support,
    recommended:
      typeof record.recommended === "boolean"
        ? record.recommended
        : DEFAULT_CUSTOM_PLAN.recommended,
  };
}

export function getDefaultCustomPlanOverride(): CustomPlanOverride {
  return { ...DEFAULT_CUSTOM_PLAN };
}

export function readCustomPlanOverride(): CustomPlanOverride {
  if (!canUseStorage()) {
    return getDefaultCustomPlanOverride();
  }
  const raw = window.localStorage.getItem(CUSTOM_PLAN_STORAGE_KEY);
  if (!raw) {
    return getDefaultCustomPlanOverride();
  }
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return getDefaultCustomPlanOverride();
  }
}

export function writeCustomPlanOverride(
  next: CustomPlanOverride,
): CustomPlanOverride {
  const normalized = sanitize(next);
  if (!canUseStorage()) {
    return normalized;
  }
  window.localStorage.setItem(
    CUSTOM_PLAN_STORAGE_KEY,
    JSON.stringify(normalized),
  );
  window.dispatchEvent(new Event(CUSTOM_PLAN_EVENT_NAME));
  return normalized;
}

export function resetCustomPlanOverride(): CustomPlanOverride {
  const defaults = getDefaultCustomPlanOverride();
  if (!canUseStorage()) {
    return defaults;
  }
  window.localStorage.removeItem(CUSTOM_PLAN_STORAGE_KEY);
  window.dispatchEvent(new Event(CUSTOM_PLAN_EVENT_NAME));
  return defaults;
}

export function subscribeCustomPlanOverride(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handleStorage = (event: StorageEvent) => {
    if (event.key === CUSTOM_PLAN_STORAGE_KEY) {
      onChange();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CUSTOM_PLAN_EVENT_NAME, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CUSTOM_PLAN_EVENT_NAME, onChange);
  };
}
