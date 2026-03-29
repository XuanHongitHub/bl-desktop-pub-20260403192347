"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { PortalPageFrame } from "@/components/portal/portal-page-frame";
import { Button } from "@/components/ui/button";

const HELP_ITEMS = ["download", "billing", "admin", "security"] as const;

export default function HelpPage() {
  const { t } = useTranslation();

  return (
    <PortalPageFrame
      title={t("portalSite.help.title")}
      description={t("portalSite.help.description")}
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {HELP_ITEMS.map((key) => (
            <article key={key} className="rounded-xl border border-border/70 bg-background/70 p-4">
              <h2 className="text-base font-semibold text-foreground">
                {t(`portalSite.help.items.${key}.title`)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`portalSite.help.items.${key}.description`)}
              </p>
            </article>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/signin">{t("portalSite.nav.signIn")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">{t("portalSite.nav.pricing")}</Link>
          </Button>
        </div>
      </div>
    </PortalPageFrame>
  );
}
