"use client";

import {
  Bell,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MonitorCog,
  Moon,
  Settings2,
  Shield,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopNavHead } from "@/components/portal/top-nav-head";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/frontend-shadcn/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend-shadcn/ui/dropdown-menu";
import { useWebPortalSession } from "@/hooks/use-web-portal-session";
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import {
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import { writeLanguageCookie } from "@/lib/language-cookie";

const PORTAL_ACCOUNT_TITLE_CLASS =
  "truncate text-xs leading-[1.25] font-semibold text-foreground";
const PORTAL_ACCOUNT_META_CLASS =
  "truncate text-[11px] leading-[1.25] font-medium text-muted-foreground";
const PORTAL_ACCOUNT_ACTION_CLASS =
  "rounded-md px-2.5 py-2 text-xs leading-[1.2] font-semibold [&_svg:not([class*='size-'])]:size-4";

export function PortalHeaderControls({
  showAccount = true,
}: {
  showAccount?: boolean;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const {
    isSignedIn,
    identityName,
    identityLabel,
    identityAvatar,
    dashboardHref,
    platformRole,
    signOut,
  } = useWebPortalSession();
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
  const userEmail = identityLabel || "portal@buglogin.com";
  const userName = userEmail;
  const userMeta =
    identityName && identityName !== userEmail ? identityName : t("portalSite.nav.account");
  const userFallback = userEmail.trim().slice(0, 1).toUpperCase() || "B";

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
  }, []);
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

  const handleLanguageChange = async (language: SupportedLanguage) => {
    if (activeLanguage === language) {
      return;
    }
    await i18n.changeLanguage(language);
    writeLanguageCookie(language);
    mergeAppSettingsCache({ language });
  };

  if (!mounted) {
    return (
      <div className="h-9 w-[300px] rounded-lg border border-border bg-card/70" />
    );
  }

  const themeOptions: {
    value: "light" | "dark" | "system";
    icon: typeof Sun;
    label: string;
  }[] = [
    { value: "light", icon: Sun, label: t("settings.appearance.light") },
    { value: "dark", icon: Moon, label: t("settings.appearance.dark") },
    {
      value: "system",
      icon: MonitorCog,
      label: t("settings.appearance.system"),
    },
  ];

  return (
    <TopNavHead
      languages={SUPPORTED_LANGUAGES.map((language) => ({
        code: language.code,
        label: language.nativeName,
        active: activeLanguage === language.code,
        onSelect: () => {
          void handleLanguageChange(language.code as SupportedLanguage);
        },
      }))}
      themeOptions={themeOptions.map((option) => ({
        id: option.value,
        label: option.label,
        icon: option.icon,
        active: themeMode === option.value,
        onSelect: () => {
          setThemeMode(option.value);
          setTheme(option.value);
        },
      }))}
      rightSlot={
        <>
          {isSignedIn ? (
            <button
              type="button"
              aria-label={t("shell.topbar.notifications")}
              title={t("shell.topbar.notifications")}
              className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Bell className="h-4 w-4" />
            </button>
          ) : null}

          {showAccount ? (
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
          ) : null}

          {showAccount ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("shell.topbar.userMenu")}
                  className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border bg-card text-foreground transition-colors hover:bg-muted/50"
                >
                  <Avatar className="h-full w-full rounded-full">
                    <AvatarImage src={identityAvatar || ""} alt={userName} />
                    <AvatarFallback className="rounded-full text-[10px] font-semibold">
                      {userFallback}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[224px] max-w-[calc(100vw-24px)] border-border bg-popover text-popover-foreground"
              >
                <DropdownMenuLabel className="space-y-0.5 px-3 pt-2 pb-1.5">
                  <p className={PORTAL_ACCOUNT_TITLE_CLASS}>{userName}</p>
                  <p className={PORTAL_ACCOUNT_META_CLASS}>{userMeta}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push(dashboardHref)}
                  className={PORTAL_ACCOUNT_ACTION_CLASS}
                >
                  <LayoutDashboard className="text-muted-foreground" />
                  {t("portalSite.nav.dashboard")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push("/account/billing")}
                  className={PORTAL_ACCOUNT_ACTION_CLASS}
                >
                  <CreditCard className="text-muted-foreground" />
                  {t("portalSite.nav.billing")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => router.push("/account/settings")}
                  className={PORTAL_ACCOUNT_ACTION_CLASS}
                >
                  <Settings2 className="text-muted-foreground" />
                  {t("portalSite.account.nav.settings")}
                </DropdownMenuItem>
                {platformRole === "platform_admin" ? (
                  <DropdownMenuItem
                    onSelect={() => router.push("/admin/dashboard")}
                    className={PORTAL_ACCOUNT_ACTION_CLASS}
                  >
                    <Shield className="text-muted-foreground" />
                    {t("portalSite.nav.admin")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    void signOut().then(() => {
                      router.replace("/signin");
                    });
                  }}
                  className={PORTAL_ACCOUNT_ACTION_CLASS}
                >
                  <LogOut className="text-muted-foreground" />
                  {t("portalSite.nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </>
      }
    />
  );
}
