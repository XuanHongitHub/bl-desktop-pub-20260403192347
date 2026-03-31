"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Gauge,
  LayoutPanelLeft,
  PlayCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  SquareTerminal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOptimizedProfileWorkspace } from "@/frontend-baseline/hooks/use-profile-workspace";
import { Button } from "@/frontend-baseline/shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/frontend-baseline/shadcn/ui/card";
import { Input } from "@/frontend-baseline/shadcn/ui/input";
import { Badge } from "@/frontend-baseline/shadcn/ui/badge";
import { OptimizedProfileList } from "@/frontend-baseline/components/optimized-profile-list";
import type { BaselineProfile } from "@/frontend-baseline/types/profile";

const DATASET_OPTIONS = [50, 500, 2000, 5000] as const;

function countByStatus(profilesById: Map<string, BaselineProfile>) {
  let running = 0;
  let syncing = 0;
  let stopped = 0;
  let locked = 0;

  for (const profile of profilesById.values()) {
    switch (profile.status) {
      case "running":
        running += 1;
        break;
      case "syncing":
        syncing += 1;
        break;
      case "stopped":
        stopped += 1;
        break;
      case "locked":
        locked += 1;
        break;
      default:
        break;
    }
  }

  return { running, syncing, stopped, locked };
}

export function BaselineDesktopView() {
  const { t } = useTranslation();
  const [datasetSize, setDatasetSize] = useState<number>(2000);
  const [searchValue, setSearchValue] = useState("");
  const { state, visibleIds, setSearchQuery, reseed, applyPatchBurst } =
    useOptimizedProfileWorkspace(datasetSize);

  useEffect(() => {
    reseed(datasetSize);
  }, [datasetSize, reseed]);

  const statusMetrics = useMemo(() => countByStatus(state.byId), [state.byId]);

  return (
    <div className="flex h-[calc(100vh-var(--window-titlebar-height,0px))] min-h-0 w-full overflow-hidden bg-background text-foreground">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-card/70 p-3 md:flex md:flex-col">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <SquareTerminal className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-foreground">
            {t("frontendBaseline.desktop.shell")}
          </span>
        </div>
        <div className="mt-3 space-y-1">
          {[
            { icon: LayoutPanelLeft, key: "frontendBaseline.desktop.navProfiles" },
            { icon: PlayCircle, key: "frontendBaseline.desktop.navAutomation" },
            { icon: ShieldCheck, key: "frontendBaseline.desktop.navSync" },
            { icon: Gauge, key: "frontendBaseline.desktop.navMonitoring" },
          ].map((entry) => (
            <button
              key={entry.key}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <entry.icon className="h-3.5 w-3.5" />
              <span>{t(entry.key)}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold">
              {t("frontendBaseline.desktop.title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("frontendBaseline.desktop.subtitle")}
            </p>
          </div>
          <Badge variant="secondary">{t("frontendBaseline.desktop.badgePhaseA")}</Badge>
          <Button variant="outline" size="sm" onClick={applyPatchBurst}>
            <RefreshCcw className="h-3.5 w-3.5" />
            {t("frontendBaseline.actions.patchBurst")}
          </Button>
        </header>

        <section className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("frontendBaseline.metrics.totalProfiles")}</CardDescription>
              <CardTitle>{state.order.length.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("frontendBaseline.status.running")}</CardDescription>
              <CardTitle>{statusMetrics.running.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("frontendBaseline.status.syncing")}</CardDescription>
              <CardTitle>{statusMetrics.syncing.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>{t("frontendBaseline.metrics.visibleRows")}</CardDescription>
              <CardTitle>{visibleIds.length.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
        </section>

        <section className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
          <Card className="min-h-0 flex-1">
            <CardHeader className="gap-3 pb-3">
              <div className="flex flex-wrap items-center gap-2">
                {DATASET_OPTIONS.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={datasetSize === size ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setDatasetSize(size);
                      setSearchValue("");
                      setSearchQuery("");
                    }}
                  >
                    {size.toLocaleString()}
                  </Button>
                ))}
              </div>
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSearchValue(next);
                    setSearchQuery(next);
                  }}
                  className="pl-8"
                  placeholder={t("frontendBaseline.actions.searchPlaceholder")}
                />
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pt-0">
              <OptimizedProfileList
                visibleIds={visibleIds}
                profilesById={state.byId}
                emptyLabel={t("frontendBaseline.empty")}
              />
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
