"use client";

import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import { extractRootError } from "@/lib/error-utils";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { openWebBillingPortal } from "@/lib/web-billing-desktop";
import type { WebBillingPortalRoute } from "@/lib/web-billing-portal";
import type {
  CloudUser,
  EntitlementSnapshot,
  RuntimeConfigStatus,
  TeamRole,
} from "@/types";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";
import { Spinner } from "./ui/spinner";

type WorkspaceBillingMode = "management" | "checkout" | "coupon" | "license";

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
  workspaceExpiresAt?: string | null;
  mode?: WorkspaceBillingMode;
  onOpenAdminWorkspace: () => void;
  onOpenSyncConfig: () => void;
  onOpenPricingPage: () => void;
  onOpenCheckoutPage: () => void;
  onPaymentCompleted?: () => void;
  onPaymentCancelled?: () => void;
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

export function WorkspaceBillingPage({
  user,
  teamRole,
  workspaceId = null,
  workspaceName = null,
  workspacePlanLabel = null,
  workspaceProfileLimit = null,
  workspaceProfilesUsed = 0,
  workspaceExpiresAt = null,
}: WorkspaceBillingPageProps) {
  const { t } = useTranslation();
  const { refreshProfile } = useCloudAuth();
  const [openingRoute, setOpeningRoute] =
    useState<WebBillingPortalRoute | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const canManageBilling =
    user.platformRole === "platform_admin" ||
    teamRole === "owner" ||
    teamRole === "admin";
  const workspaceDisplayName =
    workspaceName?.trim() || t("shell.workspaceSwitcher.current");
  const planLabel =
    workspacePlanLabel?.trim() || user.plan || t("billingPage.freePlanLabel");
  const normalizedLimit =
    typeof workspaceProfileLimit === "number" && workspaceProfileLimit > 0
      ? Math.round(workspaceProfileLimit)
      : null;
  const usedProfiles = Math.max(0, Math.round(workspaceProfilesUsed));
  const usagePercent = useMemo(() => {
    if (!normalizedLimit || normalizedLimit <= 0) {
      return 0;
    }
    return Math.max(
      0,
      Math.min(100, Math.round((usedProfiles / normalizedLimit) * 100)),
    );
  }, [normalizedLimit, usedProfiles]);
  const actionRoutes: WebBillingPortalRoute[] =
    user.platformRole === "platform_admin"
      ? ["management", "pricing", "adminCommandCenter"]
      : ["management", "pricing", "plans"];

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

  const handleSyncFromWeb = async () => {
    try {
      setIsSyncing(true);
      await refreshProfile();
      showSuccessToast(t("webBilling.desktopSyncSuccess"));
    } catch (error) {
      showErrorToast(t("webBilling.desktopSyncFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSyncing(false);
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
            {t("webBilling.desktopManagementTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("webBilling.desktopManagementDescription")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info" className="h-7 px-2 text-[11px]">
              {t("webBilling.desktopWorkspace", {
                workspace: workspaceDisplayName,
              })}
            </Badge>
            <Badge variant="success" className="h-7 px-2 text-[11px]">
              {t("webBilling.desktopPlan", { plan: planLabel })}
            </Badge>
            {workspaceExpiresAt ? (
              <Badge variant="warning" className="h-7 px-2 text-[11px]">
                {t("webBilling.desktopExpiresAt", {
                  date: formatLocaleDateTime(workspaceExpiresAt),
                })}
              </Badge>
            ) : null}
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {t("webBilling.desktopProfileUsage")}
              </p>
              <p className="text-xs font-medium text-foreground">
                {normalizedLimit
                  ? t("webBilling.desktopProfileUsageValue", {
                      used: usedProfiles,
                      limit: normalizedLimit,
                    })
                  : t("webBilling.notAvailable")}
              </p>
            </div>
            <Progress value={usagePercent} className="mt-2 h-2" />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {actionRoutes.map((route) => {
              const isLoading = openingRoute === route;
              return (
                <Button
                  key={route}
                  type="button"
                  variant={route === "management" ? "default" : "outline"}
                  className="justify-between"
                  disabled={openingRoute !== null}
                  onClick={() => void openPortal(route)}
                >
                  <span>
                    {route === "management"
                      ? t("webBilling.desktopOpenManagement")
                      : route === "pricing"
                        ? t("webBilling.desktopOpenPricing")
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

          <Button
            type="button"
            variant="outline"
            disabled={isSyncing}
            onClick={() => void handleSyncFromWeb()}
          >
            {isSyncing ? (
              <Spinner size="md" className="text-current" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t("webBilling.desktopSyncButton")}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card shadow-none">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-foreground">
            {t("webBilling.desktopMigrationTitle")}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {t("webBilling.desktopManagementMigrationDescription")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
