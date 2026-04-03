"use client";

import { invoke } from "@tauri-apps/api/core";
import Color from "color";
import {
  Bell,
  Languages,
  Palette,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BsCamera, BsMic } from "react-icons/bs";
import { LoadingButton } from "@/components/loading-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/ui/color-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLanguage } from "@/hooks/use-language";
import type { PermissionType } from "@/hooks/use-permissions";
import { usePermissions } from "@/hooks/use-permissions";
import type { SupportedLanguage } from "@/i18n";
import {
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import {
  getThemeAppearance,
  getThemeByColors,
  getThemeById,
  THEME_VARIABLES,
  THEMES,
} from "@/lib/themes";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { AppSection } from "@/types";
import { RippleButton } from "./ui/ripple";
import { WorkspacePageShell } from "./workspace-page-shell";

interface AppSettings {
  set_as_default_browser: boolean;
  theme: string;
  custom_theme?: Record<string, string>;
  language?: string | null;
  sync_server_url?: string | null;
  api_enabled: boolean;
  api_port: number;
  api_token?: string | null;
  mcp_enabled: boolean;
  mcp_port?: number | null;
  mcp_token?: string | null;
  stripe_publishable_key?: string | null;
  stripe_billing_url?: string | null;
}

interface CustomThemeState {
  selectedThemeId: string | null;
  colors: Record<string, string>;
}

interface PermissionInfo {
  permission_type: PermissionType;
  isGranted: boolean;
  description: string;
}

type AutoSaveState = "idle" | "saving" | "saved" | "error";
type SettingsSectionId = string;

function ThemeMiniPreview({
  colors,
  compact = false,
}: {
  colors: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "rounded-lg border p-1.5" : "rounded-xl border p-2.5"
      }
      style={{
        backgroundColor: colors["--background"],
        borderColor: colors["--border"],
      }}
    >
      <div
        className={
          compact
            ? "mb-1.5 flex items-center justify-between"
            : "mb-2 flex items-center justify-between"
        }
      >
        <div
          className={
            compact ? "flex items-center gap-1" : "flex items-center gap-1.5"
          }
        >
          {[colors["--muted"], colors["--muted-foreground"], colors["--border"]]
            .filter(Boolean)
            .map((color, index) => (
              <span
                key={`${color}-${index}`}
                className="h-1.5 rounded-full"
                style={{
                  width: compact
                    ? index === 2
                      ? "0.75rem"
                      : "1.1rem"
                    : index === 2
                      ? "1rem"
                      : "1.5rem",
                  backgroundColor: color,
                }}
              />
            ))}
        </div>
        <div
          className={
            compact ? "flex items-center gap-0.5" : "flex items-center gap-1"
          }
        >
          {[
            colors["--muted-foreground"],
            colors["--secondary"],
            colors["--accent"],
          ]
            .filter(Boolean)
            .map((color, index) => (
              <span
                key={`${color}-${index}`}
                className={
                  compact ? "h-1 w-1 rounded-full" : "h-1.5 w-1.5 rounded-full"
                }
                style={{ backgroundColor: color }}
              />
            ))}
        </div>
      </div>

      <div
        className={
          compact ? "mb-1.5 h-1.5 rounded-full" : "mb-2 h-2 rounded-full"
        }
        style={{ backgroundColor: colors["--card"] }}
      />

      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        <div
          className={compact ? "h-1 rounded-full" : "h-1.5 rounded-full"}
          style={{ width: "72%", backgroundColor: colors["--muted"] }}
        />
        <div
          className={compact ? "h-1 rounded-full" : "h-1.5 rounded-full"}
          style={{ width: "88%", backgroundColor: colors["--card"] }}
        />
        <div
          className={
            compact
              ? "flex items-center justify-between gap-2"
              : "flex items-center justify-between gap-3"
          }
        >
          <div
            className={
              compact
                ? "flex flex-1 items-center gap-1"
                : "flex flex-1 items-center gap-1.5"
            }
          >
            <span
              className={
                compact ? "h-1 w-3 rounded-full" : "h-1.5 w-4 rounded-full"
              }
              style={{ backgroundColor: colors["--primary"] }}
            />
            <span
              className={
                compact ? "h-1 w-3 rounded-full" : "h-1.5 w-4 rounded-full"
              }
              style={{ backgroundColor: colors["--secondary"] }}
            />
            <span
              className={
                compact ? "h-1 w-3 rounded-full" : "h-1.5 w-4 rounded-full"
              }
              style={{ backgroundColor: colors["--accent"] }}
            />
          </div>
          <span
            className={compact ? "h-2 w-4 rounded-sm" : "h-2.5 w-5 rounded-sm"}
            style={{ backgroundColor: colors["--primary"] }}
          />
        </div>
      </div>
    </div>
  );
}

