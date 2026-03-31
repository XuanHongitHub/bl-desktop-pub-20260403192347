"use client";

import {
  CircleUserRound,
  CreditCard,
  LayoutDashboard,
  PanelLeftClose,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons/logo";
import { Sidebar07NavMain } from "@/frontend-shadcn/sidebar-07/nav-main";
import { Sidebar07NavUser } from "@/frontend-shadcn/sidebar-07/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/frontend-shadcn/ui/sidebar";
import { useWebPortalSession } from "@/hooks/use-web-portal-session";
import { getPlanTierDisplayLabel } from "@/lib/plan-tier";

export function Sidebar07AppSidebar({
  showRail: _showRail = true,
  ...props
}: React.ComponentProps<typeof Sidebar> & { showRail?: boolean }) {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { t } = useTranslation();
  const router = useRouter();
  const {
    session,
    identityName,
    identityLabel,
    identityAvatar,
    platformRole,
    dashboardHref,
    signOut,
  } = useWebPortalSession();

  const platformItems: Array<{
    title: string;
    url: string;
    icon: LucideIcon;
  }> = [
    {
      title: t("portalSite.account.nav.billing"),
      url: "/account/billing",
      icon: CreditCard,
    },
    {
      title: t("portalSite.nav.account"),
      url: "/account/settings",
      icon: SlidersHorizontal,
    },
    {
      title: t("portalSite.account.nav.overview"),
      url: "/account",
      icon: LayoutDashboard,
    },
  ];

  const adminItems: Array<{
    title: string;
    url: string;
    icon: LucideIcon;
  }> = [];

  if (platformRole === "platform_admin") {
    adminItems.push(
      {
        title: t("portalSite.admin.nav.commandCenter"),
        url: "/admin/command-center",
        icon: Shield,
      },
      {
        title: t("portalSite.admin.nav.workspaces"),
        url: "/admin/workspaces",
        icon: CircleUserRound,
      },
      {
        title: t("portalSite.admin.nav.revenue"),
        url: "/admin/revenue",
        icon: CreditCard,
      },
      {
        title: t("portalSite.admin.nav.audit"),
        url: "/admin/audit",
        icon: Shield,
      },
      {
        title: t("portalSite.admin.nav.system"),
        url: "/admin/system",
        icon: SlidersHorizontal,
      },
    );
  }

  const navSections = [
    { label: t("shell.navigationGroups.platform"), items: platformItems },
    ...(adminItems.length > 0
      ? [{ label: t("shell.roles.platform_admin"), items: adminItems }]
      : []),
  ];

  const user = {
    name: identityName || "BugLogin",
    email: identityLabel || "portal@buglogin.com",
    avatar: identityAvatar || "/avatars/shadcn.jpg",
  };
  const workspaceLabel =
    session?.current?.workspaceName?.trim() ||
    t("shell.workspaceSwitcher.placeholder");
  const planLabel = getPlanTierDisplayLabel(session?.current?.planLabel);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/signin");
  };

  return (
    <Sidebar
      collapsible="icon"
      position="local"
      className="app-shell-sidebar"
      {...props}
    >
      <SidebarHeader className="border-b border-sidebar-border px-2 py-2">
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => {
              if (collapsed) {
                toggleSidebar();
                return;
              }
              router.push("/account");
            }}
            className="flex h-8 min-w-0 flex-1 items-center rounded-md px-1.5 transition-colors hover:bg-sidebar-accent/80 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <Logo
              variant={collapsed ? "icon" : "full"}
              className={
                collapsed
                  ? "h-7 w-7 rounded-md"
                  : "h-7 w-auto max-w-[136px] object-contain"
              }
            />
          </button>
          {!collapsed ? (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={t("shell.collapseSidebar")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <Sidebar07NavMain sections={navSections} />
      </SidebarContent>
      <SidebarFooter>
        <Sidebar07NavUser
          user={user}
          dashboardHref={dashboardHref}
          workspaceLabel={workspaceLabel}
          planLabel={planLabel}
          onSignOut={handleSignOut}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
