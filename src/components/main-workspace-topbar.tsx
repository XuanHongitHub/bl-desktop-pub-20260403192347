"use client";

import { invoke } from "@tauri-apps/api/core";
import {
  Bell,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogOut,
  MonitorCog,
  Moon,
  Palette,
  Settings2,
  Sun,
  Users,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { showErrorToast } from "@/lib/toast-utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";

type ThemeMode = "light" | "dark" | "system" | "custom";
const TOPBAR_ACCOUNT_TITLE_CLASS =
  "truncate text-[12px] leading-[1.3] font-semibold tracking-normal text-foreground";
const TOPBAR_ACCOUNT_META_CLASS =
  "truncate text-[10px] leading-[1.3] font-medium tracking-normal text-muted-foreground";
const TOPBAR_ACCOUNT_ACTION_CLASS =
  "rounded-md px-2 py-2 text-[12px] leading-[1.25] font-semibold [&_svg:not([class*='size-'])]:size-4";

interface HeaderNotificationItem {
  id: string;
  title: string;
  description: string;
  isUpdating?: boolean;
}

interface AppSettings {
  theme?: string;
  custom_theme?: Record<string, string>;
  [key: string]: unknown;
}

interface MainWorkspaceTopBarProps {
  workspaceName: string;
  workspaceRoleLabel: string;
  notifications: HeaderNotificationItem[];
  isCheckingUpdates: boolean;
  onCheckUpdates: () => void;
  onOpenSettings: () => void;
  onOpenAdminPanel: () => void;
  onOpenWorkspaceGovernancePanel: () => void;
  onOpenWorkspacePanel: () => void;
  onSignOut: () => void;
  authEmail: string;
  authAvatar?: string | null;
  inAdminPanel: boolean;
  inWorkspaceGovernancePanel: boolean;
  canAccessAdminPanel: boolean;
  canAccessWorkspaceGovernancePanel: boolean;
}

export function MainWorkspaceTopBar({
  workspaceName,
  workspaceRoleLabel,
  notifications,
  isCheckingUpdates,
  onCheckUpdates,
  onOpenSettings,
  onOpenAdminPanel,
  onOpenWorkspaceGovernancePanel,
  onOpenWorkspacePanel,
  onSignOut,
  authEmail,
  authAvatar = null,
  inAdminPanel,
  inWorkspaceGovernancePanel,
  canAccessAdminPanel,
  canAccessWorkspaceGovernancePanel,
}: MainWorkspaceTopBarProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const {
    currentLanguage,
    changeLanguage,
    supportedLanguages,
    isLoading: isLanguageLoading,
  } = useLanguage();

  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [languagePreference, setLanguagePreference] =
    useState<SupportedLanguage>("vi");

  useEffect(() => {
    const syncThemeMode = () => {
      const cachedTheme = readAppSettingsCache()?.theme;
      if (cachedTheme === "custom") {
        setThemeMode("custom");
        return;
      }
      if (
        cachedTheme === "light" ||
        cachedTheme === "dark" ||
        cachedTheme === "system"
      ) {
        setThemeMode(cachedTheme);
        return;
      }
      const nextTheme =
        theme === "light" || theme === "dark" || theme === "system"
          ? theme
          : "system";
      setThemeMode(nextTheme);
    };

    syncThemeMode();
    const handleSettingsCacheUpdated = () => {
      syncThemeMode();
    };
    window.addEventListener(
      APP_SETTINGS_CACHE_UPDATED_EVENT,
      handleSettingsCacheUpdated,
    );
    return () => {
      window.removeEventListener(
        APP_SETTINGS_CACHE_UPDATED_EVENT,
        handleSettingsCacheUpdated,
      );
    };
  }, [theme]);

  useEffect(() => {
    const cachedLanguage = readAppSettingsCache()?.language;
    if (
      typeof cachedLanguage === "string" &&
      supportedLanguages.some((language) => language.code === cachedLanguage)
    ) {
      setLanguagePreference(cachedLanguage as SupportedLanguage);
      return;
    }
    if (
      currentLanguage &&
      supportedLanguages.some((language) => language.code === currentLanguage)
    ) {
      setLanguagePreference(currentLanguage as SupportedLanguage);
      return;
    }
    setLanguagePreference("vi");
  }, [currentLanguage, supportedLanguages]);

  const handleThemeModeChange = async (nextTheme: ThemeMode) => {
    const activeThemeSetting = readAppSettingsCache()?.theme;
    if (nextTheme === themeMode && activeThemeSetting === nextTheme) {
      return;
    }
    try {
      setIsSavingTheme(true);
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
        const savedSettings = await invoke<AppSettings>("save_app_settings", {
          settings: nextSettings,
        });
        mergeAppSettingsCache(savedSettings);
        return;
      }

      clearThemeColors();
      setThemeMode(nextTheme);
      setTheme(nextTheme);
      const nextSettings = {
        ...currentSettings,
        theme: nextTheme,
      };
      const savedSettings = await invoke<AppSettings>("save_app_settings", {
        settings: nextSettings,
      });
      mergeAppSettingsCache(savedSettings);
    } catch (error) {
      showErrorToast(t("shell.topbar.preferenceSaveFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSavingTheme(false);
    }
  };

  const handleLanguageChange = async (nextLanguage: SupportedLanguage) => {
    if (nextLanguage === languagePreference) {
      return;
    }
    try {
      await changeLanguage(nextLanguage);
      mergeAppSettingsCache({ language: nextLanguage });
      setLanguagePreference(nextLanguage);
    } catch (error) {
      showErrorToast(t("shell.topbar.preferenceSaveFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const notificationCount = notifications.length;
  const themeOptions: {
    value: ThemeMode;
    label: string;
    icon: typeof Sun;
  }[] = [
    {
      value: "light",
      label: t("settings.appearance.light"),
      icon: Sun,
    },
    {
      value: "dark",
      label: t("settings.appearance.dark"),
      icon: Moon,
    },
    {
      value: "system",
      label: t("settings.appearance.system"),
      icon: MonitorCog,
    },
    {
      value: "custom",
      label: t("settings.appearance.customColors"),
      icon: Palette,
    },
  ];
  const userInitial = useMemo(() => {
    const normalized = authEmail.trim();
    if (!normalized) {
      return "U";
    }
    return normalized[0]?.toUpperCase() ?? "U";
  }, [authEmail]);

  return (
    <div className="app-shell-safe-header mb-4 flex min-h-[56px] shrink-0 items-center justify-end gap-2 border-b border-border pb-3">
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <div className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-none">
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
            {supportedLanguages.map((language) => {
              const isSelected = languagePreference === language.code;
              return (
                <button
                  key={language.code}
                  type="button"
                  aria-label={language.nativeName}
                  title={language.nativeName}
                  disabled={isLanguageLoading}
                  onClick={() => {
                    if (languagePreference === language.code) {
                      return;
                    }
                    void handleLanguageChange(language.code as SupportedLanguage);
                  }}
                  className={
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  }
                >
                  <span
                    className={
                      isSelected
                        ? "flex h-6 w-6 items-center justify-center rounded-md bg-background text-foreground"
                        : "flex h-6 w-6 items-center justify-center rounded-md bg-transparent text-muted-foreground"
                    }
                  >
                    {isLanguageLoading && isSelected ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase leading-none">
                        {language.code}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="h-5 w-px bg-border" />
          <div className="inline-flex items-center gap-1 rounded-lg bg-muted/60 p-0.5">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = themeMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-label={option.label}
                  title={option.label}
                  disabled={isSavingTheme}
                  onClick={() => {
                    if (themeMode === option.value) {
                      return;
                    }
                    void handleThemeModeChange(option.value);
                  }}
                  className={
                    "flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  }
                >
                  <span
                    className={
                      isSelected
                        ? "flex h-6 w-6 items-center justify-center rounded-md bg-background text-foreground"
                        : "flex h-6 w-6 items-center justify-center rounded-md bg-transparent text-muted-foreground"
                    }
                  >
                    {isSavingTheme && isSelected ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("shell.topbar.notifications")}
              className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              {isCheckingUpdates ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {notificationCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-chart-5 px-1 text-[9px] font-semibold text-primary-foreground">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[360px]">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>{t("shell.topbar.notifications")}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => onCheckUpdates()}
                disabled={isCheckingUpdates}
              >
                {isCheckingUpdates
                  ? t("shell.topbar.checkingUpdates")
                  : t("shell.topbar.checkUpdates")}
              </Button>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <p className="px-2.5 py-2 text-[11px] text-muted-foreground">
                {t("shell.topbar.notificationsEmpty")}
              </p>
            ) : (
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-1.5 px-2 py-1.5">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="rounded-md border border-border bg-muted/30 px-2.5 py-2"
                    >
                      <p className="text-[11px] font-semibold text-foreground">
                        {notification.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {notification.description}
                      </p>
                      {notification.isUpdating ? (
                        <Badge
                          variant="secondary"
                          className="mt-1.5 h-5 px-2 text-[10px]"
                        >
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          {t("shell.topbar.autoUpdateInProgress")}
                        </Badge>
                      ) : null}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t("shell.topbar.userMenu")}
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted/50"
            >
              {authAvatar ? (
                <img
                  src={authAvatar}
                  alt={authEmail}
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-[11px] font-semibold">{userInitial}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={8}
            className="w-[276px] max-w-[calc(100vw-24px)]"
          >
            <DropdownMenuLabel className="px-3 pt-2.5 pb-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-foreground">
                  {authAvatar ? (
                    <img
                      src={authAvatar}
                      alt={authEmail}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[11px] font-semibold">{userInitial}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className={TOPBAR_ACCOUNT_TITLE_CLASS}>{authEmail}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {workspaceRoleLabel}
                    </Badge>
                    <p className={TOPBAR_ACCOUNT_META_CLASS}>{workspaceName}</p>
                  </div>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenSettings} className={TOPBAR_ACCOUNT_ACTION_CLASS}>
              <Settings2 className="text-muted-foreground" />
              {t("shell.topbar.openSettings")}
            </DropdownMenuItem>
            {canAccessAdminPanel && !inAdminPanel ? (
              <DropdownMenuItem
                onSelect={onOpenAdminPanel}
                className={TOPBAR_ACCOUNT_ACTION_CLASS}
              >
                <LayoutDashboard className="text-muted-foreground" />
                {t("shell.topbar.goAdminPanel")}
              </DropdownMenuItem>
            ) : null}
            {canAccessWorkspaceGovernancePanel &&
            !inWorkspaceGovernancePanel ? (
              <DropdownMenuItem
                onSelect={onOpenWorkspaceGovernancePanel}
                className={TOPBAR_ACCOUNT_ACTION_CLASS}
              >
                <Users className="text-muted-foreground" />
                {t("shell.topbar.goWorkspaceGovernance")}
              </DropdownMenuItem>
            ) : null}
            {inAdminPanel || inWorkspaceGovernancePanel ? (
              <DropdownMenuItem
                onSelect={onOpenWorkspacePanel}
                className={TOPBAR_ACCOUNT_ACTION_CLASS}
              >
                <LifeBuoy className="text-muted-foreground" />
                {t("shell.topbar.backWorkspace")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut} className={TOPBAR_ACCOUNT_ACTION_CLASS}>
              <LogOut className="text-muted-foreground" />
              {t("shell.auth.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
