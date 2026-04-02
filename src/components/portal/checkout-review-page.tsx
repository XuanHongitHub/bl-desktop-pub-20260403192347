"use client";

import Link from "next/link";
import { ArrowRight, Check, CreditCard, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PORTAL_PRICING_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { createWorkspaceStripeCheckout } from "@/components/web-billing/control-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import {
  BILLING_PLAN_DEFINITIONS,
  getBillingPlanPrice,
  type BillingCycle,
  type BillingPlanId,
} from "@/lib/billing-plans";
import { formatLocaleNumber } from "@/lib/locale-format";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";

function isBillingCycle(value: string | null): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}

function isBillingPlanId(value: string | null): value is BillingPlanId {
  return BILLING_PLAN_DEFINITIONS.some((plan) => plan.id === value);
}

export function CheckoutReviewPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const {
    connection,
    workspaces,
    selectedWorkspace,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    loadingWorkspaces,
  } = usePortalBillingData();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(() => {
    const initial = searchParams.get("cycle");
    return isBillingCycle(initial) ? initial : "monthly";
  });
  const [pending, setPending] = useState(false);
  const [redirectingToAuth, setRedirectingToAuth] = useState(false);

  const selectedPlanId = useMemo<BillingPlanId>(() => {
    const plan = searchParams.get("plan");
    return isBillingPlanId(plan) ? plan : "growth";
  }, [searchParams]);

  const selectedPlan = useMemo(() => {
    return (
      BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === selectedPlanId) ??
      BILLING_PLAN_DEFINITIONS[1]
    );
  }, [selectedPlanId]);

  useEffect(() => {
    if (loadingWorkspaces || connection || redirectingToAuth) {
      return;
    }
    const query = searchParams.toString();
    const nextPath = query ? `/checkout?${query}` : "/checkout";
    setRedirectingToAuth(true);
    router.replace(`/signin?next=${encodeURIComponent(nextPath)}`);
  }, [connection, loadingWorkspaces, redirectingToAuth, router, searchParams]);

  const monthlyEquivalent = getBillingPlanPrice(selectedPlan, billingCycle);
  const billedNow =
    billingCycle === "yearly" ? monthlyEquivalent * 12 : monthlyEquivalent;
  const yearlySavings =
    selectedPlan.id === "custom"
      ? 0
      : Math.max(0, (selectedPlan.monthlyPrice - selectedPlan.yearlyPrice) * 12);

  const featureRows = [
    `${selectedPlan.profiles.toLocaleString("en-US")} ${t("portalSite.pricing.table.profiles")}`,
    `${selectedPlan.members.toLocaleString("en-US")} ${t("portalSite.pricing.table.members")}`,
    `${selectedPlan.storageGb.toLocaleString("en-US")} GB ${t("portalSite.pricing.table.storage")}`,
  ];

  const handleCheckout = async () => {
    if (!connection || !selectedWorkspaceId) {
      showErrorToast(
        t("portalSite.checkout.workspaceRequired", {
          defaultValue: "A workspace is required before checkout.",
        }),
      );
      return;
    }

    setPending(true);
    try {
      const origin = window.location.origin;
      const successUrl = `${origin}/checkout/success?workspaceId=${encodeURIComponent(selectedWorkspaceId)}&plan=${encodeURIComponent(selectedPlanId)}&cycle=${encodeURIComponent(billingCycle)}&session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${origin}/checkout/cancel?workspaceId=${encodeURIComponent(selectedWorkspaceId)}&plan=${encodeURIComponent(selectedPlanId)}&cycle=${encodeURIComponent(billingCycle)}`;
      const payload = await createWorkspaceStripeCheckout(
        connection,
        selectedWorkspaceId,
        {
          planId: selectedPlanId,
          billingCycle,
          successUrl,
          cancelUrl,
        },
      );
      window.location.assign(payload.checkoutUrl);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("portalSite.checkout.createFailed", {
              defaultValue: "Unable to create checkout.",
            });
      showErrorToast(message);
      setPending(false);
    }
  };

  return (
    <section className={cn("space-y-6 pb-14 pt-4", PORTAL_PRICING_WIDTH_CLASS)}>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {t("portalSite.checkout.eyebrow", { defaultValue: "Stripe checkout" })}
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
          {t("portalSite.checkout.summaryTitle", {
            defaultValue: "Order summary",
          })}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          {t("portalSite.checkout.summaryDescription", {
            defaultValue:
              "Review plan, cycle, and workspace before continuing to secure checkout.",
          })}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="border-b border-border/70 pb-5">
            <CardTitle className="text-2xl font-semibold tracking-[-0.03em] text-foreground">
              {t(`portalSite.pricing.plans.${selectedPlan.id}.name`)}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {t(`portalSite.pricing.plans.${selectedPlan.id}.audience`)}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div className="inline-flex h-9 items-center rounded-full border border-border bg-card p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition-colors",
                  billingCycle === "monthly"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("portalSite.checkout.cycleMonthly", { defaultValue: "Monthly" })}
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("yearly")}
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold transition-colors",
                  billingCycle === "yearly"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("portalSite.checkout.cycleYearly", { defaultValue: "Yearly" })}
              </button>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {t("portalSite.checkout.planTitle", { defaultValue: "Plan" })}
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-foreground">
                ${formatLocaleNumber(monthlyEquivalent, { maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-muted-foreground">
                {billingCycle === "yearly"
                  ? t("portalSite.pricing.perMonthBilledYearly")
                  : t("portalSite.pricing.perMonthBilledMonthly")}
              </p>
              {billingCycle === "yearly" && yearlySavings > 0 ? (
                <p className="mt-1 text-xs font-medium text-muted-foreground">
                  {t("portalSite.pricing.saveBadge")} ${formatLocaleNumber(yearlySavings)}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2 text-sm text-foreground">
              {featureRows.map((row) => (
                <div key={row} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-muted-foreground" />
                  <span>{row}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-border/70 bg-card/90">
            <CardContent className="space-y-4 pt-5">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  {t("portalSite.checkout.workspace", { defaultValue: "Workspace" })}
                </p>
                <Select
                  value={selectedWorkspaceId}
                  onValueChange={(value) => setSelectedWorkspaceId(value)}
                >
                  <SelectTrigger className="h-10 w-full rounded-lg text-sm">
                    <SelectValue
                      placeholder={t("portalSite.checkout.workspacePlaceholder", {
                        defaultValue: "Select workspace",
                      })}
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
                {loadingWorkspaces ? (
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.checkout.loading", {
                      defaultValue: "Loading workspaces...",
                    })}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/70 bg-background/70 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("portalSite.checkout.checkoutSummaryPlan", {
                      defaultValue: "Plan",
                    })}
                  </span>
                  <span className="font-medium text-foreground">
                    {t(`portalSite.pricing.plans.${selectedPlan.id}.name`)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("portalSite.checkout.checkoutSummaryCycle", {
                      defaultValue: "Billing cycle",
                    })}
                  </span>
                  <span className="font-medium text-foreground">
                    {billingCycle === "yearly"
                      ? t("portalSite.checkout.cycleYearly")
                      : t("portalSite.checkout.cycleMonthly")}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    {t("portalSite.checkout.checkoutSummaryWorkspace", {
                      defaultValue: "Workspace",
                    })}
                  </span>
                  <span className="max-w-[180px] truncate text-right font-medium text-foreground">
                    {selectedWorkspace?.name ||
                      t("portalSite.checkout.workspaceEmpty", {
                        defaultValue: "No workspace selected",
                      })}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/70 pt-2.5">
                  <span className="text-muted-foreground">
                    {billingCycle === "yearly"
                      ? t("portalSite.account.invoiceAmount", {
                          defaultValue: "Amount",
                        })
                      : t("portalSite.account.invoiceAmount", {
                          defaultValue: "Amount",
                        })}
                  </span>
                  <span className="font-semibold text-foreground">
                    ${formatLocaleNumber(billedNow, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border/70 bg-background/60 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t("portalSite.account.paymentSecurityHint", {
                      defaultValue:
                        "Checkout and payment methods are handled on Stripe-hosted surfaces only.",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" className="h-10 rounded-full">
                  <Link href="/pricing">
                    {t("common.buttons.back", { defaultValue: "Back" })}
                  </Link>
                </Button>
                <Button
                  className="h-10 flex-1 rounded-full"
                  disabled={pending || !selectedWorkspaceId || !connection}
                  onClick={() => {
                    void handleCheckout();
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  {pending
                    ? t("portalSite.checkout.loading", {
                        defaultValue: "Preparing checkout...",
                      })
                    : t("portalSite.checkout.continue", {
                        defaultValue: "Continue to Stripe",
                      })}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}
