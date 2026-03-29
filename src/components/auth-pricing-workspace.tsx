"use client";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Mail,
  MonitorCog,
  Moon,
  Palette,
  Sun,
  UserPlus,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaGoogle } from "react-icons/fa";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import { useLanguage } from "@/hooks/use-language";
import type { SupportedLanguage } from "@/i18n";
import {
  APP_SETTINGS_CACHE_UPDATED_EVENT,
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import { extractRootError } from "@/lib/error-utils";
import {
  applyThemeColors,
  clearThemeColors,
  getThemeAppearance,
} from "@/lib/themes";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { RuntimeConfigStatus } from "@/types";
import { Logo } from "./icons/logo";
import { LoadingButton } from "./loading-button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { cn } from "@/lib/utils";

type AuthView = "login" | "register" | "forgot";
type GoogleAuthUiState = "idle" | "browser_opened";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface AuthPricingWorkspaceProps {
  runtimeConfig?: RuntimeConfigStatus | null;
  prefilledInviteToken?: string | null;
  onConsumeInviteToken?: () => void;
  onOpenSyncConfig?: () => void;
}

interface AppSettings {
  theme?: string;
  custom_theme?: Record<string, string>;
  [key: string]: unknown;
}

const REMEMBER_EMAIL_STORAGE_KEY = "buglogin.auth.remember-email.v1";
const LANGUAGE_FLAG_CLASS: Record<string, string> = {
  vi: "fi fi-vn",
  en: "fi fi-us",
};

function resolveAuthErrorMessage(
  message: string,
  t: (key: string) => string,
): {
  title: string;
  description?: string;
} {
  if (message.includes("invalid_credentials")) {
    return {
      title: t("authLanding.invalidCredentialsTitle"),
      description: t("authLanding.invalidCredentialsDescription"),
    };
  }
  if (message.includes("email_already_registered")) {
    return {
      title: t("authLanding.emailAlreadyRegisteredTitle"),
      description: t("authLanding.emailAlreadyRegisteredDescription"),
    };
  }
  return {
    title: t("authDialog.loginFailed"),
    description: message,
  };
}

export function AuthPricingWorkspace({
  runtimeConfig,
}: AuthPricingWorkspaceProps = {}) {
  const { t } = useTranslation();
  const { loginWithEmail, refreshProfile, requestOtp, registerWithEmail } =
    useCloudAuth();
  const { theme, setTheme } = useTheme();
  const {
    currentLanguage,
    changeLanguage,
    supportedLanguages,
    isLoading: isLanguageLoading,
  } = useLanguage();

  const [authView, setAuthView] = useState<AuthView>("login");
  const [themeMode, setThemeMode] = useState<
    "light" | "dark" | "system" | "custom"
  >("system");

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleAuthState, setGoogleAuthState] =
    useState<GoogleAuthUiState>("idle");

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showErrorToast(t("authLanding.googleSoon"));
      return;
    }
    try {
      setIsSubmitting(true);
      setGoogleAuthState("idle");
      const redirectUri =
        (process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || "").trim() ||
        `${window.location.origin}/oauth-callback`;
      const nonce = Math.random().toString(36).substring(2);
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=${encodeURIComponent("openid email profile")}&nonce=${encodeURIComponent(nonce)}&prompt=select_account`;
      await openUrl(authUrl);
      setGoogleAuthState("browser_opened");
      showSuccessToast(t("authLanding.googleOpenBrowserTitle"), {
        description: t("authLanding.googleOpenBrowserDescription"),
      });
    } catch (error) {
      setGoogleAuthState("idle");
      showErrorToast(t("authLanding.googleOpenBrowserFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        setRememberMe(true);
      }
    } catch {
      // Ignore storage failures to keep auth flow stable.
    }
  }, []);

  useEffect(() => {
    let active = true;
    const syncThemeMode = async () => {
      try {
        const cachedTheme = readAppSettingsCache()?.theme;
        if (cachedTheme === "custom") {
          if (active) {
            setThemeMode("custom");
          }
          return;
        }
        if (
          cachedTheme === "light" ||
          cachedTheme === "dark" ||
          cachedTheme === "system"
        ) {
          if (active) {
            setThemeMode(cachedTheme);
          }
          return;
        }

        const settings = await invoke<AppSettings>("get_app_settings");
        mergeAppSettingsCache(settings);
        if (!active) {
          return;
        }
        const rawTheme = settings.theme;
        if (rawTheme === "custom") {
          setThemeMode("custom");
          return;
        }
        const fallbackTheme =
          theme === "light" || theme === "dark" || theme === "system"
            ? theme
            : "system";
        const resolvedTheme =
          rawTheme === "light" || rawTheme === "dark" || rawTheme === "system"
            ? rawTheme
            : fallbackTheme;
        setThemeMode(resolvedTheme);
      } catch {
        if (!active) {
          return;
        }
        const fallbackTheme =
          theme === "light" || theme === "dark" || theme === "system"
            ? theme
            : "system";
        setThemeMode(fallbackTheme);
      }
    };
    void syncThemeMode();
    const handleSettingsCacheUpdated = () => {
      void syncThemeMode();
    };
    window.addEventListener(
      APP_SETTINGS_CACHE_UPDATED_EVENT,
      handleSettingsCacheUpdated,
    );
    return () => {
      active = false;
      window.removeEventListener(
        APP_SETTINGS_CACHE_UPDATED_EVENT,
        handleSettingsCacheUpdated,
      );
    };
  }, [theme]);

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
      await loginWithEmail(normalizedEmail, {
        password: loginPassword,
      });
      await refreshProfile().catch(() => null);
      if (typeof window !== "undefined") {
        try {
          if (rememberMe) {
            window.localStorage.setItem(
              REMEMBER_EMAIL_STORAGE_KEY,
              normalizedEmail,
            );
          } else {
            window.localStorage.removeItem(REMEMBER_EMAIL_STORAGE_KEY);
          }
        } catch {
          // Ignore storage failures to keep auth flow stable.
        }
      }
      showSuccessToast(t("authDialog.loginSuccess"));
    } catch (error) {
      const message = extractRootError(error);
      if (
        message.includes("control_auth_unreachable") ||
        message.includes("control_auth_not_configured")
      ) {
        showErrorToast(t("authLanding.controlAuthUnavailableTitle"), {
          description: t("authLanding.controlAuthUnavailableDescription"),
        });
        return;
      }
      const friendlyError = resolveAuthErrorMessage(message, t);
      showErrorToast(friendlyError.title, {
        description: friendlyError.description,
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
      if (typeof window !== "undefined" && rememberMe) {
        try {
          window.localStorage.setItem(
            REMEMBER_EMAIL_STORAGE_KEY,
            normalizedEmail,
          );
        } catch {
          // Ignore storage failures to keep auth flow stable.
        }
      }
      showSuccessToast(t("authLanding.registerQueued"), {
        description: t("authLanding.registerQueuedDescription"),
      });
    } catch (error) {
      const message = extractRootError(error);
      if (
        message.includes("control_auth_unreachable") ||
        message.includes("control_auth_not_configured")
      ) {
        showErrorToast(t("authLanding.controlAuthUnavailableTitle"), {
          description: t("authLanding.controlAuthUnavailableDescription"),
        });
        return;
      }
      if (message.includes("email_already_registered")) {
        showErrorToast(t("authLanding.emailAlreadyRegisteredTitle"), {
          description: t("authLanding.emailAlreadyRegisteredDescription"),
        });
        return;
      }
      showErrorToast(t("authLanding.registerFailed"), {
        description: message,
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

  const handleThemeModeChange = async (
    nextTheme: "light" | "dark" | "system" | "custom",
  ) => {
    try {
      const currentSettings = await invoke<AppSettings>("get_app_settings");
      if (nextTheme === "custom") {
        const customThemeColors =
          currentSettings.custom_theme &&
          Object.keys(currentSettings.custom_theme).length > 0
            ? currentSettings.custom_theme
            : readAppSettingsCache()?.custom_theme;
        if (!customThemeColors || Object.keys(customThemeColors).length === 0) {
          throw new Error("custom_theme_missing");
        }
        applyThemeColors(customThemeColors);
        setTheme(getThemeAppearance(customThemeColors));
        setThemeMode("custom");
        const nextSettings = {
          ...currentSettings,
          theme: "custom",
          custom_theme: customThemeColors,
        };
        await invoke("save_app_settings", {
          settings: nextSettings,
        });
        mergeAppSettingsCache(nextSettings);
        return;
      }
      clearThemeColors();
      setThemeMode(nextTheme);
      setTheme(nextTheme);
      const nextSettings = {
        ...currentSettings,
        theme: nextTheme,
      };
      await invoke("save_app_settings", {
        settings: nextSettings,
      });
      mergeAppSettingsCache(nextSettings);
    } catch (error) {
      showErrorToast(t("authLanding.preferenceSaveFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleLanguageChange = async (nextLanguage: string) => {
    try {
      await changeLanguage(nextLanguage as SupportedLanguage);
    } catch (error) {
      showErrorToast(t("authLanding.preferenceSaveFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const activeViewDescription =
    authView === "forgot" ? t("authLanding.forgotHint") : "";

  return (
    <div className="absolute inset-0 flex h-full w-full min-h-0 overflow-hidden bg-background text-foreground antialiased">
      <div className="flex h-full w-full min-h-0 bg-background">
        <ScrollArea className="h-full w-full">
          <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col px-4 pb-5 pt-[calc(var(--window-titlebar-height)+0.45rem)] sm:max-w-[500px] sm:justify-center sm:px-6 sm:pb-6 xl:max-w-[500px] xl:px-8 xl:pb-8">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <Logo
                alt={t("authLanding.title")}
                className="h-7 w-auto object-contain sm:h-8"
              />
              <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-background p-1.5 shadow-sm">
                <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-1 py-0.5">
                  {supportedLanguages.map((language) => {
                    const isSelected = currentLanguage === language.code;
                    const compactLabel = language.code.toUpperCase();
                    const flagClass = LANGUAGE_FLAG_CLASS[language.code] ?? "fi";
                    return (
                      <button
                        key={language.code}
                        type="button"
                        aria-label={language.nativeName}
                        title={language.nativeName}
                        disabled={isSubmitting || isLanguageLoading}
                        onClick={() => {
                          if (currentLanguage === language.code) {
                            return;
                          }
                          void handleLanguageChange(language.code);
                        }}
                        className={cn(
                          "inline-flex h-7 min-w-[52px] items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold transition-colors",
                          isSelected
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <span
                          className={`${flagClass} rounded-[2px] text-[11px]`}
                          aria-hidden="true"
                        />
                        <span>{compactLabel}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="h-5 w-px bg-border" />
                <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
                  {[
                    {
                      value: "light" as const,
                      label: t("settings.appearance.light"),
                      icon: Sun,
                    },
                    {
                      value: "dark" as const,
                      label: t("settings.appearance.dark"),
                      icon: Moon,
                    },
                    {
                      value: "system" as const,
                      label: t("settings.appearance.system"),
                      icon: MonitorCog,
                    },
                    {
                      value: "custom" as const,
                      label: t("settings.appearance.customColors"),
                      icon: Palette,
                    },
                  ].map((option) => {
                    const isSelected = themeMode === option.value;
                    const Icon = option.icon;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-label={option.label}
                        title={option.label}
                        disabled={isSubmitting}
                        onClick={() => {
                          if (themeMode === option.value) {
                            return;
                          }
                          void handleThemeModeChange(option.value);
                        }}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
                          isSelected
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mb-4 space-y-1.5">
              <div className="space-y-1">
                <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.03em]">
                  {t("authLanding.signInTitle")}
                </h1>
                {activeViewDescription ? (
                  <p className="max-w-[48ch] text-sm leading-6 text-muted-foreground">
                    {activeViewDescription}
                  </p>
                ) : null}
              </div>
            </div>

            <Card className="gap-0 overflow-hidden border-border/70 shadow-lg">
              <CardHeader className="space-y-3 border-b border-border/70 pb-4">
                {authView !== "forgot" && (
                  <Tabs
                    value={authView}
                    onValueChange={(value) => setAuthView(value as AuthView)}
                    className="w-full"
                  >
                    <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/45 p-1">
                      <TabsTrigger
                        value="login"
                        className="rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                      >
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        {t("authLanding.tabs.login")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="register"
                        className="rounded-lg text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        {t("authLanding.tabs.register")}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </CardHeader>
              <CardContent className="space-y-4 pt-5">

          {authView === "login" && (
            <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-300 fill-mode-both">
              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-login-email"
                  className="text-[13px] font-medium"
                >
                  {t("authDialog.emailLabel")}
                </Label>
                <Input
                  id="auth-pricing-login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder={t("authDialog.emailPlaceholder")}
                  disabled={isSubmitting}
                  className="h-10 bg-background/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-login-password"
                  className="text-[13px] font-medium"
                >
                  {t("proxies.form.password")}
                </Label>
                <div className="relative">
                  <Input
                    id="auth-pricing-login-password"
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    placeholder={t("authDialog.passwordPlaceholder")}
                    disabled={isSubmitting}
                    className="h-10 bg-background/50 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((current) => !current)}
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showLoginPassword
                        ? t("authDialog.hidePassword")
                        : t("authDialog.showPassword")
                    }
                    title={
                      showLoginPassword
                        ? t("authDialog.hidePassword")
                        : t("authDialog.showPassword")
                    }
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

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <label
                  htmlFor="auth-pricing-remember-me"
                  className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"
                >
                  <Checkbox
                    id="auth-pricing-remember-me"
                    checked={rememberMe}
                    onCheckedChange={(checked) =>
                      setRememberMe(checked === true)
                    }
                    disabled={isSubmitting}
                  />
                  <span>{t("authDialog.rememberMe")}</span>
                </label>

                <button
                  type="button"
                  onClick={() => setAuthView("forgot")}
                  className="ml-auto rounded-sm text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                  disabled={isSubmitting}
                >
                  {t("authLanding.tabs.forgot")}
                </button>
              </div>

	              <div className="grid grid-cols-1 gap-2 pt-1">
	                <LoadingButton
	                  type="button"
	                  className="h-10 w-full shadow-sm font-medium"
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
                  <span className="relative mx-auto block w-fit bg-background px-2 text-[11px] text-muted-foreground xl:bg-card">
                    {t("authLanding.orContinueWith")}
                  </span>
                </div>

	                <Button
	                  type="button"
	                  variant="outline"
	                  className="h-10 w-full shadow-sm font-medium"
	                  disabled={isSubmitting}
	                  onClick={() => handleGoogleLogin()}
	                >
	                  <FaGoogle
                    className="mr-2.5 h-3.5 w-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
	                  {t("authLanding.googleButton")}
	                </Button>
	              </div>

	              {googleAuthState === "browser_opened" && (
	                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm">
	                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
	                  <div className="space-y-1">
	                    <p className="font-medium text-foreground">
	                      {t("authLanding.googleOpenBrowserTitle")}
	                    </p>
	                    <p className="text-muted-foreground">
	                      {t("authLanding.googleInlineHint")}
	                    </p>
	                  </div>
	                </div>
	              )}

	              <p className="pt-1.5 text-center text-xs text-muted-foreground">
	                {t("authLanding.noAccountPrompt")}{" "}
	                <button
                  type="button"
                  onClick={() => setAuthView("register")}
                  className="font-medium text-foreground underline-offset-4 transition-colors hover:underline"
                  disabled={isSubmitting}
                >
                  {t("authLanding.signUpCta")}
                </button>
              </p>

            </div>
          )}

          {authView === "register" && (
	            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300 fill-mode-both">
              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-register-name"
                  className="text-[13px] font-medium"
                >
                  {t("authDialog.nameLabel")} ({t("authLanding.optionalLabel")})
                </Label>
                <Input
                  id="auth-pricing-register-name"
                  type="text"
                  value={registerName}
                  onChange={(event) => setRegisterName(event.target.value)}
                  placeholder={t("authLanding.registerNamePlaceholder")}
                  disabled={isSubmitting}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-register-email"
                  className="text-[13px] font-medium"
                >
                  {t("authDialog.emailLabel")}
                </Label>
                <Input
                  id="auth-pricing-register-email"
                  type="email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder={t("authDialog.emailPlaceholder")}
                  disabled={isSubmitting}
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-register-password"
                  className="text-[13px] font-medium"
                >
                  {t("proxies.form.password")}
                </Label>
                <div className="relative">
                  <Input
                    id="auth-pricing-register-password"
                    type={showRegisterPassword ? "text" : "password"}
                    value={registerPassword}
                    onChange={(event) =>
                      setRegisterPassword(event.target.value)
                    }
                    placeholder={t("authDialog.passwordPlaceholder")}
                    disabled={isSubmitting}
                    className="h-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowRegisterPassword((current) => !current)
                    }
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showRegisterPassword
                        ? t("authDialog.hidePassword")
                        : t("authDialog.showPassword")
                    }
                    title={
                      showRegisterPassword
                        ? t("authDialog.hidePassword")
                        : t("authDialog.showPassword")
                    }
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

              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-register-password-confirm"
                  className="text-[13px] font-medium"
                >
                  {t("authLanding.confirmPasswordLabel")}
                </Label>
                <div className="relative">
                  <Input
                    id="auth-pricing-register-password-confirm"
                    type={showRegisterConfirmPassword ? "text" : "password"}
                    value={registerConfirmPassword}
                    onChange={(event) =>
                      setRegisterConfirmPassword(event.target.value)
                    }
                    placeholder={t("authLanding.confirmPasswordPlaceholder")}
                    disabled={isSubmitting}
                    className="h-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowRegisterConfirmPassword((current) => !current)
                    }
                    className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={
                      showRegisterConfirmPassword
                        ? t("authDialog.hidePassword")
                        : t("authDialog.showPassword")
                    }
                    title={
                      showRegisterConfirmPassword
                        ? t("authDialog.hidePassword")
                        : t("authDialog.showPassword")
                    }
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
                className="h-10 w-full shadow-sm font-medium"
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
	            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300 fill-mode-both">
              <div className="space-y-1.5">
                <Label
                  htmlFor="auth-pricing-forgot-email"
                  className="text-[13px] font-medium"
                >
                  {t("authDialog.emailLabel")}
                </Label>
                <Input
                  id="auth-pricing-forgot-email"
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder={t("authDialog.emailPlaceholder")}
                  disabled={isSubmitting}
                  className="h-10"
                />
              </div>

	              <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
	                {t("authLanding.forgotHint")}
	              </p>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <LoadingButton
                  type="button"
                  className="h-10 w-full shadow-sm font-medium"
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
                  variant="ghost"
                  className="h-10 w-full font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setAuthView("login")}
                  disabled={isSubmitting}
                >
                  {t("authDialog.back")}
	                </Button>
	              </div>
	            </div>
	          )}
	              </CardContent>
	            </Card>
	          </div>
	        </ScrollArea>
	      </div>
	    </div>
  );
}
