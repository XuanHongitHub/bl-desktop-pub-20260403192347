"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
  PORTAL_CONTENT_WIDTH_CLASS,
  PORTAL_RAIL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { useWebsiteShellVariant } from "@/components/website/website-shell-context";
import { cn } from "@/lib/utils";

const FOOTER_LABEL_FALLBACK: Record<string, string> = {
  "portalSite.nav.pricing": "Pricing",
  "portalSite.nav.docs": "Docs",
  "portalSite.nav.status": "Status",
  "portalSite.nav.contact": "Contact",
  "portalSite.nav.signIn": "Sign In",
  "portalSite.nav.help": "Help",
};
const FOOTER_COPYRIGHT_FALLBACK = "© {{year}} BugLogin. All rights reserved.";

export function PortalFooter() {
  const variant = useWebsiteShellVariant();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const renderLabel = (key: string) =>
    mounted ? t(key) : (FOOTER_LABEL_FALLBACK[key] ?? key);
  const currentYear = new Date().getFullYear();
  const copyrightText = mounted
    ? t("portalSite.footer.copyright", { year: currentYear })
    : FOOTER_COPYRIGHT_FALLBACK.replace("{{year}}", String(currentYear));

  const contentWidthClass =
    variant === "marketing"
      ? MARKETING_CONTENT_WIDTH_CLASS
      : PORTAL_CONTENT_WIDTH_CLASS;
  const railWidthClass =
    variant === "marketing"
      ? MARKETING_RAIL_WIDTH_CLASS
      : PORTAL_RAIL_WIDTH_CLASS;

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
          <p>{copyrightText}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/pricing"
              className="transition-colors hover:text-foreground"
            >
              {renderLabel("portalSite.nav.pricing")}
            </Link>
            <Link
              href="/docs"
              className="transition-colors hover:text-foreground"
            >
              {renderLabel("portalSite.nav.docs")}
            </Link>
            <Link
              href="/status"
              className="transition-colors hover:text-foreground"
            >
              {renderLabel("portalSite.nav.status")}
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-foreground"
            >
              {renderLabel("portalSite.nav.contact")}
            </Link>
            <Link
              href="/signin"
              className="transition-colors hover:text-foreground"
            >
              {renderLabel("portalSite.nav.signIn")}
            </Link>
            <Link
              href="/help"
              className="transition-colors hover:text-foreground"
            >
              {renderLabel("portalSite.nav.help")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
