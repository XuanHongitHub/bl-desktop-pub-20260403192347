"use client";

import { ArrowRight, MoreHorizontal, MousePointer2, Play } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MARKETING_RAIL_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import styles from "./framer-hero-section.module.css";

type PreviewRow = {
  id: string;
  name: string;
  status: "stopped" | "running";
  lastLaunch: string;
  proxy: string;
};

type CursorScene = {
  x: number;
  y: number;
  click: boolean;
  focusId: string;
};

type CursorPosition = {
  x: number;
  y: number;
};

export function FramerHeroSection() {
  const { t } = useTranslation();
  const [sceneIndex, setSceneIndex] = useState(0);
  const [pulseTick, setPulseTick] = useState(0);
  const [cursorPosition, setCursorPosition] = useState<CursorPosition>({
    x: 24,
    y: 50,
  });
  const [cursorTarget, setCursorTarget] = useState<CursorPosition>({
    x: 24,
    y: 50,
  });
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  const rows = useMemo<PreviewRow[]>(
    () => [
      {
        id: "r-01",
        name: "BugIdeaSync A-02",
        status: "stopped",
        lastLaunch: "1 hour ago",
        proxy: "Not Selected",
      },
      {
        id: "r-02",
        name: "BugIdeaSync A-03",
        status: "stopped",
        lastLaunch: "1 hour ago",
        proxy: "Not Selected",
      },
      {
        id: "r-03",
        name: "BugIdeaSync B-01",
        status: "stopped",
        lastLaunch: "3 days ago",
        proxy: "Not Selected",
      },
      {
        id: "r-04",
        name: "BugIdeaSync B-02",
        status: "stopped",
        lastLaunch: "5 days ago",
        proxy: "Not Selected",
      },
      {
        id: "r-05",
        name: "BugIdeaSync C-01",
        status: "stopped",
        lastLaunch: "3 days ago",
        proxy: "Not Selected",
      },
    ],
    [],
  );

  const scenes = useMemo<CursorScene[]>(
    () => [
      { x: 20, y: 41, click: true, focusId: "search" },
      { x: 22, y: 55, click: false, focusId: "group-all" },
      { x: 34, y: 67, click: true, focusId: "launch-r-01" },
      { x: 93, y: 67, click: false, focusId: "menu-r-01" },
      { x: 34, y: 74, click: true, focusId: "launch-r-02" },
      { x: 93, y: 74, click: false, focusId: "menu-r-02" },
    ],
    [],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSceneIndex((current) => {
        const next = (current + 1) % scenes.length;
        setPulseTick((v) => v + 1);
        return next;
      });
    }, 2100);

    return () => window.clearInterval(interval);
  }, [scenes]);

  const activeScene = scenes[sceneIndex] ?? scenes[0];

  useEffect(() => {
    const syncCursorToTarget = () => {
      const surface = surfaceRef.current;
      if (!surface) return;
      const target = surface.querySelector<HTMLElement>(
        `[data-focus-id="${activeScene.focusId}"]`,
      );
      if (!target) {
        setCursorTarget({ x: activeScene.x, y: activeScene.y });
        return;
      }

      const surfaceRect = surface.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      if (surfaceRect.width <= 0 || surfaceRect.height <= 0) return;

      const anchorX = targetRect.left + targetRect.width * 0.5;
      const anchorY = targetRect.top + targetRect.height * 0.5;
      const x = ((anchorX - surfaceRect.left) / surfaceRect.width) * 100;
      const y = ((anchorY - surfaceRect.top) / surfaceRect.height) * 100;
      setCursorTarget({
        x: Math.max(4, Math.min(97, x)),
        y: Math.max(8, Math.min(94, y)),
      });
    };

    const timer = window.setTimeout(syncCursorToTarget, 80);
    window.addEventListener("resize", syncCursorToTarget);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", syncCursorToTarget);
    };
  }, [activeScene.focusId, activeScene.x, activeScene.y]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      setCursorPosition((current) => {
        const nextX = current.x + (cursorTarget.x - current.x) * 0.18;
        const nextY = current.y + (cursorTarget.y - current.y) * 0.18;
        return { x: nextX, y: nextY };
      });
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [cursorTarget.x, cursorTarget.y]);

  return (
    <section
      className={cn(
        styles.section,
        "relative isolate bg-background text-foreground",
      )}
    >
      <div
        className={cn(
          styles.glowTop,
          "pointer-events-none absolute inset-x-0 top-0 h-80",
        )}
      />
      <div
        className={cn(
          styles.glowBottom,
          "pointer-events-none absolute inset-x-0 bottom-0 h-64",
        )}
      />

      <header
        className={cn(
          "relative z-10 px-0 pb-8 pt-10 lg:pt-14",
          MARKETING_RAIL_WIDTH_CLASS,
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full flex-col items-center text-center",
          )}
        >
          <div className="mt-8 space-y-4">
            <h1 className="text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground sm:text-5xl lg:text-7xl">
              <span suppressHydrationWarning>
                {t("portalSite.home.linearTitleLine1")}
              </span>
              <br />
              <span suppressHydrationWarning>
                {t("portalSite.home.linearTitleLine2")}
              </span>
            </h1>
            <p className="mx-auto max-w-xl text-pretty text-base leading-7 text-muted-foreground">
              <span suppressHydrationWarning>
                {t("portalSite.home.linearSubtitle")}
              </span>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="h-12 rounded-full px-6 text-[15px] font-semibold tracking-[-0.02em]"
            >
              <Link href="/signup">
                <span suppressHydrationWarning>
                  {t("portalSite.home.primaryCta")}
                </span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 rounded-full border-border/70 bg-card/70 px-6 text-[15px] font-semibold tracking-[-0.02em] text-foreground hover:bg-muted/70 hover:text-foreground"
            >
              <Link href="#workspace-demo">
                <span suppressHydrationWarning>
                  {t("portalSite.home.secondaryCta")}
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div
        id="workspace-demo"
        className={cn("relative z-10 px-0 pb-10", MARKETING_RAIL_WIDTH_CLASS)}
      >
        <div className="mx-auto w-full">
          <div
            ref={surfaceRef}
            className="relative hidden overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-md backdrop-blur sm:block"
          >
            <div className="border-b border-border/70 bg-background/80 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-chart-4/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-chart-2/80" />
                </div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  BugLogin Desktop · Profiles
                </p>
                <div className="w-12" />
              </div>
              <div className="mt-2 h-7 rounded-md border border-border/70 bg-muted/30 px-2 text-[10px] leading-7 text-muted-foreground">
                Workspace: CUSTOM · 56 / 2000 profiles
              </div>
            </div>

            <div className="grid min-h-[420px] grid-cols-12">
              <aside className="col-span-3 border-r border-border/70 bg-background/60 p-3">
                <p className="mb-2 text-[10px] uppercase text-muted-foreground">
                  Platform
                </p>
                <div className="space-y-1 text-xs">
                  <div className="rounded-md bg-muted/70 px-2 py-1.5 font-medium text-foreground">
                    Profiles
                  </div>
                  <div className="rounded-md px-2 py-1.5 text-muted-foreground">
                    Automation
                  </div>
                  <div className="rounded-md px-2 py-1.5 text-muted-foreground">
                    Proxy Center
                  </div>
                  <div className="rounded-md px-2 py-1.5 text-muted-foreground">
                    Integrations
                  </div>
                </div>
              </aside>

              <main className="col-span-9 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-lg font-semibold text-foreground">
                    Profiles
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                    <Button className="h-7 rounded-md px-2 text-[11px] font-medium sm:px-3">
                      <span className="sm:hidden">Create</span>
                      <span className="hidden sm:inline">
                        Create a new profile
                      </span>
                    </Button>
                  </div>
                </div>

                <div
                  data-focus-id="search"
                  className="mb-3 flex h-8 items-center rounded-md border border-border/70 bg-background px-2 text-[11px] text-muted-foreground"
                >
                  Search profiles...
                </div>

                <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 text-[11px]">
                  <div
                    data-focus-id="group-all"
                    className="shrink-0 rounded-md border border-border/70 bg-muted/40 px-2 py-1"
                  >
                    All · 56
                  </div>
                  <div className="shrink-0 rounded-md border border-border/70 bg-background px-2 py-1 text-muted-foreground">
                    Demo-Bug... · 52
                  </div>
                  <div className="shrink-0 rounded-md border border-border/70 bg-background px-2 py-1 text-muted-foreground">
                    Nguyen Xu... · 0
                  </div>
                </div>

                <div className="overflow-hidden rounded-md border border-border/70 bg-background">
                  <div className="grid grid-cols-12 border-b border-border/70 px-2 py-1.5 text-[10px] font-medium text-muted-foreground">
                    <p className="col-span-1"> </p>
                    <p className="col-span-2">Actions</p>
                    <p className="col-span-2">Status</p>
                    <p className="col-span-3">Name</p>
                    <p className="col-span-2">Last Launch</p>
                    <p className="col-span-2">Proxy</p>
                  </div>

                  {rows.map((row, idx) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-12 items-center border-b border-border/60 px-2 py-1.5 text-[11px] last:border-b-0"
                    >
                      <div className="col-span-1">
                        <div className="h-3.5 w-3.5 rounded border border-border" />
                      </div>
                      <div className="col-span-2">
                        <Button
                          data-focus-id={`launch-${row.id}`}
                          size="sm"
                          className={cn(
                            "h-6 rounded-md px-2 text-[10px]",
                            idx <= 1
                              ? "bg-foreground text-background hover:bg-foreground/90"
                              : "bg-muted text-foreground hover:bg-muted/80",
                            idx === 0 &&
                              pulseTick % 2 === 0 &&
                              "ring-1 ring-primary/50",
                          )}
                        >
                          <Play className="mr-1 h-3 w-3" />
                          Launch
                        </Button>
                      </div>
                      <div className="col-span-2">
                        <Badge
                          variant="outline"
                          className="h-5 rounded-full px-2 text-[10px] text-muted-foreground"
                        >
                          Stopped
                        </Badge>
                      </div>
                      <div className="col-span-3 truncate text-foreground">
                        {row.name}
                      </div>
                      <div className="col-span-2 text-muted-foreground">
                        {row.lastLaunch}
                      </div>
                      <div className="col-span-1 truncate text-muted-foreground">
                        {row.proxy}
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          data-focus-id={`menu-${row.id}`}
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </main>
            </div>

            <div className="pointer-events-none absolute inset-0 hidden sm:block">
              <div
                className="absolute z-20 transition-transform duration-100 ease-linear"
                style={{
                  left: `${cursorPosition.x}%`,
                  top: `${cursorPosition.y}%`,
                  transform: "translate(-38%, -18%) rotate(-6deg)",
                }}
              >
                <span className="absolute -left-0.5 -top-0.5 h-5 w-5 rounded-full bg-primary/10 blur-[2px]" />
                <MousePointer2 className="relative h-5 w-5 fill-current text-foreground drop-shadow-sm" />
                {activeScene?.click ? (
                  <>
                    <span className="absolute -left-1.5 -top-1.5 h-7 w-7 animate-ping rounded-full border border-primary/60" />
                    <span className="absolute -left-3 -top-3 h-10 w-10 rounded-full border border-primary/25 animate-[ping_1.4s_ease-out_infinite]" />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
