"use client";

import {
  Activity,
  BadgeDollarSign,
  Building2,
  CreditCard,
  FileText,
  Gauge,
  type LucideIcon,
  ReceiptText,
  Settings2,
  User,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons/logo";
import { PORTAL_CONTENT_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { PortalHeaderControls } from "@/components/portal/portal-header-controls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { cn } from "@/lib/utils";

export type PortalSettingsNavItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
};

export const ACCOUNT_SETTINGS_NAV: PortalSettingsNavItem[] = [
  {
    href: "/account",
    labelKey: "portalSite.account.nav.overview",
    icon: UserRound,
  },
  {
    href: "/account/billing",
    labelKey: "portalSite.account.nav.billing",
    icon: CreditCard,
  },
  {
    href: "/account/invoices",
    labelKey: "portalSite.account.nav.invoices",
    icon: ReceiptText,
  },
  {
    href: "/account/settings",
    labelKey: "portalSite.account.nav.settings",
    icon: Settings2,
  },
];

export const ADMIN_SETTINGS_NAV: PortalSettingsNavItem[] = [
  {
    href: "/admin/dashboard",
    labelKey: "portalSite.admin.nav.dashboard",
    icon: Gauge,
  },
  {
    href: "/admin/workspaces",
    labelKey: "portalSite.admin.nav.workspaces",
    icon: Building2,
  },
  {
    href: "/admin/revenue",
    labelKey: "portalSite.admin.nav.revenue",
    icon: BadgeDollarSign,
  },
  {
    href: "/admin/audit-log",
    labelKey: "portalSite.admin.nav.auditLog",
    icon: FileText,
  },
  {
    href: "/admin/system",
    labelKey: "portalSite.admin.nav.system",
    icon: Activity,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/account") return pathname === "/account";
  if (href === "/admin/dashboard")
    return pathname === "/admin" || pathname === "/admin/dashboard" || pathname === "/admin/command-center";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSettingsShell({
  children,
  nav,
  eyebrowKey,
  title,
}: {
  children: ReactNode;
  nav: PortalSettingsNavItem[];
  eyebrowKey: string;
  title: string;
}) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { session, selectedWorkspace } = usePortalBillingData();

  const subtitle = selectedWorkspace?.name || session?.user.email || "BugLogin";

  return (
    <div
      data-portal-shell={title}
      className="grid min-h-screen overflow-hidden bg-background"
      style={{ gridTemplateColumns: "258px minmax(0, 1fr)" }}
    >
      <aside className="app-shell-sidebar app-sidebar-font relative flex h-screen shrink-0 flex-col border-r border-border bg-background text-foreground tracking-normal">
        <div className="shrink-0 border-b border-border">
          <div className="flex h-11 items-center gap-2 px-3">
            <div className="min-w-0 flex-1">
              <span className="flex h-8 w-full items-center rounded-md px-1.5">
                <Logo
                  variant="full"
                  className="h-6 w-auto max-w-[168px] shrink-0 object-contain"
                />
              </span>
            </div>
          </div>
        </div>

        <ScrollArea className="h-screen">
          <div className="flex min-h-screen flex-col px-3 py-3">
            <div className="rounded-lg border border-border/70 bg-card/60 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t(eyebrowKey)}
                  </p>
                  <p className="truncate text-xs font-semibold text-foreground">
                    {subtitle}
                  </p>
                </div>
              </div>
            </div>

            <nav className="mt-3 space-y-0.5">
              {nav.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold leading-[1.25] tracking-normal transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-foreground"
                          : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto border-t border-border pt-3">
              <div className="rounded-md border border-border/70 bg-background/70 p-2.5">
                <p className="text-[10px] font-medium text-muted-foreground">
                  {t("portalSite.account.workspace")}
                </p>
                <p className="mt-1 truncate text-[12px] font-semibold text-foreground">
                  {selectedWorkspace?.name ||
                    session?.user.email ||
                    t("portalSite.account.workspaceEmpty")}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>
      </aside>

      <div className="min-w-0 bg-background">
        <ScrollArea className="h-screen">
          <div className="app-shell-safe-header mb-4 flex min-h-[56px] shrink-0 items-center justify-end gap-2 border-b border-border pb-3">
            <PortalHeaderControls />
          </div>
          <div className="px-6 py-2 lg:px-8 lg:py-4">
            <div className={PORTAL_CONTENT_WIDTH_CLASS}>{children}</div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
