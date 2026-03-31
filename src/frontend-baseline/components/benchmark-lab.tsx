"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, PlayCircle, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  createBaselineProfiles,
  pickPatchTargets,
} from "@/frontend-baseline/data/profile-generator";
import {
  applyLegacyPatchBurst,
  computeLegacyVisibleRows,
  useOptimizedProfileWorkspace,
} from "@/frontend-baseline/hooks/use-profile-workspace";
import type { BaselineProfile, ProfileBenchmarkRow } from "@/frontend-baseline/types/profile";
import { LegacyProfileList } from "@/frontend-baseline/components/legacy-profile-list";
import { OptimizedProfileList } from "@/frontend-baseline/components/optimized-profile-list";
import { Button } from "@/frontend-baseline/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend-baseline/shadcn/ui/card";
import { Input } from "@/frontend-baseline/shadcn/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend-baseline/shadcn/ui/tabs";

const BENCHMARK_SIZES = [50, 500, 2000, 5000] as const;
const SCROLL_WINDOW_MS = 2200;

type BenchmarkMode = "legacy" | "optimized";

declare global {
  interface Window {
    __BUGLOGIN_PHASE_A_RUN_BENCHMARK__?: () => Promise<ProfileBenchmarkRow[]>;
  }
}

function waitFrames(frameCount = 2): Promise<void> {
  return new Promise((resolve) => {
    let framesLeft = frameCount;
    const step = () => {
      framesLeft -= 1;
      if (framesLeft <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function readMemoryMb(): number | null {
  const withMemory = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };
  const bytes = withMemory.memory?.usedJSHeapSize;
  if (!bytes) {
    return null;
  }
  return Number((bytes / 1024 / 1024).toFixed(2));
}

function startLongTaskObserver() {
  let total = 0;
  let observer: PerformanceObserver | null = null;
  if (typeof PerformanceObserver === "undefined") {
    return {
      stop: () => total,
    };
  }
  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        total += entry.duration;
      }
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    observer = null;
  }
  return {
    stop: () => {
      observer?.disconnect();
      return total;
    },
  };
}

async function measureScrollFps(
  viewport: HTMLDivElement | null,
): Promise<{ scrollFps: number; minFps: number }> {
  if (!viewport) {
    return { scrollFps: 0, minFps: 0 };
  }
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  if (maxScrollTop <= 0) {
    return { scrollFps: 0, minFps: 0 };
  }

  return new Promise((resolve) => {
    const frameDeltas: number[] = [];
    let startedAt = 0;
    let lastFrame = 0;

    const step = (now: number) => {
      if (startedAt === 0) {
        startedAt = now;
        lastFrame = now;
      }
      const elapsed = now - startedAt;
      const progress = Math.min(1, elapsed / SCROLL_WINDOW_MS);
      viewport.scrollTop = maxScrollTop * progress;
      frameDeltas.push(now - lastFrame);
      lastFrame = now;

      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }

      if (frameDeltas.length === 0) {
        resolve({ scrollFps: 0, minFps: 0 });
        return;
      }

      const avgDelta =
        frameDeltas.reduce((sum, value) => sum + value, 0) / frameDeltas.length;
      const maxDelta = Math.max(...frameDeltas);
      resolve({
        scrollFps: Number((1000 / Math.max(avgDelta, 1)).toFixed(2)),
        minFps: Number((1000 / Math.max(maxDelta, 1)).toFixed(2)),
      });
    };

    requestAnimationFrame(step);
  });
}

export function BaselineBenchmarkLab() {
  const { t } = useTranslation();
  const [activeMode, setActiveMode] = useState<BenchmarkMode>("legacy");
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<ProfileBenchmarkRow[]>([]);
  const [legacyRows, setLegacyRows] = useState<BaselineProfile[]>(
    createBaselineProfiles(50),
  );
  const [legacySearch, setLegacySearch] = useState("");
  const [legacySize, setLegacySize] = useState(50);

  const [optimizedSize, setOptimizedSize] = useState(50);
  const [optimizedSearch, setOptimizedSearch] = useState("");
  const optimizedWorkspace = useOptimizedProfileWorkspace(optimizedSize);

  const legacyViewportRef = useRef<HTMLDivElement | null>(null);
  const optimizedViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    optimizedWorkspace.reseed(optimizedSize);
    optimizedWorkspace.setSearchQuery("");
    setOptimizedSearch("");
  }, [optimizedSize, optimizedWorkspace.reseed, optimizedWorkspace.setSearchQuery]);

  const legacyVisibleRows = useMemo(
    () => computeLegacyVisibleRows(legacyRows, legacySearch),
    [legacyRows, legacySearch],
  );

  const runSingle = useCallback(
    async (mode: BenchmarkMode, datasetSize: number): Promise<ProfileBenchmarkRow> => {
      const longTasks = startLongTaskObserver();
      const renderStart = performance.now();

      if (mode === "legacy") {
        setActiveMode("legacy");
        setLegacySize(datasetSize);
        setLegacyRows(createBaselineProfiles(datasetSize));
        setLegacySearch("");
      } else {
        setActiveMode("optimized");
        setOptimizedSize(datasetSize);
      }

      await waitFrames(4);
      const renderLatencyMs = performance.now() - renderStart;

      const interactionStart = performance.now();
      const searchKeyword = "profile";
      if (mode === "legacy") {
        setLegacySearch(searchKeyword);
      } else {
        setOptimizedSearch(searchKeyword);
        optimizedWorkspace.setSearchQuery(searchKeyword);
      }
      await waitFrames(3);
      const interactionDelayMs = performance.now() - interactionStart;

      const viewport =
        mode === "legacy" ? legacyViewportRef.current : optimizedViewportRef.current;
      const { scrollFps, minFps } = await measureScrollFps(viewport);

      const patchTargets = pickPatchTargets(datasetSize);
      const patchStart = performance.now();
      if (mode === "legacy") {
        setLegacyRows((previous) => applyLegacyPatchBurst(previous, patchTargets));
      } else {
        optimizedWorkspace.applyPatchBurst();
      }
      await waitFrames(2);
      const patchDuration = performance.now() - patchStart;

      const longTaskMs = longTasks.stop();
      const totalWindow = renderLatencyMs + interactionDelayMs + SCROLL_WINDOW_MS + patchDuration;
      const cpuBusyPercent = Number(
        Math.min(100, (longTaskMs / Math.max(totalWindow, 1)) * 100).toFixed(2),
      );

      return {
        mode,
        datasetSize,
        renderLatencyMs: Number(renderLatencyMs.toFixed(2)),
        interactionDelayMs: Number(interactionDelayMs.toFixed(2)),
        scrollFps,
        minFps,
        cpuBusyPercent,
        longTaskMs: Number(longTaskMs.toFixed(2)),
        memoryMb: readMemoryMb(),
      };
    },
    [optimizedWorkspace],
  );

  const runBenchmarkSuite = useCallback(async () => {
    setIsRunning(true);
    const nextResults: ProfileBenchmarkRow[] = [];
    for (const size of BENCHMARK_SIZES) {
      nextResults.push(await runSingle("legacy", size));
      nextResults.push(await runSingle("optimized", size));
    }
    setResults(nextResults);
    setIsRunning(false);
    return nextResults;
  }, [runSingle]);

  useEffect(() => {
    window.__BUGLOGIN_PHASE_A_RUN_BENCHMARK__ = runBenchmarkSuite;
    return () => {
      delete window.__BUGLOGIN_PHASE_A_RUN_BENCHMARK__;
    };
  }, [runBenchmarkSuite]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4 md:p-6">
      <Card>
        <CardHeader className="gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            {t("frontendBaseline.benchmark.title")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                void runBenchmarkSuite();
              }}
              disabled={isRunning}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              {isRunning
                ? t("frontendBaseline.benchmark.running")
                : t("frontendBaseline.benchmark.run")}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeMode} onValueChange={(value) => setActiveMode(value as BenchmarkMode)}>
        <TabsList>
          <TabsTrigger value="legacy">{t("frontendBaseline.benchmark.legacyTab")}</TabsTrigger>
          <TabsTrigger value="optimized">
            {t("frontendBaseline.benchmark.optimizedTab")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="legacy" className="space-y-3">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle className="text-sm">{t("frontendBaseline.benchmark.legacyTitle")}</CardTitle>
              <div className="flex flex-wrap gap-2">
                {BENCHMARK_SIZES.map((size) => (
                  <Button
                    key={`legacy-${size}`}
                    size="sm"
                    variant={legacySize === size ? "default" : "outline"}
                    onClick={() => {
                      setLegacySize(size);
                      setLegacyRows(createBaselineProfiles(size));
                      setLegacySearch("");
                    }}
                  >
                    {size.toLocaleString()}
                  </Button>
                ))}
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={legacySearch}
                  onChange={(event) => setLegacySearch(event.target.value)}
                  className="pl-8"
                  placeholder={t("frontendBaseline.actions.searchPlaceholder")}
                />
              </div>
            </CardHeader>
            <CardContent className="h-[380px]">
              <LegacyProfileList
                rows={legacyVisibleRows}
                emptyLabel={t("frontendBaseline.empty")}
                viewportDataTestId="legacy-viewport"
                onViewportReady={(viewport) => {
                  legacyViewportRef.current = viewport;
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimized" className="space-y-3">
          <Card>
            <CardHeader className="gap-2">
              <CardTitle className="text-sm">
                {t("frontendBaseline.benchmark.optimizedTitle")}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                {BENCHMARK_SIZES.map((size) => (
                  <Button
                    key={`optimized-${size}`}
                    size="sm"
                    variant={optimizedSize === size ? "default" : "outline"}
                    onClick={() => setOptimizedSize(size)}
                  >
                    {size.toLocaleString()}
                  </Button>
                ))}
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={optimizedSearch}
                  onChange={(event) => {
                    const next = event.target.value;
                    setOptimizedSearch(next);
                    optimizedWorkspace.setSearchQuery(next);
                  }}
                  className="pl-8"
                  placeholder={t("frontendBaseline.actions.searchPlaceholder")}
                />
              </div>
            </CardHeader>
            <CardContent className="h-[380px]">
              <OptimizedProfileList
                visibleIds={optimizedWorkspace.visibleIds}
                profilesById={optimizedWorkspace.state.byId}
                emptyLabel={t("frontendBaseline.empty")}
                viewportDataTestId="optimized-viewport"
                onViewportReady={(viewport) => {
                  optimizedViewportRef.current = viewport;
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("frontendBaseline.benchmark.resultsTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("frontendBaseline.benchmark.noResults")}
            </p>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.mode")}</th>
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.size")}</th>
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.render")}</th>
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.interaction")}</th>
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.scrollFps")}</th>
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.cpu")}</th>
                  <th className="px-2 py-2">{t("frontendBaseline.benchmark.columns.memory")}</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr
                    key={`${row.mode}-${row.datasetSize}`}
                    className="border-b border-border/70 hover:bg-muted/40"
                  >
                    <td className="px-2 py-2">{row.mode}</td>
                    <td className="px-2 py-2">{row.datasetSize.toLocaleString()}</td>
                    <td className="px-2 py-2">{row.renderLatencyMs} ms</td>
                    <td className="px-2 py-2">{row.interactionDelayMs} ms</td>
                    <td className="px-2 py-2">
                      {row.scrollFps} / {row.minFps}
                    </td>
                    <td className="px-2 py-2">
                      {row.cpuBusyPercent}% ({row.longTaskMs} ms)
                    </td>
                    <td className="px-2 py-2">
                      {row.memoryMb === null ? "n/a" : `${row.memoryMb} MB`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
