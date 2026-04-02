"use client";

import {
  Eye,
  EyeOff,
  Mail,
  MonitorCog,
  Moon,
  Sun,
  UserPlus,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaGoogle } from "react-icons/fa";
import { Logo } from "@/components/icons/logo";
import { TopNavHead } from "@/components/portal/top-nav-head";
import { Button } from "@/frontend-shadcn/ui/button";
import { Card, CardContent, CardHeader } from "@/frontend-shadcn/ui/card";
import { Checkbox } from "@/frontend-shadcn/ui/checkbox";
import { Input } from "@/frontend-shadcn/ui/input";
import { Label } from "@/frontend-shadcn/ui/label";
import { Separator } from "@/frontend-shadcn/ui/separator";
import { Spinner } from "@/frontend-shadcn/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/frontend-shadcn/ui/tabs";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import {
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import { extractRootError } from "@/lib/error-utils";
import { writeLanguageCookie } from "@/lib/language-cookie";
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
import type { CloudUser } from "@/types";

const REMEMBER_EMAIL_STORAGE_KEY = "buglogin.auth.remember-email.v1";
const AUTH_INPUT_CLASS = "h-10 text-sm";
const AUTH_PASSWORD_INPUT_CLASS = `${AUTH_INPUT_CLASS} pr-11`;
const AUTH_ACTION_BUTTON_CLASS = "h-10 w-full text-sm font-medium";

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

export type PortalAuthView = "login" | "register" | "forgot";

export function PortalAuthPage({
  forcedView,
  surface = "web",
}: {
  forcedView?: PortalAuthView;
  surface?: "web" | "desktop";
}) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme, setTheme } = useTheme();
  const {
    user,
    isLoggedIn,
    isLoading,
    loginWithEmail,
    refreshProfile,
    registerWithEmail,
    requestOtp,
  } = useCloudAuth();

  const [authView, setAuthView] = useState<PortalAuthView>("login");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPostAuthTransition, setIsPostAuthTransition] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<SupportedLanguage>(
    () => {
      const cached = readAppSettingsCache()?.language;
      return cached === "en" ? "en" : "vi";
    },
  );
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">(
    "system",
  );

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
  const isOAuthReturn = searchParams.get("oauth")?.trim() === "google";
  const requestedView = forcedView ?? searchParams.get("view")?.trim() ?? "";
  const [oauthBootstrapComplete, setOAuthBootstrapComplete] = useState(
    !isOAuthReturn,
  );

  useEffect(() => {
    setMounted(true);
    const nextLanguage = i18n.resolvedLanguage || i18n.language || "vi";
    setActiveLanguage(nextLanguage === "en" ? "en" : "vi");

    const handleChanged = (language: string) => {
      setActiveLanguage(language === "en" ? "en" : "vi");
    };
    i18n.on("languageChanged", handleChanged);
    return () => {
      i18n.off("languageChanged", handleChanged);
    };
  }, [i18n]);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    const next =
      resolvedTheme === "dark"
        ? "dark"
        : resolvedTheme === "light"
          ? "light"
          : "system";
    setThemeMode(next);
  }, [mounted, resolvedTheme]);

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

  const persistRememberedEmail = useCallback(
    (email: string) => {
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
    },
    [rememberMe],
  );

  const handleLanguageChange = useCallback(
    async (language: SupportedLanguage) => {
      if (activeLanguage === language) {
        return;
      }
      await i18n.changeLanguage(language);
      writeLanguageCookie(language);
      mergeAppSettingsCache({ language });
    },
    [activeLanguage, i18n],
  );

  const completePortalAuth = useCallback(
    (nextUser: CloudUser) => {
      if (surface === "desktop") {
        return;
      }
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
        nextPath ||
        resolvePortalPostAuthPath({
          platformRole: nextUser.platformRole ?? null,
        });
      setIsPostAuthTransition(true);
      router.replace(destination);
    },
    [nextPath, router, surface],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!isOAuthReturn) {
      setOAuthBootstrapComplete(true);
      return;
    }
    if (consumedGoogleProfileRef.current) {
      setOAuthBootstrapComplete(true);
      return;
    }

    const rawProfile = window.sessionStorage.getItem(PORTAL_GOOGLE_STORAGE_KEY);
    if (!rawProfile) {
      setOAuthBootstrapComplete(true);
      return;
    }

    consumedGoogleProfileRef.current = true;
    window.sessionStorage.removeItem(PORTAL_GOOGLE_STORAGE_KEY);

    let profile: {
      email?: string;
      name?: string;
      avatar?: string;
      idToken?: string;
    } | null = null;
    try {
      profile = JSON.parse(rawProfile) as {
        email?: string;
        name?: string;
        avatar?: string;
        idToken?: string;
      };
    } catch {
      profile = null;
    }

    const normalizedEmail = normalizeEmail(profile?.email ?? "");
    if (!isValidEmail(normalizedEmail)) {
      setOAuthBootstrapComplete(true);
      return;
    }

    void (async () => {
      try {
        setIsSubmitting(true);
        const state = await loginWithEmail(normalizedEmail, {
          authProvider: "google_oauth",
          name: profile?.name,
          avatar: profile?.avatar,
          idToken: profile?.idToken,
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
        setOAuthBootstrapComplete(true);
        setIsSubmitting(false);
        setGoogleAuthState("idle");
      }
    })();
  }, [
    completePortalAuth,
    isOAuthReturn,
    loginWithEmail,
    refreshProfile,
    t,
    persistRememberedEmail,
  ]);

  useEffect(() => {
    if (isLoading || !isLoggedIn || !user) {
      return;
    }
    setIsPostAuthTransition(true);
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
    if (surface === "desktop") {
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

    setIsPostAuthTransition(true);
    router.replace(destination);
  }, [isLoading, isSubmitting, nextPath, router, surface]);

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

      if (surface === "desktop") {
        const { openUrl } = await import("@tauri-apps/plugin-opener");
        await openUrl(authUrl.toString());
        setGoogleAuthState("opened");
        showSuccessToast(t("authLanding.googleOpenBrowserTitle"), {
          description: t("authLanding.googleOpenBrowserDescription"),
        });
        setIsSubmitting(false);
        return;
      }

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
      setIsPostAuthTransition(false);
      showErrorToast(t("portalSite.auth.googleFailed"), {
        description: extractRootError(error),
      });
      setIsSubmitting(false);
    }
  };

  const showPostAuthLoading =
    mounted &&
    (isPostAuthTransition || (isOAuthReturn && !oauthBootstrapComplete));

  if (showPostAuthLoading) {
    return (
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] w-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-border/70 bg-card/70 p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">
            {t("authLanding.signInTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("portalSite.auth.oauthReturn")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-auto flex w-full items-center justify-center px-4 py-6 sm:px-6 md:py-10">
      <div className="w-full max-w-sm md:max-w-[920px]">
        <Card className="w-full overflow-hidden border-border/70 bg-card p-0 shadow-sm">
          <div className="grid md:grid-cols-[minmax(0,0.94fr)_minmax(0,1fr)]">
            <div className="flex flex-col">
              <CardHeader className="mx-auto w-full max-w-[440px] space-y-4 border-b border-border p-6 md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <Logo
                    alt="BugLogin"
                    variant="full"
                    className="h-8 w-auto max-w-[176px]"
                  />
                  <TopNavHead
                    className="shrink-0"
                    loading={isSubmitting}
                    languages={SUPPORTED_LANGUAGES.map((language) => ({
                      code: language.code,
                      label: language.nativeName,
                      active: activeLanguage === language.code,
                      onSelect: () => {
                        void handleLanguageChange(
                          language.code as SupportedLanguage,
                        );
                      },
                    }))}
                    themeOptions={[
                      {
                        id: "light",
                        label: t("settings.appearance.light"),
                        icon: Sun,
                        active: themeMode === "light",
                        onSelect: () => {
                          setThemeMode("light");
                          setTheme("light");
                        },
                      },
                      {
                        id: "dark",
                        label: t("settings.appearance.dark"),
                        icon: Moon,
                        active: themeMode === "dark",
                        onSelect: () => {
                          setThemeMode("dark");
                          setTheme("dark");
                        },
                      },
                      {
                        id: "system",
                        label: t("settings.appearance.system"),
                        icon: MonitorCog,
                        active: themeMode === "system",
                        onSelect: () => {
                          setThemeMode("system");
                          setTheme("system");
                        },
                      },
                    ]}
                  />
                </div>

                <div className="space-y-1 text-center">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {t("authLanding.signInTitle")}
                  </h1>
                </div>

                {authView !== "forgot" ? (
                  <Tabs
                    value={authView}
                    onValueChange={(value) => {
                      setAuthView(value as PortalAuthView);
                    }}
                    className="mx-auto w-full max-w-[360px]"
                  >
                    <TabsList className="grid h-10 w-full grid-cols-2 rounded-md bg-muted p-1">
                      <TabsTrigger
                        value="login"
                        className="h-8 gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                      >
                        <Mail className="h-3.5 w-3.5" />
                        {t("authLanding.tabs.login")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="register"
                        className="h-8 gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        {t("authLanding.tabs.register")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                ) : null}
              </CardHeader>

              <CardContent className="mx-auto w-full max-w-[440px] space-y-4 p-6 md:p-8">
                {authView === "login" ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <Label
                        htmlFor="portal-login-email"
                        className="text-sm font-medium leading-none"
                      >
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
                        autoComplete="email"
                        className={AUTH_INPUT_CLASS}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <Label
                          htmlFor="portal-login-password"
                          className="text-sm font-medium leading-none"
                        >
                          {t("proxies.form.password")}
                        </Label>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto px-0 text-xs"
                          onClick={() => {
                            setAuthView("forgot");
                          }}
                          disabled={isSubmitting}
                        >
                          {t("authLanding.tabs.forgot")}
                        </Button>
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
                          className={AUTH_PASSWORD_INPUT_CLASS}
                          autoComplete="current-password"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute top-1/2 right-1.5 h-8 w-8 -translate-y-1/2 rounded-md"
                          onClick={() => {
                            setShowLoginPassword((current) => !current);
                          }}
                          disabled={isSubmitting}
                        >
                          {showLoginPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <label
                      htmlFor="portal-remember-me"
                      className="flex items-center gap-2.5 text-sm text-muted-foreground"
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

                    <Button
                      type="button"
                      className={AUTH_ACTION_BUTTON_CLASS}
                      onClick={handleSignIn}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
                      {t("authDialog.signInWithEmail")}
                    </Button>

                    <div className="relative py-1">
                      <Separator />
                      <span className="absolute inset-0 m-auto flex w-fit items-center bg-background px-2 text-[11px] text-muted-foreground">
                        {t("authLanding.orContinueWith")}
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className={AUTH_ACTION_BUTTON_CLASS}
                      disabled={isSubmitting}
                      onClick={() => {
                        void handleGoogleLogin();
                      }}
                    >
                      {isSubmitting ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <FaGoogle className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t("authLanding.googleButton")}
                    </Button>

                    {googleAuthState === "opened" ? (
                      <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
                        {t("authLanding.googleOpenBrowserDescription")}
                      </div>
                    ) : null}

                    <p className="text-center text-xs text-muted-foreground">
                      {t("authLanding.noAccountPrompt")}{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto px-0 text-xs"
                        onClick={() => {
                          setAuthView("register");
                        }}
                        disabled={isSubmitting}
                      >
                        {t("authLanding.signUpCta")}
                      </Button>
                    </p>
                  </div>
                ) : null}

                {authView === "register" ? (
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      <Label
                        htmlFor="portal-register-name"
                        className="text-sm font-medium leading-none"
                      >
                        {t("authDialog.nameLabel")} (
                        {t("authLanding.optionalLabel")})
                      </Label>
                      <Input
                        id="portal-register-name"
                        value={registerName}
                        onChange={(event) => {
                          setRegisterName(event.target.value);
                        }}
                        placeholder={t("authLanding.registerNamePlaceholder")}
                        disabled={isSubmitting}
                        className={AUTH_INPUT_CLASS}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label
                        htmlFor="portal-register-email"
                        className="text-sm font-medium leading-none"
                      >
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
                        className={AUTH_INPUT_CLASS}
                      />
                    </div>

                    <div className="space-y-3">
                      <Label
                        htmlFor="portal-register-password"
                        className="text-sm font-medium leading-none"
                      >
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
                          className={AUTH_PASSWORD_INPUT_CLASS}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute top-1/2 right-1.5 h-8 w-8 -translate-y-1/2 rounded-md"
                          onClick={() => {
                            setShowRegisterPassword((current) => !current);
                          }}
                          disabled={isSubmitting}
                        >
                          {showRegisterPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label
                        htmlFor="portal-register-confirm-password"
                        className="text-sm font-medium leading-none"
                      >
                        {t("authLanding.confirmPasswordLabel")}
                      </Label>
                      <div className="relative">
                        <Input
                          id="portal-register-confirm-password"
                          type={
                            showRegisterConfirmPassword ? "text" : "password"
                          }
                          value={registerConfirmPassword}
                          onChange={(event) => {
                            setRegisterConfirmPassword(event.target.value);
                          }}
                          placeholder={t(
                            "authLanding.confirmPasswordPlaceholder",
                          )}
                          disabled={isSubmitting}
                          className={AUTH_PASSWORD_INPUT_CLASS}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute top-1/2 right-1.5 h-8 w-8 -translate-y-1/2 rounded-md"
                          onClick={() => {
                            setShowRegisterConfirmPassword(
                              (current) => !current,
                            );
                          }}
                          disabled={isSubmitting}
                        >
                          {showRegisterConfirmPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="button"
                      className={AUTH_ACTION_BUTTON_CLASS}
                      onClick={() => {
                        void handleRegister();
                      }}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
                      {t("authLanding.registerAction")}
                    </Button>
                  </div>
                ) : null}

                {authView === "forgot" ? (
                  <div className="space-y-4">
                    <div className="space-y-2.5">
                      <Label
                        htmlFor="portal-forgot-email"
                        className="text-sm font-medium leading-none"
                      >
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
                        className={AUTH_INPUT_CLASS}
                      />
                    </div>

                    <p className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                      {t("authLanding.forgotHint")}
                    </p>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        className="h-10 text-sm font-medium"
                        onClick={() => {
                          void handleForgotPassword();
                        }}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? <Spinner className="h-4 w-4" /> : null}
                        {t("authLanding.forgotAction")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 text-sm font-medium"
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
              </CardContent>

              <div className="mt-auto border-t border-border px-6 py-4 text-center text-xs text-muted-foreground md:px-8">
                <p>
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
              </div>
            </div>

            <div className="relative hidden overflow-hidden border-l border-border md:block">
              <Image
                src="/auth/buglogin-auth-security.jpg"
                alt="BugLogin — Antidetect Browser"
                fill
                className="object-cover"
                priority
                sizes="(min-width: 768px) 50vw, 0vw"
              />
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
