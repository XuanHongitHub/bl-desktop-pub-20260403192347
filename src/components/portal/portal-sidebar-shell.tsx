"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalHeaderControls } from "@/components/portal/portal-header-controls";
import { ScrollArea } from "@/components/ui/scroll-area";
import { usePortalBillingData } from "@/hooks/use-portal-billing-data";
import { writePortalSessionStorage } from "@/lib/portal-session";
import type { AppSection, TeamRole } from "@/types";

type PortalSidebarMode = "account" | "admin";

function mapAccountPathToSection(pathname: string): AppSection {
  if (pathname.startsWith("/account/billing")) return "pricing";
  if (pathname.startsWith("/account/invoices")) return "billing";
  if (pathname.startsWith("/account/settings")) return "settings";
  return "profiles";
}

function mapAccountSectionToPath(section: AppSection): string {
  switch (section) {
    case "pricing":
      return "/account/billing";
    case "billing":
      return "/account/invoices";
    case "settings":
      return "/account/settings";
    case "super-admin-overview":
      return "/admin/command-center";
    case "profiles":
    default:
      return "/account";
  }
}

function mapAdminPathToSection(pathname: string): AppSection {
  if (pathname.startsWith("/admin/workspaces")) return "super-admin-workspace";
  if (pathname.startsWith("/admin/revenue")) return "super-admin-billing";
  if (pathname.startsWith("/admin/audit")) return "super-admin-audit";
  if (pathname.startsWith("/admin/system")) return "super-admin-system";
  return "super-admin-overview";
}

function mapAdminSectionToPath(section: AppSection): string {
  switch (section) {
    case "super-admin-workspace":
      return "/admin/workspaces";
    case "super-admin-billing":
      return "/admin/revenue";
    case "super-admin-audit":
      return "/admin/audit";
    case "super-admin-cookies":
    case "super-admin-system":
      return "/admin/system";
    case "profiles":
      return "/account";
    case "super-admin-overview":
    default:
      return "/admin/command-center";
  }
}

function PortalSidebarShell({
  children,
  mode,
}: {
  children: ReactNode;
  mode: PortalSidebarMode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const {
    session,
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    billingState,
  } = usePortalBillingData();

  const activeSection = useMemo(
    () =>
      mode === "admin"
        ? mapAdminPathToSection(pathname)
        : mapAccountPathToSection(pathname),
    [mode, pathname],
  );

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        planLabel:
          workspace.id === selectedWorkspaceId
            ? billingState?.subscription.planLabel || workspace.planLabel
            : workspace.planLabel,
        id: workspace.id,
        label: workspace.name,
        details: undefined,
        status: undefined,
        profileLimit: workspace.profileLimit,
        profilesUsed: null,
      })),
    [billingState?.subscription.planLabel, selectedWorkspaceId, workspaces],
  );

  const handleSectionChange = (section: AppSection) => {
    const nextPath =
      mode === "admin"
        ? mapAdminSectionToPath(section)
        : mapAccountSectionToPath(section);
    const params = new URLSearchParams(searchParams.toString());
    if (selectedWorkspaceId) {
      params.set("workspaceId", selectedWorkspaceId);
    }
    const nextHref = params.toString()
      ? `${nextPath}?${params.toString()}`
      : nextPath;
    const currentHref = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    if (nextHref === currentHref || nextPath === pathname) {
      return;
    }
    router.push(nextHref);
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);
    const params = new URLSearchParams(searchParams.toString());
    params.set("workspaceId", workspaceId);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const workspaceRole: TeamRole = "owner";

  return (
    <div className="type-ui flex h-[calc(100vh-var(--window-titlebar-height,0px))] overflow-hidden bg-background">
      <AppSidebar
        activeSection={activeSection}
        collapsed={collapsed}
        onSectionChange={handleSectionChange}
        onCollapsedChange={setCollapsed}
        showAdminSection={session?.user.platformRole === "platform_admin"}
        teamRole={workspaceRole}
        currentWorkspaceRole={workspaceRole}
        platformRole={session?.user.platformRole ?? null}
        isDeveloperBuild={false}
        workspaceOptions={workspaceOptions}
        currentWorkspaceId={selectedWorkspaceId || null}
        onWorkspaceChange={handleWorkspaceChange}
        isWorkspaceSwitching={false}
        authEmail={session?.user.email ?? null}
        authName={session?.user.name ?? null}
        authAvatar={session?.user.avatar ?? null}
        isAuthenticated={Boolean(session?.user.email)}
        isAuthBusy={false}
        navigationMode={mode === "account" ? "portal-account" : "default"}
        onSignIn={() => {
          router.push("/signin");
        }}
        onSignOut={() => {
          void (async () => {
            if (isTauri()) {
              try {
                await invoke("cloud_logout");
              } catch {
                // ignore bridge logout failure and clear portal session anyway
              }
            }
            writePortalSessionStorage(null);
            router.replace("/signin");
          })();
        }}
      />

      <main className="app-shell-safe flex min-w-0 flex-1 flex-col overflow-hidden pl-3 pb-2.5 md:pl-4 md:pb-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <header className="app-shell-safe-header mb-2 flex min-h-[44px] shrink-0 items-center justify-end gap-1.5 border-b border-border pb-2">
            <PortalHeaderControls showAccount />
          </header>

          <ScrollArea className="min-h-0 flex-1">
            <div className="px-1 py-2 md:px-2 md:py-3">{children}</div>
          </ScrollArea>
        </div>
      </main>
    </div>
  );
}

export function PortalAccountSidebarShell({
  children,
}: {
  children: ReactNode;
}) {
  return <PortalSidebarShell mode="account">{children}</PortalSidebarShell>;
}

export function PortalAdminSidebarShell({ children }: { children: ReactNode }) {
  return <PortalSidebarShell mode="admin">{children}</PortalSidebarShell>;
}
