"use client";

import { Download, LifeBuoy, ShieldCheck, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  MARKETING_CONTENT_WIDTH_CLASS,
  MARKETING_RAIL_WIDTH_CLASS,
} from "@/components/portal/portal-geometry";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const HELP_ITEMS = [
  { key: "download", icon: Download },
  { key: "billing", icon: Sparkles },
  { key: "admin", icon: LifeBuoy },
  { key: "security", icon: ShieldCheck },
] as const;

export default function HelpPage() {
  const { t } = useTranslation();

  return (
    <section
      className={cn(
        "space-y-8 py-16 sm:py-20",
        MARKETING_RAIL_WIDTH_CLASS,
        MARKETING_CONTENT_WIDTH_CLASS,
      )}
    >
      <div className="space-y-3">
        <Badge variant="secondary" className="w-fit">
          {t("portalSite.nav.help")}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("portalSite.help.title")}
        </h1>
        <p className="max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
          {t("portalSite.help.description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {HELP_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.key} className="border-border/70 bg-card/60">
              <CardHeader className="space-y-3 pb-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </span>
                <CardTitle className="text-base">
                  {t(`portalSite.help.items.${item.key}.title`)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-sm leading-7 text-muted-foreground">
                {t(`portalSite.help.items.${item.key}.description`)}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
