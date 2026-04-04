"use client";

import { Globe, Layers, Rocket, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { LegacyProfileList } from "@/frontend-baseline/components/legacy-profile-list";
import { createBaselineProfiles } from "@/frontend-baseline/data/profile-generator";
import { computeLegacyVisibleRows } from "@/frontend-baseline/hooks/use-profile-workspace";
import { Badge } from "@/frontend-baseline/shadcn/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/frontend-baseline/shadcn/ui/card";

export function BaselineWebView() {
  const { t } = useTranslation();
  const rows = useMemo(() => createBaselineProfiles(50), []);
  const previewRows = useMemo(
    () => computeLegacyVisibleRows(rows, "profile").slice(0, 14),
    [rows],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="rounded-xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t("frontendBaseline.web.badge")}</Badge>
            <Badge variant="outline">
              {t("frontendBaseline.web.badgeShadcn")}
            </Badge>
          </div>
          <h1 className="mt-3 text-xl font-semibold tracking-tight">
            {t("frontendBaseline.web.title")}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            {t("frontendBaseline.web.subtitle")}
          </p>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Layers, title: t("frontendBaseline.web.cards.foundation") },
            {
              icon: Rocket,
              title: t("frontendBaseline.web.cards.readyForScale"),
            },
            {
              icon: ShieldCheck,
              title: t("frontendBaseline.web.cards.stateSafety"),
            },
            {
              icon: Globe,
              title: t("frontendBaseline.web.cards.crossSurface"),
            },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {item.title}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </section>

        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-sm">
              {t("frontendBaseline.web.previewListTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[340px]">
            <LegacyProfileList
              rows={previewRows}
              compact
              emptyLabel={t("frontendBaseline.empty")}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
