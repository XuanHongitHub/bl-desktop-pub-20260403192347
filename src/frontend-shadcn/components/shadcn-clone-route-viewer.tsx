"use client";

import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CloneSurface,
  getCloneRouteBase,
  getCloneRouteHrefForEntry,
  resolveCloneRouteEntry,
  SHADCN_CLONE_ROUTE_ENTRIES,
  SHADCN_CLONE_ROUTE_GROUP_ORDER,
} from "@/frontend-shadcn/lib/shadcn-clone-routes";
import { Badge } from "@/frontend-shadcn/ui/badge";
import { Button } from "@/frontend-shadcn/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/frontend-shadcn/ui/card";
import { Input } from "@/frontend-shadcn/ui/input";
import { ScrollArea } from "@/frontend-shadcn/ui/scroll-area";
import { cn } from "@/lib/utils";

type ShadcnCloneRouteViewerProps = {
  surface: CloneSurface;
  slug?: string[];
};

export function ShadcnCloneRouteViewer({
  surface,
  slug,
}: ShadcnCloneRouteViewerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const activeEntry = useMemo(() => resolveCloneRouteEntry(slug), [slug]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredEntries = useMemo(() => {
    if (!normalizedQuery) {
      return SHADCN_CLONE_ROUTE_ENTRIES;
    }

    return SHADCN_CLONE_ROUTE_ENTRIES.filter((entry) => {
      return (
        entry.sourcePath.toLowerCase().includes(normalizedQuery) ||
        entry.group.toLowerCase().includes(normalizedQuery) ||
        entry.label.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery]);

  const groupedEntries = useMemo(() => {
    return SHADCN_CLONE_ROUTE_GROUP_ORDER.map((group) => ({
      group,
      entries: filteredEntries.filter((entry) => entry.group === group),
    })).filter((item) => item.entries.length > 0);
  }, [filteredEntries]);

  const oppositeSurface: CloneSurface =
    surface === "desktop" ? "web" : "desktop";
  const oppositeHref = getCloneRouteHrefForEntry(oppositeSurface, activeEntry);

  return (
    <div
      className={cn(
        "flex bg-background text-foreground",
        surface === "desktop"
          ? "h-[calc(100vh-var(--window-titlebar-height,0px))]"
          : "h-screen",
      )}
    >
      <aside className="hidden w-[360px] shrink-0 border-r border-border bg-muted/20 lg:flex lg:flex-col">
        <div className="space-y-3 border-b border-border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              {t("shadcnCloneSkill.routeViewer.sidebarTitle")}
            </p>
            <Badge variant="secondary">{filteredEntries.length}</Badge>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("shadcnCloneSkill.routeViewer.searchPlaceholder")}
              className="pl-8"
            />
          </div>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3">
            {groupedEntries.map((grouped) => (
              <div key={grouped.group} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {t(`shadcnCloneSkill.routeViewer.groups.${grouped.group}`)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {grouped.entries.length}
                  </span>
                </div>

                {grouped.entries.map((entry) => {
                  const isActive = entry.slugKey === activeEntry.slugKey;

                  return (
                    <Button
                      key={entry.url}
                      asChild
                      variant={isActive ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start gap-2"
                    >
                      <Link
                        href={getCloneRouteHrefForEntry(surface, entry)}
                        prefetch={false}
                      >
                        <span className="truncate font-mono text-xs">
                          {entry.sourcePath}
                        </span>
                      </Link>
                    </Button>
                  );
                })}
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-border">
          <div className="flex h-14 items-center gap-2 px-3 md:px-4">
            <p className="truncate font-mono text-xs text-muted-foreground">
              {activeEntry.sourcePath}
            </p>

            <Badge variant="outline" className="hidden sm:inline-flex">
              {t(`shadcnCloneSkill.routeViewer.groups.${activeEntry.group}`)}
            </Badge>

            <Badge variant="secondary" className="hidden md:inline-flex">
              {activeEntry.index}/{SHADCN_CLONE_ROUTE_ENTRIES.length}
            </Badge>

            <div className="ml-auto flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={getCloneRouteBase(surface)} prefetch={false}>
                  {t("shadcnCloneSkill.routeViewer.actions.allRoutes")}
                </Link>
              </Button>

              <Button asChild variant="outline" size="sm">
                <Link href={oppositeHref} prefetch={false}>
                  {surface === "desktop"
                    ? t("shadcnCloneSkill.routeViewer.actions.openWeb")
                    : t("shadcnCloneSkill.routeViewer.actions.openDesktop")}
                </Link>
              </Button>

              <Button asChild size="sm">
                <a href={activeEntry.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t("shadcnCloneSkill.routeViewer.actions.openSource")}
                </a>
              </Button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 p-3 md:p-4">
          <Card className="flex h-full min-h-0 flex-col overflow-hidden">
            <CardHeader className="border-b border-border py-3">
              <CardTitle className="text-base">
                {t("shadcnCloneSkill.routeViewer.previewTitle")}
              </CardTitle>
              <CardDescription>
                {t("shadcnCloneSkill.routeViewer.previewDescription", {
                  path: activeEntry.sourcePath,
                })}
              </CardDescription>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 p-0">
              <iframe
                key={activeEntry.url}
                src={activeEntry.url}
                title={`shadcn clone mirror ${activeEntry.sourcePath}`}
                className="h-full w-full border-0 bg-background"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
