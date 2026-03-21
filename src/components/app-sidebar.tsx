"use client";

import {
  BarChart3,
  Building2,
  Check,
  ChevronsUpDown,
  ChevronRight,
  FileText,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Receipt,
  Settings2,
  Shield,
  SquareTerminal,
  UserRound,
  Users,
  Wrench,
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
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type NavItem = {
  id: AppSection;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

const APP_NAV_ITEMS: NavItem[] = [
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

const BILLING_NAV_ITEM: NavItem = {
  id: "billing",
  labelKey: "shell.sections.billing",
  icon: Receipt,
};

const ADMIN_PANEL_NAV_ITEMS: NavItem[] = [
  {
    id: "admin-overview",
    labelKey: "adminWorkspace.tabs.overview",
    icon: LayoutDashboard,
  },
  {
    id: "admin-workspace",
    labelKey: "adminWorkspace.tabs.workspace",
    icon: Users,
  },
  {
    id: "admin-billing",
    labelKey: "adminWorkspace.tabs.billing",
    icon: Receipt,
  },
  {
    id: "admin-audit",
    labelKey: "adminWorkspace.tabs.audit",
    icon: FileText,
  },
  {
    id: "admin-system",
    labelKey: "adminWorkspace.tabs.system",
    icon: Wrench,
  },
  {
    id: "admin-analytics",
    labelKey: "adminWorkspace.tabs.analytics",
    icon: BarChart3,
  },
];

function isAdminPanelSection(section: AppSection): boolean {
  return section.startsWith("admin-");
}

type PanelMode = "workspace" | "admin";

type NavBuildInput = {
  panelMode: PanelMode;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isTeamOperator: boolean;
  teamRole: TeamRole | null;
};

function buildNavItems(input: NavBuildInput): NavItem[] {
  if (input.panelMode === "admin") {
    if (input.isPlatformAdmin) {
      return [...ADMIN_PANEL_NAV_ITEMS];
    }
    if (input.isTeamOperator) {
      return ADMIN_PANEL_NAV_ITEMS.filter(
        (item) =>
          item.id === "admin-overview" ||
          item.id === "admin-workspace" ||
          item.id === "admin-system" ||
          item.id === "admin-analytics",
      );
    }
    return ADMIN_PANEL_NAV_ITEMS.filter(
      (item) => item.id === "admin-overview" || item.id === "admin-workspace",
    );
  }

  const base = [...APP_NAV_ITEMS];
  if (input.isAuthenticated) {
    base.splice(2, 0, BILLING_NAV_ITEM);
  }
  return base.filter(
    (item) =>
      !(
        input.teamRole === "viewer" &&
        item.id === "integrations"
      ),
  );
}

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
  const isTeamOperator = teamRole === "owner" || teamRole === "admin";
  const inAdminPanel = isAdminPanelSection(activeSection);
  const panelMode: PanelMode = inAdminPanel ? "admin" : "workspace";
  const roleLabel = isPlatformAdmin
    ? t("shell.roles.platform_admin")
    : teamRole
      ? t(`shell.roles.${teamRole}`)
      : t("shell.roles.guest");

  const navItems = useMemo(() => {
    return buildNavItems({
      panelMode,
      isAuthenticated,
      isPlatformAdmin,
      isTeamOperator,
      teamRole,
    });
  }, [isAuthenticated, isPlatformAdmin, isTeamOperator, panelMode, teamRole]);

  const canSwitchWorkspace = workspaceOptions.length > 1 && Boolean(onWorkspaceChange);
  const selectedWorkspaceId = currentWorkspaceId ?? workspaceOptions[0]?.id ?? "default";
  const selectedWorkspace =
    workspaceOptions.find((workspace) => workspace.id === selectedWorkspaceId) ??
    workspaceOptions[0] ??
    null;
  const workspaceContextLabel = inAdminPanel
    ? t("shell.sections.adminPanel")
    : roleLabel;

  const renderAccountMenuContent = () => (
    <>
      <DropdownMenuLabel className="space-y-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {authEmail ?? t("shell.auth.loggedOut")}
        </p>
        <p className="truncate text-xs font-medium text-muted-foreground">
          {workspaceContextLabel}
        </p>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
        {t("shell.accountMenu.workspaces")}
      </DropdownMenuLabel>
      {workspaceOptions.map((workspace) => {
        const isCurrentWorkspace = workspace.id === selectedWorkspaceId;
        return (
          <DropdownMenuItem
            key={workspace.id}
            onClick={() => onWorkspaceChange?.(workspace.id)}
            disabled={!canSwitchWorkspace}
            className={cn("rounded-md px-2 py-2", isCurrentWorkspace && "bg-muted")}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {workspace.label}
              </p>
              <p className="truncate text-[10px] font-medium text-muted-foreground">
                {isCurrentWorkspace
                  ? t("shell.workspaceSwitcher.current")
                  : t("shell.workspaceSwitcher.switchTo")}
              </p>
            </div>
            {isCurrentWorkspace && (
              <Check className="h-4 w-4 shrink-0 text-foreground" />
            )}
          </DropdownMenuItem>
        );
      })}
      <DropdownMenuItem disabled className="rounded-md px-2 py-2">
        <Plus className="h-4 w-4" />
        {t("shell.accountMenu.addWorkspace")}
      </DropdownMenuItem>
      {(showAdminSection || inAdminPanel) && <DropdownMenuSeparator />}
      {showAdminSection && !inAdminPanel && (
        <DropdownMenuItem onClick={() => onSectionChange("admin-overview")}>
          <LayoutDashboard className="h-4 w-4" />
          {t("shell.panelSwitch.toAdmin")}
        </DropdownMenuItem>
      )}
      {inAdminPanel && (
        <DropdownMenuItem onClick={() => onSectionChange("profiles")}>
          <LifeBuoy className="h-4 w-4" />
          {t("shell.panelSwitch.toWorkspace")}
        </DropdownMenuItem>
      )}
      {(showAdminSection || inAdminPanel) && <DropdownMenuSeparator />}
      <DropdownMenuItem onClick={onSignOut} disabled={isAuthBusy || !onSignOut}>
        <LogOut className="h-4 w-4" />
        {t("shell.auth.signOut")}
      </DropdownMenuItem>
    </>
  );

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    const isPlatformAdminItem =
      isPlatformAdmin &&
      (item.id === "admin-overview" ||
        item.id === "admin-workspace" ||
        item.id === "admin-billing" ||
        item.id === "admin-audit" ||
        item.id === "admin-system" ||
        item.id === "admin-analytics");

    const button = (
      <button
        type="button"
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "group flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold leading-[1.25] transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          isPlatformAdminItem && "border border-border bg-muted/60 shadow-[inset_0_0_0_1px_var(--border)]",
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

      <div className="shrink-0 border-b border-border">
        <div
          className={cn(
            "flex h-11 items-center",
            collapsed ? "gap-1 px-2" : "gap-2 px-2.5",
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
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-muted/60"
              >
                <Logo variant="icon" className="h-8 w-8 rounded-md" />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-foreground">
                  {selectedWorkspace?.label ?? "BugLogin"}
                </p>
                <p className="truncate text-[10px] font-medium text-muted-foreground">
                  {workspaceContextLabel}
                </p>
              </div>

              {onCollapsedChange && (
                <button
                  type="button"
                  onClick={() => onCollapsedChange(true)}
                  aria-label={t("shell.collapseSidebar")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
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
          isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground transition-colors hover:bg-muted/40"
                >
                  <UserRound className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[292px]">
                {renderAccountMenuContent()}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={isAuthBusy || !onSignIn}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-background text-foreground transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <UserRound className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {t("shell.auth.signIn")}
              </TooltipContent>
            </Tooltip>
          )
        ) : isAuthenticated ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="group flex w-full items-center gap-2 rounded-lg bg-background px-2 py-2 text-left transition-colors hover:bg-muted/40 data-[state=open]:bg-muted/50"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background text-foreground">
                  <UserRound className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    {selectedWorkspace?.label ??
                      t("shell.workspaceSwitcher.placeholder")}
                  </p>
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {workspaceContextLabel}
                  </p>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[292px]">
              {renderAccountMenuContent()}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-background px-2 py-2">
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
