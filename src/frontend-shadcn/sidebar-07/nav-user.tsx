"use client";

import {
  ChevronsUpDown,
  CreditCard,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/frontend-shadcn/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/frontend-shadcn/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/frontend-shadcn/ui/sidebar";
import { getPlanBadgeStyle } from "@/lib/plan-tier";
import { cn } from "@/lib/utils";

export function Sidebar07NavUser({
  user,
  dashboardHref,
  workspaceLabel,
  planLabel,
  onSignOut,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
  dashboardHref: string;
  workspaceLabel: string;
  planLabel: string;
  onSignOut: () => void;
}) {
  const { isMobile } = useSidebar();
  const { t } = useTranslation();
  const fallback = user.name.trim().slice(0, 2).toUpperCase() || "BL";
  const planBadge = getPlanBadgeStyle(planLabel);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="group flex h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-7 w-7 rounded-full">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-full">
                  {fallback}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate text-xs font-semibold">
                  {user.email}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] text-muted-foreground">
                    {workspaceLabel}
                  </span>
                  <Badge
                    variant={planBadge.variant}
                    className={cn(
                      "h-5 px-1.5 text-[10px] font-semibold",
                      planBadge.className,
                    )}
                  >
                    {planLabel}
                  </Badge>
                </div>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-full">
                    {fallback}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href={dashboardHref}>
                  <LayoutDashboard />
                  {t("portalSite.nav.dashboard")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/account/billing">
                  <CreditCard />
                  {t("portalSite.nav.billing")}
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut />
              {t("portalSite.nav.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
