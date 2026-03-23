"use client";

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Eye,
  EyeOff,
  KeyRound,
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
import { LoadingButton } from "./loading-button";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

type AuthView = "login" | "register" | "forgot";

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
const LOCAL_DEV_DEFAULT_PASSWORD = "buglogin123";
const LOCAL_DEV_QUICK_CREDENTIALS = [
  {
    id: "platform_admin",
    labelKey: "authDialog.quickPresetPlatformAdmin",
    email: "platform.admin@buglogin.local",
  },
  {
    id: "owner",
    labelKey: "authDialog.quickPresetOwner",
    email: "owner.preview@buglogin.local",
  },
  {
    id: "admin",
    labelKey: "authDialog.quickPresetAdmin",
    email: "admin.preview@buglogin.local",
  },
] as const;

export function AuthPricingWorkspace(_props: AuthPricingWorkspaceProps = {}) {
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

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showErrorToast(t("authLanding.googleSoon"));
      return;
    }
    try {
      setIsSubmitting(true);
      const redirectUri = "http://localhost:12341/oauth-callback";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token%20id_token&scope=openid%20email%20profile&nonce=${Math.random().toString(36).substring(2)}`;
      await openUrl(authUrl);
      showSuccessToast(t("authLanding.googleOpenBrowserTitle"), {
        description: t("authLanding.googleOpenBrowserDescription"),
      });
    } catch (e) {
      showErrorToast(t("authLanding.googleOpenBrowserFailed"), {
        description: extractRootError(e),
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
      if (message.includes("control_auth_unreachable")) {
        showErrorToast(t("authLanding.controlAuthUnavailableTitle"), {
          description: t("authLanding.controlAuthUnavailableDescription"),
        });
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
      if (message.includes("control_auth_unreachable")) {
        showErrorToast(t("authLanding.controlAuthUnavailableTitle"), {
          description: t("authLanding.controlAuthUnavailableDescription"),
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

  const handleApplyQuickCredential = (email: string) => {
    setAuthView("login");
    setLoginEmail(email);
    setLoginPassword(LOCAL_DEV_DEFAULT_PASSWORD);
    setRememberMe(true);
  };

  const handleApplyRegisterPreset = (email: string) => {
    setRegisterEmail(email);
    setRegisterPassword(LOCAL_DEV_DEFAULT_PASSWORD);
    setRegisterConfirmPassword(LOCAL_DEV_DEFAULT_PASSWORD);
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

  return (
    <div className="absolute inset-0 flex h-full w-full overflow-hidden bg-background text-foreground antialiased">
      <div className="relative hidden overflow-hidden border-r border-border bg-muted/20 lg:flex lg:w-[47%] xl:w-[50%]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-background via-muted/35 to-card" />
        <div className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative z-10 flex h-full w-full flex-col p-8 xl:p-10">
          <div className="flex items-center justify-between gap-3">
            <img
              src="/buglogin-logo.webp"
              alt={t("authLanding.title")}
              className="h-9 w-auto object-contain"
            />
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-[0.08em]"
            >
              {t("proxyExportDialog.labels.preview")}
            </Badge>
          </div>

          <div className="mt-6 grid min-h-0 flex-1 grid-cols-12 gap-3">
            <div className="col-span-8 overflow-hidden rounded-[24px] border border-border/80 bg-card shadow-2xl">
              <img
                src="/tauri-nextjs-template-2_screenshot.png"
                alt={t("authLanding.title")}
                className="h-full w-full object-cover object-top"
              />
            </div>
            <div className="col-span-4 grid grid-rows-2 gap-3">
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl">
                <img
                  src="/tauri-nextjs-template-2_screenshot.png"
                  alt={t("authLanding.title")}
                  className="h-full w-full object-cover object-left-top"
                />
              </div>
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xl">
                <img
                  src="/tauri-nextjs-template-2_screenshot.png"
                  alt={t("authLanding.title")}
                  className="h-full w-full object-cover object-right-bottom"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((index) => (
              <div
                key={`auth-gallery-${index}`}
                className="overflow-hidden rounded-xl border border-border/80 bg-card"
              >
                <img
                  src="/tauri-nextjs-template-2_screenshot.png"
                  alt={t("authLanding.title")}
                  className={`h-20 w-full object-cover ${
                    index === 0
                      ? "object-left-bottom"
                      : index === 1
                        ? "object-center"
                        : "object-right-top"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex h-full w-full items-center bg-background lg:w-[53%] xl:w-[50%]">
        <div className="mx-auto w-full max-w-[430px] px-6 py-5 sm:px-8 lg:px-10">
          <div className="mb-3 flex items-center justify-between gap-3">
            <img
              src="/buglogin-logo.webp"
              alt={t("authLanding.title")}
              className="h-8 w-auto object-contain lg:hidden"
            />
            <div className="ml-auto inline-flex items-center gap-2 rounded-xl border border-border bg-card/80 p-1.5 shadow-sm">
              <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-1 py-0.5">
                {supportedLanguages.map((language) => {
                  const isSelected = currentLanguage === language.code;
                  const compactLabel = language.code.toUpperCase();
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
                      className={`h-7 min-w-8 rounded-md px-2 text-[11px] font-semibold transition-colors ${
                        isSelected
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {compactLabel}
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
                      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
                        isSelected
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mb-3 space-y-1">
            <h1 className="text-[25px] font-semibold leading-tight tracking-tight">
              {t("authLanding.signInTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("authLanding.signInDescription")}
            </p>
          </div>

          {authView !== "forgot" && (
            <Tabs
              value={authView}
              onValueChange={(value) => setAuthView(value as AuthView)}
              className="mb-3 w-full"
            >
              <TabsList className="grid h-10 w-full grid-cols-2 rounded-lg bg-muted/40 p-1">
                <TabsTrigger
                  value="login"
                  className="rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Mail className="mr-1.5 h-3.5 w-3.5" />
                  {t("authLanding.tabs.login")}
                </TabsTrigger>
                <TabsTrigger
                  value="register"
                  className="rounded-md text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  {t("authLanding.tabs.register")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}

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

              <div className="flex items-center justify-between gap-3 pt-0.5">
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
                  className="rounded-sm text-[12px] font-medium text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
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

              <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  {t("authLanding.localDevQuickTitle")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t("authLanding.localDevQuickDescription", {
                    password: LOCAL_DEV_DEFAULT_PASSWORD,
                  })}
                </p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-3">
                  {LOCAL_DEV_QUICK_CREDENTIALS.map((credential) => (
                    <Button
                      key={credential.id}
                      type="button"
                      variant="outline"
                      className="h-auto flex-col items-start gap-0.5 px-2.5 py-2 text-left"
                      onClick={() =>
                        handleApplyQuickCredential(credential.email)
                      }
                      disabled={isSubmitting}
                    >
                      <span className="text-[11px] font-semibold leading-none">
                        {t(credential.labelKey)}
                      </span>
                      <span className="max-w-full truncate text-[10px] font-normal text-muted-foreground">
                        {credential.email}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {authView === "register" && (
            <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-300 fill-mode-both">
              <div className="rounded-lg border border-border/70 bg-muted/25 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  {t("authLanding.registerFlowTitle")}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {t("authLanding.registerHint")}
                </p>
              </div>

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

              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-start gap-2 text-[12px] text-muted-foreground"
                onClick={() =>
                  handleApplyRegisterPreset(
                    LOCAL_DEV_QUICK_CREDENTIALS[0].email,
                  )
                }
                disabled={isSubmitting}
              >
                <KeyRound className="h-4 w-4" />
                {t("authLanding.useLocalDevPreset")}
              </Button>
            </div>
          )}

          {authView === "forgot" && (
            <div className="space-y-2.5 animate-in fade-in zoom-in-95 duration-300 fill-mode-both">
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

              <p className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
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
        </div>
      </div>
    </div>
  );
}
