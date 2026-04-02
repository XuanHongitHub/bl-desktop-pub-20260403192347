"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BadgeDollarSign,
  Building2,
  Gauge,
  ReceiptText,
  Shield,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  {
    href: "/admin/dashboard",
    key: "portalSite.admin.nav.dashboard",
    icon: Gauge,
  },
  {
    href: "/admin/workspaces",
    key: "portalSite.admin.nav.workspaces",
    icon: Building2,
  },
  {
    href: "/admin/revenue",
    key: "portalSite.admin.nav.revenue",
    icon: BadgeDollarSign,
  },
  {
    href: "/admin/audit",
    key: "portalSite.admin.nav.audit",
    icon: ReceiptText,
  },
  {
    href: "/admin/system",
    key: "portalSite.admin.nav.system",
    icon: Activity,
  },
] as const;

function isAdminActive(pathname: string, href: string): boolean {
  if (href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === href || pathname === "/admin/command-center";
  }
  return pathname === href;
}

export function PortalAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div
      className="grid min-h-screen gap-0 overflow-hidden bg-card/60"
      style={{ gridTemplateColumns: "248px minmax(0, 1fr)" }}
    >
      <aside className="border-r border-border/70 bg-background/75">
        <ScrollArea className="h-full">
          <div className="space-y-6 p-4 lg:p-5">
            <div className="space-y-2 border-b border-border/70 pb-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-muted/40">
                <Shield className="h-4 w-4 text-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("portalSite.admin.eyebrow")}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  BugLogin Control Plane
                </p>
              </div>
            </div>

            <nav className="space-y-1.5">
              {ADMIN_NAV.map((item) => {
                const active = isAdminActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t(item.key)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </ScrollArea>
      </aside>

      <div className="min-w-0 bg-background/30">
        <ScrollArea className="h-full">
          <div className="px-5 py-5 lg:px-8 lg:py-8">{children}</div>
        </ScrollArea>
      </div>
    </div>
  );
}
