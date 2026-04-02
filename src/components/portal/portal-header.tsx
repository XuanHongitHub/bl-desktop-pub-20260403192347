"use client";

import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons/logo";
import {
  MARKETING_RAIL_WIDTH_CLASS,
  PORTAL_HEADER_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useWebsiteShellVariant } from "@/components/website/website-shell-context";
import { useWebPortalSession } from "@/hooks/use-web-portal-session";
import { cn } from "@/lib/utils";

const MARKETING_NAV_ITEMS = [
  { href: "/", key: "portalSite.nav.home" },
  { href: "/pricing", key: "portalSite.nav.pricing" },
  { href: "/docs", key: "portalSite.nav.docs" },
  { href: "/download", key: "portalSite.nav.download" },
  { href: "/status", key: "portalSite.nav.status" },
  { href: "/contact", key: "portalSite.nav.contact" },
] as const;
const PORTAL_ACCOUNT_TITLE_CLASS =
  "truncate text-xs leading-[1.25] font-semibold text-foreground";
const PORTAL_ACCOUNT_META_CLASS =
  "truncate text-[11px] leading-[1.25] font-medium text-muted-foreground";
const PORTAL_ACCOUNT_ACTION_CLASS =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs leading-[1.2] font-semibold [&_svg:not([class*='size-'])]:size-4";
const NAV_LABEL_FALLBACK: Record<string, string> = {
  "portalSite.nav.home": "Home",
  "portalSite.nav.product": "Product",
  "portalSite.nav.teams": "Solutions",
  "portalSite.nav.resources": "Resources",
  "portalSite.nav.support": "Security",
  "portalSite.nav.pricing": "Pricing",
  "portalSite.nav.docs": "Docs",
  "portalSite.nav.status": "Status",
  "portalSite.nav.contact": "Contact",
  "portalSite.nav.dashboard": "Dashboard",
  "portalSite.nav.account": "Account",
  "portalSite.nav.admin": "Admin",
  "portalSite.nav.signUp": "Get Started",
  "portalSite.nav.billing": "Billing",
  "portalSite.nav.signIn": "Sign In",
  "portalSite.nav.signOut": "Sign Out",
};

