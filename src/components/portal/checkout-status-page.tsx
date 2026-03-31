"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, CreditCard, ReceiptText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PORTAL_PRICING_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  confirmWorkspaceStripeCheckout,
  getWorkspaceBillingState,
} from "@/components/web-billing/control-api";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { formatLocaleDateTime, formatLocaleNumber } from "@/lib/locale-format";
import { showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";

interface CheckoutStatusPageProps {
  status: "success" | "cancel";
}

type ConfirmState = "idle" | "confirming" | "paid" | "pending" | "failed";

async function waitMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function CheckoutStatusPage({ status }: CheckoutStatusPageProps) {
  const { t } = useTranslation();
  const isSuccess = status === "success";
  const searchParams = useSearchParams();
  const confirmStartedRef = useRef(false);
  const {
    connection,
    selectedWorkspace,
    selectedWorkspaceId,
    billingState,
    refreshBilling,
    refreshWorkspaces,
  } = usePortalBillingData();

  const [confirmState, setConfirmState] = useState<ConfirmState>(
    isSuccess ? "confirming" : "idle",
  );
  const iconClass = "h-5 w-5";
  const checkoutSessionId = searchParams.get("session_id")?.trim() ?? "";
  const workspaceIdFromQuery = searchParams.get("workspaceId")?.trim() ?? "";
  const planFromQuery = searchParams.get("plan")?.trim() ?? "";
  const cycleFromQuery = searchParams.get("cycle")?.trim() ?? "";
  const targetWorkspaceId = workspaceIdFromQuery || selectedWorkspaceId || "";

  useEffect(() => {
    if (!isSuccess || !connection || !targetWorkspaceId || confirmStartedRef.current) {
      return;
    }
    confirmStartedRef.current = true;
    let cancelled = false;

    void (async () => {
      setConfirmState("confirming");
      const maxAttempts = checkoutSessionId ? 8 : 4;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (cancelled) {
          return;
        }
        try {
          if (checkoutSessionId) {
            const result = await confirmWorkspaceStripeCheckout(
              connection,
              targetWorkspaceId,
              checkoutSessionId,
            );
            if (result.status === "paid") {
              await refreshBilling();
              await refreshWorkspaces();
              if (!cancelled) {
                setConfirmState("paid");
                showSuccessToast(
                  t("portalSite.checkout.syncCompleteToast", {
                    defaultValue: "Payment confirmed. Billing is updated.",
                  }),
                );
              }
              return;
            }
          } else {
            const snapshot = await getWorkspaceBillingState(connection, targetWorkspaceId);
            if (snapshot.recentInvoices.length > 0) {
              await refreshBilling();
              await refreshWorkspaces();
              if (!cancelled) {
                setConfirmState("paid");
              }
              return;
            }
          }
        } catch {
          if (attempt === maxAttempts - 1 && !cancelled) {
            setConfirmState("failed");
            return;
          }
        }
        await refreshBilling();
        await waitMs(1300);
      }

      if (!cancelled) {
        setConfirmState("pending");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [checkoutSessionId, connection, isSuccess, refreshBilling, refreshWorkspaces, t, targetWorkspaceId]);

  const latestInvoice = billingState?.recentInvoices?.[0] ?? null;
  const subscription = billingState?.subscription ?? null;
  const resolvedPlan =
    subscription?.planLabel ||
    selectedWorkspace?.planLabel ||
    (planFromQuery
      ? t(`portalSite.pricing.plans.${planFromQuery}.name`, { defaultValue: planFromQuery })
      : "--");
  const resolvedCycle =
    subscription?.billingCycle ||
    (cycleFromQuery === "yearly" || cycleFromQuery === "monthly"
      ? cycleFromQuery
      : null);

  const title = isSuccess
    ? t("portalSite.checkout.successTitle", { defaultValue: "Payment completed" })
    : t("portalSite.checkout.cancelTitle", { defaultValue: "Checkout cancelled" });
  const bodyText = useMemo(() => {
    if (!isSuccess) {
      return t("portalSite.checkout.cancelDescription", {
        defaultValue: "No changes were made. You can retry checkout anytime.",
      });
    }
    switch (confirmState) {
      case "confirming":
        return t("portalSite.checkout.syncingPayment", {
          defaultValue: "Synchronizing payment confirmation...",
        });
      case "paid":
        return t("portalSite.checkout.syncComplete", {
          defaultValue: "Payment confirmed. Subscription and invoice are now updated.",
        });
      case "pending":
        return t("portalSite.checkout.syncPending", {
          defaultValue: "Payment is pending confirmation from Stripe.",
        });
      case "failed":
        return t("portalSite.checkout.syncFailed", {
          defaultValue: "Unable to verify payment automatically. Open Billing to retry.",
        });
      default:
        return t("portalSite.checkout.returning", {
          defaultValue: "Returning to billing portal.",
        });
    }
  }, [confirmState, isSuccess, t]);

  return (
    <section className={cn("space-y-6 pb-14 pt-4", PORTAL_PRICING_WIDTH_CLASS)}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="border-border/70 bg-card/90">
          <CardHeader className="border-b border-border/70 pb-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground">
              {isSuccess ? (
                <CheckCircle2 className={iconClass} />
              ) : (
                <CircleAlert className={iconClass} />
              )}
              {title}
            </div>
            <CardTitle className="text-4xl font-semibold tracking-[-0.045em] text-foreground sm:text-5xl">
              {title}
            </CardTitle>
            <p className="max-w-[62ch] text-base text-muted-foreground">{bodyText}</p>
          </CardHeader>

          <CardContent className="space-y-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.account.plan", { defaultValue: "Plan" })}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{resolvedPlan}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.account.cycle", { defaultValue: "Cycle" })}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {resolvedCycle
                    ? resolvedCycle === "yearly"
                      ? t("portalSite.checkout.cycleYearly", { defaultValue: "Yearly" })
                      : t("portalSite.checkout.cycleMonthly", { defaultValue: "Monthly" })
                    : "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.account.status", { defaultValue: "Status" })}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {subscription?.status || "--"}
                </p>
              </div>
              <div className="rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  {t("portalSite.account.renewal", { defaultValue: "Renewal" })}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {subscription?.expiresAt
                    ? formatLocaleDateTime(subscription.expiresAt)
                    : "--"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/60 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ReceiptText className="h-4 w-4 text-muted-foreground" />
                {t("portalSite.checkout.latestInvoice", {
                  defaultValue: "Latest invoice",
                })}
              </div>
              {latestInvoice ? (
                <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <p>
                    {t("portalSite.account.invoiceId", { defaultValue: "Invoice ID" })}:{" "}
                    <span className="font-medium text-foreground">{latestInvoice.id}</span>
                  </p>
                  <p>
                    {t("portalSite.account.invoiceAmount", { defaultValue: "Amount" })}:{" "}
                    <span className="font-medium text-foreground">
                      $
                      {formatLocaleNumber(latestInvoice.amountUsd, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </p>
                  <p>
                    {t("portalSite.account.invoiceDate", { defaultValue: "Date" })}:{" "}
                    <span className="font-medium text-foreground">
                      {formatLocaleDateTime(latestInvoice.paidAt || latestInvoice.createdAt)}
                    </span>
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  {isSuccess
                    ? t("portalSite.checkout.invoicePending", {
                        defaultValue:
                          "Invoice is still being synchronized. Please check again shortly.",
                      })
                    : t("portalSite.account.checkoutCancelDescription", {
                        defaultValue: "Current plan is unchanged after cancellation.",
                      })}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/account/billing">
                  {t("portalSite.checkout.openBilling", {
                    defaultValue: "Open billing",
                  })}
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/account/invoices">
                  {t("portalSite.checkout.openInvoices", {
                    defaultValue: "Open invoices",
                  })}
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/pricing">{t("portalSite.nav.pricing")}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-border/70 bg-card/90">
            <CardContent className="space-y-2.5 pt-5">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {t("portalSite.checkout.checkoutSession", {
                  defaultValue: "Checkout session",
                })}
              </div>
              <p className="break-all rounded-md border border-border/70 bg-background/70 px-2.5 py-2 text-xs text-muted-foreground">
                {checkoutSessionId || "--"}
              </p>
              {isSuccess && confirmState === "confirming" ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
                  <Spinner className="h-3.5 w-3.5" />
                  {t("portalSite.checkout.syncingPayment", {
                    defaultValue: "Synchronizing payment confirmation...",
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}
