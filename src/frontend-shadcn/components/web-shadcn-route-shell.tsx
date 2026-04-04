"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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

type WebRouteGroup =
  | "marketing"
  | "legal"
  | "account"
  | "checkout"
  | "admin"
  | "lab";

type WebRouteDefinition = {
  path: string;
  group: WebRouteGroup;
  labelKey?: string;
};

const WEB_ROUTES: WebRouteDefinition[] = [
  { path: "/", group: "marketing", labelKey: "portalSite.nav.home" },
  { path: "/pricing", group: "marketing", labelKey: "portalSite.nav.pricing" },
  { path: "/help", group: "marketing", labelKey: "portalSite.nav.help" },
  { path: "/auth", group: "marketing", labelKey: "portalSite.nav.auth" },
  { path: "/legal/terms", group: "legal", labelKey: "portalSite.footer.terms" },
  {
    path: "/legal/privacy",
    group: "legal",
    labelKey: "portalSite.footer.privacy",
  },
  {
    path: "/legal/refund",
    group: "legal",
    labelKey: "portalSite.footer.refund",
  },
  { path: "/account", group: "account", labelKey: "portalSite.nav.dashboard" },
  {
    path: "/account/billing",
    group: "account",
    labelKey: "portalSite.nav.billing",
  },
  { path: "/account/invoices", group: "account" },
  { path: "/account/settings", group: "account" },
  { path: "/checkout", group: "checkout" },
  { path: "/checkout/success", group: "checkout" },
  { path: "/checkout/cancel", group: "checkout" },
  { path: "/admin", group: "admin", labelKey: "portalSite.nav.admin" },
  { path: "/admin/workspaces", group: "admin" },
  { path: "/admin/revenue", group: "admin" },
  { path: "/admin/audit", group: "admin" },
  { path: "/admin/audit-log", group: "admin" },
  { path: "/admin/command-center", group: "admin" },
  { path: "/admin/system", group: "admin" },
  { path: "/web-baseline", group: "lab" },
  { path: "/web-v2", group: "lab" },
];

const COMPONENT_SAMPLES = [
  "accordion",
  "alert-dialog",
  "avatar",
  "badge",
  "button",
  "card",
  "checkbox",
  "combobox",
  "dialog",
  "dropdown-menu",
  "input",
  "navigation-menu",
  "select",
  "sheet",
  "sidebar",
  "table",
  "tabs",
  "tooltip",
] as const;

function toPathLabel(path: string): string {
  if (path === "/") {
    return "/";
  }
  return path
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/-/g, " "))
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" / ");
}

type WebShadcnRouteShellProps = {
  routePath: string;
};

export function WebShadcnRouteShell({ routePath }: WebShadcnRouteShellProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const activeRoute = useMemo(
    () => WEB_ROUTES.find((item) => item.path === routePath) ?? WEB_ROUTES[0],
    [routePath],
  );

  const filteredRoutes = useMemo(() => {
    if (!normalizedQuery) {
      return WEB_ROUTES;
    }
    return WEB_ROUTES.filter((item) => {
      const label = item.labelKey ? t(item.labelKey) : toPathLabel(item.path);
      return (
        item.path.toLowerCase().includes(normalizedQuery) ||
        item.group.toLowerCase().includes(normalizedQuery) ||
        label.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [normalizedQuery, t]);

  const groupedRoutes = useMemo(() => {
    const groups: WebRouteGroup[] = [
      "marketing",
      "legal",
      "account",
      "checkout",
      "admin",
      "lab",
    ];
    return groups
      .map((group) => ({
        group,
        routes: filteredRoutes.filter((item) => item.group === group),
      }))
      .filter((entry) => entry.routes.length > 0);
  }, [filteredRoutes]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-2 px-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            prefetch={false}
          >
            <Sparkles className="h-4 w-4" />
            <span>{t("webShadcn.brand")}</span>
          </Link>

          <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
            {t("webShadcn.migrationBadge")}
          </Badge>

          <div className="ml-auto hidden w-72 md:block">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("webShadcn.searchPlaceholder")}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {t("webShadcn.routesTitle")}
              </CardTitle>
              <CardDescription>
                {t("webShadcn.routesDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {groupedRoutes.map((entry) => (
                <div key={entry.group} className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase">
                    {t(`webShadcn.groups.${entry.group}`)}
                  </p>
                  {entry.routes.map((item) => {
                    const isActive = item.path === activeRoute.path;
                    return (
                      <Button
                        key={item.path}
                        asChild
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start"
                      >
                        <Link href={item.path} prefetch={false}>
                          <span className="truncate">
                            {item.labelKey
                              ? t(item.labelKey)
                              : toPathLabel(item.path)}
                          </span>
                        </Link>
                      </Button>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="space-y-4 pr-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("webShadcn.shellTitle")}</CardTitle>
                <CardDescription>
                  {t("webShadcn.shellDescription", {
                    path: activeRoute.path,
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("webShadcn.currentRouteLabel")}
                  </p>
                  <p className="font-mono text-sm">{activeRoute.path}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="mb-1 text-xs text-muted-foreground">
                    {t("webShadcn.groupLabel")}
                  </p>
                  <p className="text-sm font-medium">
                    {t(`webShadcn.groups.${activeRoute.group}`)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("webShadcn.componentTitle")}</CardTitle>
                <CardDescription>
                  {t("webShadcn.componentDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {COMPONENT_SAMPLES.map((name) => (
                  <div
                    key={name}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                  >
                    {name}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("webShadcn.nextTitle")}</CardTitle>
                <CardDescription>
                  {t("webShadcn.nextDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Button
                  asChild
                  variant="outline"
                  className={cn("justify-between")}
                >
                  <Link href="/auth" prefetch={false}>
                    {t("portalSite.nav.auth")}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className={cn("justify-between")}
                >
                  <Link href="/shadcn-clone" prefetch={false}>
                    /shadcn-clone
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className={cn("justify-between")}
                >
                  <Link href="/app-shadcn-clone" prefetch={false}>
                    /app-shadcn-clone
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
