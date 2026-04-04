"use client";

import { ExternalLink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface CheckoutReturnPageProps {
  status: "success" | "cancel";
}

function CheckoutReturnPageContent({ status }: CheckoutReturnPageProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [manualTarget, setManualTarget] = useState<string>(
    "buglogin://checkout-callback?status=cancel",
  );
  const [phase, setPhase] = useState<"resolving" | "redirecting">("resolving");
  const [mode, setMode] = useState<"desktop" | "portal">("desktop");
  const isSuccess = status === "success";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isCancelled = false;
    const closeTimers: ReturnType<typeof setTimeout>[] = [];

    const finish = (target: string, nextMode: "desktop" | "portal") => {
      if (isCancelled) {
        return;
      }
      setMode(nextMode);
      setManualTarget(target);
      setPhase("redirecting");
      if (nextMode === "portal") {
        router.replace(target);
        return;
      }
      window.location.assign(target);
      closeTimers.push(
        setTimeout(() => {
          window.location.assign(target);
        }, 450),
      );
      closeTimers.push(
        setTimeout(() => {
          const link = document.createElement("a");
          link.href = target;
          link.rel = "noreferrer";
          link.click();
        }, 1100),
      );
      closeTimers.push(
        setTimeout(() => {
          window.close();
        }, 1400),
      );
      closeTimers.push(
        setTimeout(() => {
          window.close();
        }, 2600),
      );
    };

    const sessionId = searchParams.get("session_id")?.trim();
    const target =
      searchParams.get("target") === "portal" ? "portal" : "desktop";
    const workspaceId = searchParams.get("workspaceId")?.trim();

    if (target === "portal") {
      const nextUrl = new URL("/account/billing", window.location.origin);
      nextUrl.searchParams.set("checkout", status);
      if (workspaceId) {
        nextUrl.searchParams.set("workspaceId", workspaceId);
      }
      if (status === "success" && sessionId) {
        nextUrl.searchParams.set("session_id", sessionId);
      }
      finish(nextUrl.toString(), "portal");
      return;
    }

    const params = new URLSearchParams({ status });
    if (status === "success" && sessionId) {
      params.set("session_id", sessionId);
    }
    finish(`buglogin://checkout-callback?${params.toString()}`, "desktop");

    return () => {
      isCancelled = true;
      for (const timer of closeTimers) {
        clearTimeout(timer);
      }
    };
  }, [router, searchParams, status]);

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/35 to-card" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:18px_18px]" />
      <Card className="relative z-10 w-full max-w-[420px] gap-0 border-border/70 shadow-xl">
        <CardContent className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          <Logo alt={t("authLanding.title")} className="h-10 w-auto" />
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" className="h-8 w-8 text-primary" />
            <div className="space-y-2">
              <p className="text-xl font-semibold tracking-tight text-foreground">
                {mode === "portal"
                  ? isSuccess
                    ? t("portalSite.checkout.successTitle")
                    : t("portalSite.checkout.cancelTitle")
                  : isSuccess
                    ? t("billingPage.checkoutReturnSuccessTitle")
                    : t("billingPage.checkoutReturnCancelTitle")}
              </p>
              <p className="max-w-[28ch] text-sm leading-6 text-muted-foreground">
                {phase === "redirecting"
                  ? mode === "portal"
                    ? t("portalSite.checkout.returning")
                    : t("billingPage.checkoutReturnRedirecting")
                  : mode === "portal"
                    ? isSuccess
                      ? t("portalSite.checkout.successDescription")
                      : t("portalSite.checkout.cancelDescription")
                    : isSuccess
                      ? t("billingPage.checkoutReturnSuccessDescription")
                      : t("billingPage.checkoutReturnCancelDescription")}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="h-10 w-full font-medium">
            <a href={manualTarget}>
              <ExternalLink className="h-4 w-4" />
              {mode === "portal"
                ? t("portalSite.checkout.openBilling")
                : t("billingPage.checkoutReturnOpenApp")}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function CheckoutReturnPage(props: CheckoutReturnPageProps) {
  return (
    <Suspense fallback={null}>
      <CheckoutReturnPageContent {...props} />
    </Suspense>
  );
}