function ThemeChoiceIndicator({
  selected,
  compact = false,
}: {
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`mt-0.5 flex items-center justify-center rounded-full border ${
        compact ? "h-3.5 w-3.5" : "h-4 w-4"
      } ${selected ? "border-primary" : "border-border"}`}
    >
      <span
        className={`${compact ? "h-1.5 w-1.5" : "h-2 w-2"} rounded-full ${
          selected ? "bg-primary" : "bg-transparent"
        }`}
      />
    </span>
  );
}

// Version update progress toasts are handled globally via useVersionUpdater

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSectionOpen?: (section: AppSection) => void;
  onSyncConfigOpen?: () => void;
  canUseEncryption?: boolean;
  mode?: "dialog" | "page";
}

export function SettingsDialog({
  isOpen,
  onClose,
  mode = "dialog",
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<AppSettings>({
    set_as_default_browser: false,
    theme: "system",
    custom_theme: undefined,
    language: null,
    sync_server_url: null,
    api_enabled: false,
    api_port: 10108,
    api_token: undefined,
    mcp_enabled: false,
    mcp_port: null,
    mcp_token: null,
    stripe_publishable_key: null,
    stripe_billing_url: null,
  });
  const [customThemeState, setCustomThemeState] = useState<CustomThemeState>({
    selectedThemeId: null,
    colors: {},
  });
  const [isLoading, setIsLoading] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [permissions, setPermissions] = useState<PermissionInfo[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [requestingPermission, setRequestingPermission] =
    useState<PermissionType | null>(null);
  const [isMacOS, setIsMacOS] = useState(false);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("appearance");
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("unsupported");

  const { t } = useTranslation();
  const { resolvedTheme, setTheme } = useTheme();
  const {
    requestPermission,
    isMicrophoneAccessGranted,
    isCameraAccessGranted,
  } = usePermissions();
  const {
    currentLanguage,
    changeLanguage,
    supportedLanguages,
    isLoading: isLanguageLoading,
  } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage | null>(null);
  const autoSaveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoSaveResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingAutoSaveSettingsRef = useRef<AppSettings | null>(null);
  const autoSaveRequestIdRef = useRef(0);

  const getPermissionIcon = useCallback((type: PermissionType) => {
    switch (type) {
      case "microphone":
        return <BsMic className="w-4 h-4" />;
      case "camera":
        return <BsCamera className="w-4 h-4" />;
    }
  }, []);

  const getPermissionDisplayName = useCallback(
    (type: PermissionType) => {
      switch (type) {
        case "microphone":
          return t("settings.permissions.microphone");
        case "camera":
          return t("settings.permissions.camera");
      }
    },
    [t],
  );

  const getStatusBadge = useCallback(
    (isGranted: boolean) => {
      if (isGranted) {
        return <Badge variant="default">{t("common.status.granted")}</Badge>;
      }
      return <Badge variant="secondary">{t("common.status.notGranted")}</Badge>;
    },
    [t],
  );

  const getPermissionDescription = useCallback(
    (type: PermissionType) => {
      switch (type) {
        case "microphone":
          return t("settings.permissions.microphoneDescription");
        case "camera":
          return t("settings.permissions.cameraDescription");
      }
    },
    [t],
  );

  const applyCustomTheme = useCallback((vars: Record<string, string>) => {
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) =>
      root.style.setProperty(k, v, "important"),
    );
  }, []);

  const clearCustomTheme = useCallback(() => {
    const root = document.documentElement;
    THEME_VARIABLES.forEach(({ key }) =>
      root.style.removeProperty(key as string),
    );
  }, []);

  const clearAutoSaveResetTimer = useCallback(() => {
    if (autoSaveResetTimerRef.current) {
      clearTimeout(autoSaveResetTimerRef.current);
      autoSaveResetTimerRef.current = null;
    }
  }, []);

  const loadSettings = useCallback(async () => {
    autoSaveRequestIdRef.current += 1;
    setAutoSaveState("idle");
    pendingAutoSaveSettingsRef.current = null;
    if (autoSaveDebounceTimerRef.current) {
      clearTimeout(autoSaveDebounceTimerRef.current);
      autoSaveDebounceTimerRef.current = null;
    }
    clearAutoSaveResetTimer();

    const cachedSettings = readAppSettingsCache();
    if (cachedSettings?.theme) {
      const tokyoNightTheme = getThemeById("tokyo-night");
      const mergedFromCache: AppSettings = {
        set_as_default_browser: Boolean(cachedSettings.set_as_default_browser),
        theme:
          typeof cachedSettings.theme === "string"
            ? cachedSettings.theme
            : "system",
        custom_theme:
          cachedSettings.custom_theme &&
          Object.keys(cachedSettings.custom_theme).length > 0
            ? cachedSettings.custom_theme
            : tokyoNightTheme?.colors,
        language:
          typeof cachedSettings.language === "string"
            ? cachedSettings.language
            : null,
        sync_server_url:
          typeof cachedSettings.sync_server_url === "string"
            ? cachedSettings.sync_server_url
            : null,
        api_enabled: Boolean(cachedSettings.api_enabled),
        api_port:
          typeof cachedSettings.api_port === "number"
            ? cachedSettings.api_port
            : 10108,
        api_token:
          typeof cachedSettings.api_token === "string"
            ? cachedSettings.api_token
            : null,
        mcp_enabled: Boolean(cachedSettings.mcp_enabled),
        mcp_port:
          typeof cachedSettings.mcp_port === "number"
            ? cachedSettings.mcp_port
            : null,
        mcp_token:
          typeof cachedSettings.mcp_token === "string"
            ? cachedSettings.mcp_token
            : null,
        stripe_publishable_key:
          typeof cachedSettings.stripe_publishable_key === "string"
            ? cachedSettings.stripe_publishable_key
            : null,
        stripe_billing_url:
          typeof cachedSettings.stripe_billing_url === "string"
            ? cachedSettings.stripe_billing_url
            : null,
      };
      setSettings(mergedFromCache);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    try {
      const appSettings = await invoke<AppSettings>("get_app_settings");
      mergeAppSettingsCache(appSettings);
      const tokyoNightTheme = getThemeById("tokyo-night");
      if (!tokyoNightTheme) {
        throw new Error("Tokyo Night theme not found");
      }
      const merged: AppSettings = {
        ...appSettings,
        custom_theme:
          appSettings.custom_theme &&
          Object.keys(appSettings.custom_theme).length > 0
            ? appSettings.custom_theme
            : tokyoNightTheme.colors,
      };
      setSettings(merged);

      if (merged.theme === "custom" && merged.custom_theme) {
        const matchingTheme = getThemeByColors(merged.custom_theme);
        setCustomThemeState({
          selectedThemeId: matchingTheme?.id || null,
          colors: merged.custom_theme,
        });
      } else if (merged.theme === "custom") {
        setCustomThemeState({
          selectedThemeId: "tokyo-night",
          colors: tokyoNightTheme.colors,
        });
      } else {
        setCustomThemeState((prev) => ({
          ...prev,
          selectedThemeId: null,
          colors: merged.custom_theme ?? tokyoNightTheme.colors,
        }));
      }
    } catch {
      // Keep current UI state from cache when runtime load fails.
    } finally {
      setIsLoading(false);
    }
  }, [clearAutoSaveResetTimer]);

  const loadPermissions = useCallback(async () => {
    setIsLoadingPermissions(true);
    try {
      if (!isMacOS) {
        // On non-macOS platforms, don't show permissions
        setPermissions([]);
        return;
      }

      const permissionList: PermissionInfo[] = [
        {
          permission_type: "microphone",
          isGranted: isMicrophoneAccessGranted,
          description: getPermissionDescription("microphone"),
        },
        {
          permission_type: "camera",
          isGranted: isCameraAccessGranted,
          description: getPermissionDescription("camera"),
        },
      ];

      setPermissions(permissionList);
    } catch {
      setPermissions([]);
    } finally {
      setIsLoadingPermissions(false);
    }
  }, [
    getPermissionDescription,
    isCameraAccessGranted,
    isMacOS,
    isMicrophoneAccessGranted,
  ]);

  const handleClearCache = useCallback(async () => {
    setIsClearingCache(true);
    try {
      await invoke("clear_all_version_cache_and_refetch");
      // Also clear traffic stats cache
      await invoke("clear_all_traffic_stats");
      // Don't show immediate success toast - let the version update progress events handle it
    } catch (error) {
      showErrorToast(t("settings.advanced.clearCacheFailed"), {
        description:
          error instanceof Error
            ? error.message
            : t("settings.advanced.unknownError"),
        duration: 4000,
      });
    } finally {
      setIsClearingCache(false);
    }
  }, [t]);

  const handleRequestPermission = useCallback(
    async (permissionType: PermissionType) => {
      setRequestingPermission(permissionType);
      try {
        await requestPermission(permissionType);
        showSuccessToast(
          `${getPermissionDisplayName(permissionType)} access requested`,
        );
      } catch (error) {
        showErrorToast(t("toasts.error.settingsSaveFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setRequestingPermission(null);
      }
    },
    [getPermissionDisplayName, requestPermission, t],
  );

  const handleRequestNotificationPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
      if (result === "granted") {
        showSuccessToast(t("settings.notifications.permissionGranted"));
      } else if (result === "denied") {
        showErrorToast(t("settings.notifications.permissionDenied"));
      }
    } catch (error) {
      showErrorToast(t("toasts.error.settingsSaveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [t]);

  const scheduleAutoSaveStateReset = useCallback(() => {
    clearAutoSaveResetTimer();
    autoSaveResetTimerRef.current = setTimeout(() => {
      setAutoSaveState("idle");
      autoSaveResetTimerRef.current = null;
    }, 1500);
  }, [clearAutoSaveResetTimer]);

  const persistSettingsImmediately = useCallback(
    async (nextSettings: AppSettings) => {
      const requestId = ++autoSaveRequestIdRef.current;
      clearAutoSaveResetTimer();
      setAutoSaveState("saving");
      try {
        const savedSettings = await invoke<AppSettings>("save_app_settings", {
          settings: nextSettings,
        });
        if (requestId !== autoSaveRequestIdRef.current) {
          return;
        }
        mergeAppSettingsCache(savedSettings);
        pendingAutoSaveSettingsRef.current = null;
        setSettings(savedSettings);
        setAutoSaveState("saved");
        scheduleAutoSaveStateReset();
      } catch (error) {
        if (requestId !== autoSaveRequestIdRef.current) {
          return;
        }
        setAutoSaveState("error");
        showErrorToast(t("toasts.error.settingsSaveFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [clearAutoSaveResetTimer, scheduleAutoSaveStateReset, t],
  );

  const queueSettingsAutoSave = useCallback(
    (nextSettings: AppSettings, debounceMs = 300) => {
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
      pendingAutoSaveSettingsRef.current = nextSettings;
      clearAutoSaveResetTimer();
      setAutoSaveState("saving");
      autoSaveDebounceTimerRef.current = setTimeout(() => {
        autoSaveDebounceTimerRef.current = null;
        const pendingSettings = pendingAutoSaveSettingsRef.current;
        if (pendingSettings) {
          void persistSettingsImmediately(pendingSettings);
        }
      }, debounceMs);
    },
    [clearAutoSaveResetTimer, persistSettingsImmediately],
  );

  const handleLanguageSelection = useCallback(
    async (nextLanguage: SupportedLanguage) => {
      if (isLoading || isLanguageLoading) {
        return;
      }
      if (nextLanguage === selectedLanguage) {
        return;
      }

      const previousLanguage = selectedLanguage;
      setSelectedLanguage(nextLanguage);
      clearAutoSaveResetTimer();
      setAutoSaveState("saving");
      try {
        await changeLanguage(nextLanguage);
        setAutoSaveState("saved");
        scheduleAutoSaveStateReset();
      } catch (error) {
        setSelectedLanguage(previousLanguage);
        setAutoSaveState("error");
        showErrorToast(t("toasts.error.settingsSaveFailed"), {
          description: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [
      changeLanguage,
      clearAutoSaveResetTimer,
      isLoading,
      isLanguageLoading,
      scheduleAutoSaveStateReset,
      selectedLanguage,
      t,
    ],
  );

  const handleThemeModeChange = useCallback(
    (value: AppSettings["theme"]) => {
      if (value === "custom") {
        const fallbackTheme = getThemeById(
          customThemeState.selectedThemeId || "tokyo-night",
        );
        const nextColors = fallbackTheme?.colors ?? customThemeState.colors;
        setCustomThemeState((prev) => ({
          selectedThemeId: fallbackTheme?.id ?? prev.selectedThemeId,
          colors: nextColors,
        }));
        applyCustomTheme(nextColors);
        setTheme(getThemeAppearance(nextColors));
        setSettings((prev) => {
          const nextSettings = {
            ...prev,
            theme: "custom",
            custom_theme: nextColors,
          };
          queueSettingsAutoSave(nextSettings);
          return nextSettings;
        });
        return;
      }

      clearCustomTheme();
      setTheme(value);
      setSettings((prev) => {
        const nextSettings = {
          ...prev,
          theme: value,
        };
        queueSettingsAutoSave(nextSettings);
        return nextSettings;
      });
    },
    [
      applyCustomTheme,
      clearCustomTheme,
      customThemeState.colors,
      customThemeState.selectedThemeId,
      queueSettingsAutoSave,
      setTheme,
    ],
  );

  const handleThemePresetChange = useCallback(
    (themeId: string | null) => {
      if (!themeId) {
        setCustomThemeState((prev) => ({ ...prev, selectedThemeId: null }));
        return;
      }

      const theme = getThemeById(themeId);
      if (!theme) {
        return;
      }

      setCustomThemeState({
        selectedThemeId: themeId,
        colors: theme.colors,
      });
      applyCustomTheme(theme.colors);
      setTheme(getThemeAppearance(theme.colors));
      setSettings((prev) => {
        const nextSettings = {
          ...prev,
          theme: "custom",
          custom_theme: theme.colors,
        };
        queueSettingsAutoSave(nextSettings);
        return nextSettings;
      });
    },
    [applyCustomTheme, queueSettingsAutoSave, setTheme],
  );

  const handleClose = useCallback(() => {
    if (autoSaveDebounceTimerRef.current) {
      clearTimeout(autoSaveDebounceTimerRef.current);
      autoSaveDebounceTimerRef.current = null;
    }
    const pendingSettings = pendingAutoSaveSettingsRef.current;
    if (pendingSettings) {
      void persistSettingsImmediately(pendingSettings);
    }
    clearAutoSaveResetTimer();
    onClose();
  }, [clearAutoSaveResetTimer, onClose, persistSettingsImmediately]);

  useEffect(() => {
    if (isOpen) {
      loadSettings().catch(() => undefined);

      // Check if we're on macOS
      const userAgent = navigator.userAgent;
      const isMac = userAgent.includes("Mac");
      setIsMacOS(isMac);

      if (typeof window !== "undefined" && "Notification" in window) {
        setNotificationPermission(Notification.permission);
      } else {
        setNotificationPermission("unsupported");
      }

      if (isMac) {
        loadPermissions().catch(() => undefined);
      }
    }
  }, [isOpen, loadPermissions, loadSettings]);

  // Initialize language selection when dialog opens or language loads
  useEffect(() => {
    if (isOpen && !isLanguageLoading) {
      const normalizedLanguage = supportedLanguages.some(
        (item) => item.code === currentLanguage,
      )
        ? (currentLanguage as SupportedLanguage)
        : "vi";
      setSelectedLanguage(normalizedLanguage);
    }
  }, [currentLanguage, isLanguageLoading, isOpen, supportedLanguages]);

  useEffect(() => {
    return () => {
      if (autoSaveDebounceTimerRef.current) {
        clearTimeout(autoSaveDebounceTimerRef.current);
      }
      if (autoSaveResetTimerRef.current) {
        clearTimeout(autoSaveResetTimerRef.current);
      }
    };
  }, []);

  // Update permissions when the permission states change
  useEffect(() => {
    if (isMacOS) {
      const permissionList: PermissionInfo[] = [
        {
          permission_type: "microphone",
          isGranted: isMicrophoneAccessGranted,
          description: getPermissionDescription("microphone"),
        },
        {
          permission_type: "camera",
          isGranted: isCameraAccessGranted,
          description: getPermissionDescription("camera"),
        },
      ];
      setPermissions(permissionList);
    } else {
      setPermissions([]);
    }
  }, [
    isMacOS,
    isMicrophoneAccessGranted,
    isCameraAccessGranted,
    getPermissionDescription,
  ]);

  const title = t("settings.title");
  const isSettingsReady = !isLoading;
  const lightPreviewTheme = getThemeById("ayu-light");
  const darkPreviewTheme = getThemeById("tokyo-night");
  const systemPreviewColors =
    resolvedTheme === "light"
      ? lightPreviewTheme?.colors
      : darkPreviewTheme?.colors;
  const themeModeOptions = [
    {
      value: "light" as const,
      label: t("settings.appearance.light"),
      colors: lightPreviewTheme?.colors,
    },
    {
      value: "dark" as const,
      label: t("settings.appearance.dark"),
      colors: darkPreviewTheme?.colors,
    },
    {
      value: "system" as const,
      label: t("settings.appearance.system"),
      colors: systemPreviewColors,
    },
    {
      value: "custom" as const,
      label: t("settings.appearance.customColors"),
      colors:
        customThemeState.colors &&
        Object.keys(customThemeState.colors).length > 0
          ? customThemeState.colors
          : darkPreviewTheme?.colors,
    },
  ];
  const selectedThemeModeLabel =
    themeModeOptions.find((option) => option.value === settings.theme)?.label ??
    t("settings.appearance.system");
  const selectedThemePresetLabel =
    customThemeState.selectedThemeId === null
      ? t("settings.appearance.yourOwn")
      : (THEMES.find((theme) => theme.id === customThemeState.selectedThemeId)
          ?.name ?? t("settings.appearance.yourOwn"));
  const notificationPermissionLabel =
    notificationPermission === "granted"
      ? t("settings.notifications.statusGranted")
      : notificationPermission === "denied"
        ? t("settings.notifications.statusDenied")
        : notificationPermission === "default"
          ? t("settings.notifications.statusPrompt")
          : t("settings.notifications.statusUnsupported");
  const settingsSectionItems = useMemo(
    () => [
      {
        id: "appearance" as const,
        label: t("settings.navigation.items.appearance"),
        icon: Palette,
        group: "workspace" as const,
        disabled: false,
      },
      {
        id: "language" as const,
        label: t("settings.navigation.items.languageRegion"),
        icon: Languages,
        group: "workspace" as const,
        disabled: false,
      },
      {
        id: "notifications" as const,
        label: t("settings.navigation.items.notifications"),
        icon: Bell,
        group: "workspace" as const,
        disabled: false,
      },
      ...(isMacOS
        ? [
            {
              id: "permissions" as const,
              label: t("settings.navigation.items.permissions"),
              icon: Shield,
              group: "system" as const,
              disabled: false,
            },
          ]
        : []),
      {
        id: "advanced" as const,
        label: t("settings.navigation.items.advanced"),
        icon: SlidersHorizontal,
        group: "system" as const,
        disabled: false,
      },
    ],
    [isMacOS, t],
  );
  const settingsGroupRows = useMemo(
    () => [
      {
        id: "workspace" as const,
        label: t("settings.navigation.groups.workspace"),
      },
      {
        id: "system" as const,
        label: t("settings.navigation.groups.system"),
      },
    ],
    [t],
  );
  const groupedSectionItems = useMemo(
    () =>
      settingsGroupRows
        .map((group) => ({
          ...group,
          items: settingsSectionItems.filter((item) => item.group === group.id),
        }))
        .filter((group) => group.items.length > 0),
    [settingsGroupRows, settingsSectionItems],
  );
  useEffect(() => {
    if (settingsSectionItems.length === 0) {
      return;
    }
    if (!settingsSectionItems.some((item) => item.id === activeSection)) {
      setActiveSection(settingsSectionItems[0].id);
    }
  }, [activeSection, settingsSectionItems]);

  const handleSelectSection = useCallback(
    (sectionId: SettingsSectionId) => {
      const target = settingsSectionItems.find((item) => item.id === sectionId);
      if (!target || target.disabled) {
        return;
      }
      setActiveSection(sectionId);
    },
    [settingsSectionItems],
  );

  const loadingSections = (
    <div className="grid w-full gap-4 pb-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-3 rounded-xl border border-border bg-card p-3">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="space-y-1.5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={`settings-nav-skeleton-${index}`}
              className="h-8 rounded-md border border-border bg-background"
            />
          ))}
        </div>
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="h-5 w-56 rounded bg-muted" />
        <div className="h-4 w-80 rounded bg-muted" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, optionIndex) => (
            <div
              key={`settings-option-skeleton-${optionIndex}`}
              className="h-16 rounded-md border border-border bg-background"
            />
          ))}
        </div>
      </div>
    </div>
  );

  const settingsNavigation = (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="space-y-1 px-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      {groupedSectionItems.map((group) => (
        <div key={group.id} className="space-y-1">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {group.label}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              const isDisabled = Boolean(item.disabled);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => {
                    handleSelectSection(item.id);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-medium transition-colors ${
                    isDisabled
                      ? "cursor-not-allowed border-transparent text-muted-foreground/50"
                      : isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const appearanceSection = (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("settings.appearance.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("settings.appearance.themeDescription")}
        </p>
      </div>

      <div className="grid max-w-[720px] grid-cols-2 gap-2 sm:grid-cols-4">
        {themeModeOptions.map((option) => (
          <button
            type="button"
            key={option.value}
            disabled={!isSettingsReady}
            onClick={() => {
              handleThemeModeChange(option.value);
            }}
            className={`rounded-lg border p-1.5 text-left transition-colors ${
              settings.theme === option.value
                ? "border-primary bg-accent/40"
                : "border-border bg-card hover:bg-muted/40"
            } ${!isSettingsReady ? "cursor-wait opacity-60" : ""}`}
          >
            <div className="space-y-1.5">
              {option.colors && (
                <ThemeMiniPreview colors={option.colors} compact />
              )}
              <div className="flex items-center gap-2">
                <ThemeChoiceIndicator
                  selected={settings.theme === option.value}
                  compact
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {option.label}
                  </p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {settings.theme === "custom" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              {t("settings.appearance.themePreset")}
            </Label>
            <div className="grid max-w-[720px] grid-cols-2 gap-2 sm:grid-cols-4">
              {THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme.id}
                  disabled={!isSettingsReady}
                  onClick={() => {
                    handleThemePresetChange(theme.id);
                  }}
                  className={`rounded-lg border p-1.5 text-left transition-colors ${
                    customThemeState.selectedThemeId === theme.id
                      ? "border-primary bg-accent/40"
                      : "border-border bg-card hover:bg-muted/40"
                  } ${!isSettingsReady ? "cursor-wait opacity-60" : ""}`}
                >
                  <div className="space-y-1.5">
                    <ThemeMiniPreview colors={theme.colors} compact />
                    <div className="flex items-center gap-2">
                      <ThemeChoiceIndicator
                        selected={customThemeState.selectedThemeId === theme.id}
                        compact
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {theme.name}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <button
                type="button"
                disabled={!isSettingsReady}
                onClick={() => {
                  handleThemePresetChange(null);
                }}
                className={`rounded-lg border p-1.5 text-left transition-colors ${
                  customThemeState.selectedThemeId === null
                    ? "border-primary bg-accent/40"
                    : "border-border bg-card hover:bg-muted/40"
                } ${!isSettingsReady ? "cursor-wait opacity-60" : ""}`}
              >
                <div className="space-y-1.5">
                  <ThemeMiniPreview colors={customThemeState.colors} compact />
                  <div className="flex items-center gap-2">
                    <ThemeChoiceIndicator
                      selected={customThemeState.selectedThemeId === null}
                      compact
                    />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {t("settings.appearance.yourOwn")}
                      </p>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <div className="max-w-[720px] rounded-lg border border-border bg-card p-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">
                {t("settings.appearance.customColors")}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t("settings.appearance.colorEditHint")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {THEME_VARIABLES.map(({ key, label }) => {
                const colorValue = customThemeState.colors[key] || "#000000";
                return (
                  <div key={key}>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label={label}
                          title={label}
                          className="h-6 w-6 cursor-pointer rounded-md border border-border"
                          style={{ backgroundColor: colorValue }}
                        />
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-3" sideOffset={6}>
                        <ColorPicker
                          className="rounded-md border bg-background p-3 shadow-sm"
                          value={colorValue}
                          onColorChange={([r, g, b, a]) => {
                            const next = Color({ r, g, b }).alpha(a);
                            const nextStr = next.hexa();
                            const newColors = {
                              ...customThemeState.colors,
                              [key]: nextStr,
                            };

                            const matchingTheme = getThemeByColors(newColors);

                            setCustomThemeState({
                              selectedThemeId: matchingTheme?.id || null,
                              colors: newColors,
                            });
                            applyCustomTheme(newColors);
                            setTheme(getThemeAppearance(newColors));
                            setSettings((prev) => {
                              const nextSettings = {
                                ...prev,
                                theme: "custom",
                                custom_theme: newColors,
                              };
                              queueSettingsAutoSave(nextSettings, 450);
                              return nextSettings;
                            });
                          }}
                        >
                          <ColorPickerSelection className="h-36 rounded" />
                          <div className="mt-3 flex items-center gap-3">
                            <ColorPickerEyeDropper />
                            <div className="grid w-full gap-1">
                              <ColorPickerHue />
                              <ColorPickerAlpha />
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <ColorPickerOutput />
                            <ColorPickerFormat />
                          </div>
                        </ColorPicker>
                      </PopoverContent>
                    </Popover>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("settings.appearance.theme")}: {selectedThemeModeLabel}
        </Badge>
        {settings.theme === "custom" ? (
          <Badge variant="outline">
            {t("settings.appearance.themePreset")}: {selectedThemePresetLabel}
          </Badge>
        ) : null}
      </div>
    </section>
  );

  const languageSection = (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("settings.language.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("settings.language.description")}
        </p>
      </div>

      <div className="grid max-w-[720px] gap-2">
        <Label className="text-sm">
          {t("settings.language.selectLanguage")}
        </Label>
        <div className="inline-flex w-fit flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm">
          {supportedLanguages.map((option) => {
            const isSelected = selectedLanguage === option.code;
            return (
              <button
                key={option.code}
                type="button"
                disabled={isLanguageLoading || !isSettingsReady}
                onClick={() =>
                  void handleLanguageSelection(option.code as SupportedLanguage)
                }
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {`${option.nativeName} (${option.name})`}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {t("settings.language.selectLanguage")}:{" "}
          {supportedLanguages.find((lang) => lang.code === selectedLanguage)
            ?.nativeName ?? selectedLanguage}
        </Badge>
      </div>
    </section>
  );

  const notificationsSection = (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("settings.notifications.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("settings.notifications.description")}
        </p>
      </div>

      <div className="space-y-2 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {t("settings.notifications.actionTitle")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("settings.notifications.permissionLabel")}:{" "}
          <span className="font-medium text-foreground">
            {notificationPermissionLabel}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          {t("settings.notifications.actionHint")}
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            void handleRequestNotificationPermission();
          }}
          disabled={notificationPermission === "unsupported"}
        >
          {t("settings.notifications.requestPermission")}
        </Button>
      </div>
    </section>
  );

  const permissionsSection = isMacOS ? (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("settings.permissions.title")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("settings.permissions.description")}
        </p>
      </div>

      {isLoadingPermissions ? (
        <div className="text-sm text-muted-foreground">
          {t("settings.permissions.loading")}
        </div>
      ) : (
        <div className="space-y-3">
          {permissions.map((permission) => (
            <div
              key={permission.permission_type}
              className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
            >
              <div className="flex items-center space-x-3">
                {getPermissionIcon(permission.permission_type)}
                <div>
                  <div className="text-sm font-medium">
                    {getPermissionDisplayName(permission.permission_type)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {permission.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusBadge(permission.isGranted)}
                {!permission.isGranted && (
                  <LoadingButton
                    size="sm"
                    isLoading={
                      requestingPermission === permission.permission_type
                    }
                    onClick={() => {
                      handleRequestPermission(permission.permission_type).catch(
                        () => undefined,
                      );
                    }}
                  >
                    {t("common.buttons.grant")}
                  </LoadingButton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  ) : null;

  const advancedSection = (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <Label className="text-base font-semibold">
          {t("settings.advanced.title")}
        </Label>
        <p className="max-w-xl text-xs text-muted-foreground">
          {t("settings.advanced.clearCacheDescription")}
        </p>
      </div>
      <LoadingButton
        isLoading={isClearingCache}
        onClick={() => {
          handleClearCache().catch(() => undefined);
        }}
        variant="outline"
        className="min-w-52"
      >
        {t("settings.advanced.clearCache")}
      </LoadingButton>
    </section>
  );

  const activeSectionItem =
    settingsSectionItems.find((item) => item.id === activeSection) ??
    settingsSectionItems[0] ??
    null;

  let activeSectionContent: React.ReactNode = null;
  if (activeSectionItem) {
    if (activeSectionItem.id === "appearance") {
      activeSectionContent = appearanceSection;
    } else if (activeSectionItem.id === "language") {
      activeSectionContent = languageSection;
    } else if (activeSectionItem.id === "notifications") {
      activeSectionContent = notificationsSection;
    } else if (activeSectionItem.id === "permissions") {
      activeSectionContent = permissionsSection ?? advancedSection;
    } else if (activeSectionItem.id === "advanced") {
      activeSectionContent = advancedSection;
    }
  }

  const settingsSections = (
    <div className="grid w-full gap-4 pb-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className={mode === "page" ? "h-fit lg:sticky lg:top-0" : "h-fit"}>
        {settingsNavigation}
      </aside>

      <div className="space-y-4">{activeSectionContent}</div>
    </div>
  );

  const dialogContent = (
    <>
      <div className="app-shell-safe-header shrink-0 border-b px-5 py-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
      </div>

      <ScrollArea className="min-h-0 flex-1">{settingsSections}</ScrollArea>

      <DialogFooter className="shrink-0 border-t px-5 py-4 sm:justify-between">
        {mode === "dialog" && (
          <RippleButton variant="outline" onClick={handleClose}>
            {t("common.buttons.cancel")}
          </RippleButton>
        )}
      </DialogFooter>
    </>
  );

  if (mode === "page") {
    return (
      <WorkspacePageShell title={title} contentClassName="max-w-none">
        {isLoading ? loadingSections : settingsSections}
      </WorkspacePageShell>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="my-8 flex max-h-[85vh] max-w-5xl flex-col p-0">
        {dialogContent}
      </DialogContent>
    </Dialog>
  );
}
