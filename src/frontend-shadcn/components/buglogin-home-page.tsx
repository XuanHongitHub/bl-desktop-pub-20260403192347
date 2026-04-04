"use client";

import type React from "react";
import {
  ChevronDown,
  Copy,
  Github,
  Laptop,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Smartphone,
  Sun,
  Tablet,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Logo } from "@/components/icons/logo";
import { cn } from "@/lib/utils";
import { Sidebar07AppSidebar } from "@/frontend-shadcn/sidebar-07/app-sidebar";
import { Button } from "@/frontend-shadcn/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/frontend-shadcn/ui/breadcrumb";
import { Input } from "@/frontend-shadcn/ui/input";
import { Separator } from "@/frontend-shadcn/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/frontend-shadcn/ui/sidebar";

type HomeSurface = "web" | "desktop";

const HEADER_LINKS = ["Docs", "Components", "Blocks", "Charts", "Directory", "Create"] as const;

export function BugloginHomePage({ surface = "web" }: { surface?: HomeSurface }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "bg-background text-foreground",
        surface === "desktop" ? "h-[calc(100vh-var(--window-titlebar-height,0px))] overflow-auto" : "min-h-screen",
      )}
    >
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-2 px-4 md:px-6">
          <a href="#" className="inline-flex h-8 items-center">
            <Logo variant="full" className="h-6 w-auto max-w-[160px] object-contain align-middle" alt="BugLogin" />
          </a>

          <nav className="ml-3 hidden items-center gap-1 lg:flex">
            {HEADER_LINKS.map((link) => (
              <Button
                key={link}
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-sm font-medium leading-none"
              >
                {link}
              </Button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden lg:block">
              <Input
                className="h-8 w-72 rounded-lg text-sm shadow-none"
                placeholder="Search documentation..."
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5">
              <Github className="h-4 w-4" />
              <span className="text-xs text-muted-foreground">111k</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5">
              <Plus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center rounded-md border p-0.5">
            <Button variant="ghost" size="sm" className="h-7 rounded-sm px-3 text-xs">
              Preview
            </Button>
            <Button variant="ghost" size="sm" className="h-7 rounded-sm px-3 text-xs text-muted-foreground">
              Code
            </Button>
          </div>

          <Separator orientation="vertical" className="hidden h-5 md:block" />

          <p className="text-sm font-medium">A sidebar that collapses to icons</p>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1 md:flex">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Monitor className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Laptop className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Tablet className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Smartphone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-2 rounded-lg px-3 text-xs">
              <span className="text-[11px]">&gt;_</span>
              npx shadcn add sidebar-07
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-lg px-3">
              Open in
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-background">
          <SidebarProvider
            className="h-full min-h-0"
            style={
              {
                "--sidebar-width-icon": "2.5rem",
              } as React.CSSProperties
            }
          >
            <div
              className={cn(
                "flex h-[560px] w-full min-w-0 overflow-hidden",
                surface === "desktop" && "h-[calc(100vh-var(--window-titlebar-height,0px)-13rem)] min-h-[520px]",
              )}
            >
              <Sidebar07AppSidebar position="local" showRail={false} />
              <SidebarInset className="min-h-0 overflow-hidden">
                <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                  <div className="flex items-center gap-2 px-4">
                    <SidebarTrigger className="-ml-1" />
                    <Separator orientation="vertical" className="mr-2 h-4" />
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem className="hidden md:block">
                          <BreadcrumbLink href="#">Building Your Application</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="hidden md:block" />
                        <BreadcrumbItem>
                          <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                </header>

                <div className="flex flex-1 flex-col gap-4 overflow-auto p-4 pt-0">
                  <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <div className="aspect-video rounded-xl bg-muted/50" />
                    <div className="aspect-video rounded-xl bg-muted/50" />
                    <div className="aspect-video rounded-xl bg-muted/50" />
                  </div>
                  <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min" />
                </div>
              </SidebarInset>
            </div>
          </SidebarProvider>
        </div>
      </main>
    </div>
  );
}
