"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { usePathname, useRouter } from "next/navigation";
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
  if (pathname.startsWith("/account/plan")) return "pricing";
  if (pathname.startsWith("/account/billing")) return "pricing";
  if (pathname.startsWith("/account/invoices")) return "billing";
  if (pathname.startsWith("/account/invites")) return "billing";
  if (pathname.startsWith("/account/settings")) return "settings";
  return "profiles";
}

function mapAccountSectionToPath(section: AppSection): string {
  switch (section) {
    case "pricing":
      return "/account/plan";
    case "billing":
      return "/account/invoices";
    case "settings":
      return "/account/settings";
    case "super-admin-overview":
      return "/admin/dashboard";
    default:
      return "/account";
  }
}

function mapAdminPathToSection(pathname: string): AppSection {
  if (pathname.startsWith("/admin/dashboard")) return "super-admin-overview";
  if (pathname.startsWith("/admin/incident-board"))
    return "super-admin-incident-board";
  if (pathname.startsWith("/admin/permissions"))
    return "super-admin-permissions";
  if (pathname.startsWith("/admin/memberships"))
    return "super-admin-memberships";
  if (pathname.startsWith("/admin/abuse-trust"))
    return "super-admin-abuse-trust";
  if (pathname.startsWith("/admin/subscriptions"))
    return "super-admin-subscriptions";
  if (pathname.startsWith("/admin/invoices")) return "super-admin-invoices";
  if (pathname.startsWith("/admin/coupons"))
    return "super-admin-commerce-coupons";
  if (pathname.startsWith("/admin/policy-center"))
    return "super-admin-policy-center";
  if (pathname.startsWith("/admin/data-governance"))
    return "super-admin-data-governance";
  if (pathname.startsWith("/admin/jobs-queues"))
    return "super-admin-jobs-queues";
  if (pathname.startsWith("/admin/system/browser"))
    return "super-admin-browser-update";
  if (pathname.startsWith("/admin/feature-flags"))
    return "super-admin-feature-flags";
  if (pathname.startsWith("/admin/support-console"))
    return "super-admin-support-console";
  if (pathname.startsWith("/admin/impersonation-center"))
    return "super-admin-impersonation-center";
  if (pathname.startsWith("/admin/commerce/plans"))
    return "super-admin-commerce-plans";
  if (pathname.startsWith("/admin/commerce/campaigns"))
    return "super-admin-commerce-campaigns";
  if (pathname.startsWith("/admin/commerce/coupons"))
    return "super-admin-commerce-coupons";
  if (pathname.startsWith("/admin/commerce/licenses"))
    return "super-admin-commerce-licenses";
  if (pathname.startsWith("/admin/commerce/preview"))
    return "super-admin-commerce-preview";
  if (pathname.startsWith("/admin/commerce/audit"))
    return "super-admin-commerce-audit";
  if (pathname.startsWith("/admin/workspaces")) return "super-admin-workspace";
  if (pathname.startsWith("/admin/users")) return "super-admin-users";
  if (pathname.startsWith("/admin/revenue")) return "super-admin-billing";
  if (pathname.startsWith("/admin/audit")) return "super-admin-audit";
  if (pathname.startsWith("/admin/system")) return "super-admin-system";
  return "super-admin-overview";
}

function mapAdminSectionToPath(section: AppSection): string {
  switch (section) {
    case "super-admin-incident-board":
      return "/admin/incident-board";
    case "super-admin-workspace":
      return "/admin/workspaces";
    case "super-admin-permissions":
      return "/admin/permissions";
    case "super-admin-memberships":
      return "/admin/memberships";
    case "super-admin-abuse-trust":
      return "/admin/abuse-trust";
    case "super-admin-users":
      return "/admin/users";
    case "super-admin-subscriptions":
      return "/admin/subscriptions";
    case "super-admin-invoices":
      return "/admin/invoices";
    case "super-admin-commerce-plans":
      return "/admin/commerce/plans";
    case "super-admin-commerce-campaigns":
      return "/admin/commerce/campaigns";
    case "super-admin-commerce-coupons":
      return "/admin/coupons";
    case "super-admin-commerce-licenses":
      return "/admin/commerce/licenses";
    case "super-admin-commerce-preview":
      return "/admin/commerce/preview";
    case "super-admin-commerce-audit":
      return "/admin/commerce/audit";
    case "super-admin-billing":
      return "/admin/revenue";
    case "super-admin-policy-center":
      return "/admin/policy-center";
    case "super-admin-data-governance":
      return "/admin/data-governance";
    case "super-admin-jobs-queues":
      return "/admin/jobs-queues";
    case "super-admin-feature-flags":
      return "/admin/feature-flags";
    case "super-admin-support-console":
      return "/admin/support-console";
    case "super-admin-impersonation-center":
      return "/admin/impersonation-center";
    case "super-admin-browser-update":
      return "/admin/system/browser";
    case "super-admin-audit":
      return "/admin/audit";
    case "super-admin-cookies":
    case "super-admin-system":
      return "/admin/system";
    case "profiles":
      return "/account";
    default:
      return "/admin/dashboard";
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
    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
    if (selectedWorkspaceId) {
      params.set("workspaceId", selectedWorkspaceId);
    } else {
      params.delete("workspaceId");
    }
    const nextHref = params.toString()
      ? `${nextPath}?${params.toString()}`
      : nextPath;
    const currentHref = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;
    if (nextHref === currentHref || nextPath === pathname) {
      return;
    }
    router.push(nextHref);
  };

  const handleWorkspaceChange = (workspaceId: string) => {
    setSelectedWorkspaceId(workspaceId);

    const params = new URLSearchParams(
      typeof window !== "undefined" ? window.location.search : "",
    );
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
        navigationMode={mode === "account" ? "portal-account" : "portal-admin"}
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
