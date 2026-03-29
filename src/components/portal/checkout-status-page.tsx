"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, CreditCard, LifeBuoy, RotateCcw, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PORTAL_PRICING_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CheckoutStatusPageProps {
  status: "success" | "cancel";
}

export function CheckoutStatusPage({ status }: CheckoutStatusPageProps) {
  const { t } = useTranslation();
  const isSuccess = status === "success";
  const Icon = isSuccess ? CheckCircle2 : XCircle;

  return (
    <section className={cn("space-y-8 pb-16 pt-4", PORTAL_PRICING_WIDTH_CLASS)}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_360px]">
        <div className="overflow-hidden rounded-[32px] border border-border bg-card/90 shadow-[0_24px_80px_rgba(0,0,0,0.16)]">
          <div className="border-b border-border bg-muted/35 px-6 py-5 sm:px-8 sm:py-6">
            <div className="inline-flex items-center gap-3 rounded-full border border-border bg-background/80 px-3 py-2 text-sm font-medium text-foreground">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  isSuccess ? "bg-foreground text-background" : "bg-muted text-foreground",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span>
                {isSuccess
                  ? t("portalSite.checkout.successTitle")
                  : t("portalSite.checkout.cancelTitle")}
              </span>
            </div>
          </div>

          <div className="grid gap-8 px-6 py-8 sm:px-8 sm:py-10">
            <div className="space-y-4">
              <h1 className="max-w-[14ch] text-4xl font-semibold tracking-[-0.055em] text-foreground sm:text-5xl lg:text-6xl">
                {isSuccess
                  ? t("portalSite.checkout.successTitle")
                  : t("portalSite.checkout.cancelTitle")}
              </h1>
              <p className="max-w-[58ch] text-base leading-8 text-muted-foreground sm:text-lg">
                {isSuccess
                  ? t("portalSite.checkout.successDescription")
                  : t("portalSite.checkout.cancelDescription")}
              </p>
            </div>

            <div className="grid gap-4 rounded-[28px] border border-border bg-background/70 p-5 sm:grid-cols-2 sm:p-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t("portalSite.nav.billing")}
                </p>
                <p className="text-sm leading-7 text-foreground/88">
                  {isSuccess
                    ? t("portalSite.account.checkoutSuccessDescription")
                    : t("portalSite.account.checkoutCancelDescription")}
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  asChild
                  className="h-11 w-full rounded-full bg-foreground text-[15px] font-medium text-background hover:opacity-90"
                >
                  <Link href={isSuccess ? "/account/billing" : "/checkout"}>
                    {isSuccess
                      ? t("portalSite.checkout.openBilling")
                      : t("portalSite.checkout.continue")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full rounded-full border-border bg-transparent text-[15px] font-medium text-foreground hover:bg-muted"
                >
                  <Link href="/pricing">{t("portalSite.nav.pricing")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:pt-2">
          <div className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {t("portalSite.nav.billing")}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {isSuccess
                    ? t("portalSite.account.checkoutSuccessDescription")
                    : t("portalSite.account.checkoutCancelDescription")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background">
                {isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {isSuccess
                    ? t("portalSite.checkout.successTitle")
                    : t("portalSite.checkout.continue")}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  {isSuccess
                    ? t("portalSite.checkout.returning")
                    : t("portalSite.checkout.cancelDescription")}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-card/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background">
                <LifeBuoy className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    {t("portalSite.nav.help")}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t("portalSite.pricing.finalCtaDescription")}
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-full border-border bg-transparent px-4 text-sm font-medium text-foreground hover:bg-muted"
                >
                  <Link href="/help">{t("portalSite.nav.help")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