function isActivePath(pathname: string, href: string): boolean {
  const normalizedHref = href.split("#")[0] || "/";
  if (normalizedHref === "/") return pathname === "/";
  return (
    pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`)
  );
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
    platformRole,
    signOut,
  } = useWebPortalSession();
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    setSessionReady(true);
  }, []);

  useEffect(() => {
    if (!identityAvatar) {
      setAvatarLoaded(true);
      return;
    }
    setAvatarLoaded(false);
  }, [identityAvatar]);
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize, { passive: true });
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const userInitial =
    (identityName || identityLabel).trim().charAt(0).toUpperCase() || "B";
  const signedNavItems = [
    { href: dashboardHref, key: "portalSite.nav.dashboard" },
    { href: "/account", key: "portalSite.nav.account" },
    { href: "/pricing", key: "portalSite.nav.pricing" },
    ...(platformRole === "platform_admin"
      ? [{ href: "/admin/dashboard", key: "portalSite.nav.admin" }]
      : []),
  ] as const;
  const navItems =
    variant === "marketing" ? MARKETING_NAV_ITEMS : signedNavItems;
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const headerWidthClass =
    variant === "marketing" || isAdminRoute
      ? MARKETING_RAIL_WIDTH_CLASS
      : PORTAL_HEADER_WIDTH_CLASS;

  const handleLogout = async () => {
    await signOut();
    router.replace("/signin");
  };
  const renderNavLabel = (key: string) =>
    mounted ? t(key) : (NAV_LABEL_FALLBACK[key] ?? key);
  const canRenderSignedSession = mounted && sessionReady && isSignedIn;
  const homeAriaLabel = mounted
    ? t("portalSite.nav.home")
    : NAV_LABEL_FALLBACK["portalSite.nav.home"];
  const menuAriaLabel = mounted ? t("portalSite.nav.openMenu") : "Open menu";

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
            : "border-b border-border/60 bg-background/88 backdrop-blur-[10px]",
      )}
    >
      <div className={cn("h-16", headerWidthClass)}>
        <div className="flex h-full items-center gap-3 lg:gap-5">
          <div className="flex min-w-[120px] shrink-0 items-center">
            <Link
              href="/"
              aria-label={homeAriaLabel}
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
            className="hidden h-full min-w-0 flex-1 items-stretch justify-center gap-0.5 lg:flex"
          >
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative inline-flex h-full self-stretch items-center px-2.5 text-[14px] font-medium leading-none tracking-[-0.015em] no-underline transition-colors duration-200 xl:px-4 xl:text-[15px]",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="relative inline-flex items-center leading-none whitespace-nowrap">
                    {renderNavLabel(item.key)}
                  </span>
                  {active && (
                    <span className="pointer-events-none absolute inset-x-4 bottom-2 h-px bg-foreground/90" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-[120px] shrink-0 items-center justify-end lg:min-w-[180px]">
            <div className="flex items-center gap-2 lg:hidden">
              {mounted ? (
                <PortalHeaderControls showAccount={false} />
              ) : (
                <div className="h-8 min-w-[92px]" />
              )}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label={menuAriaLabel}
                    title={menuAriaLabel}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Menu className="h-4 w-4" />
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="right"
                  className="w-[min(86vw,320px)] border-border bg-background p-0 text-foreground"
                >
                  <div className="flex h-full flex-col">
                    <div className="border-b border-border/70 px-4 py-3">
                      <SheetTitle className="text-sm font-semibold">
                        {menuAriaLabel}
                      </SheetTitle>
                    </div>

                    <nav className="space-y-1 px-2 py-2">
                      {navItems.map((item) => (
                        <SheetClose asChild key={item.href}>
                          <Link
                            href={item.href}
                            className="flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                          >
                            {renderNavLabel(item.key)}
                          </Link>
                        </SheetClose>
                      ))}
                    </nav>

                    <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/70 px-2 py-2">
                      {canRenderSignedSession ? (
                        <>
                          <div className="space-y-0.5 px-3 py-2">
                            <p className={PORTAL_ACCOUNT_TITLE_CLASS}>
                              {identityName}
                            </p>
                            <p className={PORTAL_ACCOUNT_META_CLASS}>
                              {identityLabel}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <SheetClose asChild>
                              <Link
                                href={dashboardHref}
                                className={PORTAL_ACCOUNT_ACTION_CLASS}
                              >
                                <LayoutDashboard className="h-4 w-4" />
                                {renderNavLabel("portalSite.nav.dashboard")}
                              </Link>
                            </SheetClose>
                            <SheetClose asChild>
                              <Link
                                href="/account/billing"
                                className={PORTAL_ACCOUNT_ACTION_CLASS}
                              >
                                <CreditCard className="h-4 w-4" />
                                {renderNavLabel("portalSite.nav.billing")}
                              </Link>
                            </SheetClose>
                            <SheetClose asChild>
                              <Link
                                href="/account/invoices"
                                className={PORTAL_ACCOUNT_ACTION_CLASS}
                              >
                                <ReceiptText className="h-4 w-4" />
                                {t("portalSite.account.nav.invoices")}
                              </Link>
                            </SheetClose>
                            <SheetClose asChild>
                              <Link
                                href="/account/settings"
                                className={PORTAL_ACCOUNT_ACTION_CLASS}
                              >
                                <Settings className="h-4 w-4" />
                                {t("portalSite.account.nav.settings")}
                              </Link>
                            </SheetClose>
                            {platformRole === "platform_admin" ? (
                              <SheetClose asChild>
                                <Link
                                  href="/admin/dashboard"
                                  className={PORTAL_ACCOUNT_ACTION_CLASS}
                                >
                                  <Shield className="h-4 w-4" />
                                  {renderNavLabel("portalSite.nav.admin")}
                                </Link>
                              </SheetClose>
                            ) : null}
                            <SheetClose asChild>
                              <button
                                type="button"
                                onClick={() => void handleLogout()}
                                className={cn(
                                  PORTAL_ACCOUNT_ACTION_CLASS,
                                  "text-left",
                                )}
                              >
                                <LogOut className="h-4 w-4" />
                                {renderNavLabel("portalSite.nav.signOut")}
                              </button>
                            </SheetClose>
                          </div>
                        </>
                      ) : (
                        <SheetClose asChild>
                          <Link
                            href="/signin"
                            className="flex rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
                          >
                            {renderNavLabel("portalSite.nav.signIn")}
                          </Link>
                        </SheetClose>
                      )}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              {mounted ? (
                <PortalHeaderControls showAccount={false} />
              ) : (
                <div className="h-8 min-w-[92px]" />
              )}
              <div className="flex items-center justify-end">
                {!mounted || !sessionReady ? (
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
                        className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-border/70 bg-background text-[11px] font-semibold text-foreground transition-colors hover:bg-muted/70"
                      >
                        <span
                          className={cn(
                            "transition-opacity duration-200",
                            identityAvatar && avatarLoaded
                              ? "opacity-0"
                              : "opacity-100",
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
                      sideOffset={8}
                      className="w-[224px] max-w-[calc(100vw-20px)] border-border bg-popover text-popover-foreground"
                    >
                      <DropdownMenuLabel className="space-y-0.5 px-3 pt-2 pb-1.5">
                        <p className={PORTAL_ACCOUNT_TITLE_CLASS}>
                          {identityName}
                        </p>
                        <p className={PORTAL_ACCOUNT_META_CLASS}>
                          {identityLabel}
                        </p>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        asChild
                        className={PORTAL_ACCOUNT_ACTION_CLASS}
                      >
                        <Link href={dashboardHref}>
                          <LayoutDashboard className="h-4 w-4" />
                          {t("portalSite.nav.dashboard")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className={PORTAL_ACCOUNT_ACTION_CLASS}
                      >
                        <Link href="/account/billing">
                          <CreditCard className="h-4 w-4" />
                          {t("portalSite.nav.billing")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className={PORTAL_ACCOUNT_ACTION_CLASS}
                      >
                        <Link href="/account/invoices">
                          <ReceiptText className="h-4 w-4" />
                          {t("portalSite.account.nav.invoices")}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        asChild
                        className={PORTAL_ACCOUNT_ACTION_CLASS}
                      >
                        <Link href="/account/settings">
                          <Settings className="h-4 w-4" />
                          {t("portalSite.account.nav.settings")}
                        </Link>
                      </DropdownMenuItem>
                      {platformRole === "platform_admin" ? (
                        <DropdownMenuItem
                          asChild
                          className={PORTAL_ACCOUNT_ACTION_CLASS}
                        >
                          <Link href="/admin/dashboard">
                            <Shield className="h-4 w-4" />
                            {t("portalSite.nav.admin")}
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => void handleLogout()}
                        className={PORTAL_ACCOUNT_ACTION_CLASS}
                      >
                        <LogOut className="h-4 w-4" />
                        {t("portalSite.nav.signOut")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    asChild
                    variant="outline"
                    className="h-8 rounded-md px-3 text-[13px] font-medium leading-none tracking-[-0.015em]"
                  >
                    <Link href="/signin">{t("portalSite.nav.signIn")}</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
