"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
  PORTAL_CONTENT_WIDTH_CLASS,
  PORTAL_RAIL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { useWebsiteShellVariant } from "@/components/website/website-shell-context";
import { cn } from "@/lib/utils";

export function PortalFooter() {
  const variant = useWebsiteShellVariant();
  const { t } = useTranslation();
  const contentWidthClass =
    variant === "marketing" ? MARKETING_CONTENT_WIDTH_CLASS : PORTAL_CONTENT_WIDTH_CLASS;
  const railWidthClass =
    variant === "marketing" ? MARKETING_RAIL_WIDTH_CLASS : PORTAL_RAIL_WIDTH_CLASS;

  return (
    <footer
      data-web-variant={variant}
      className="border-t border-border/70 bg-background/86"
    >
      <div
        className={cn(
          variant === "marketing" ? "py-7" : "py-6",
          railWidthClass,
        )}
      >
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-4 border-t border-border/70 pt-5 text-sm text-muted-foreground",
            contentWidthClass,
          )}
        >
          <p>© {new Date().getFullYear()} BugLogin. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              {t("portalSite.nav.pricing")}
            </Link>
            <Link
              href="/signin"
              className="transition-colors hover:text-foreground"
            >
              {t("portalSite.nav.signIn")}
            </Link>
            <Link
              href="/help"
              className="transition-colors hover:text-foreground"
            >
              {t("portalSite.nav.help")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
