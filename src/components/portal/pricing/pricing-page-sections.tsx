"use client";

import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  createWorkspaceStripeCheckout,
  type CreateCheckoutInput,
  listWorkspaces,
} from "@/components/web-billing/control-api";
import { usePortalSessionStore } from "@/hooks/use-portal-session-store";
import {
  PORTAL_CONTENT_WIDTH_CLASS,
  PORTAL_NARROW_CONTENT_WIDTH_CLASS,
  PORTAL_PRICING_WIDTH_CLASS,
  PORTAL_SECTION_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { Button } from "@/components/ui/button";
import {
  mergePortalSessionCurrent,
  writePortalSessionStorage,
} from "@/lib/portal-session";
import { BILLING_PLAN_DEFINITIONS, type BillingPlanId } from "@/lib/billing-plans";
import {
  getPlanRank,
  normalizePlanId,
  normalizePlanIdFromLabel,
} from "@/lib/workspace-billing-logic";
import { showErrorToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";

type BillingCycle = "yearly" | "monthly";

const FEATURE_ROWS = ["profiles", "members", "storage", "proxy"] as const;

const FEATURE_DESCRIPTION_KEYS: Record<
  (typeof FEATURE_ROWS)[number],
  string
> = {
  profiles: "portalSite.pricing.tableDescriptions.profiles",
  members: "portalSite.pricing.tableDescriptions.members",
  storage: "portalSite.pricing.tableDescriptions.storage",
  proxy: "portalSite.pricing.tableDescriptions.proxy",
};

type PricingPlanCard = {
  id: BillingPlanId;
  nameKey: string;
  audienceKey: string;
  monthlyPrice: string;
  yearlyPrice: string;
  values: [string, string, string, string];
  supportKey: "email" | "priority" | "dedicated";
  highlight: boolean;
  ctaKey: "selectPlan" | "contactSales";
  price: string;
  href: string;
};

function resolvePlanHref(planId: BillingPlanId, cycle: BillingCycle) {
  if (planId !== "custom") {
    return `/checkout?plan=${planId}&cycle=${cycle}&auto=1`;
  }
  return "/help";
}

export function PricingPageSections() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = usePortalSessionStore();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const [pendingPlanId, setPendingPlanId] = useState<string>("");
  const currentPlanId = useMemo(() => {
    return (
      normalizePlanId(session?.current?.planId ?? null) ??
      normalizePlanIdFromLabel(session?.current?.planLabel ?? null)
    );
  }, [session?.current?.planId, session?.current?.planLabel]);
  const currentWorkspaceName = session?.current?.workspaceName?.trim() ?? "";
  const currentSubscriptionStatus =
    session?.current?.subscriptionStatus?.trim() ?? "";

  const plans = useMemo<PricingPlanCard[]>(
    () =>
      BILLING_PLAN_DEFINITIONS.map((plan) => {
        const monthlyPrice = `$${plan.monthlyPrice}`;
        const yearlyPrice = `$${plan.yearlyPrice}`;
        return {
          id: plan.id,
          nameKey: `portalSite.pricing.plans.${plan.id}.name`,
          audienceKey: `portalSite.pricing.plans.${plan.id}.audience`,
          monthlyPrice:
            plan.id === "custom" ? t("portalSite.pricing.customPriceLabel") : monthlyPrice,
          yearlyPrice:
            plan.id === "custom" ? t("portalSite.pricing.customPriceLabel") : yearlyPrice,
          values: [
            plan.id === "custom" ? "2,000+" : plan.profiles.toLocaleString("en-US"),
            plan.id === "custom" ? "25+" : String(plan.members),
            `${plan.storageGb.toLocaleString("en-US")} GB`,
            `${plan.proxyGb.toLocaleString("en-US")} GB`,
          ],
          supportKey: plan.support,
          highlight: Boolean(plan.recommended),
          ctaKey: plan.id === "custom" ? "contactSales" : "selectPlan",
          price:
            billingCycle === "yearly"
              ? plan.id === "custom"
                ? t("portalSite.pricing.customPriceLabel")
                : yearlyPrice
              : plan.id === "custom"
                ? t("portalSite.pricing.customPriceLabel")
                : monthlyPrice,
          href: resolvePlanHref(plan.id, billingCycle),
        };
      }),
    [billingCycle, t]
  );
  const primaryPlans = useMemo(
    () => plans.filter((plan) => plan.id !== "custom"),
    [plans],
  );
  const customPlan = useMemo(
    () => plans.find((plan) => plan.id === "custom") ?? plans[plans.length - 1],
    [plans],
  );

  const handlePlanIntent = async (planId: BillingPlanId) => {
    if (planId === "custom") {
      router.push("/help");
      return;
    }

    if (currentPlanId && getPlanRank(planId) < getPlanRank(currentPlanId)) {
      showErrorToast(t("portalSite.pricing.downgradeDisabled"));
      return;
    }

    const checkoutIntent = `/checkout?plan=${planId}&cycle=${billingCycle}&auto=1`;
    if (typeof window === "undefined") {
      router.push(checkoutIntent);
      return;
    }

    if (!session) {
      const params = new URLSearchParams();
      params.set("next", checkoutIntent);
      router.push(`/signin?${params.toString()}`);
      return;
    }

    setPendingPlanId(planId);
    try {
      let workspaceId = session.current?.workspaceId?.trim() ?? "";
      let nextSession = session;

      if (!workspaceId) {
        const workspaces = await listWorkspaces({
          controlBaseUrl: session.connection.controlBaseUrl,
          controlToken: session.connection.controlToken,
          userId: session.connection.userId,
          userEmail: session.connection.userEmail,
          platformRole:
            session.connection.platformRole ?? session.user.platformRole ?? null,
        });

        const firstWorkspace = workspaces[0] ?? null;
        workspaceId = firstWorkspace?.id?.trim() ?? "";
        if (!workspaceId) {
          showErrorToast(t("portalSite.checkout.workspaceRequired"));
          router.push("/account/billing");
          return;
        }

        nextSession = mergePortalSessionCurrent(session, {
          workspaceId,
          workspaceName: firstWorkspace?.name ?? null,
          planId: normalizePlanIdFromLabel(firstWorkspace?.planLabel ?? null),
          planLabel: firstWorkspace?.planLabel ?? null,
          billingCycle: firstWorkspace?.billingCycle ?? null,
          subscriptionStatus: firstWorkspace?.subscriptionStatus ?? null,
        });
        writePortalSessionStorage(nextSession);
      }

      const successUrl = `${window.location.origin}/checkout/success`;
      const cancelUrl = `${window.location.origin}/checkout/cancel`;
      const input: CreateCheckoutInput = {
        planId,
        billingCycle,
        successUrl,
        cancelUrl,
      };
      const response = await createWorkspaceStripeCheckout(
        {
          controlBaseUrl: nextSession.connection.controlBaseUrl,
          controlToken: nextSession.connection.controlToken,
          userId: nextSession.connection.userId,
          userEmail: nextSession.connection.userEmail,
          platformRole:
            nextSession.connection.platformRole ??
            nextSession.user.platformRole ??
            null,
        },
        workspaceId,
        input,
      );
      window.location.assign(response.checkoutUrl);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : t("portalSite.checkout.createFailed");
      showErrorToast(t("portalSite.checkout.createFailed"), {
        description: message,
      });
    } finally {
      setPendingPlanId("");
    }
  };

  return (
    <div className="space-y-0 pb-12">
      <section className="border-b border-border/70 pb-16 pt-24 sm:pb-20 sm:pt-28">
        <div className={cn("text-center", PORTAL_NARROW_CONTENT_WIDTH_CLASS)}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {t("portalSite.pricing.eyebrow")}
          </p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.05em] text-foreground sm:text-6xl lg:text-7xl">
            {t("portalSite.nav.pricing")}
          </h1>
          <p className="mx-auto mt-5 max-w-[760px] text-lg leading-8 text-foreground/80 sm:text-[22px] sm:leading-9">
            {t("portalSite.pricing.linearSubtitle")}
          </p>
          <p className="mx-auto mt-4 max-w-[760px] text-sm leading-7 text-muted-foreground sm:text-base">
            {t("portalSite.pricing.description")}
          </p>

          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-border bg-card/80 p-1.5 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 text-[14px] font-medium tracking-[-0.02em] transition-colors",
                billingCycle === "yearly"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("portalSite.checkout.cycleYearly")}
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "inline-flex h-11 items-center rounded-full px-5 text-[14px] font-medium tracking-[-0.02em] transition-colors",
                billingCycle === "monthly"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("portalSite.checkout.cycleMonthly")}
            </button>
            <span className="inline-flex h-8 items-center rounded-full bg-muted px-3 text-[12px] font-medium text-foreground/80">
              {t("portalSite.pricing.saveBadge")}
            </span>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 py-12">
        <div className={PORTAL_PRICING_WIDTH_CLASS}>
          <div className="grid gap-4 xl:grid-cols-3">
            {primaryPlans.map((plan) => {
              const isHighlighted = plan.highlight;
              const isCurrentPlan =
                currentPlanId === plan.id &&
                currentSubscriptionStatus !== "canceled";
              const isDowngrade =
                currentPlanId != null &&
                getPlanRank(plan.id) < getPlanRank(currentPlanId);
              const priceLabel =
                billingCycle === "yearly"
                  ? t("portalSite.pricing.perMonthBilledYearly")
                  : t("portalSite.pricing.perMonthBilledMonthly");

              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex min-h-[620px] flex-col overflow-hidden rounded-[32px] border p-6 shadow-sm sm:p-7",
                    isHighlighted
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card/70 text-foreground",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-[18px] font-semibold tracking-[-0.03em]">
                        {t(plan.nameKey)}
                      </h2>
                      <p
                        className={cn(
                          "mt-2 max-w-[20ch] text-[15px] leading-7",
                          isHighlighted
                            ? "text-primary-foreground/80"
                            : "text-muted-foreground",
                        )}
                      >
                        {t(plan.audienceKey)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {isHighlighted ? (
                        <div className="inline-flex items-center gap-1.5 self-end whitespace-nowrap rounded-xl border border-primary-foreground/20 bg-background/10 px-2.5 py-1.5 text-[11px] font-semibold tracking-[-0.01em] text-primary-foreground sm:px-3 sm:text-[12px]">
                          <Sparkles className="h-3.5 w-3.5" />
                          {t("portalSite.pricing.mostPopular")}
                        </div>
                      ) : isCurrentPlan ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1.5 text-[12px] font-medium text-foreground">
                          {t("portalSite.pricing.currentPlanBadge")}
                        </div>
                      ) : null}
                      <span
                        className={cn(
                          "text-[11px] font-semibold uppercase tracking-[0.22em]",
                          isHighlighted
                            ? "text-primary-foreground/72"
                            : "text-muted-foreground",
                        )}
                      >
                        {billingCycle === "yearly" ? "ANNUAL" : "MONTHLY"}
                      </span>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "mt-6 border-y py-6",
                      isHighlighted
                        ? "border-primary-foreground/14"
                        : "border-border/70",
                    )}
                  >
                    <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
                      <div className="text-5xl font-semibold tracking-[-0.05em]">
                        {plan.price}
                      </div>
                      <div
                        className={cn(
                          "pb-1 text-sm",
                          isHighlighted
                            ? "text-primary-foreground/76"
                            : "text-muted-foreground",
                        )}
                      >
                        {priceLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 py-6">
                    <div className="space-y-3.5">
                      {FEATURE_ROWS.map((rowKey, index) => (
                        <div
                          key={`${plan.id}-${rowKey}`}
                          className="flex items-start gap-3"
                        >
                          <Check
                            className={cn(
                              "mt-0.5 h-4 w-4 shrink-0",
                              isHighlighted
                                ? "text-primary-foreground"
                                : "text-foreground/85",
                            )}
                          />
                          <div
                            className={cn(
                              "text-sm leading-7",
                              isHighlighted
                                ? "text-primary-foreground/82"
                                : "text-muted-foreground",
                            )}
                          >
                            <span
                              className={cn(
                                "font-medium",
                                isHighlighted
                                  ? "text-primary-foreground"
                                  : "text-foreground",
                              )}
                            >
                              {plan.values[index]}
                            </span>{" "}
                            {t(`portalSite.pricing.table.${rowKey}`)}
                          </div>
                        </div>
                      ))}
                      <div className="flex items-start gap-3">
                        <Check
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            isHighlighted
                              ? "text-primary-foreground"
                              : "text-foreground/85",
                          )}
                        />
                        <div
                          className={cn(
                            "text-sm leading-7",
                            isHighlighted
                              ? "text-primary-foreground/82"
                              : "text-muted-foreground",
                          )}
                        >
                          {t(`portalSite.pricing.support.${plan.supportKey}`)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "mt-auto space-y-4 border-t pt-6",
                      isHighlighted
                        ? "border-primary-foreground/14"
                        : "border-border/70",
                    )}
                  >
                    <Button
                      className={cn(
                        "h-12 w-full rounded-full text-[15px] font-medium tracking-[-0.02em]",
                        isHighlighted
                          ? "bg-background text-foreground hover:bg-background/90"
                          : "bg-muted text-foreground hover:bg-muted/80",
                      )}
                      disabled={pendingPlanId === plan.id || isDowngrade}
                      onClick={() => {
                        if (isCurrentPlan) {
                          router.push("/account/billing");
                          return;
                        }
                        if (isDowngrade) {
                          showErrorToast(t("portalSite.pricing.downgradeDisabled"));
                          return;
                        }
                        void handlePlanIntent(plan.id);
                      }}
                    >
                      {isCurrentPlan
                        ? t("portalSite.pricing.managePlanCta")
                        : isDowngrade
                          ? t("portalSite.pricing.downgradeTo", {
                              plan: t(plan.nameKey),
                            })
                        : t(`portalSite.pricing.${plan.ctaKey}`)}
                    </Button>
                    <p
                      className={cn(
                        "text-center text-sm leading-6",
                        isHighlighted
                          ? "text-primary-foreground/74"
                          : "text-muted-foreground",
                      )}
                    >
                      {isCurrentPlan && currentWorkspaceName
                        ? t("portalSite.pricing.currentWorkspacePlanHint", {
                            workspace: currentWorkspaceName,
                            plan: t(plan.nameKey),
                          })
                        : isDowngrade
                          ? t("portalSite.pricing.downgradeDisabledHint")
                        : t(`portalSite.pricing.support.${plan.supportKey}`)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-4 rounded-[30px] border border-border bg-card/70 px-6 py-5 sm:px-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-[28px] font-semibold tracking-[-0.04em] text-foreground">
                  {t(customPlan.nameKey)}
                </p>
                <p className="text-base leading-7 text-muted-foreground">
                  {t(customPlan.audienceKey)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <p className="text-base leading-7 text-muted-foreground">
                  {t("portalSite.pricing.finalCtaDescription")}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-full border-border bg-transparent px-5 text-[15px] font-medium text-foreground hover:bg-muted"
                >
                  <Link href={customPlan.href}>
                    {t("portalSite.pricing.contactSales")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border/70 py-14">
        <div className={PORTAL_PRICING_WIDTH_CLASS}>
          <div className="mx-auto mb-8 max-w-[760px] text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {t("portalSite.pricing.compareTitle")}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
              {t("portalSite.pricing.compareHeading")}
            </h2>
            <p className="mt-4 text-base leading-8 text-muted-foreground">
              {t("portalSite.pricing.compareDescription")}
            </p>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-border/70 bg-card/70">
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[28%]" />
                  {primaryPlans.map((plan) => (
                    <col key={`${plan.id}-col`} className="w-[24%]" />
                  ))}
                </colgroup>
                <thead>
                  <tr className="border-b border-border bg-muted/35">
                    <th className="px-6 py-5 text-left text-sm font-medium text-muted-foreground">
                      {t("portalSite.pricing.table.feature")}
                    </th>
                    {primaryPlans.map((plan) => (
                      <th
                        key={`${plan.id}-compare`}
                        className="border-l border-border px-6 py-5 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-foreground">
                            {t(plan.nameKey)}
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {plan.price}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURE_ROWS.map((rowKey, rowIndex) => (
                    <tr
                      key={rowKey}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-6 py-5 align-top">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">
                            {t(`portalSite.pricing.table.${rowKey}`)}
                          </p>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {t(FEATURE_DESCRIPTION_KEYS[rowKey])}
                          </p>
                        </div>
                      </td>
                      {primaryPlans.map((plan) => (
                        <td
                          key={`${plan.id}-${rowKey}-cell`}
                          className="border-l border-border px-6 py-5 align-top text-sm font-medium text-foreground/88"
                        >
                          {plan.values[rowIndex]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-6 py-5 align-top">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {t("portalSite.pricing.supportLabel")}
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {t("portalSite.pricing.tableDescriptions.support")}
                        </p>
                      </div>
                    </td>
                    {primaryPlans.map((plan) => (
                      <td
                        key={`${plan.id}-support-cell`}
                        className="border-l border-border px-6 py-5 align-top text-sm font-medium text-foreground/88"
                      >
                        {t(`portalSite.pricing.support.${plan.supportKey}`)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className={cn("border border-border/70 bg-background p-7 sm:p-9", PORTAL_PRICING_WIDTH_CLASS)}>
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                {t("portalSite.pricing.finalCtaEyebrow")}
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl">
                {t("portalSite.pricing.finalCtaTitle")}
              </h2>
              <p className="mt-4 max-w-[760px] text-base leading-8 text-muted-foreground">
                {t("portalSite.pricing.finalCtaDescription")}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild className="h-11 rounded-full bg-foreground px-5 text-[15px] font-medium text-background hover:opacity-90">
                <Link href={resolvePlanHref("scale", billingCycle)}>
                  {t("portalSite.pricing.selectPlan")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-11 rounded-full border-border bg-transparent px-5 text-[15px] font-medium text-foreground hover:bg-muted"
              >
                <Link href="/help">{t("portalSite.nav.help")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
