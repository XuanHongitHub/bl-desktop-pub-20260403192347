"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin/dashboard", key: "portalSite.admin.nav.dashboard" },
  { href: "/admin/workspaces", key: "portalSite.admin.nav.workspaces" },
  { href: "/admin/revenue", key: "portalSite.admin.nav.revenue" },
  { href: "/admin/audit", key: "portalSite.admin.nav.audit" },
  { href: "/admin/system", key: "portalSite.admin.nav.system" },
] as const;

function isAdminActive(pathname: string, href: string): boolean {
  if (href === "/admin/dashboard") {
    return pathname === "/admin" || pathname === href || pathname === "/admin/command-center";
  }
  return pathname === href;
}

export function PortalAdminNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div className="mb-7 overflow-x-auto border-b border-border/70 pb-4">
      <div className="inline-flex min-w-full gap-2 sm:min-w-0">
        {ADMIN_NAV.map((item) => {
          const active = isAdminActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
