"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { extractRootError } from "@/lib/error-utils";
import { openWebBillingPortal } from "@/lib/web-billing-desktop";
import type { WebBillingPortalRoute } from "@/lib/web-billing-portal";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { CloudUser, TeamRole } from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Spinner } from "./ui/spinner";

interface WorkspacePricingPageProps {
  user: CloudUser;
  teamRole: TeamRole | null;
  workspaceId?: string | null;
  workspaceMode?: "personal" | "team" | null;
  workspaceName?: string | null;
  workspacePlanLabel?: string | null;
  workspaceCount?: number;
  onOpenCheckoutPage?: () => void;
}

function resolvePortalErrorKey(message: string): string {
  if (message.includes("web_billing_portal_url_missing")) {
    return "webBilling.desktopPortalMissing";
  }
  if (message.includes("web_billing_context_missing")) {
    return "webBilling.desktopContextMissing";
  }
  return "";
}

export function WorkspacePricingPage({
  user,
  teamRole,
  workspaceId = null,
  workspaceName = null,
  workspacePlanLabel = null,
  workspaceCount,
}: WorkspacePricingPageProps) {
  const { t } = useTranslation();
  const [openingRoute, setOpeningRoute] = useState<WebBillingPortalRoute | null>(
    null,
  );

  const canManageBilling =
    user.platformRole === "platform_admin" ||
    teamRole === "owner" ||
    teamRole === "admin";
  const workspaceDisplayName = workspaceName?.trim() || t("shell.workspaceSwitcher.current");
  const currentPlan = workspacePlanLabel?.trim() || user.plan || t("pricingPage.freePlanLabel");
  const workspaceTotal = Math.max(1, workspaceCount ?? user.workspaceSeeds?.length ?? 1);
  const routeOrder: WebBillingPortalRoute[] =
    user.platformRole === "platform_admin"
      ? ["pricing", "management", "adminCommandCenter"]
      : ["pricing", "management", "plans"];

  const openPortal = async (route: WebBillingPortalRoute) => {
    try {
      setOpeningRoute(route);
      await openWebBillingPortal({
        route,
        user,
        workspaceId,
        workspaceName,
      });
      showSuccessToast(t("webBilling.desktopPortalOpened"));
    } catch (error) {
      const root = extractRootError(error);
      const key = resolvePortalErrorKey(root);
      showErrorToast(key ? t(key) : t("webBilling.desktopPortalOpenFailed"), {
        description: key ? undefined : root,
      });
    } finally {
      setOpeningRoute(null);
    }
  };

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
              workspace: workspaceDisplayName,
              email: user.email,
            })}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 pb-8">
      <Card className="border-border/70 bg-card shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-foreground">
            {t("webBilling.desktopPricingTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("webBilling.desktopPricingDescription")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="h-7 px-2 text-[11px]">
              {t("webBilling.desktopWorkspace", { workspace: workspaceDisplayName })}
            </Badge>
            <Badge variant="outline" className="h-7 px-2 text-[11px]">
              {t("webBilling.desktopPlan", { plan: currentPlan })}
            </Badge>
            <Badge variant="outline" className="h-7 px-2 text-[11px]">
              {t("webBilling.desktopWorkspaceCount", { count: workspaceTotal })}
            </Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {routeOrder.map((route) => {
              const isLoading = openingRoute === route;
              return (
                <Button
                  key={route}
                  type="button"
                  variant={route === "pricing" ? "default" : "outline"}
                  className="justify-between"
                  disabled={openingRoute !== null}
                  onClick={() => void openPortal(route)}
                >
                  <span>
                    {route === "pricing"
                      ? t("webBilling.desktopOpenPricing")
                      : route === "management"
                        ? t("webBilling.desktopOpenManagement")
                        : route === "adminCommandCenter"
                          ? t("portalSite.nav.admin")
                          : t("webBilling.desktopOpenPlans")}
                  </span>
                  {isLoading ? (
                    <Spinner size="md" className="text-current" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4" />
                  )}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">
            {t("webBilling.desktopMigrationTitle")}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {t("webBilling.desktopMigrationDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
