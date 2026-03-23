"use client";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import {
  clearBillingCheckoutIntent,
  readBillingCheckoutIntent,
  resolveBillingCheckoutIntentForContext,
  subscribeBillingCheckoutIntent,
  writeBillingCheckoutIntent,
} from "@/lib/billing-checkout-intent";
import { type BillingCycle } from "@/lib/billing-plans";
import {
  readCustomPlanOverride,
  subscribeCustomPlanOverride,
} from "@/lib/custom-plan-config";
import { extractRootError } from "@/lib/error-utils";
import { formatLocaleDateTime } from "@/lib/locale-format";
import {
  readPlanAddonConfig,
  subscribePlanAddonConfig,
} from "@/lib/plan-addon-config";
import { getPlanBadgeStyle } from "@/lib/plan-tier";
import {
  activateSelfHostedPlan,
  buildSelfHostedLicenseCode,
  listSelfHostedInvoices,
  type SelfHostedInvoice,
  seedSelfHostedBillingForUser,
  selectBestSelfHostedCoupon,
  subscribeSelfHostedBillingState,
  validateSelfHostedLicense,
} from "@/lib/self-host-billing";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import {
  buildEffectivePlans,
  getAddonCost,
  getAddonState,
  getEffectivePlanPrice,
  getEffectiveProfileLimit,
  getPlanById,
  normalizePlanId,
  normalizePlanIdFromLabel,
} from "@/lib/workspace-billing-logic";
import type {
  CloudUser,
  ControlStripeCheckoutConfirmResponse,
  ControlStripeCheckoutCreateResponse,
  ControlWorkspaceBillingState,
  EntitlementSnapshot,
  RuntimeConfigStatus,
  TeamRole,
} from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";

type WorkspaceBillingMode = "management" | "checkout" | "coupon" | "license";
type PaymentActionTab = "checkout" | "coupon" | "license";

interface WorkspaceBillingPageProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
  user: CloudUser;
  teamRole: TeamRole | null;
  workspaceId?: string | null;
  workspaceMode?: "personal" | "team" | null;
  workspaceName?: string | null;
  workspacePlanLabel?: string | null;
  workspaceProfileLimit?: number | null;
  workspaceProfilesUsed?: number;
  mode?: WorkspaceBillingMode;
  onOpenAdminWorkspace: () => void;
  onOpenSyncConfig: () => void;
  onOpenPricingPage: () => void;
  onOpenCheckoutPage: () => void;
}

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface AppSettings {
  stripe_billing_url?: string;
  [key: string]: unknown;
}

interface CouponSelectionResponse {
  bestCoupon: {
    id: string;
    code: string;
    discountPercent: number;
  } | null;
  reason: string;
}

interface LicenseClaimResponse {
  code: string;
  planId: "starter" | "growth" | "scale" | "custom";
  planLabel: string;
  profileLimit: number;
  billingCycle: BillingCycle;
}

const FREE_PLAN_PROFILE_LIMIT = 3;

function toIntegerOrZero(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function resolvePaymentActionTab(mode: WorkspaceBillingMode): PaymentActionTab {
  if (mode === "coupon") {
    return "coupon";
  }
  if (mode === "license") {
    return "license";
  }
  return "checkout";
}

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
}

function normalizeStripeBillingUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function toServerInvoiceRows(
  state: ControlWorkspaceBillingState,
  user: CloudUser,
  workspaceName: string | null,
): SelfHostedInvoice[] {
  return state.recentInvoices.map((invoice) => ({
    id: invoice.id,
    accountId: user.id,
    workspaceId: invoice.workspaceId,
    workspaceName: workspaceName ?? "Workspace",
    planId: invoice.planId,
    planLabel: invoice.planLabel,
    billingCycle: invoice.billingCycle,
    amountUsd: invoice.amountUsd,
    baseAmountUsd: invoice.baseAmountUsd,
    discountPercent: invoice.discountPercent,
    method: invoice.method,
    couponCode: invoice.couponCode,
    status: "paid",
    createdAt: invoice.createdAt,
    paidAt: invoice.paidAt,
  }));
}

