"use client";

import Link from "next/link";
import {
  ArrowRight,
  CreditCard,
  Eye,
  EyeOff,
  LifeBuoy,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaGoogle } from "react-icons/fa";
import { Logo } from "@/components/icons/logo";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/loading-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import { extractRootError } from "@/lib/error-utils";
import {
  createPortalSessionRecord,
  PORTAL_GOOGLE_STORAGE_KEY,
  PORTAL_OAUTH_INTENT_STORAGE_KEY,
  readPortalSessionStorage,
  resolvePortalPostAuthPath,
  writePortalSessionStorage,
} from "@/lib/portal-session";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { readWebBillingPortalContextFromHash } from "@/lib/web-billing-portal";
import { cn } from "@/lib/utils";
import type { CloudUser } from "@/types";

type AuthView = "login" | "register" | "forgot";

const REMEMBER_EMAIL_STORAGE_KEY = "buglogin.auth.remember-email.v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function encodeOAuthState(input: {
  target: "portal";
  nextPath?: string;
  inviteToken?: string;
}): string {
  return window.btoa(JSON.stringify(input));
}

export default function AuthPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    user,
    isLoggedIn,
    isLoading,
    loginWithEmail,
    refreshProfile,
    registerWithEmail,
    requestOtp,
  } = useCloudAuth();

  const [authView, setAuthView] = useState<AuthView>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showRegisterConfirmPassword, setShowRegisterConfirmPassword] =
    useState(false);

  const [forgotEmail, setForgotEmail] = useState("");
  const [googleAuthState, setGoogleAuthState] = useState<"idle" | "opened">(
    "idle",
  );
  const consumedGoogleProfileRef = useRef(false);

  const nextPath = searchParams.get("next")?.trim() ?? "";
  const inviteToken = searchParams.get("inviteToken")?.trim() ?? "";
  const requestedView = searchParams.get("view")?.trim() ?? "";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const cachedEmail = window.localStorage.getItem(
        REMEMBER_EMAIL_STORAGE_KEY,
      );
      if (cachedEmail && isValidEmail(cachedEmail)) {
        setLoginEmail(cachedEmail);
      }
    } catch {
      // Ignore local storage failures.
    }
  }, []);

  const persistRememberedEmail = (email: string) => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      if (rememberMe) {
        window.localStorage.setItem(REMEMBER_EMAIL_STORAGE_KEY, email);
      } else {
        window.localStorage.removeItem(REMEMBER_EMAIL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage failures in web auth.
    }
  };

  const completePortalAuth = useCallback(
    (nextUser: CloudUser) => {
      if (typeof window === "undefined") {
        return;
      }

      const context = readWebBillingPortalContextFromHash(window.location.hash);
      const storedSession = readPortalSessionStorage();
      const controlBaseUrl =
        context?.controlBaseUrl ??
        storedSession?.connection.controlBaseUrl ??
        process.env.NEXT_PUBLIC_SYNC_SERVER_URL?.trim() ??
        "";
      const controlToken =
        context?.controlToken ??
        storedSession?.connection.controlToken ??
        process.env.NEXT_PUBLIC_SYNC_TOKEN?.trim() ??
        "";

      if (controlBaseUrl && controlToken) {
        const record = createPortalSessionRecord({
          user: {
            id: nextUser.id,
            email: nextUser.email,
            name: nextUser.name,
            avatar: nextUser.avatar,
            platformRole: nextUser.platformRole ?? null,
          },
          connection: {
            controlBaseUrl,
            controlToken,
            userId: nextUser.id,
            userEmail: nextUser.email,
            platformRole: nextUser.platformRole ?? null,
          },
        });
        writePortalSessionStorage(record);
      }

      const destination =
        nextPath || resolvePortalPostAuthPath({ platformRole: nextUser.platformRole ?? null });
      router.replace(destination);
    },
    [nextPath, router],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (consumedGoogleProfileRef.current) {
      return;
    }

    const rawProfile = window.sessionStorage.getItem(PORTAL_GOOGLE_STORAGE_KEY);
    if (!rawProfile) {
      return;
    }

    consumedGoogleProfileRef.current = true;
    window.sessionStorage.removeItem(PORTAL_GOOGLE_STORAGE_KEY);

    let profile: { email?: string; name?: string; avatar?: string } | null = null;
    try {
      profile = JSON.parse(rawProfile) as {
        email?: string;
        name?: string;
        avatar?: string;
      };
    } catch {
      profile = null;
    }

    const normalizedEmail = normalizeEmail(profile?.email ?? "");
    if (!isValidEmail(normalizedEmail)) {
      return;
    }

    void (async () => {
      try {
        setIsSubmitting(true);
        const state = await loginWithEmail(normalizedEmail, {
          authProvider: "google_oauth",
          name: profile?.name,
          avatar: profile?.avatar,
        });
        const refreshedUser = await refreshProfile().catch(() => state.user);
        persistRememberedEmail(normalizedEmail);
        showSuccessToast(t("authDialog.loginSuccess"));
        completePortalAuth(refreshedUser);
      } catch (error) {
        const authMessage = extractRootError(error);
        showErrorToast(t("authDialog.loginFailed"), {
          description: authMessage,
        });
      } finally {
        setIsSubmitting(false);
        setGoogleAuthState("idle");
      }
    })();
  }, [completePortalAuth, loginWithEmail, refreshProfile, t]);

  useEffect(() => {
    if (isLoading || !isLoggedIn || !user) {
      return;
    }
    completePortalAuth(user);
  }, [completePortalAuth, isLoading, isLoggedIn, user]);

  useEffect(() => {
    if (requestedView === "register") {
      setAuthView("register");
      return;
    }
    if (requestedView === "login") {
      setAuthView("login");
    }
  }, [requestedView]);

  useEffect(() => {
    if (isSubmitting || isLoading) {
      return;
    }

    const parsedSession =
      typeof window === "undefined" ? null : readPortalSessionStorage();
    if (!parsedSession) {
      return;
    }

    const destination =
      nextPath ||
      resolvePortalPostAuthPath({
        platformRole:
          parsedSession.user.platformRole ??
          parsedSession.connection.platformRole ??
          null,
      });
    if (!destination) {
      return;
    }

    router.replace(destination);
  }, [isLoading, isSubmitting, nextPath, router]);

  const handleSignIn = async () => {
    const normalizedEmail = normalizeEmail(loginEmail);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }
    if (!loginPassword || loginPassword.length < 8) {
      showErrorToast(t("authDialog.passwordTooShort"));
      return;
    }

    try {
      setIsSubmitting(true);
      const state = await loginWithEmail(normalizedEmail, {
        password: loginPassword,
      });
      const refreshedUser = await refreshProfile().catch(() => state.user);
      persistRememberedEmail(normalizedEmail);
      showSuccessToast(t("authDialog.loginSuccess"));
      completePortalAuth(refreshedUser);
    } catch (error) {
      showErrorToast(t("authDialog.loginFailed"), {
        description: extractRootError(error),
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
    if (!registerPassword || registerPassword.length < 8) {
      showErrorToast(t("authDialog.passwordTooShort"));
      return;
    }
    if (registerPassword !== registerConfirmPassword) {
      showErrorToast(t("authDialog.passwordMismatch"));
      return;
    }

    try {
      setIsSubmitting(true);
      await registerWithEmail(normalizedEmail, registerPassword, {
        name: registerName.trim() || undefined,
      });
      await refreshProfile().catch(() => null);
      persistRememberedEmail(normalizedEmail);
      showSuccessToast(t("authLanding.registerQueued"), {
        description: t("authLanding.registerQueuedDescription"),
      });
      setAuthView("login");
      setLoginEmail(normalizedEmail);
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
      await requestOtp(normalizedEmail);
      showSuccessToast(t("authLanding.resetSent"));
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

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showErrorToast(t("portalSite.auth.googleConfigMissing"));
      return;
    }

    try {
      setIsSubmitting(true);
      setGoogleAuthState("idle");
      const callback = new URL("/oauth-callback", window.location.origin);
      const nonce = Math.random().toString(36).slice(2);
      const state = encodeOAuthState({
        target: "portal",
        nextPath,
        inviteToken,
      });
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", callback.toString());
      authUrl.searchParams.set("response_type", "token id_token");
      authUrl.searchParams.set("scope", "openid email profile");
      authUrl.searchParams.set("nonce", nonce);
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("prompt", "select_account");
      window.sessionStorage.setItem(
        PORTAL_OAUTH_INTENT_STORAGE_KEY,
        JSON.stringify({
          targetMode: "portal",
          nextPath,
          inviteToken,
          createdAt: Date.now(),
        }),
      );
      window.location.assign(authUrl.toString());
      setGoogleAuthState("opened");
    } catch (error) {
      showErrorToast(t("portalSite.auth.googleFailed"), {
        description: extractRootError(error),
      });
      setIsSubmitting(false);
    }
  };

  return (
    <section className={cn("py-6 sm:py-8", MARKETING_RAIL_WIDTH_CLASS)}>
        <div
          className={cn(
            "grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:items-start",
            MARKETING_CONTENT_WIDTH_CLASS,
          )}
        >
          <section className="rounded-[24px] border border-border/70 bg-background/90 p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-border/70 pb-4">
              <div className="inline-flex items-center gap-3">
                <Logo
                  alt="BugLogin"
                  variant="icon"
                  className="h-8 w-8 rounded-md"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">
                    BugLogin
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("portalSite.auth.hub")}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-border bg-muted/45 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Web
              </span>
            </div>

            {authView !== "forgot" ? (
              <Tabs
                value={authView}
                onValueChange={(value) => {
                  setAuthView(value as AuthView);
                }}
                className="w-full"
              >
                <TabsList className="grid h-12 w-full grid-cols-2 rounded-2xl border border-border/70 bg-muted/35 p-1.5">
                  <TabsTrigger
                    value="login"
                    className="rounded-xl border border-transparent text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-all data-[state=active]:border-border/70 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
                  >
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    {t("authLanding.tabs.login")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="register"
                    className="rounded-xl border border-transparent text-[13px] font-medium tracking-[-0.01em] text-muted-foreground transition-all data-[state=active]:border-border/70 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-[0_10px_24px_rgba(0,0,0,0.12)]"
                  >
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    {t("authLanding.tabs.register")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            ) : null}

            <div className="mt-5">
              {authView === "login" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="portal-login-email" className="text-[13px] font-medium">
                      {t("authDialog.emailLabel")}
                    </Label>
                    <Input
                      id="portal-login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(event) => {
                        setLoginEmail(event.target.value);
                      }}
                      placeholder={t("authDialog.emailPlaceholder")}
                      disabled={isSubmitting}
                      className="h-11"
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="portal-login-password" className="text-[13px] font-medium">
                        {t("proxies.form.password")}
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthView("forgot");
                        }}
                        className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                        disabled={isSubmitting}
                      >
                        {t("authLanding.tabs.forgot")}
                      </button>
                    </div>
                    <div className="relative">
                      <Input
                        id="portal-login-password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(event) => {
                          setLoginPassword(event.target.value);
                        }}
                        placeholder={t("authDialog.passwordPlaceholder")}
                        disabled={isSubmitting}
                        className="h-11 pr-11"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowLoginPassword((current) => !current);
                        }}
                        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                        disabled={isSubmitting}
                      >
                        {showLoginPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <label
                    htmlFor="portal-remember-me"
                    className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Checkbox
                      id="portal-remember-me"
                      checked={rememberMe}
                      onCheckedChange={(checked) => {
                        setRememberMe(checked === true);
                      }}
                      disabled={isSubmitting}
                    />
                    <span>{t("authDialog.rememberMe")}</span>
                  </label>

                  <div className="grid gap-2">
                    <LoadingButton
                      type="button"
                      className="h-11 w-full rounded-xl font-medium"
                      onClick={handleSignIn}
                      isLoading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      {t("authDialog.signInWithEmail")}
                    </LoadingButton>

                    <div className="relative py-1">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/70" />
                      </div>
                      <span className="relative mx-auto block w-fit bg-background px-2 text-[11px] text-muted-foreground">
                        {t("authLanding.orContinueWith")}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl font-medium"
                      disabled={isSubmitting}
                      onClick={() => {
                        void handleGoogleLogin();
                      }}
                    >
                      <FaGoogle
                        className="mr-2.5 h-3.5 w-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      {t("authLanding.googleButton")}
                    </Button>
                  </div>

                  {googleAuthState === "opened" ? (
                    <div className="rounded-xl border border-border/70 bg-muted/30 px-3.5 py-3 text-sm text-muted-foreground">
                      {t("authLanding.googleOpenBrowserDescription")}
                    </div>
                  ) : null}

                  <p className="text-center text-xs text-muted-foreground">
                    {t("authLanding.noAccountPrompt")}{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthView("register");
                      }}
                      className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
                      disabled={isSubmitting}
                    >
                      {t("authLanding.signUpCta")}
                    </button>
                  </p>
                </div>
              ) : null}

              {authView === "register" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="portal-register-name" className="text-[13px] font-medium">
                      {t("authDialog.nameLabel")} ({t("authLanding.optionalLabel")})
                    </Label>
                    <Input
                      id="portal-register-name"
                      value={registerName}
                      onChange={(event) => {
                        setRegisterName(event.target.value);
                      }}
                      placeholder={t("authLanding.registerNamePlaceholder")}
                      disabled={isSubmitting}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="portal-register-email" className="text-[13px] font-medium">
                      {t("authDialog.emailLabel")}
                    </Label>
                    <Input
                      id="portal-register-email"
                      type="email"
                      value={registerEmail}
                      onChange={(event) => {
                        setRegisterEmail(event.target.value);
                      }}
                      placeholder={t("authDialog.emailPlaceholder")}
                      disabled={isSubmitting}
                      className="h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="portal-register-password" className="text-[13px] font-medium">
                      {t("proxies.form.password")}
                    </Label>
                    <div className="relative">
                      <Input
                        id="portal-register-password"
                        type={showRegisterPassword ? "text" : "password"}
                        value={registerPassword}
                        onChange={(event) => {
                          setRegisterPassword(event.target.value);
                        }}
                        placeholder={t("authDialog.passwordPlaceholder")}
                        disabled={isSubmitting}
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowRegisterPassword((current) => !current);
                        }}
                        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                        disabled={isSubmitting}
                      >
                        {showRegisterPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label
                      htmlFor="portal-register-confirm-password"
                      className="text-[13px] font-medium"
                    >
                      {t("authLanding.confirmPasswordLabel")}
                    </Label>
                    <div className="relative">
                      <Input
                        id="portal-register-confirm-password"
                        type={showRegisterConfirmPassword ? "text" : "password"}
                        value={registerConfirmPassword}
                        onChange={(event) => {
                          setRegisterConfirmPassword(event.target.value);
                        }}
                        placeholder={t("authLanding.confirmPasswordPlaceholder")}
                        disabled={isSubmitting}
                        className="h-11 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowRegisterConfirmPassword((current) => !current);
                        }}
                        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                        disabled={isSubmitting}
                      >
                        {showRegisterConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <LoadingButton
                    type="button"
                    className="h-11 w-full rounded-xl font-medium"
                    onClick={() => {
                      void handleRegister();
                    }}
                    isLoading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    {t("authLanding.registerAction")}
                  </LoadingButton>
                </div>
              ) : null}

              {authView === "forgot" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="portal-forgot-email" className="text-[13px] font-medium">
                      {t("authDialog.emailLabel")}
                    </Label>
                    <Input
                      id="portal-forgot-email"
                      type="email"
                      value={forgotEmail}
                      onChange={(event) => {
                        setForgotEmail(event.target.value);
                      }}
                      placeholder={t("authDialog.emailPlaceholder")}
                      disabled={isSubmitting}
                      className="h-11"
                    />
                  </div>

                  <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
                    {t("authLanding.forgotHint")}
                  </p>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <LoadingButton
                      type="button"
                      className="h-11 w-full rounded-xl font-medium"
                      onClick={() => {
                        void handleForgotPassword();
                      }}
                      isLoading={isSubmitting}
                      disabled={isSubmitting}
                    >
                      {t("authLanding.forgotAction")}
                    </LoadingButton>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full rounded-xl font-medium"
                      onClick={() => {
                        setAuthView("login");
                      }}
                      disabled={isSubmitting}
                    >
                      {t("authDialog.back")}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <p className="mt-5 text-sm leading-6 text-muted-foreground">
              {t("portalSite.auth.legalHint")}{" "}
              <Link
                href="/legal/terms"
                className="text-foreground underline underline-offset-4"
              >
                {t("portalSite.footer.terms")}
              </Link>{" "}
              {t("portalSite.auth.and")}{" "}
              <Link
                href="/legal/privacy"
                className="text-foreground underline underline-offset-4"
              >
                {t("portalSite.footer.privacy")}
              </Link>
              .
            </p>
          </section>

          <aside className="space-y-4 md:max-w-[360px] md:justify-self-end">
            <section className="rounded-[24px] border border-border/70 bg-card/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Web access
              </p>
              <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
                Đăng nhập để vào đúng bề mặt web.
              </h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-border/70 bg-background/85 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                      <CreditCard className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Billing workspace
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        Xem subscription, invoice, usage và mở lại checkout cho
                        workspace đã gắn vào account.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/85 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                      <ShieldCheck className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Admin command center
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        Nếu account có quyền `platform_admin`, sau đăng nhập sẽ
                        dùng cùng authority để vào các route admin trên web.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/85 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                      <Mail className="h-4 w-4 text-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Google OAuth portal flow
                      </p>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">
                        Google sign-in trả về qua `/oauth-callback` rồi ghi
                        session portal để mở đúng route web tiếp theo.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-border/70 bg-background/90 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Quick links
              </p>
              <div className="mt-4 grid gap-3">
                <Link
                  href="/pricing"
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
                >
                  <span>Xem pricing và quota</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="/signin?next=%2Faccount%2Fbilling"
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
                >
                  <span>Mở account billing</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                <Link
                  href="/help"
                  className="flex items-center justify-between rounded-xl border border-border/70 bg-card/70 px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-card"
                >
                  <span>Hỗ trợ và tài liệu</span>
                  <LifeBuoy className="h-4 w-4 text-muted-foreground" />
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </section>
  );
}
