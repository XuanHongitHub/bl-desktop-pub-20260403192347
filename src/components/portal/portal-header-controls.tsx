"use client";

import {
  Bell,
  Check,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MonitorCog,
  Moon,
  Settings2,
  Shield,
  Sun,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TopNavHead } from "@/components/portal/top-nav-head";
import {
  acceptAuthInvite,
  declineAuthInvite,
  listAuthInvites,
  type WebBillingConnection,
} from "@/components/web-billing/control-api";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWebPortalSession } from "@/hooks/use-web-portal-session";
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import {
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import { writeLanguageCookie } from "@/lib/language-cookie";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { readPortalSessionStorage } from "@/lib/portal-session";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ControlAuthInvite } from "@/types";

const PORTAL_ACCOUNT_TITLE_CLASS =
  "truncate text-xs leading-[1.25] font-semibold text-foreground";
const PORTAL_ACCOUNT_META_CLASS =
  "truncate text-[11px] leading-[1.25] font-medium text-muted-foreground";
const PORTAL_ACCOUNT_ACTION_CLASS =
  "rounded-md px-2.5 py-2 text-xs leading-[1.2] font-semibold [&_svg:not([class*='size-'])]:size-4";

function resolvePortalConnection(): WebBillingConnection | null {
  const session = readPortalSessionStorage();
  if (!session) {
    return null;
  }
  const controlBaseUrl = session.connection.controlBaseUrl?.trim() ?? "";
  const controlToken = session.connection.controlToken?.trim() ?? "";
  const userId = session.connection.userId?.trim() ?? "";
  const userEmail = session.connection.userEmail?.trim() ?? "";
  if (!controlBaseUrl || !controlToken || !userId || !userEmail) {
    return null;
  }
  return {
    controlBaseUrl,
    controlToken,
    userId,
    userEmail,
    platformRole:
      session.connection.platformRole ?? session.user.platformRole ?? null,
  };
}

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
  const [inviteItems, setInviteItems] = useState<ControlAuthInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const userEmail = identityLabel || "portal@buglogin.com";
  const userName = userEmail;
  const userMeta =
    identityName && identityName !== userEmail
      ? identityName
      : t("portalSite.nav.account");
  const userFallback = userEmail.trim().slice(0, 1).toUpperCase() || "B";

  const refreshInvites = useCallback(async () => {
    if (!isSignedIn) {
      setInviteItems([]);
      return;
    }
    const connection = resolvePortalConnection();
    if (!connection) {
      setInviteItems([]);
      return;
    }
    setLoadingInvites(true);
    try {
      const rows = await listAuthInvites(connection);
      setInviteItems(rows);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "load_invites_failed";
      showErrorToast(t("portalSite.invites.loadFailed"), {
        description: message,
      });
    } finally {
      setLoadingInvites(false);
    }
  }, [isSignedIn, t]);

  const handleAcceptInvite = useCallback(
    async (inviteId: string) => {
      const connection = resolvePortalConnection();
      if (!connection) {
        showErrorToast(t("portalSite.invites.connectionMissing"));
        return;
      }
      setInviteActionId(inviteId);
      try {
        await acceptAuthInvite(connection, inviteId);
        showSuccessToast(t("portalSite.invites.accepted"));
        await refreshInvites();
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "accept_invite_failed";
        showErrorToast(t("portalSite.invites.acceptFailed"), {
          description: message,
        });
      } finally {
        setInviteActionId(null);
      }
    },
    [refreshInvites, router, t],
  );

  const handleDeclineInvite = useCallback(
    async (inviteId: string) => {
      const connection = resolvePortalConnection();
      if (!connection) {
        showErrorToast(t("portalSite.invites.connectionMissing"));
        return;
      }
      setInviteActionId(inviteId);
      try {
        await declineAuthInvite(connection, inviteId);
        showSuccessToast(t("portalSite.invites.declined"));
        await refreshInvites();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "decline_invite_failed";
        showErrorToast(t("portalSite.invites.declineFailed"), {
          description: message,
        });
      } finally {
        setInviteActionId(null);
      }
    },
    [refreshInvites, t],
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

  useEffect(() => {
    if (!isSignedIn) {
      setInviteItems([]);
      return;
    }
    void refreshInvites();
    const timer = window.setInterval(() => {
      void refreshInvites();
    }, 45000);
    return () => window.clearInterval(timer);
  }, [isSignedIn, refreshInvites]);

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

  const pendingInviteCount = inviteItems.filter(
    (item) => item.actionable,
  ).length;

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
            <DropdownMenu
              onOpenChange={(open) => open && void refreshInvites()}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={t("shell.topbar.notifications")}
                  title={t("shell.topbar.notifications")}
                  className="relative flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Bell className="h-4 w-4" />
                  {pendingInviteCount > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                      {pendingInviteCount > 9 ? "9+" : pendingInviteCount}
                    </span>
                  ) : null}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-[340px] max-w-[calc(100vw-24px)] border-border bg-popover text-popover-foreground"
              >
                <DropdownMenuLabel className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="text-xs font-semibold text-foreground">
                    {t("portalSite.invites.notificationsTitle")}
                  </span>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t("portalSite.invites.pendingCount", {
                      count: pendingInviteCount,
                    })}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[320px] space-y-1 overflow-y-auto px-2 py-1">
                  {loadingInvites ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      {t("portalSite.admin.loading")}
                    </p>
                  ) : inviteItems.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground">
                      {t("portalSite.invites.empty")}
                    </p>
                  ) : (
                    inviteItems.slice(0, 5).map((invite) => (
                      <div
                        key={invite.id}
                        className="rounded-md border border-border/70 bg-card/40 p-2"
                      >
                        <p className="truncate text-xs font-semibold text-foreground">
                          {invite.workspaceName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t("portalSite.invites.roleLabel", {
                            role: invite.role,
                          })}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t(`portalSite.invites.status.${invite.status}`)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {t("portalSite.invites.expiresAt", {
                            at:
                              formatLocaleDateTime(invite.expiresAt) ??
                              invite.expiresAt,
                          })}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <Button
                            size="sm"
                            className="h-7 text-[11px]"
                            onClick={() => void handleAcceptInvite(invite.id)}
                            disabled={
                              inviteActionId === invite.id || !invite.actionable
                            }
                          >
                            <Check className="h-3.5 w-3.5" />
                            {t("portalSite.invites.accept")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => void handleDeclineInvite(invite.id)}
                            disabled={
                              inviteActionId === invite.id || !invite.actionable
                            }
                          >
                            <X className="h-3.5 w-3.5" />
                            {t("portalSite.invites.decline")}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => router.push("/account/invites")}
                  className={PORTAL_ACCOUNT_ACTION_CLASS}
                >
                  {t("portalSite.invites.viewAll")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
