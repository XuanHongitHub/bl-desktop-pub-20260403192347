"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, LayoutDashboard, LogOut, Menu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Logo } from "@/components/icons/logo";
import { PortalHeaderControls } from "@/components/portal/portal-header-controls";
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
import { cn } from "@/lib/utils";
import {
  MARKETING_RAIL_WIDTH_CLASS,
  PORTAL_HEADER_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { useWebsiteShellVariant } from "@/components/website/website-shell-context";

const MARKETING_NAV_ITEMS = [
  { href: "/", key: "portalSite.nav.home" },
  { href: "/pricing", key: "portalSite.nav.pricing" },
  { href: "/help", key: "portalSite.nav.help" },
] as const;

const PORTAL_NAV_ITEMS = [
  { href: "/", key: "portalSite.nav.home" },
  { href: "/pricing", key: "portalSite.nav.pricing" },
  { href: "/help", key: "portalSite.nav.help" },
] as const;

const DESKTOP_MEDIA_QUERY = "(min-width: 48rem)";

function isActivePath(pathname: string, href: string): boolean {
  const normalizedHref = href.split("#")[0] || "/";
  if (normalizedHref === "/") return pathname === "/";
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
}

export function PortalHeader() {
  const variant = useWebsiteShellVariant();
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const {
    isSignedIn,
    dashboardHref,
    identityLabel,
    identityName,
    identityAvatar,
    signOut,
  } = useWebPortalSession();
  const [scrolled, setScrolled] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncViewport = () => {
      setIsDesktopViewport(mediaQuery.matches);
    };
    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);
  useEffect(() => {
    if (isSignedIn) {
      setSessionReady(true);
      return;
    }

    const timerId = window.setTimeout(() => {
      setSessionReady(true);
    }, 180);

    return () => window.clearTimeout(timerId);
  }, [isSignedIn]);

  useEffect(() => {
    setAvatarLoaded(false);
  }, [identityAvatar]);
  const userInitial = (identityName || identityLabel).trim().charAt(0).toUpperCase() || "B";
  const navItems = variant === "marketing" ? MARKETING_NAV_ITEMS : PORTAL_NAV_ITEMS;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const headerWidthClass =
    variant === "marketing" || isAdminRoute
      ? MARKETING_RAIL_WIDTH_CLASS
      : PORTAL_HEADER_WIDTH_CLASS;

  const handleLogout = async () => {
    await signOut();
    router.replace("/signin");
  };

  return (
    <header
      data-web-variant={variant}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-500 ease-out",
        variant === "marketing"
          ? scrolled
            ? "border-b border-border/70 bg-background shadow-[0_10px_30px_rgba(0,0,0,0.22)] backdrop-blur-[8px]"
            : "border-b border-border/60 bg-background/90 backdrop-blur-[14px]"
          : scrolled
            ? "border-b border-border/70 bg-background shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-[8px]"
            : "border-b border-border/60 bg-background/88 backdrop-blur-[10px]"
      )}
    >
      <div className={cn("h-16", headerWidthClass)}>
        <div className="relative flex h-full items-stretch justify-between">
          <div className="flex min-w-[120px] shrink-0 items-center lg:min-w-[160px]">
            <Link
              href="/"
              aria-label={t("portalSite.nav.home")}
              className="group inline-flex items-center transition-transform duration-300 active:scale-95"
            >
              <Logo
                alt="BugLogin"
                variant="full"
                className="h-9 w-auto max-w-[132px] transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </Link>
          </div>

          <nav
            aria-label="Main"
            className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-stretch justify-center gap-1 md:flex"
          >
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-full items-center px-4 text-[15px] font-medium leading-none tracking-[-0.015em] transition-colors duration-200",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="relative inline-flex items-center leading-none">
                    {t(item.key)}
                  </span>
                  {active && (
                    <span className="absolute inset-x-4 bottom-[7px] h-px bg-foreground/90" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-[120px] shrink-0 items-center justify-end lg:min-w-[160px]">
            {!isDesktopViewport ? (
              <div className="flex items-center gap-2">
                <PortalHeaderControls />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("portalSite.nav.openMenu")}
                      title={t("portalSite.nav.openMenu")}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Menu className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {navItems.map((item) => (
                      <DropdownMenuItem asChild key={item.href}>
                        <Link href={item.href}>{t(item.key)}</Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {isSignedIn ? (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href={dashboardHref}>
                            <LayoutDashboard className="h-4 w-4" />
                            {t("portalSite.nav.dashboard")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/account/billing">
                            <CreditCard className="h-4 w-4" />
                            {t("portalSite.nav.billing")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void handleLogout()}>
                          <LogOut className="h-4 w-4" />
                          {t("portalSite.nav.signOut")}
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <DropdownMenuItem asChild>
                        <Link href="/signin">{t("portalSite.nav.signIn")}</Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : null}

            {isDesktopViewport ? (
              <div className="flex items-center gap-3">
                <PortalHeaderControls />
                <div className="flex w-[148px] items-center justify-end">
                  {!sessionReady ? (
                    <span
                      aria-hidden="true"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background"
                    />
                  ) : isSignedIn ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("shell.topbar.userMenu")}
                          className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted/70"
                        >
                          <span
                            className={cn(
                              "transition-opacity duration-200",
                              identityAvatar && avatarLoaded ? "opacity-0" : "opacity-100",
                            )}
                          >
                            {userInitial}
                          </span>
                          {identityAvatar ? (
                            <img
                              src={identityAvatar}
                              alt={identityLabel}
                              className={cn(
                                "absolute inset-0 h-full w-full object-cover transition-opacity duration-200",
                                avatarLoaded ? "opacity-100" : "opacity-0",
                              )}
                              referrerPolicy="no-referrer"
                              onLoad={() => setAvatarLoaded(true)}
                              onError={() => setAvatarLoaded(false)}
                            />
                          ) : null}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[248px] border-border bg-popover text-popover-foreground"
                      >
                        <DropdownMenuLabel className="space-y-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {identityName}
                          </p>
                          <p className="truncate text-xs font-medium text-muted-foreground">
                            {identityLabel}
                          </p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-muted focus:text-foreground"
                        >
                          <Link href={dashboardHref}>
                            <LayoutDashboard className="h-4 w-4" />
                            {t("portalSite.nav.dashboard")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="focus:bg-muted focus:text-foreground"
                        >
                          <Link href="/account/billing">
                            <CreditCard className="h-4 w-4" />
                            {t("portalSite.nav.billing")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void handleLogout()}
                          className="focus:bg-muted focus:text-foreground"
                        >
                          <LogOut className="h-4 w-4" />
                          {t("portalSite.nav.signOut")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Button
                      asChild
                      className="h-8 rounded-md bg-foreground px-4 text-[14px] font-medium leading-none tracking-[-0.015em] text-background transition-colors hover:opacity-90"
                    >
                      <Link href="/signin">{t("portalSite.nav.signIn")}</Link>
                    </Button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
