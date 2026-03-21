"use client";

import { Check, Crown, KeyRound, Mail, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import {
  getBillingPlanPrice,
  BILLING_PLAN_DEFINITIONS,
  type BillingCycle,
} from "@/lib/billing-plans";
import {
  type AuthLoginScope,
  AUTH_QUICK_PRESETS,
} from "@/lib/auth-quick-presets";
import { acceptControlInviteIfProvided } from "@/lib/control-invite";
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { RuntimeConfigStatus } from "@/types";
import { LoadingButton } from "./loading-button";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

type AuthView = "login" | "register" | "forgot";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface AuthPricingWorkspaceProps {
  runtimeConfig: RuntimeConfigStatus | null;
  prefilledInviteToken?: string | null;
  onConsumeInviteToken?: () => void;
  onOpenSyncConfig: () => void;
}

export function AuthPricingWorkspace({
  runtimeConfig,
  prefilledInviteToken = null,
  onConsumeInviteToken,
  onOpenSyncConfig,
}: AuthPricingWorkspaceProps) {
  const { t } = useTranslation();
  const { loginWithEmail, refreshProfile, requestOtp } = useCloudAuth();

  const [authView, setAuthView] = useState<AuthView>("login");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<"starter" | "growth" | "scale">(
    "growth",
  );

  const [loginEmail, setLoginEmail] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [scope, setScope] = useState<AuthLoginScope>("workspace_user");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPlan =
    BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === selectedPlanId) ??
    BILLING_PLAN_DEFINITIONS[1];
  const isGoogleReady = runtimeConfig?.auth === "ready";
  const isStripeReady = runtimeConfig?.stripe === "ready";
  const isSyncReady = runtimeConfig?.s3_sync === "ready";

  useEffect(() => {
    if (!prefilledInviteToken) {
      return;
    }
    setInviteToken(prefilledInviteToken);
    setAuthView("login");
  }, [prefilledInviteToken]);

  const handleSelectPlan = (planId: "starter" | "growth" | "scale") => {
    setSelectedPlanId(planId);
    const plan = BILLING_PLAN_DEFINITIONS.find((row) => row.id === planId);
    if (!plan) {
      return;
    }
    const price = getBillingPlanPrice(plan, billingCycle);
    showSuccessToast(t("authLanding.planSelected"), {
      description: `${t(`authLanding.plans.${plan.id}.name`)} • $${price}/${billingCycle === "monthly" ? t("authLanding.perMonth") : t("authLanding.perYear")}`,
    });
  };

  const handleSignIn = async () => {
    const normalizedEmail = normalizeEmail(loginEmail);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }

    try {
      setIsSubmitting(true);
      const hasInvite = inviteToken.trim().length > 0;
      const state = await loginWithEmail(normalizedEmail, {
        scope,
        allowUnassigned: hasInvite,
      });

      try {
        const inviteStatus = await acceptControlInviteIfProvided({
          token: inviteToken,
          userId: state.user.id,
          email: state.user.email,
          platformRole: state.user.platformRole,
        });
        if (inviteStatus === "accepted") {
          showSuccessToast(t("authDialog.inviteAccepted"));
        }
      } catch (inviteError) {
        const inviteMessage = extractRootError(inviteError);
        if (inviteMessage.includes("invite_server_missing")) {
          showErrorToast(t("authDialog.inviteServerMissing"));
        } else {
          showErrorToast(t("authDialog.inviteAcceptFailed"), {
            description: inviteMessage,
          });
        }
      }

      await refreshProfile().catch(() => null);
      showSuccessToast(t("authDialog.loginSuccess"));
      onConsumeInviteToken?.();
    } catch (error) {
      const message = extractRootError(error);
      if (message.includes("invite_required")) {
        showErrorToast(t("authDialog.inviteRequired"));
        return;
      }
      showErrorToast(t("authDialog.loginFailed"), {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    const normalizedEmail = normalizeEmail(registerEmail);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }

    try {
      setIsSubmitting(true);
      const otpResult = await requestOtp(normalizedEmail);
      if (otpResult === "self_hosted_no_otp") {
        showSuccessToast(t("authLanding.registerQueued"), {
          description: t("authLanding.registerQueuedDescription"),
        });
      } else {
        showSuccessToast(t("authDialog.otpRequested"));
      }
      setLoginEmail(normalizedEmail);
      setAuthView("login");
    } catch (error) {
      showErrorToast(t("authLanding.registerFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = normalizeEmail(forgotEmail);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }

    try {
      setIsSubmitting(true);
      const otpResult = await requestOtp(normalizedEmail);
      if (otpResult === "self_hosted_no_otp") {
        showSuccessToast(t("authLanding.resetQueued"), {
          description: t("authLanding.resetQueuedDescription"),
        });
      } else {
        showSuccessToast(t("authLanding.resetSent"));
      }
      setAuthView("login");
      setLoginEmail(normalizedEmail);
    } catch (error) {
      showErrorToast(t("authLanding.resetFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const rolePresetRows = useMemo(() => AUTH_QUICK_PRESETS, []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t("authLanding.pricingTitle")}</CardTitle>
            <CardDescription>{t("authLanding.pricingDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant={billingCycle === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setBillingCycle("monthly")}
              >
                {t("authLanding.monthly")}
              </Button>
              <Button
                type="button"
                variant={billingCycle === "yearly" ? "default" : "outline"}
                size="sm"
                onClick={() => setBillingCycle("yearly")}
              >
                {t("authLanding.yearly")}
              </Button>
              <Badge variant="secondary">{t("authLanding.yearlySave")}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {BILLING_PLAN_DEFINITIONS.map((plan) => {
                const price = getBillingPlanPrice(plan, billingCycle);
                const isSelected = selectedPlanId === plan.id;
                return (
                  <Card key={plan.id} className={isSelected ? "border-primary" : undefined}>
                    <CardHeader className="space-y-2 pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm">
                          {t(`authLanding.plans.${plan.id}.name`)}
                        </CardTitle>
                        {plan.recommended && (
                          <Badge variant="secondary">
                            <Crown className="mr-1 h-3 w-3" />
                            {t("authLanding.recommended")}
                          </Badge>
                        )}
                      </div>
                      <CardDescription>
                        {t(`authLanding.plans.${plan.id}.description`)}
                      </CardDescription>
                      <div className="text-lg font-semibold text-foreground">
                        ${price}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          /{billingCycle === "monthly" ? t("authLanding.perMonth") : t("authLanding.perYear")}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("authLanding.featureProfiles", { count: plan.profiles })}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("authLanding.featureMembers", { count: plan.members })}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("authLanding.featureStorage", { count: plan.storageGb })}
                      </p>
                      <p className="flex items-center gap-2 text-xs text-foreground">
                        <Check className="h-3.5 w-3.5 text-muted-foreground" />
                        {t("authLanding.featureSupport", {
                          level: t(`authLanding.support.${plan.support}`),
                        })}
                      </p>
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        className="mt-2 w-full"
                        onClick={() => handleSelectPlan(plan.id)}
                      >
                        {isSelected
                          ? t("authLanding.selectedPlan")
                          : t("authLanding.selectPlan")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {isStripeReady ? t("authLanding.stripeReady") : t("authLanding.stripePending")}
              </div>
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {isGoogleReady ? t("authLanding.authReady") : t("authLanding.authPending")}
              </div>
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {isSyncReady ? t("authLanding.syncReady") : t("authLanding.syncPending")}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("authLanding.signInTitle")}</CardTitle>
            <CardDescription>{t("authLanding.signInDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Tabs value={authView} onValueChange={(value) => setAuthView(value as AuthView)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="login">
                  <Mail className="mr-1 h-3.5 w-3.5" />
                  {t("authLanding.tabs.login")}
                </TabsTrigger>
                <TabsTrigger value="register">
                  <UserPlus className="mr-1 h-3.5 w-3.5" />
                  {t("authLanding.tabs.register")}
                </TabsTrigger>
                <TabsTrigger value="forgot">
                  <KeyRound className="mr-1 h-3.5 w-3.5" />
                  {t("authLanding.tabs.forgot")}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {authView === "login" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="auth-pricing-login-email">{t("authDialog.emailLabel")}</Label>
                  <Input
                    id="auth-pricing-login-email"
                    type="email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    placeholder={t("authDialog.emailPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-pricing-scope">{t("authDialog.accessScopeLabel")}</Label>
                  <Select
                    value={scope}
                    onValueChange={(value) => setScope(value as AuthLoginScope)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="auth-pricing-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="workspace_user">
                        {t("authDialog.accessScopeUser")}
                      </SelectItem>
                      <SelectItem value="platform_admin">
                        {t("authDialog.accessScopeAdmin")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="auth-pricing-invite">{t("authDialog.inviteTokenLabel")}</Label>
                  <Input
                    id="auth-pricing-invite"
                    value={inviteToken}
                    onChange={(event) => setInviteToken(event.target.value)}
                    placeholder={t("authDialog.inviteTokenPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>

                <LoadingButton
                  type="button"
                  className="w-full"
                  onClick={handleSignIn}
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {selectedPlan
                    ? `${t("authDialog.signInWithEmail")} • ${t(`authLanding.plans.${selectedPlan.id}.name`)}`
                    : t("authDialog.signInWithEmail")}
                </LoadingButton>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={!isGoogleReady || isSubmitting}
                  onClick={() => showSuccessToast(t("authLanding.googleSoon"))}
                >
                  {t("authLanding.googleButton")}
                </Button>
              </div>
            )}

            {authView === "register" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="auth-pricing-register-email">{t("authDialog.emailLabel")}</Label>
                  <Input
                    id="auth-pricing-register-email"
                    type="email"
                    value={registerEmail}
                    onChange={(event) => setRegisterEmail(event.target.value)}
                    placeholder={t("authDialog.emailPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {t("authLanding.registerHint")}
                </p>
                <LoadingButton
                  type="button"
                  className="w-full"
                  onClick={() => {
                    void handleRegister();
                  }}
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {t("authLanding.registerAction")}
                </LoadingButton>
              </div>
            )}

            {authView === "forgot" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="auth-pricing-forgot-email">{t("authDialog.emailLabel")}</Label>
                  <Input
                    id="auth-pricing-forgot-email"
                    type="email"
                    value={forgotEmail}
                    onChange={(event) => setForgotEmail(event.target.value)}
                    placeholder={t("authDialog.emailPlaceholder")}
                    disabled={isSubmitting}
                  />
                </div>
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {t("authLanding.forgotHint")}
                </p>
                <LoadingButton
                  type="button"
                  className="w-full"
                  onClick={() => {
                    void handleForgotPassword();
                  }}
                  isLoading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {t("authLanding.forgotAction")}
                </LoadingButton>
              </div>
            )}

            <div className="space-y-2 rounded-md border border-border bg-muted p-3">
              <p className="text-xs font-medium text-foreground">
                {t("authDialog.quickPresetTitle")}
              </p>
              <div className="space-y-2">
                {rolePresetRows.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                    onClick={() => {
                      setLoginEmail(preset.email);
                      setScope(preset.scope);
                      setAuthView("login");
                    }}
                    disabled={isSubmitting}
                  >
                    <span className="font-medium text-foreground">{t(preset.labelKey)}</span>
                    <span className="truncate text-muted-foreground">{preset.email}</span>
                  </button>
                ))}
              </div>
            </div>

            {!isSyncReady && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={onOpenSyncConfig}
              >
                {t("authLanding.openSyncConfig")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
