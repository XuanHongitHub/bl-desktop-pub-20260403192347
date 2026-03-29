"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createWorkspaceStripeCheckout } from "@/components/web-billing/control-api";
import { PORTAL_NARROW_CONTENT_WIDTH_CLASS, PORTAL_PRICING_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { PortalShell } from "@/components/portal/portal-shell";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { BILLING_PLAN_DEFINITIONS, type BillingPlanId } from "@/lib/billing-plans";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import { getPlanRank, normalizePlanIdFromLabel } from "@/lib/workspace-billing-logic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHECKOUT_PLANS = BILLING_PLAN_DEFINITIONS.map((plan) => ({
  id: plan.id,
  nameKey: `portalSite.pricing.plans.${plan.id}.name`,
  price: {
    monthly: plan.id === "custom" ? null : `$${plan.monthlyPrice}`,
    yearly: plan.id === "custom" ? null : `$${plan.yearlyPrice}`,
  },
  profiles: plan.id === "custom" ? "2,000+" : plan.profiles.toLocaleString("en-US"),
  members: plan.id === "custom" ? "25+" : String(plan.members),
  highlight: Boolean(plan.recommended),
}));

type PlanId = BillingPlanId;
type BillingCycle = "monthly" | "yearly";

export default function CheckoutPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>("starter");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [couponCode, setCouponCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const autoCheckoutStartedRef = useRef(false);

  const {
    sessionReady,
    connection,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    workspaces,
    billingState,
    loadingWorkspaces,
    workspacesError,
  } = usePortalBillingData();
  const autoCheckout = searchParams.get("auto") === "1";

  const selectedPlan = useMemo(
    () => CHECKOUT_PLANS.find((plan) => plan.id === selectedPlanId) ?? CHECKOUT_PLANS[0],
    [selectedPlanId],
  );

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const currentPlanId = useMemo(() => {
    return (
      billingState?.subscription.planId ??
      normalizePlanIdFromLabel(selectedWorkspace?.planLabel ?? null)
    );
  }, [billingState?.subscription.planId, selectedWorkspace?.planLabel]);

  const isDowngradeSelection = useMemo(() => {
    if (!currentPlanId) {
      return false;
    }
    return getPlanRank(selectedPlanId) < getPlanRank(currentPlanId);
  }, [currentPlanId, selectedPlanId]);

  useEffect(() => {
    const nextPlan = searchParams.get("plan");
    const nextCycle = searchParams.get("cycle");

    if (nextPlan && CHECKOUT_PLANS.some((plan) => plan.id === nextPlan)) {
      setSelectedPlanId(nextPlan as PlanId);
    }

    if (nextCycle === "monthly" || nextCycle === "yearly") {
      setBillingCycle(nextCycle);
    }
  }, [searchParams]);

  const checkoutIntentHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `/checkout?${query}` : "/checkout";
  }, [searchParams]);

  const handleCheckout = useCallback(async () => {
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(t("portalSite.checkout.workspaceRequired"));
      return false;
    }
    if (isDowngradeSelection) {
      showErrorToast(t("portalSite.pricing.downgradeDisabled"));
      return false;
    }

    setSubmitting(true);
    try {
      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = `${window.location.origin}/checkout/cancel`;
      const response = await createWorkspaceStripeCheckout(connection, selectedWorkspaceId, {
        planId: selectedPlanId,
        billingCycle,
        couponCode: couponCode.trim() || null,
        successUrl,
        cancelUrl,
      });
      window.location.assign(response.checkoutUrl);
      return true;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : t("portalSite.checkout.createFailed");
      showErrorToast(t("portalSite.checkout.createFailed"), {
        description: message,
      });
      setSubmitting(false);
      return false;
    }
  }, [
    billingCycle,
    connection,
    couponCode,
    isDowngradeSelection,
    selectedPlanId,
    selectedWorkspaceId,
    t,
  ]);

  useEffect(() => {
    if (!autoCheckout || autoCheckoutStartedRef.current) {
      return;
    }

    if (!sessionReady) {
      return;
    }

    if (!connection) {
      autoCheckoutStartedRef.current = true;
      const authParams = new URLSearchParams();
      authParams.set("next", checkoutIntentHref);
      router.replace(`/signin?${authParams.toString()}`);
      return;
    }

    if (selectedPlanId === "custom") {
      autoCheckoutStartedRef.current = true;
      router.replace("/help");
      return;
    }

    if (loadingWorkspaces || workspacesError || !selectedWorkspaceId) {
      return;
    }

    autoCheckoutStartedRef.current = true;
    void handleCheckout().then((ok) => {
      if (!ok) {
        autoCheckoutStartedRef.current = false;
      }
    });
  }, [
    autoCheckout,
    checkoutIntentHref,
    connection,
    handleCheckout,
    loadingWorkspaces,
    router,
    selectedPlanId,
    selectedWorkspaceId,
    sessionReady,
    workspacesError,
  ]);

  const selectedPrice =
    selectedPlan.id === "custom"
      ? t("portalSite.pricing.contactSales")
      : (selectedPlan.price[billingCycle] ?? t("portalSite.pricing.customPriceLabel"));

  return (
    <PortalShell>
      <div className="space-y-10 pb-16">
        <section className="border-b border-border/70 pb-10 pt-4">
          <div className={cn("space-y-5 text-center", PORTAL_NARROW_CONTENT_WIDTH_CLASS)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t("portalSite.checkout.eyebrow")}
            </p>
            <h1 className="text-4xl font-semibold tracking-[-0.05em] text-foreground sm:text-5xl">
              {t("portalSite.checkout.title")}
            </h1>
            <p className="mx-auto max-w-[760px] text-base leading-8 text-muted-foreground sm:text-lg">
              {t("portalSite.checkout.description")}
            </p>
          </div>
        </section>

        <section className={PORTAL_PRICING_WIDTH_CLASS}>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
            <div className="space-y-5">
              <section className="rounded-[28px] border border-border bg-card/92 p-6 shadow-sm sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                      {t("portalSite.checkout.planTitle")}
                    </h2>
                    <p className="mt-2 max-w-[620px] text-sm leading-7 text-muted-foreground">
                      {t("portalSite.checkout.planDescription")}
                    </p>
                  </div>
                  <div className="hidden rounded-full border border-border bg-background/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground sm:inline-flex">
                    {billingCycle === "yearly"
                      ? t("portalSite.checkout.cycleYearly")
                      : t("portalSite.checkout.cycleMonthly")}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-3">
                  {CHECKOUT_PLANS.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    const isCustom = plan.id === "custom";
                    const isDowngrade =
                      currentPlanId != null &&
                      getPlanRank(plan.id) < getPlanRank(currentPlanId);
                    const price = isCustom
                      ? t("portalSite.pricing.customPriceLabel")
                      : (plan.price[billingCycle] ?? t("portalSite.pricing.customPriceLabel"));

                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={cn(
                          "relative flex min-h-[220px] flex-col rounded-[24px] border px-5 py-5 text-left transition-all",
                          isSelected
                            ? "border-foreground bg-background shadow-[0_18px_60px_rgba(0,0,0,0.12)]"
                            : "border-border bg-background/60 hover:border-foreground/30 hover:bg-background",
                          isDowngrade && "cursor-not-allowed opacity-60",
                        )}
                        onClick={() => {
                          if (isDowngrade) {
                            showErrorToast(t("portalSite.pricing.downgradeDisabled"));
                            return;
                          }
                          setSelectedPlanId(plan.id);
                        }}
                      >
                        {plan.highlight ? (
                          <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-[11px] font-medium text-foreground/80">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {t("portalSite.pricing.mostPopular")}
                          </span>
                        ) : null}

                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                              {t(plan.nameKey)}
                            </p>
                            <p className="mt-2 text-sm leading-7 text-muted-foreground">
                              {t("portalSite.checkout.profiles")}: {plan.profiles}
                            </p>
                            <p className="text-sm leading-7 text-muted-foreground">
                              {t("portalSite.checkout.members")}: {plan.members}
                            </p>
                          </div>
                          <span className="pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            {billingCycle === "yearly" ? "ANNUAL" : "MONTHLY"}
                          </span>
                        </div>

                        <div className="mt-auto border-t border-border/70 pt-5">
                          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                            <span className="text-4xl font-semibold tracking-[-0.05em] text-foreground">
                              {price}
                            </span>
                            <span className="pb-1 text-sm text-muted-foreground">
                              {isCustom
                                ? t("portalSite.pricing.customPriceLabel")
                                : billingCycle === "yearly"
                                  ? t("portalSite.pricing.perMonthBilledYearly")
                                  : t("portalSite.pricing.perMonthBilledMonthly")}
                            </span>
                          </div>
                          {isDowngrade ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t("portalSite.pricing.downgradeDisabledHint")}
                            </p>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-[28px] border border-border bg-card/92 p-6 shadow-sm sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">
                      {t("portalSite.checkout.cycle")}
                    </h3>
                    <p className="mt-1 text-sm leading-7 text-muted-foreground">
                      {t("portalSite.checkout.summaryDescription")}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background p-1">
                    <button
                      type="button"
                      onClick={() => setBillingCycle("yearly")}
                      className={cn(
                        "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
                        billingCycle === "yearly"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t("portalSite.checkout.cycleYearly")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle("monthly")}
                      className={cn(
                        "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
                        billingCycle === "monthly"
                          ? "bg-foreground text-background"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t("portalSite.checkout.cycleMonthly")}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside className="xl:sticky xl:top-24 xl:self-start">
              <section className="rounded-[28px] border border-border bg-card/95 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.1)] sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground">
                      {t("portalSite.checkout.summaryTitle")}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {t("portalSite.checkout.summaryDescription")}
                    </p>
                  </div>
                  <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Stripe
                  </span>
                </div>

                <div className="mt-6 rounded-[24px] border border-border bg-background p-5">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {t(selectedPlan.nameKey)}
                      </p>
                      <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-foreground">
                        {selectedPrice}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{t("portalSite.checkout.profiles")}: {selectedPlan.profiles}</p>
                      <p>{t("portalSite.checkout.members")}: {selectedPlan.members}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <label
                      htmlFor="checkout-workspace"
                      className="text-sm font-medium text-foreground"
                    >
                      {t("portalSite.checkout.workspace")}
                    </label>
                    <Select
                      value={selectedWorkspaceId}
                      onValueChange={setSelectedWorkspaceId}
                      disabled={loadingWorkspaces || workspaces.length === 0}
                    >
                      <SelectTrigger id="checkout-workspace" className="h-12 rounded-2xl">
                        <SelectValue
                          placeholder={t("portalSite.checkout.workspacePlaceholder")}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="checkout-coupon" className="text-sm font-medium text-foreground">
                      {t("portalSite.checkout.coupon")}
                    </label>
                    <Input
                      id="checkout-coupon"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(event.target.value);
                      }}
                      className="h-12 rounded-2xl"
                      placeholder={t("portalSite.checkout.couponPlaceholder")}
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-[24px] border border-border bg-background p-5 text-sm">
                  <div className="flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{t("portalSite.checkout.workspace")}</span>
                    <span className="font-medium text-foreground">
                      {selectedWorkspace?.name || t("portalSite.checkout.workspaceEmpty")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{t("portalSite.checkout.cycle")}</span>
                    <span className="font-medium text-foreground">
                      {billingCycle === "yearly"
                        ? t("portalSite.checkout.cycleYearly")
                        : t("portalSite.checkout.cycleMonthly")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4 text-muted-foreground">
                    <span>{t("portalSite.account.plan")}</span>
                    <span className="font-medium text-foreground">{t(selectedPlan.nameKey)}</span>
                  </div>
                </div>

                {workspacesError ? (
                  <p className="mt-4 text-sm text-destructive">
                    {t("portalSite.checkout.loadWorkspacesFailed")}
                  </p>
                ) : null}
                {isDowngradeSelection ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    {t("portalSite.pricing.downgradeDisabledHint")}
                  </p>
                ) : null}

                <div className="mt-6 space-y-3">
                  {selectedPlan.id === "custom" ? (
                    <Button asChild className="h-12 w-full rounded-2xl text-[15px] font-medium">
                      <Link href="/help">{t("portalSite.pricing.contactSales")}</Link>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="h-12 w-full rounded-2xl text-[15px] font-medium"
                      onClick={() => {
                        void handleCheckout();
                      }}
                      disabled={submitting || !selectedWorkspaceId || isDowngradeSelection}
                    >
                      {submitting
                        ? t("portalSite.checkout.loading")
                        : t("portalSite.checkout.continue")}
                    </Button>
                  )}

                  <p className="text-center text-xs leading-6 text-muted-foreground">
                    <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
                    {t("portalSite.checkout.summaryDescription")}
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
