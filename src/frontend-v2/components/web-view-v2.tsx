"use client";

import { ArrowRight, Cpu, Layers, Orbit, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/frontend-baseline/shadcn/ui/badge";
import { Button } from "@/frontend-baseline/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend-baseline/shadcn/ui/card";

export function WebViewV2() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
        <header className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-muted/30" />
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{t("frontendV2.web.badge")}</Badge>
              <Badge variant="outline">{t("frontendV2.web.badgeRealtime")}</Badge>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{t("frontendV2.web.title")}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t("frontendV2.web.subtitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href="/app-v2">
                  {t("frontendV2.web.openApp")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href="/app-baseline-benchmark">{t("frontendV2.web.openBenchmark")}</a>
              </Button>
            </div>
          </div>
        </header>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: Layers, key: "frontendV2.web.cards.isolation" },
            { icon: Orbit, key: "frontendV2.web.cards.realtime" },
            { icon: Zap, key: "frontendV2.web.cards.incremental" },
            { icon: Cpu, key: "frontendV2.web.cards.windowing" },
          ].map((item) => (
            <Card key={item.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  {t(item.key)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                {t(`${item.key}Body`)}
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
