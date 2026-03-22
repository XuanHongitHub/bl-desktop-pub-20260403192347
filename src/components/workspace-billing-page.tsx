"use client";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type BillingCycle,
} from "@/lib/billing-plans";
import { readCustomPlanOverride, subscribeCustomPlanOverride } from "@/lib/custom-plan-config";
import {
  readPlanAddonConfig,
  subscribePlanAddonConfig,
} from "@/lib/plan-addon-config";
import {
  clearBillingCheckoutIntent,
  readBillingCheckoutIntent,
  resolveBillingCheckoutIntentForContext,
  subscribeBillingCheckoutIntent,
  writeBillingCheckoutIntent,
} from "@/lib/billing-checkout-intent";
import { getPlanBadgeStyle } from "@/lib/plan-tier";
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
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import type { CloudUser, EntitlementSnapshot, RuntimeConfigStatus, TeamRole } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Progress } from "./ui/progress";

interface WorkspaceBillingPageProps {
  runtimeConfig: RuntimeConfigStatus | null;
  entitlement: EntitlementSnapshot | null;
  user: CloudUser;
  teamRole: TeamRole | null;
  workspaceId?: string | null;
  workspaceName?: string | null;
  workspacePlanLabel?: string | null;
  workspaceProfileLimit?: number | null;
  workspaceProfilesUsed?: number;
  onOpenAdminWorkspace: () => void;
  onOpenSyncConfig: () => void;
  onOpenPricingPage: () => void;
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

function toIntegerOrZero(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
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

export function WorkspaceBillingPage({
  runtimeConfig,
  entitlement,
  user,
  teamRole,
  workspaceId = null,
  workspaceName = null,
  workspacePlanLabel = null,
  workspaceProfileLimit = null,
  workspaceProfilesUsed = 0,
  onOpenAdminWorkspace,
  onOpenSyncConfig,
  onOpenPricingPage,
}: WorkspaceBillingPageProps) {
  const { t } = useTranslation();
  const showConfigHints = process.env.NODE_ENV !== "production";
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [licenseCode, setLicenseCode] = useState("");
  const [isClaimingLicense, setIsClaimingLicense] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false);
  const [checkoutIntent, setCheckoutIntent] = useState(readBillingCheckoutIntent);
  const [customPlanOverride, setCustomPlanOverride] = useState(readCustomPlanOverride);
  const [planAddons, setPlanAddons] = useState(readPlanAddonConfig);
  const { refreshProfile, updateLocalSubscription } = useCloudAuth();

  useEffect(
    () => subscribeCustomPlanOverride(() => setCustomPlanOverride(readCustomPlanOverride())),
    [],
  );
  useEffect(() => subscribePlanAddonConfig(() => setPlanAddons(readPlanAddonConfig())), []);
  useEffect(() => subscribeBillingCheckoutIntent((intent) => setCheckoutIntent(intent)), []);
  useEffect(() => {
    if (!checkoutIntent) {
      return;
    }
    if (!checkoutIntent.accountId || !checkoutIntent.workspaceId) {
      clearBillingCheckoutIntent();
    }
  }, [checkoutIntent]);

  const planDefinitions = useMemo(() => buildEffectivePlans(customPlanOverride), [customPlanOverride]);

  const isStripeReady = runtimeConfig?.stripe === "ready";
  const isSyncReady = runtimeConfig?.s3_sync === "ready";
  const isAuthReady = runtimeConfig?.auth === "ready";
  const isReadOnly = entitlement?.state === "read_only";
  const isPlatformAdmin = user.platformRole === "platform_admin";
  const canManageBilling =
    user.platformRole === "platform_admin" || teamRole === "owner" || teamRole === "admin";

  if (!canManageBilling) {
    return (
      <Card className="border-border/70 bg-card shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">{t("billingPage.ownerOnlyTitle")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("billingPage.ownerOnlyDescription")}</p>
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

  const currentPlanId = useMemo(
    () => normalizePlanIdFromLabel(workspacePlanLabel) ?? normalizePlanId(user.plan),
    [user.plan, workspacePlanLabel],
  );
  const currentPlan = useMemo(() => getPlanById(planDefinitions, currentPlanId), [currentPlanId, planDefinitions]);

  const currentPlanLabel = useMemo(() => {
    const userPlan = normalizePlanIdFromLabel(workspacePlanLabel) ?? normalizePlanId(user.plan);
    if (userPlan) {
      return t(`authLanding.plans.${userPlan}.name`);
    }
    if (workspacePlanLabel) {
      return workspacePlanLabel;
    }
    return t("billingPage.planFallback");
  }, [t, user.plan, workspacePlanLabel]);
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
    return planDefinitions.find((plan) => plan.id === activeCheckoutIntent.planId) ?? null;
  }, [activeCheckoutIntent, planDefinitions]);
  const isPendingCouponApplied = Boolean(activeCheckoutIntent?.couponCode?.trim());
  const hasCheckoutStarted = Boolean(activeCheckoutIntent?.checkoutStartedAt);
  const canConfirmPendingPlan = isStripeReady ? hasCheckoutStarted : isPendingCouponApplied;

  const currentPlanAddons = getAddonState(planAddons, currentPlan.id);
  const addOnCost = getAddonCost(currentPlanAddons, billingCycle);
  const effectivePlanPrice = getEffectivePlanPrice(currentPlan, currentPlanAddons, billingCycle);

  const usageLimit = toIntegerOrZero(
    getEffectiveProfileLimit(
      workspaceProfileLimit ?? user.profileLimit,
      currentPlanAddons,
    ),
  );
  const usageUsed = toIntegerOrZero(workspaceProfilesUsed);
  const usagePercent = usageLimit > 0 ? Math.min(100, Math.round((usageUsed / usageLimit) * 100)) : 0;

  const bandwidthLimit = toIntegerOrZero(user.proxyBandwidthLimitMb + user.proxyBandwidthExtraMb);
  const bandwidthUsed = toIntegerOrZero(user.proxyBandwidthUsedMb);
  const bandwidthPercent =
    bandwidthLimit > 0 ? Math.min(100, Math.round((bandwidthUsed / bandwidthLimit) * 100)) : 0;

  const storageLimitGb = currentPlan.storageGb;
  const storageUsedGb =
    usageLimit > 0 ? Math.min(storageLimitGb, Number(((usageUsed / usageLimit) * storageLimitGb).toFixed(1))) : 0;
  const storagePercent =
    storageLimitGb > 0 ? Math.min(100, Math.round((storageUsedGb / storageLimitGb) * 100)) : 0;

  const hasPendingPlan = Boolean(activeCheckoutIntent && pendingPlan);

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
        showErrorToast(t("billingPage.couponValidationUnavailable"));
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
      setCouponCode("");
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
        showErrorToast(t("billingPage.licenseValidationUnavailable"));
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
      await updateLocalSubscription({
        planId: claimed.planId,
        billingCycle: claimed.billingCycle,
        profileLimit: claimed.profileLimit,
        planLabel: claimed.planLabel,
        workspaceId,
      });
      clearBillingCheckoutIntent();
      setLicenseCode("");
      showSuccessToast(t("billingPage.licenseClaimed"), {
        description: t("billingPage.planActivatedDescription", {
          plan: claimed.planLabel,
        }),
      });
    } catch (error) {
      showErrorToast(t("billingPage.licenseClaimFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsClaimingLicense(false);
    }
  };

  const handleStartStripeCheckout = async () => {
    if (!activeCheckoutIntent || !pendingPlan) {
      showErrorToast(t("billingPage.pendingPlanMissing"));
      return;
    }
    if (!isStripeReady) {
      showErrorToast(t("billingPage.paymentOrCouponRequired"));
      return;
    }
    if (!workspaceId) {
      showErrorToast(t("billingPage.workspaceRequiredForBilling"));
      return;
    }

    try {
      setIsOpeningCheckout(true);
      const settings = await invoke<AppSettings>("get_app_settings");
      const billingUrl = normalizeStripeBillingUrl(settings.stripe_billing_url);
      if (!billingUrl) {
        showErrorToast(t("billingPage.checkoutUrlMissing"));
        return;
      }

      const checkout = new URL(billingUrl);
      checkout.searchParams.set("workspace_id", workspaceId);
      checkout.searchParams.set("workspace_name", workspaceName ?? "");
      checkout.searchParams.set("plan_id", pendingPlan.id);
      checkout.searchParams.set("billing_cycle", activeCheckoutIntent.billingCycle);
      checkout.searchParams.set("user_email", user.email);
      if (activeCheckoutIntent.couponCode) {
        checkout.searchParams.set("coupon", activeCheckoutIntent.couponCode);
      }

      await openUrl(checkout.toString());
      writeBillingCheckoutIntent({
        ...activeCheckoutIntent,
        accountId: user.id,
        workspaceId,
        checkoutStartedAt: new Date().toISOString(),
        activationMethod: "stripe",
      });
      showSuccessToast(t("billingPage.checkoutOpened"));
    } catch (error) {
      showErrorToast(t("billingPage.planActivateFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsOpeningCheckout(false);
    }
  };

  const handleConfirmPendingPlan = async () => {
    if (!activeCheckoutIntent || !pendingPlan) {
      showErrorToast(t("billingPage.pendingPlanMissing"));
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
      if (!isStripeReady && isPendingCouponApplied) {
        await updateLocalSubscription({
          planId: pendingPlan.id,
          billingCycle: activeCheckoutIntent.billingCycle,
          profileLimit: pendingPlan.profiles,
          planLabel: t(`authLanding.plans.${pendingPlan.id}.name`),
          workspaceId,
        });
      } else {
        const refreshed = await refreshProfile();
        const refreshedPlanId = normalizePlanId(refreshed.plan);
        if (refreshedPlanId !== pendingPlan.id) {
          showErrorToast(t("billingPage.paymentPendingVerification"));
          return;
        }
      }
      clearBillingCheckoutIntent();
      showSuccessToast(t("billingPage.planActivated"), {
        description: t("billingPage.planActivatedDescription", {
          plan: t(`authLanding.plans.${pendingPlan.id}.name`),
        }),
      });
    } catch (error) {
      showErrorToast(t("billingPage.planActivateFailed"), {
        description:
          error instanceof Error ? error.message : t("billingPage.planActivateFailed"),
      });
    } finally {
      setIsConfirmingPlan(false);
    }
  };

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
                    : t("billingPage.pendingPlanNeedsPayment")}
              </p>
            </div>
            <div className="flex gap-2">
              {isStripeReady ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleStartStripeCheckout()}
                  disabled={isOpeningCheckout}
                >
                  {t("billingPage.startStripeCheckout")}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                onClick={() => clearBillingCheckoutIntent()}
                disabled={isConfirmingPlan || isOpeningCheckout}
              >
                {t("common.buttons.cancel")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleConfirmPendingPlan()}
                disabled={isConfirmingPlan || isOpeningCheckout || !canConfirmPendingPlan}
              >
                {t("billingPage.confirmPlanActivation")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/70 bg-card shadow-none">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("billingPage.managementBadge")}</p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{t("billingPage.managementTitle")}</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">{t("billingPage.managementDescription")}</p>
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
                <span className="text-[11px] text-muted-foreground">{user.email}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onOpenPricingPage}>{t("billingPage.openPricingPage")}</Button>
            {showConfigHints ? (
              <Button type="button" variant="outline" onClick={onOpenSyncConfig}>{t("authLanding.openSyncConfig")}</Button>
            ) : null}
            {isPlatformAdmin ? (
              <Button type="button" variant="outline" onClick={onOpenAdminWorkspace}>
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
              <CardTitle className="text-sm font-semibold">{t("billingPage.currentPlan")}</CardTitle>
              {entitlement?.state === "grace_active" ? (
                <Badge variant="outline" className="h-5 px-2 text-[10px] uppercase tracking-wide">{t("adminWorkspace.status.entitlementGrace")}</Badge>
              ) : isReadOnly ? (
                <Badge variant="outline" className="h-5 px-2 text-[10px] uppercase tracking-wide">{t("adminWorkspace.status.entitlementReadOnly")}</Badge>
              ) : (
                <Badge variant="secondary" className="h-5 px-2 text-[10px] uppercase tracking-wide">{t("adminWorkspace.status.entitlementActive")}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-2xl font-semibold tracking-tight text-foreground">{currentPlanLabel}</p>
                  <Badge variant={currentPlanBadge.variant} className={currentPlanBadge.className}>
                    {currentPlanLabel}
                  </Badge>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  ${effectivePlanPrice} / {billingCycle === "monthly" ? t("authLanding.perMonth") : t("authLanding.perYear")}
                </p>
                {addOnCost > 0 ? (
                  <p className="mt-1 text-[11px] text-chart-2">+${addOnCost} {t("billingPage.addonApplied")}</p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">{t("billingPage.nextInvoiceHint")}</p>
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
                <p className="text-[11px] text-muted-foreground">{t("billingPage.profileUsage")}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {usageLimit > 0
                    ? t("billingPage.profileUsageValue", { used: usageUsed, limit: usageLimit })
                    : t("billingPage.unlimited")}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">{t("pricingPage.addonMembers")}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {currentPlan.members + currentPlanAddons.extraMembers}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <p className="text-[11px] text-muted-foreground">{t("billingPage.paymentRoute")}</p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {isStripeReady ? t("billingPage.paymentRouteStripe") : t("billingPage.paymentRouteClaim")}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-background/60 p-3">
              <p className="text-[12px] font-medium text-foreground">{t("billingPage.addonTitle")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t("billingPage.addonMembersValue", { count: currentPlanAddons.extraMembers })} · {" "}
                {t("billingPage.addonProfilesValue", {
                  count: getEffectiveProfileLimit(0, currentPlanAddons),
                })}
              </p>
            </div>

            {showConfigHints ? (
              <div className="grid gap-2 md:grid-cols-3">
                <Badge variant={isAuthReady ? "secondary" : "outline"} className="h-7 justify-center text-[11px]">{t(isAuthReady ? "billingPage.authReady" : "billingPage.authPending")}</Badge>
                <Badge variant={isStripeReady ? "secondary" : "outline"} className="h-7 justify-center text-[11px]">{t(isStripeReady ? "billingPage.stripeReady" : "billingPage.stripePending")}</Badge>
                <Badge variant={isSyncReady ? "secondary" : "outline"} className="h-7 justify-center text-[11px]">{t(isSyncReady ? "billingPage.syncReady" : "billingPage.syncPending")}</Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-border shadow-none">
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="inline-flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t("billingPage.paymentMethodTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            {isStripeReady ? (
              <div className="rounded-lg border border-border/60 bg-background/70 p-3">
                <p className="text-[12px] font-semibold text-foreground">{t("billingPage.paymentConnectedTitle")}</p>
                <p className="text-[11px] text-muted-foreground">{t("billingPage.paymentConnectedDescription")}</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-[11px] text-muted-foreground">
                {t("billingPage.paymentClaimDescription")}
              </div>
            )}

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
                disabled={isApplyingCoupon || !couponCode.trim() || !hasPendingPlan}
              >
                {t("billingPage.applyCoupon")}
              </Button>
            </div>

            {!isStripeReady ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
                <p className="text-[11px] font-medium text-foreground">{t("billingPage.licenseTitle")}</p>
                <div className="flex gap-2">
                  <Input
                    value={licenseCode}
                    onChange={(event) => setLicenseCode(event.target.value)}
                    placeholder={t("billingPage.licensePlaceholder")}
                    disabled={isClaimingLicense}
                    className="h-9 text-[12px]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void handleClaimLicense()}
                    disabled={isClaimingLicense || !licenseCode.trim() || !hasPendingPlan}
                  >
                    {t("billingPage.claimLicense")}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t("billingPage.licenseHint", {
                    code:
                      pendingPlan
                        ? pendingPlan.id.toUpperCase()
                        : "PLAN",
                  })}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">{t("billingPage.profileUsage")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">{t("billingPage.profileUsage")}</span>
              <span className="text-muted-foreground">
                {usageLimit > 0
                  ? t("billingPage.profileUsageValue", { used: usageUsed, limit: usageLimit })
                  : t("billingPage.unlimited")}
              </span>
            </div>
            <Progress value={usageLimit > 0 ? usagePercent : 25} className="h-2 [&_[data-slot=progress-indicator]]:bg-chart-2" />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">{t("billingPage.storageUsage")}</span>
              <span className="text-muted-foreground">{storageUsedGb} GB / {storageLimitGb} GB</span>
            </div>
            <Progress value={storagePercent} className="h-2 [&_[data-slot=progress-indicator]]:bg-chart-4" />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-foreground">{t("billingPage.bandwidthUsage")}</span>
              <span className="text-muted-foreground">
                {bandwidthUsed} MB / {bandwidthLimit > 0 ? `${bandwidthLimit} MB` : t("billingPage.unlimited")}
              </span>
            </div>
            <Progress value={bandwidthLimit > 0 ? bandwidthPercent : 20} className="h-2 [&_[data-slot=progress-indicator]]:bg-chart-1" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border shadow-none">
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-sm font-semibold">{t("billingPage.invoice.title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-4 text-[12px] text-muted-foreground">
            {isStripeReady
              ? t("billingPage.invoice.pendingSyncDescription")
              : t("billingPage.invoice.empty")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
