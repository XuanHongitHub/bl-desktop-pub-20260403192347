"use client";

import {
  ChevronsUpDown,
  ChevronRight,
  Globe,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings2,
  Shield,
  SquareTerminal,
  UserRound,
} from "lucide-react";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { AppSection, TeamRole } from "@/types";
import { Logo } from "./icons/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type NavItem = {
  id: AppSection;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "profiles",
    labelKey: "shell.sections.profiles",
    icon: SquareTerminal,
  },
  {
    id: "proxies",
    labelKey: "shell.sections.proxies",
    icon: Globe,
  },
  {
    id: "integrations",
    labelKey: "shell.sections.integrations",
    icon: Shield,
  },
  {
    id: "settings",
    labelKey: "shell.sections.settings",
    icon: Settings2,
  },
];

const ADMIN_NAV_ITEM: NavItem = {
  id: "admin",
  labelKey: "shell.sections.admin",
  icon: LayoutDashboard,
};

const BILLING_NAV_ITEM: NavItem = {
  id: "billing",
  labelKey: "shell.sections.billing",
  icon: Receipt,
};

type Props = {
  activeSection: AppSection;
  collapsed: boolean;
  onSectionChange: (section: AppSection) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  showAdminSection?: boolean;
  teamRole?: TeamRole | null;
  platformRole?: string | null;
  workspaceOptions?: Array<{
    id: string;
    label: string;
  }>;
  currentWorkspaceId?: string | null;
  onWorkspaceChange?: (workspaceId: string) => void;
  authEmail?: string | null;
  isAuthenticated?: boolean;
  isAuthBusy?: boolean;
  onSignIn?: () => void;
  onSignOut?: () => void;
};

export function AppSidebar({
  activeSection,
  collapsed,
  onSectionChange,
  onCollapsedChange,
  showAdminSection = false,
  teamRole = null,
  platformRole = null,
  workspaceOptions = [],
  currentWorkspaceId = null,
  onWorkspaceChange,
  authEmail = null,
  isAuthenticated = false,
  isAuthBusy = false,
  onSignIn,
  onSignOut,
}: Props) {
  const { t } = useTranslation();
  const isPlatformAdmin = platformRole === "platform_admin";
  const roleLabel = isPlatformAdmin
    ? t("shell.roles.platform_admin")
    : teamRole
      ? t(`shell.roles.${teamRole}`)
      : t("shell.roles.guest");

  const navItems = useMemo(() => {
    const base = [...NAV_ITEMS];
    if (isAuthenticated) {
      base.splice(2, 0, BILLING_NAV_ITEM);
    }
    const filtered = base.filter((item) =>
      teamRole === "viewer" && item.id === "integrations" ? false : true,
    );
    if (showAdminSection) {
      filtered.push(ADMIN_NAV_ITEM);
    }
    return filtered;
  }, [isAuthenticated, showAdminSection, teamRole]);

  const canSwitchWorkspace = workspaceOptions.length > 1 && Boolean(onWorkspaceChange);
  const selectedWorkspaceId = currentWorkspaceId ?? workspaceOptions[0]?.id ?? "default";
  const selectedWorkspace =
    workspaceOptions.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaceOptions[0] ??
    null;

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    const isPlatformAdminItem = item.id === "admin" && isPlatformAdmin;

    const button = (
      <button
        type="button"
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "group flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold leading-[1.25] transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          isPlatformAdminItem && "border border-border bg-muted/60",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            isActive
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        {!collapsed && (
          <>
            <span className="min-w-0">{t(item.labelKey)}</span>
            {isActive && (
              <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </>
        )}
      </button>
    );

    if (!collapsed) {
      return button;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "app-shell-sidebar app-sidebar-font relative flex h-screen flex-col border-r border-border bg-background text-foreground tracking-normal transition-all duration-200",
        collapsed ? "w-[80px]" : "w-[258px]",
      )}
    >
      <div
        className="shrink-0"
        style={{ height: "var(--window-titlebar-height)" }}
      />

      <div
        className="shrink-0 border-b border-border"
      >
        <div
          className={cn(
            "flex h-11 items-center",
            collapsed ? "gap-1 px-2" : "gap-1 px-3",
          )}
        >
          {collapsed ? (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSectionChange("profiles")}
                    className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted/60"
                  >
                    <Logo variant="icon" className="h-8 w-8 rounded-md" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">BugLogin</TooltipContent>
              </Tooltip>

              {onCollapsedChange && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onCollapsedChange(false)}
                      aria-label={t("shell.expandSidebar")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {t("shell.expandSidebar")}
                  </TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSectionChange("profiles")}
                className="flex min-w-0 flex-1 items-center rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted/50"
              >
                <Logo variant="full" className="h-7 max-w-[148px]" />
              </button>
              {onCollapsedChange && (
                <button
                  type="button"
                  onClick={() => onCollapsedChange(true)}
                  aria-label={t("shell.collapseSidebar")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>

        {!collapsed && isAuthenticated && workspaceOptions.length > 0 && (
          <div className="px-3 pb-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={!canSwitchWorkspace}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg border border-border bg-muted px-2 py-2 text-left transition-colors",
                    canSwitchWorkspace ? "hover:bg-muted/70" : "cursor-default opacity-85",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">
                      {selectedWorkspace?.label ?? t("shell.workspaceSwitcher.placeholder")}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <p className="truncate text-[10px] font-medium text-muted-foreground">
                        {roleLabel}
                      </p>
                      {isPlatformAdmin && (
                        <span className="rounded-md border border-border bg-background px-1 py-0.5 text-[9px] font-semibold text-foreground">
                          {t("shell.roles.platform_admin_short")}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[260px]">
                <DropdownMenuLabel>{t("shell.workspaceSwitcher.label")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {workspaceOptions.map((workspace, index) => (
                  <DropdownMenuItem
                    key={workspace.id}
                    onClick={() => onWorkspaceChange?.(workspace.id)}
                    disabled={!canSwitchWorkspace}
                  >
                    <span className="truncate">{workspace.label}</span>
                    <DropdownMenuShortcut>{index + 1}</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* ── Navigation ── */}
      <ScrollArea className="flex-1 px-2 pb-3 pt-1">
        <div className="space-y-0.5 pb-2">
          {navItems.map((item) => (
            <div key={item.id}>{renderNavItem(item)}</div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="border-t border-border p-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={isAuthenticated ? onSignOut : onSignIn}
                disabled={isAuthBusy || (isAuthenticated ? !onSignOut : !onSignIn)}
                className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted text-foreground transition-colors hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserRound className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {isAuthenticated ? t("shell.auth.signOut") : t("shell.auth.signIn")}
            </TooltipContent>
          </Tooltip>
        ) : isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-muted px-2 py-2 text-left transition-colors hover:bg-muted/70"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    {authEmail ?? t("shell.auth.loggedOut")}
                  </p>
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {roleLabel}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="space-y-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {authEmail ?? t("shell.auth.loggedOut")}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">{roleLabel}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onSignOut}
                disabled={isAuthBusy || !onSignOut}
              >
                <LogOut className="h-4 w-4" />
                {t("shell.auth.signOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
              <UserRound className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {t("shell.auth.loggedOut")}
              </p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {t("shell.auth.disconnected")}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              disabled={isAuthBusy || !onSignIn}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("shell.auth.signIn")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
