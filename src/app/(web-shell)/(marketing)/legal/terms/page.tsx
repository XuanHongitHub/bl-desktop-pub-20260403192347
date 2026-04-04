"use client";

import { useTranslation } from "react-i18next";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function TermsPage() {
  const { t } = useTranslation();

  return (
    <section
      className={cn(
        "space-y-8 py-16 sm:py-20",
        MARKETING_RAIL_WIDTH_CLASS,
        MARKETING_CONTENT_WIDTH_CLASS,
      )}
    >
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("portalSite.legal.terms.title")}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          {t("portalSite.legal.terms.description")}
        </p>
      </header>
      {["1", "2", "3"].map((section) => (
        <Card key={section} className="border-border/70 bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {t(`portalSite.legal.terms.sections.${section}.title`)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm leading-7 text-muted-foreground">
            {t(`portalSite.legal.terms.sections.${section}.body`)}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