export function WorkspaceBillingPage({
  runtimeConfig,
  entitlement,
  user,
  teamRole,
  workspaceId = null,
  workspaceMode = null,
  workspaceName = null,
  workspacePlanLabel = null,
  workspaceProfileLimit = null,
  workspaceProfilesUsed = 0,
  mode = "management",
  onOpenAdminWorkspace,
  onOpenSyncConfig,
  onOpenPricingPage,
  onOpenCheckoutPage,
}: WorkspaceBillingPageProps) {
  const { t } = useTranslation();
  const showConfigHints =
    process.env.NEXT_PUBLIC_SHOW_RUNTIME_CONFIG_HINTS === "1";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [licenseCode, setLicenseCode] = useState("");
  const [isClaimingLicense, setIsClaimingLicense] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false);
  const [selfHostedInvoices, setSelfHostedInvoices] = useState<
    SelfHostedInvoice[]
  >([]);
  const [checkoutIntent, setCheckoutIntent] = useState(
    readBillingCheckoutIntent,
  );
  const [customPlanOverride, setCustomPlanOverride] = useState(
    readCustomPlanOverride,
  );
  const [planAddons, setPlanAddons] = useState(readPlanAddonConfig);
  const [paymentActionTab, setPaymentActionTab] = useState<PaymentActionTab>(
    () => resolvePaymentActionTab(mode),
  );
  const { refreshProfile, updateLocalSubscription } = useCloudAuth();

  useEffect(
    () =>
      subscribeCustomPlanOverride(() =>
        setCustomPlanOverride(readCustomPlanOverride()),
      ),
    [],
  );
  useEffect(
    () => subscribePlanAddonConfig(() => setPlanAddons(readPlanAddonConfig())),
    [],
  );
  useEffect(
    () => subscribeBillingCheckoutIntent((intent) => setCheckoutIntent(intent)),
    [],
  );
  useEffect(() => {
    setPaymentActionTab(resolvePaymentActionTab(mode));
  }, [mode]);
  useEffect(() => {
    if (!checkoutIntent) {
      return;
    }
    if (!checkoutIntent.accountId || !checkoutIntent.workspaceId) {
      clearBillingCheckoutIntent();
    }
  }, [checkoutIntent]);

  const planDefinitions = useMemo(
    () => buildEffectivePlans(customPlanOverride),
    [customPlanOverride],
  );

  const isStripeReady = runtimeConfig?.stripe === "ready";
  const isSelfHostedBilling = !isStripeReady;
  const isSyncReady = runtimeConfig?.s3_sync === "ready";
  const isAuthReady = runtimeConfig?.auth === "ready";
  const isReadOnly = entitlement?.state === "read_only";
  const isPlatformAdmin = user.platformRole === "platform_admin";
  const canManageBilling =
    user.platformRole === "platform_admin" ||
    teamRole === "owner" ||
    teamRole === "admin";
  const isManagementMode = mode === "management";
  const isCheckoutMode = !isManagementMode && paymentActionTab === "checkout";
  const isCouponMode = !isManagementMode && paymentActionTab === "coupon";
  const isLicenseMode = !isManagementMode && paymentActionTab === "license";

  if (!canManageBilling) {
    return (
      <Card className="border-border/70 bg-card shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">
            {t("billingPage.ownerOnlyTitle")}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {t("billingPage.ownerOnlyDescription")}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {t("billingPage.workspaceContext", {
              workspace: workspaceName ?? t("shell.workspaceSwitcher.current"),
              email: user.email,
            })}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("billingPage.workspaceRoleContext", {
              role: t(`shell.roles.${teamRole ?? "member"}`),
            })}
          </p>
        </CardContent>
      </Card>
    );
  }

  const normalizedWorkspacePlanLabel = workspacePlanLabel?.trim() ?? "";
  const hasWorkspacePlanLabel = normalizedWorkspacePlanLabel.length > 0;
  const currentPlanId = useMemo(() => {
    if (workspaceMode === "personal") {
      return null;
    }
    if (hasWorkspacePlanLabel) {
      return normalizePlanIdFromLabel(normalizedWorkspacePlanLabel);
    }
    return normalizePlanId(user.plan);
  }, [
    hasWorkspacePlanLabel,
    normalizedWorkspacePlanLabel,
    user.plan,
    workspaceMode,
  ]);
  const currentPlan = useMemo(
    () => (currentPlanId ? getPlanById(planDefinitions, currentPlanId) : null),
    [currentPlanId, planDefinitions],
  );

  const currentPlanLabel = useMemo(() => {
    if (currentPlanId) {
      return t(`authLanding.plans.${currentPlanId}.name`);
    }
    if (hasWorkspacePlanLabel) {
      return normalizedWorkspacePlanLabel;
    }
    return t("billingPage.freePlanLabel");
  }, [currentPlanId, hasWorkspacePlanLabel, normalizedWorkspacePlanLabel, t]);
  const currentPlanBadge = useMemo(
    () => getPlanBadgeStyle(currentPlanLabel),
    [currentPlanLabel],
  );
  const activeCheckoutIntent = useMemo(() => {
    return resolveBillingCheckoutIntentForContext(checkoutIntent, {
      accountId: user.id,
      workspaceId,
    });
  }, [checkoutIntent, user.id, workspaceId]);

  const pendingPlan = useMemo(() => {
    if (!activeCheckoutIntent) {
      return null;
    }
    return (
      planDefinitions.find((plan) => plan.id === activeCheckoutIntent.planId) ??
      null
    );
  }, [activeCheckoutIntent, planDefinitions]);
  const isPendingCouponApplied = Boolean(
    activeCheckoutIntent?.couponCode?.trim(),
  );
  const hasCheckoutStarted = Boolean(activeCheckoutIntent?.checkoutStartedAt);
  const canConfirmPendingPlan =
    isStripeReady &&
    hasCheckoutStarted &&
    Boolean(activeCheckoutIntent?.stripeCheckoutSessionId);

  const currentPlanAddons = currentPlan
    ? getAddonState(planAddons, currentPlan.id)
    : { extraMembers: 0, extraProfileBundles: 0 };
  const addOnCost = currentPlan
    ? getAddonCost(currentPlanAddons, billingCycle)
    : 0;
  const effectivePlanPrice = currentPlan
    ? getEffectivePlanPrice(currentPlan, currentPlanAddons, billingCycle)
    : 0;
  const resolvedWorkspaceBaseProfileLimit = useMemo(() => {
    if (!currentPlanId) {
      const normalizedLabel = normalizedWorkspacePlanLabel.toLowerCase();
      const looksLikeFreePlan =
        !normalizedLabel ||
        normalizedLabel.includes("free") ||
        normalizedLabel.includes("miễn") ||
        normalizedLabel.includes("không trả");
      if (
        !looksLikeFreePlan &&
        typeof workspaceProfileLimit === "number" &&
        workspaceProfileLimit > 0
      ) {
        return Math.round(workspaceProfileLimit);
      }
      return FREE_PLAN_PROFILE_LIMIT;
    }
    if (
      typeof workspaceProfileLimit === "number" &&
      workspaceProfileLimit > 0
    ) {
      return Math.round(workspaceProfileLimit);
    }
    if (typeof currentPlan?.profiles === "number" && currentPlan.profiles > 0) {
      return currentPlan.profiles;
    }
    if (typeof user.profileLimit === "number" && user.profileLimit > 0) {
      return Math.round(user.profileLimit);
    }
    return FREE_PLAN_PROFILE_LIMIT;
  }, [
    currentPlan?.profiles,
    currentPlanId,
    user.profileLimit,
    workspaceProfileLimit,
    normalizedWorkspacePlanLabel.toLowerCase,
  ]);

  const usageLimit = toIntegerOrZero(
    currentPlan
      ? getEffectiveProfileLimit(
          resolvedWorkspaceBaseProfileLimit,
          currentPlanAddons,
        )
      : resolvedWorkspaceBaseProfileLimit,
  );
  const usageUsed = toIntegerOrZero(workspaceProfilesUsed);
  const usagePercent =
    usageLimit > 0
      ? Math.min(100, Math.round((usageUsed / usageLimit) * 100))
      : 0;

  const bandwidthLimit = toIntegerOrZero(
    user.proxyBandwidthLimitMb + user.proxyBandwidthExtraMb,
  );
  const bandwidthUsed = toIntegerOrZero(user.proxyBandwidthUsedMb);
  const bandwidthPercent =
    bandwidthLimit > 0
      ? Math.min(100, Math.round((bandwidthUsed / bandwidthLimit) * 100))
      : 0;

  const storageLimitGb = currentPlan?.storageGb ?? 0;
  const storageUsedGb =
    usageLimit > 0
      ? Math.min(
          storageLimitGb,
          Number(((usageUsed / usageLimit) * storageLimitGb).toFixed(1)),
        )
      : 0;
  const storagePercent =
    storageLimitGb > 0
      ? Math.min(100, Math.round((storageUsedGb / storageLimitGb) * 100))
      : 0;

  const hasPendingPlan = Boolean(activeCheckoutIntent && pendingPlan);
  const refreshSelfHostedInvoices = useCallback(async () => {
    try {
      const settings = await invoke<SyncSettings>("get_sync_settings");
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      if (!baseUrl || !workspaceId) {
        seedSelfHostedBillingForUser(user);
        setSelfHostedInvoices(listSelfHostedInvoices(user.id, workspaceId));
        return;
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-email": user.email,
      };
      if (user.platformRole) {
        headers["x-platform-role"] = user.platformRole;
      }
      if (settings.sync_token?.trim()) {
        headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
      }
      const response = await fetch(
        `${baseUrl}/v1/control/workspaces/${workspaceId}/billing/state`,
        {
          method: "GET",
          headers,
        },
      );
      if (!response.ok) {
        seedSelfHostedBillingForUser(user);
        setSelfHostedInvoices(listSelfHostedInvoices(user.id, workspaceId));
        return;
      }
      const state = (await response.json()) as ControlWorkspaceBillingState;
      setSelfHostedInvoices(toServerInvoiceRows(state, user, workspaceName));
    } catch {
      seedSelfHostedBillingForUser(user);
      setSelfHostedInvoices(listSelfHostedInvoices(user.id, workspaceId));
    }
  }, [user, workspaceId, workspaceName]);

  useEffect(() => {
    void refreshSelfHostedInvoices();
    return subscribeSelfHostedBillingState(() => {
      void refreshSelfHostedInvoices();
    });
  }, [refreshSelfHostedInvoices]);

  const licenseHintCode = useMemo(() => {
    if (!workspaceId || !pendingPlan) {
      return "PLAN";
    }
    return buildSelfHostedLicenseCode(workspaceId, pendingPlan.id);
  }, [pendingPlan, workspaceId]);

  const activatePendingPlanInSelfHost = useCallback(
    async (input: {
      method: "coupon" | "license";
      couponCode?: string | null;
      discountPercent?: number | null;
      planId?: "starter" | "growth" | "scale" | "custom";
      profileLimit?: number;
      planLabel?: string;
      billingCycle?: BillingCycle;
    }) => {
      if (!activeCheckoutIntent || !pendingPlan || !workspaceId) {
        showErrorToast(t("billingPage.pendingPlanMissing"));
        return false;
      }

      const targetPlan = input.planId
        ? (planDefinitions.find((plan) => plan.id === input.planId) ??
          pendingPlan)
        : pendingPlan;
      const targetAddon = getAddonState(planAddons, targetPlan.id);
      const targetBillingCycle =
        input.billingCycle ?? activeCheckoutIntent.billingCycle;
      const targetProfileLimit =
        input.profileLimit ??
        getEffectiveProfileLimit(targetPlan.profiles, targetAddon);
      const targetPlanLabel =
        input.planLabel ?? t(`authLanding.plans.${targetPlan.id}.name`);
      const baseAmountUsd = getEffectivePlanPrice(
        targetPlan,
        targetAddon,
        targetBillingCycle,
      );

      const settings = await invoke<SyncSettings>("get_sync_settings");
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      if (baseUrl && input.method === "coupon") {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-user-id": user.id,
          "x-user-email": user.email,
        };
        if (user.platformRole) {
          headers["x-platform-role"] = user.platformRole;
        }
        if (settings.sync_token?.trim()) {
          headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
        }
        const response = await fetch(
          `${baseUrl}/v1/control/workspaces/${workspaceId}/billing/internal-activate`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              planId: targetPlan.id,
              billingCycle: targetBillingCycle,
              method: "coupon",
              couponCode: input.couponCode ?? null,
            }),
          },
        );
        if (!response.ok) {
          showErrorToast(t("billingPage.planActivateFailed"), {
            description: `${response.status}`,
          });
          return false;
        }
        await refreshProfile();
      } else {
        const activation = activateSelfHostedPlan({
          accountId: user.id,
          workspaceId,
          workspaceName: workspaceName ?? t("shell.workspaceSwitcher.current"),
          planId: targetPlan.id,
          planLabel: targetPlanLabel,
          billingCycle: targetBillingCycle,
          profileLimit: targetProfileLimit,
          baseAmountUsd,
          discountPercent: input.discountPercent ?? 0,
          method: input.method,
          couponCode: input.couponCode ?? null,
        });
        await updateLocalSubscription({
          planId: targetPlan.id,
          billingCycle: targetBillingCycle,
          profileLimit: targetProfileLimit,
          planLabel: targetPlanLabel,
          workspaceId,
        });
        if (activation.invoice.discountPercent > 0) {
          showSuccessToast(t("billingPage.couponApplied"), {
            description: `-${activation.invoice.discountPercent}%`,
          });
        }
      }
      clearBillingCheckoutIntent();
      setCouponCode("");
      setLicenseCode("");
      void refreshSelfHostedInvoices();
      showSuccessToast(t("billingPage.planActivated"), {
        description: t("billingPage.planActivatedDescription", {
          plan: targetPlanLabel,
        }),
      });
      return true;
    },
    [
      activeCheckoutIntent,
      pendingPlan,
      planAddons,
      planDefinitions,
      refreshSelfHostedInvoices,
      refreshProfile,
      t,
      updateLocalSubscription,
      user.email,
      user.id,
      user.platformRole,
      workspaceId,
      workspaceName,
    ],
  );

  const handleApplyCoupon = async () => {
    const normalizedCode = couponCode.trim().toUpperCase();
    if (!normalizedCode) {
      showErrorToast(t("billingPage.couponRequired"));
      return;
    }
    if (!activeCheckoutIntent || !pendingPlan) {
      showErrorToast(t("billingPage.selectPlanBeforeClaim"));
      return;
    }
    if (!/^[A-Z0-9_-]{3,40}$/.test(normalizedCode)) {
      showErrorToast(t("billingPage.couponInvalid"));
      return;
    }
    if (!workspaceId) {
      showErrorToast(t("billingPage.workspaceRequiredForBilling"));
      return;
    }

    try {
      setIsApplyingCoupon(true);
      const settings = await invoke<SyncSettings>("get_sync_settings");
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      if (!baseUrl) {
        const selection = selectBestSelfHostedCoupon({
          workspaceId,
          codes: [normalizedCode],
        });
        if (!selection.bestCoupon) {
          showErrorToast(t("billingPage.couponNotEligible"));
          return;
        }
        await activatePendingPlanInSelfHost({
          method: "coupon",
          couponCode: selection.bestCoupon.code,
          discountPercent: selection.bestCoupon.discountPercent,
        });
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-email": user.email,
      };
      if (user.platformRole) {
        headers["x-platform-role"] = user.platformRole;
      }
      if (settings.sync_token?.trim()) {
        headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
      }

      const response = await fetch(
        `${baseUrl}/v1/control/workspaces/${workspaceId}/coupons/select-best`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            codes: [normalizedCode],
          }),
        },
      );
      if (!response.ok) {
        showErrorToast(t("billingPage.couponValidationUnavailable"), {
          description: `${response.status}`,
        });
        return;
      }

      const selection = (await response.json()) as CouponSelectionResponse;
      if (!selection.bestCoupon) {
        showErrorToast(t("billingPage.couponNotEligible"));
        return;
      }

      showSuccessToast(t("billingPage.couponApplied"), {
        description: `${t("billingPage.couponAppliedDescription")} (-${selection.bestCoupon.discountPercent}%)`,
      });
      if (activeCheckoutIntent) {
        writeBillingCheckoutIntent({
          ...activeCheckoutIntent,
          accountId: user.id,
          workspaceId,
          couponCode: selection.bestCoupon.code,
          couponDiscountPercent: selection.bestCoupon.discountPercent,
          activationMethod: "coupon",
        });
      }
      if (isSelfHostedBilling) {
        if (selection.bestCoupon.discountPercent >= 100) {
          await activatePendingPlanInSelfHost({
            method: "coupon",
            couponCode: selection.bestCoupon.code,
            discountPercent: selection.bestCoupon.discountPercent,
          });
        } else {
          setCouponCode("");
          showErrorToast(t("billingPage.stripeRequiredForPaidCoupon"), {
            description: t(
              "billingPage.stripeRequiredForPaidCouponDescription",
            ),
          });
        }
      } else {
        setCouponCode("");
      }
    } catch (error) {
      showErrorToast(t("billingPage.couponValidationUnavailable"), {
        description: extractRootError(error),
      });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleClaimLicense = async () => {
    const normalizedCode = licenseCode.trim().toUpperCase();
    if (!normalizedCode) {
      showErrorToast(t("billingPage.licenseRequired"));
      return;
    }
    if (!activeCheckoutIntent || !pendingPlan) {
      showErrorToast(t("billingPage.pendingPlanMissing"));
      return;
    }
    if (isStripeReady) {
      showErrorToast(t("billingPage.licenseStripeEnabled"));
      return;
    }
    if (!workspaceId) {
      showErrorToast(t("billingPage.workspaceRequiredForBilling"));
      return;
    }

    try {
      setIsClaimingLicense(true);
      const settings = await invoke<SyncSettings>("get_sync_settings");
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      if (!baseUrl) {
        const isValid = validateSelfHostedLicense({
          workspaceId,
          planId: pendingPlan.id,
          code: normalizedCode,
        });
        if (!isValid) {
          showErrorToast(t("billingPage.licenseInvalid"), {
            description: t("billingPage.licenseInvalidDescription", {
              sample: licenseHintCode,
            }),
          });
          return;
        }
        await activatePendingPlanInSelfHost({
          method: "license",
          couponCode: null,
          discountPercent: 100,
        });
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-email": user.email,
      };
      if (user.platformRole) {
        headers["x-platform-role"] = user.platformRole;
      }
      if (settings.sync_token?.trim()) {
        headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
      }

      const response = await fetch(
        `${baseUrl}/v1/control/workspaces/${workspaceId}/licenses/claim`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            code: normalizedCode,
          }),
        },
      );
      if (!response.ok) {
        showErrorToast(t("billingPage.licenseClaimFailed"), {
          description: `${response.status}`,
        });
        return;
      }

      const claimed = (await response.json()) as LicenseClaimResponse;
      await refreshProfile();
      clearBillingCheckoutIntent();
      setLicenseCode("");
      showSuccessToast(t("billingPage.licenseClaimed"), {
        description: t("billingPage.planActivatedDescription", {
          plan: claimed.planLabel,
        }),
      });
      void refreshSelfHostedInvoices();
    } catch (error) {
      showErrorToast(t("billingPage.licenseClaimFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsClaimingLicense(false);
    }
  };

  const handleStartStripeCheckout = useCallback(async () => {
    if (!activeCheckoutIntent || !pendingPlan) {
      showErrorToast(t("billingPage.pendingPlanMissing"));
      return;
    }
    if (!isStripeReady) {
      showErrorToast(t("billingPage.stripeRequiredForCheckout"));
      return;
    }
    if (!workspaceId) {
      showErrorToast(t("billingPage.workspaceRequiredForBilling"));
      return;
    }

    try {
      setIsOpeningCheckout(true);
      const [settings, appSettings] = await Promise.all([
        invoke<SyncSettings>("get_sync_settings"),
        invoke<AppSettings>("get_app_settings"),
      ]);
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      if (!baseUrl) {
        showErrorToast(t("billingPage.couponValidationUnavailable"));
        return;
      }
      const billingUrl = normalizeStripeBillingUrl(
        appSettings.stripe_billing_url,
      );
      if (!billingUrl) {
        showErrorToast(t("billingPage.checkoutUrlMissing"));
        return;
      }
      const billingBase = new URL(billingUrl);
      const successUrl = new URL(
        "/checkout/success?session_id={CHECKOUT_SESSION_ID}",
        `${billingBase.protocol}//${billingBase.host}`,
      ).toString();
      const cancelUrl = new URL(
        "/checkout/cancel",
        `${billingBase.protocol}//${billingBase.host}`,
      ).toString();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-email": user.email,
      };
      if (user.platformRole) {
        headers["x-platform-role"] = user.platformRole;
      }
      if (settings.sync_token?.trim()) {
        headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
      }

      const response = await fetch(
        `${baseUrl}/v1/control/workspaces/${workspaceId}/billing/stripe-checkout`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            planId: pendingPlan.id,
            billingCycle: activeCheckoutIntent.billingCycle,
            couponCode: activeCheckoutIntent.couponCode ?? null,
            successUrl,
            cancelUrl,
          }),
        },
      );
      if (!response.ok) {
        showErrorToast(t("billingPage.planActivateFailed"), {
          description: `${response.status}`,
        });
        return;
      }
      const created =
        (await response.json()) as ControlStripeCheckoutCreateResponse;
      if (created.immediateActivated) {
        await refreshProfile();
        clearBillingCheckoutIntent();
        void refreshSelfHostedInvoices();
        showSuccessToast(t("billingPage.planActivated"), {
          description: t("billingPage.planActivatedDescription", {
            plan: t(`authLanding.plans.${pendingPlan.id}.name`),
          }),
        });
        return;
      }

      await openUrl(created.checkoutUrl);
      writeBillingCheckoutIntent({
        ...activeCheckoutIntent,
        accountId: user.id,
        workspaceId,
        checkoutStartedAt: new Date().toISOString(),
        stripeCheckoutSessionId: created.checkoutSessionId,
        checkoutAmountUsd: created.amountUsd ?? null,
        prorationCreditUsd: created.prorationCreditUsd ?? null,
        prorationRemainingDays: created.prorationRemainingDays ?? null,
        activationMethod: "stripe",
        autoStartStripeCheckout: false,
      });
      showSuccessToast(t("billingPage.checkoutOpened"));
    } catch (error) {
      showErrorToast(t("billingPage.planActivateFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsOpeningCheckout(false);
    }
  }, [
    activeCheckoutIntent,
    isStripeReady,
    pendingPlan,
    refreshProfile,
    refreshSelfHostedInvoices,
    t,
    user.email,
    user.id,
    user.platformRole,
    workspaceId,
  ]);

  const handleConfirmPendingPlan = async () => {
    if (!activeCheckoutIntent || !pendingPlan) {
      showErrorToast(t("billingPage.pendingPlanMissing"));
      return;
    }
    if (!isStripeReady) {
      showErrorToast(t("billingPage.stripeRequiredForCheckout"));
      return;
    }
    if (!canConfirmPendingPlan) {
      showErrorToast(
        isStripeReady
          ? t("billingPage.checkoutStartRequired")
          : t("billingPage.paymentOrCouponRequired"),
      );
      return;
    }

    try {
      setIsConfirmingPlan(true);
      const settings = await invoke<SyncSettings>("get_sync_settings");
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      const checkoutSessionId =
        activeCheckoutIntent.stripeCheckoutSessionId?.trim() ?? "";
      if (!baseUrl || !checkoutSessionId || !workspaceId) {
        showErrorToast(t("billingPage.checkoutStartRequired"));
        return;
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": user.id,
        "x-user-email": user.email,
      };
      if (user.platformRole) {
        headers["x-platform-role"] = user.platformRole;
      }
      if (settings.sync_token?.trim()) {
        headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
      }
      const response = await fetch(
        `${baseUrl}/v1/control/workspaces/${workspaceId}/billing/stripe-checkout/${encodeURIComponent(checkoutSessionId)}/confirm`,
        {
          method: "POST",
          headers,
        },
      );
      if (!response.ok) {
        showErrorToast(t("billingPage.planActivateFailed"), {
          description: `${response.status}`,
        });
        return;
      }
      const confirmed =
        (await response.json()) as ControlStripeCheckoutConfirmResponse;
      if (confirmed.status !== "paid") {
        showErrorToast(t("billingPage.paymentPendingVerification"));
        return;
      }
      await refreshProfile();
      clearBillingCheckoutIntent();
      void refreshSelfHostedInvoices();
      showSuccessToast(t("billingPage.planActivated"), {
        description: t("billingPage.planActivatedDescription", {
          plan: t(`authLanding.plans.${pendingPlan.id}.name`),
        }),
      });
    } catch (error) {
      showErrorToast(t("billingPage.planActivateFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("billingPage.planActivateFailed"),
      });
    } finally {
      setIsConfirmingPlan(false);
    }
  };

  const recentSelfHostedInvoices = useMemo(
    () => selfHostedInvoices.slice(0, 8),
    [selfHostedInvoices],
  );

  const resolveInvoiceMethodLabel = useCallback(
    (method: SelfHostedInvoice["method"]) => {
      if (method === "coupon") {
        return t("billingPage.invoice.methodCoupon");
      }
      if (method === "license") {
        return t("billingPage.invoice.methodLicense");
      }
      if (method === "stripe") {
        return t("billingPage.invoice.methodStripe");
      }
      return t("billingPage.invoice.methodSelfHosted");
    },
    [t],
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      {activeCheckoutIntent && pendingPlan && (
        <Card className="border-border/80 shadow-none">
          <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {t("billingPage.pendingPlanBadge")}
              </p>
              <p className="mt-1 text-[13px] font-semibold text-foreground">
                {t("billingPage.pendingPlanTitle", {
                  plan: t(`authLanding.plans.${pendingPlan.id}.name`),
                })}
              </p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {isStripeReady
                  ? t("billingPage.pendingPlanStripeReady")
                  : isPendingCouponApplied
                    ? t("billingPage.pendingPlanCouponApplied")
                    : t("billingPage.pendingPlanSelfHostedReady")}
              </p>
              {typeof activeCheckoutIntent.prorationCreditUsd === "number" &&
              activeCheckoutIntent.prorationCreditUsd > 0 &&
              typeof activeCheckoutIntent.prorationRemainingDays === "number" &&
              activeCheckoutIntent.prorationRemainingDays > 0 ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("billingPage.pendingProrationCredit", {
                    amount: activeCheckoutIntent.prorationCreditUsd,
                    days: activeCheckoutIntent.prorationRemainingDays,
                  })}
                </p>
              ) : null}
              {typeof activeCheckoutIntent.checkoutAmountUsd === "number" ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("billingPage.pendingAmountDue", {
                    amount: activeCheckoutIntent.checkoutAmountUsd,
                  })}
                </p>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isCheckoutMode ? "secondary" : "outline"}
                onClick={() => setPaymentActionTab("checkout")}
              >
                {t("shell.sections.billingCheckout")}
              </Button>
              <Button
                type="button"
                variant={isCouponMode ? "secondary" : "outline"}
                onClick={() => setPaymentActionTab("coupon")}
              >
                {t("shell.sections.billingCoupon")}
              </Button>
              <Button
                type="button"
                variant={isLicenseMode ? "secondary" : "outline"}
                onClick={() => setPaymentActionTab("license")}
              >
                {t("shell.sections.billingLicense")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => clearBillingCheckoutIntent()}
                disabled={isConfirmingPlan || isOpeningCheckout}
              >
                {t("common.buttons.cancel")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card shadow-none">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("billingPage.managementBadge")}
            </p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {t("billingPage.managementTitle")}
            </h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {t("billingPage.managementDescription")}
            </p>
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
              <p className="text-[11px] font-medium text-foreground">
                {workspaceName ?? t("shell.workspaceSwitcher.current")}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-5 px-2 text-[10px]">
                  {t("billingPage.workspaceRoleContext", {
                    role: t(`shell.roles.${teamRole ?? "member"}`),
                  })}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onOpenPricingPage}>
              {t("billingPage.openPricingPage")}
            </Button>
            <Button
              type="button"
              variant={isCheckoutMode ? "secondary" : "outline"}
              onClick={() => setPaymentActionTab("checkout")}
            >
              {t("shell.sections.billingCheckout")}
            </Button>
            <Button
              type="button"
              variant={isCouponMode ? "secondary" : "outline"}
              onClick={() => setPaymentActionTab("coupon")}
            >
              {t("shell.sections.billingCoupon")}
            </Button>
            <Button
              type="button"
              variant={isLicenseMode ? "secondary" : "outline"}
              onClick={() => setPaymentActionTab("license")}
            >
              {t("shell.sections.billingLicense")}
            </Button>
            {showConfigHints ? (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenSyncConfig}
              >
                {t("authLanding.openSyncConfig")}
              </Button>
            ) : null}
            {isPlatformAdmin ? (
              <Button
                type="button"
                variant="outline"
                onClick={onOpenAdminWorkspace}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {t("billingPage.openAdminWorkspace")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <Card className="border-border shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {t("billingPage.currentPlan")}
              </CardTitle>
              {entitlement?.state === "grace_active" ? (
                <Badge
                  variant="outline"
                  className="h-5 px-2 text-[10px] uppercase tracking-wide"
                >
                  {t("adminWorkspace.status.entitlementGrace")}
                </Badge>
              ) : isReadOnly ? (
                <Badge
                  variant="outline"
                  className="h-5 px-2 text-[10px] uppercase tracking-wide"
                >
                  {t("adminWorkspace.status.entitlementReadOnly")}
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="h-5 px-2 text-[10px] uppercase tracking-wide"
                >
                  {t("adminWorkspace.status.entitlementActive")}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">
                    {currentPlanLabel}
                  </p>
                  <Badge
                    variant={currentPlanBadge.variant}
                    className={currentPlanBadge.className}
                  >
                    {currentPlanLabel}
                  </Badge>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {currentPlan
                    ? `$${effectivePlanPrice} / ${billingCycle === "monthly" ? t("authLanding.perMonth") : t("authLanding.perYear")}`
                    : t("billingPage.freePlanPriceLine")}
                </p>
                {addOnCost > 0 ? (
                  <p className="mt-1 text-[11px] text-chart-2">
                    +${addOnCost} {t("billingPage.addonApplied")}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("billingPage.nextInvoiceHint")}
                </p>
              </div>
              <div className="inline-flex items-center rounded-full border border-border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setBillingCycle("monthly")}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${billingCycle === "monthly" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("authLanding.monthly")}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle("yearly")}
                  className={`rounded-full px-3 py-1 text-[11px] font-medium ${billingCycle === "yearly" ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("authLanding.yearly")}
                </button>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("billingPage.profileUsage")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {usageLimit > 0
                    ? t("billingPage.profileUsageValue", {
                        used: usageUsed,
                        limit: usageLimit,
                      })
                    : t("billingPage.unlimited")}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("pricingPage.addonMembers")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {currentPlan
                    ? currentPlan.members + currentPlanAddons.extraMembers
                    : t("billingPage.notAvailable")}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">
                  {t("billingPage.paymentRoute")}
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {isStripeReady
                    ? t("billingPage.paymentRouteStripe")
                    : t("billingPage.paymentRouteSelfHosted")}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-[12px] font-medium text-foreground">
                {t("billingPage.addonTitle")}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {currentPlan
                  ? `${t("billingPage.addonMembersValue", { count: currentPlanAddons.extraMembers })} · ${t(
                      "billingPage.addonProfilesValue",
                      {
                        count: getEffectiveProfileLimit(0, currentPlanAddons),
                      },
                    )}`
                  : t("billingPage.addonUnavailableOnFree")}
              </p>
            </div>

            {showConfigHints ? (
              <div className="grid gap-2 md:grid-cols-3">
                <Badge
                  variant={isAuthReady ? "secondary" : "outline"}
                  className="h-7 justify-center text-[11px]"
                >
                  {t(
                    isAuthReady
                      ? "billingPage.authReady"
                      : "billingPage.authPending",
                  )}
                </Badge>
                <Badge
                  variant={
                    isStripeReady || isSelfHostedBilling
                      ? "secondary"
                      : "outline"
                  }
                  className="h-7 justify-center text-[11px]"
                >
                  {isStripeReady
                    ? t("billingPage.stripeReady")
                    : t("billingPage.selfHostedModeReady")}
                </Badge>
                <Badge
                  variant={isSyncReady ? "secondary" : "outline"}
                  className="h-7 justify-center text-[11px]"
                >
                  {t(
                    isSyncReady
                      ? "billingPage.syncReady"
                      : "billingPage.syncPending",
                  )}
                </Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("billingPage.paymentActionCenterTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-lg border border-border/60 bg-background/70 p-3">
              <p className="text-[12px] font-semibold text-foreground">
                {t("billingPage.paymentActionCenterBodyTitle")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t("billingPage.paymentActionCenterBodyDescription")}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant={isCheckoutMode ? "secondary" : "outline"}
                onClick={() => setPaymentActionTab("checkout")}
              >
                {t("shell.sections.billingCheckout")}
              </Button>
              <Button
                type="button"
                variant={isCouponMode ? "secondary" : "outline"}
                onClick={() => setPaymentActionTab("coupon")}
              >
                {t("shell.sections.billingCoupon")}
              </Button>
              <Button
                type="button"
                variant={isLicenseMode ? "secondary" : "outline"}
                onClick={() => setPaymentActionTab("license")}
              >
                {t("shell.sections.billingLicense")}
              </Button>
            </div>

            {isCheckoutMode ? (
              <>
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {isStripeReady
                      ? t("billingPage.paymentConnectedTitle")
                      : t("billingPage.paymentActionCenterSelfHostTitle")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isStripeReady
                      ? t("billingPage.paymentConnectedDescription")
                      : t("billingPage.paymentSelfHostedDescription")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="h-9"
                    onClick={() => void handleStartStripeCheckout()}
                    disabled={
                      !isStripeReady || !hasPendingPlan || isOpeningCheckout
                    }
                  >
                    {t("billingPage.startStripeCheckout")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleConfirmPendingPlan()}
                    disabled={
                      !isStripeReady ||
                      !canConfirmPendingPlan ||
                      isConfirmingPlan ||
                      isOpeningCheckout
                    }
                  >
                    {t("billingPage.confirmPlanActivation")}
                  </Button>
                </div>
              </>
            ) : null}

            {isCouponMode ? (
              <>
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {t("billingPage.couponTitle")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("billingPage.couponDescription")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value)}
                    placeholder={t("billingPage.couponPlaceholder")}
                    disabled={isApplyingCoupon}
                    className="h-9 text-[12px]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleApplyCoupon()}
                    disabled={
                      isApplyingCoupon || !couponCode.trim() || !hasPendingPlan
                    }
                  >
                    {t("billingPage.applyCoupon")}
                  </Button>
                </div>
              </>
            ) : null}

            {isLicenseMode ? (
              <>
                <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                  <p className="text-[12px] font-semibold text-foreground">
                    {t("billingPage.licenseTitle")}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("billingPage.licenseHint", {
                      code: licenseHintCode,
                    })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={licenseCode}
                    onChange={(event) => setLicenseCode(event.target.value)}
                    placeholder={t("billingPage.licensePlaceholder")}
                    disabled={isClaimingLicense || isStripeReady}
                    className="h-9 text-[12px]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleClaimLicense()}
                    disabled={
                      isClaimingLicense ||
                      isStripeReady ||
                      !licenseCode.trim() ||
                      !hasPendingPlan
                    }
                  >
                    {t("billingPage.claimLicense")}
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            {t("billingPage.profileUsage")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">
                {t("billingPage.profileUsage")}
              </span>
              <span className="text-muted-foreground">
                {usageLimit > 0
                  ? t("billingPage.profileUsageValue", {
                      used: usageUsed,
                      limit: usageLimit,
                    })
                  : t("billingPage.unlimited")}
              </span>
            </div>
            <Progress
              value={usageLimit > 0 ? usagePercent : 25}
              className="h-2 [&_[data-slot=progress-indicator]]:bg-chart-2"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">
                {t("billingPage.storageUsage")}
              </span>
              <span className="text-muted-foreground">
                {storageLimitGb > 0
                  ? `${storageUsedGb} GB / ${storageLimitGb} GB`
                  : t("billingPage.notAvailable")}
              </span>
            </div>
            <Progress
              value={storagePercent}
              className="h-2 [&_[data-slot=progress-indicator]]:bg-chart-4"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">
                {t("billingPage.bandwidthUsage")}
              </span>
              <span className="text-muted-foreground">
                {bandwidthUsed} MB /{" "}
                {bandwidthLimit > 0
                  ? `${bandwidthLimit} MB`
                  : t("billingPage.unlimited")}
              </span>
            </div>
            <Progress
              value={bandwidthLimit > 0 ? bandwidthPercent : 20}
              className="h-2 [&_[data-slot=progress-indicator]]:bg-chart-1"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-none">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-sm font-semibold">
            {t("billingPage.invoice.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {recentSelfHostedInvoices.length > 0 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-[1.35fr_0.95fr_0.9fr_0.8fr_0.7fr] gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[11px] font-medium text-muted-foreground">
                <span>{t("billingPage.invoice.colDate")}</span>
                <span>{t("billingPage.invoice.colPlan")}</span>
                <span>{t("billingPage.invoice.colMethod")}</span>
                <span className="text-right">
                  {t("billingPage.invoice.colAmount")}
                </span>
                <span className="text-right">
                  {t("billingPage.invoice.colStatus")}
                </span>
              </div>
              {recentSelfHostedInvoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="grid grid-cols-[1.35fr_0.95fr_0.9fr_0.8fr_0.7fr] gap-2 rounded-lg border border-border/60 px-3 py-2 text-[12px]"
                >
                  <span className="text-muted-foreground">
                    {formatLocaleDateTime(invoice.createdAt)}
                  </span>
                  <span className="font-medium text-foreground">
                    {invoice.planLabel}
                  </span>
                  <span className="text-muted-foreground">
                    {resolveInvoiceMethodLabel(invoice.method)}
                  </span>
                  <span className="text-right font-medium text-foreground">
                    ${invoice.amountUsd}
                  </span>
                  <span className="text-right text-chart-2">
                    {t("billingPage.invoice.statusPaid")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-4 text-[12px] text-muted-foreground">
              {isStripeReady
                ? t("billingPage.invoice.pendingSyncDescription")
                : t("billingPage.invoice.empty")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
