"use client";

import {
  BarChart3,
  Building2,
  Check,
  CreditCard,
  ChevronRight,
  ChevronsUpDown,
  Crown,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useTranslation } from "react-i18next";
import { getPlanBadgeStyle } from "@/lib/plan-tier";
import { cn } from "@/lib/utils";
import type { AppSection, TeamRole } from "@/types";
import { Logo } from "./icons/logo";
import { Badge } from "./ui/badge";
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

type NavLeafItem = {
  type: "item";
  id: AppSection;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
};

type NavGroupItem = {
  type: "group";
  id: "workspace-billing";
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  children: NavLeafItem[];
};

type NavEntry = NavLeafItem | NavGroupItem;
type NavGroupId = NavGroupItem["id"];

const PROFILES_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "profiles",
  labelKey: "shell.sections.profiles",
  icon: SquareTerminal,
};

const PROXIES_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "proxies",
  labelKey: "shell.sections.proxies",
  icon: Globe,
};

const PRICING_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "pricing",
  labelKey: "shell.sections.pricing",
  icon: Crown,
};

const INTEGRATIONS_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "integrations",
  labelKey: "shell.sections.integrations",
  icon: Shield,
};

const SETTINGS_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "settings",
  labelKey: "shell.sections.settings",
  icon: Settings2,
};

const WORKSPACE_NAV_BASE_ITEMS: NavLeafItem[] = [
  PROFILES_NAV_ITEM,
  PROXIES_NAV_ITEM,
  INTEGRATIONS_NAV_ITEM,
  SETTINGS_NAV_ITEM,
];

const BILLING_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "billing",
  labelKey: "shell.sections.billingManagement",
  icon: Receipt,
};

const BILLING_CHECKOUT_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "billing-checkout",
  labelKey: "shell.sections.billingCheckout",
  icon: CreditCard,
};

const WORKSPACE_BILLING_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "workspace-billing",
  labelKey: "shell.sections.billing",
  icon: Receipt,
  children: [PRICING_NAV_ITEM, BILLING_CHECKOUT_NAV_ITEM, BILLING_NAV_ITEM],
};

const WORKSPACE_ADMIN_OVERVIEW_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "workspace-admin-overview",
  labelKey: "shell.sections.workspaceAdminOverview",
  icon: LayoutDashboard,
};

const WORKSPACE_ADMIN_DIRECTORY_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "workspace-admin-directory",
  labelKey: "shell.sections.workspaceAdminDirectory",
  icon: Building2,
};

const WORKSPACE_ADMIN_PERMISSIONS_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "workspace-admin-permissions",
  labelKey: "shell.sections.workspaceAdminPermissions",
  icon: Shield,
};

const WORKSPACE_GOVERNANCE_PANEL_BASE_ITEMS: NavLeafItem[] = [
  WORKSPACE_ADMIN_OVERVIEW_NAV_ITEM,
  WORKSPACE_ADMIN_DIRECTORY_NAV_ITEM,
  WORKSPACE_ADMIN_PERMISSIONS_NAV_ITEM,
];

const ADMIN_PANEL_NAV_ITEMS: NavLeafItem[] = [
  {
    type: "item",
    id: "admin-overview",
    labelKey: "adminWorkspace.tabs.overview",
    icon: LayoutDashboard,
  },
  {
    type: "item",
    id: "admin-workspace",
    labelKey: "adminWorkspace.tabs.workspace",
    icon: Users,
  },
  {
    type: "item",
    id: "admin-billing",
    labelKey: "adminWorkspace.tabs.billing",
    icon: Receipt,
  },
  {
    type: "item",
    id: "admin-audit",
    labelKey: "adminWorkspace.tabs.audit",
    icon: FileText,
  },
  {
    type: "item",
    id: "admin-system",
    labelKey: "adminWorkspace.tabs.system",
    icon: Wrench,
  },
  {
    type: "item",
    id: "admin-analytics",
    labelKey: "adminWorkspace.tabs.analytics",
    icon: BarChart3,
  },
];

function isAdminPanelSection(section: AppSection): boolean {
  return section.startsWith("admin-");
}

type PanelMode = "workspace" | "workspace-governance" | "admin";

type NavBuildInput = {
  panelMode: PanelMode;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isTeamOperator: boolean;
  canManageWorkspaceBilling: boolean;
  canManageWorkspaceGovernance: boolean;
  teamRole: TeamRole | null;
};

function buildNavItems(input: NavBuildInput): NavEntry[] {
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

  if (input.panelMode === "workspace-governance") {
    if (!input.isAuthenticated || !input.canManageWorkspaceGovernance) {
      return [...WORKSPACE_NAV_BASE_ITEMS];
    }
    return [...WORKSPACE_GOVERNANCE_PANEL_BASE_ITEMS];
  }

  const base: NavEntry[] = [...WORKSPACE_NAV_BASE_ITEMS];
  const proxiesIndex = base.findIndex(
    (item) => item.type === "item" && item.id === "proxies",
  );
  const billingInsertIndex = proxiesIndex >= 0 ? proxiesIndex + 1 : 2;
  if (input.isAuthenticated && input.canManageWorkspaceBilling) {
    base.splice(billingInsertIndex, 0, WORKSPACE_BILLING_NAV_GROUP);
  } else {
    base.splice(billingInsertIndex, 0, PRICING_NAV_ITEM);
  }
  if (input.teamRole !== "viewer") {
    return base;
  }
  return base
    .map((item) => {
      if (item.type === "group") {
        const children = item.children.filter(
          (child) => child.id !== "integrations",
        );
        if (children.length === 0) {
          return null;
        }
        return {
          ...item,
          children,
        } satisfies NavGroupItem;
      }
      if (item.id === "integrations") {
        return null;
      }
      return item;
    })
    .filter((item): item is NavEntry => item !== null);
}

type Props = {
  activeSection: AppSection;
  collapsed: boolean;
  onSectionChange: (section: AppSection) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  showAdminSection?: boolean;
  teamRole?: TeamRole | null;
  currentWorkspaceRole?: TeamRole | null;
  platformRole?: string | null;
  workspaceOptions?: Array<{
    id: string;
    label: string;
    details?: string;
    status?: string;
    planLabel?: string;
  }>;
  currentWorkspaceId?: string | null;
  onWorkspaceChange?: (workspaceId: string) => void;
  isWorkspaceSwitching?: boolean;
  authEmail?: string | null;
  authName?: string | null;
  authAvatar?: string | null;
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
  currentWorkspaceRole = null,
  platformRole = null,
  workspaceOptions = [],
  currentWorkspaceId = null,
  onWorkspaceChange,
  isWorkspaceSwitching = false,
  authEmail = null,
  authName = null,
  authAvatar = null,
  isAuthenticated = false,
  isAuthBusy = false,
  onSignIn,
  onSignOut,
}: Props) {
  const { t } = useTranslation();
  const isPlatformAdmin = platformRole === "platform_admin";
  const effectiveWorkspaceRole = currentWorkspaceRole ?? teamRole;
  const isTeamOperator =
    effectiveWorkspaceRole === "owner" || effectiveWorkspaceRole === "admin";
  const canManageWorkspaceBilling = isPlatformAdmin || isTeamOperator;
  const canManageWorkspaceGovernance =
    isPlatformAdmin ||
    effectiveWorkspaceRole === "owner" ||
    effectiveWorkspaceRole === "admin";
  const inAdminPanel = isAdminPanelSection(activeSection);
  const inWorkspaceGovernancePanel =
    activeSection === "workspace-governance" ||
    activeSection.startsWith("workspace-admin-");
  const panelMode: PanelMode = inAdminPanel
    ? "admin"
    : inWorkspaceGovernancePanel
      ? "workspace-governance"
      : "workspace";
  const roleLabel = isPlatformAdmin
    ? t("shell.roles.platform_admin")
    : effectiveWorkspaceRole
      ? t(`shell.roles.${effectiveWorkspaceRole}`)
      : t("shell.roles.guest");

  const navItems = useMemo(() => {
    return buildNavItems({
      panelMode,
      isAuthenticated,
      isPlatformAdmin,
      isTeamOperator,
      canManageWorkspaceBilling,
      canManageWorkspaceGovernance,
      teamRole: panelMode === "workspace" ? effectiveWorkspaceRole : teamRole,
    });
  }, [
    canManageWorkspaceBilling,
    canManageWorkspaceGovernance,
    effectiveWorkspaceRole,
    isAuthenticated,
    isPlatformAdmin,
    isTeamOperator,
    panelMode,
    teamRole,
  ]);
  const [expandedNavGroups, setExpandedNavGroups] = useState<
    Record<NavGroupId, boolean>
  >(() => ({
    "workspace-billing":
      activeSection === "pricing" ||
      activeSection === "billing" ||
      activeSection === "billing-checkout" ||
      activeSection === "billing-coupon" ||
      activeSection === "billing-license",
  }));

  useEffect(() => {
    if (panelMode !== "workspace") {
      return;
    }
    if (
      activeSection !== "pricing" &&
      activeSection !== "billing" &&
      activeSection !== "billing-checkout" &&
      activeSection !== "billing-coupon" &&
      activeSection !== "billing-license"
    ) {
      return;
    }
    setExpandedNavGroups((prev) => {
      if (prev["workspace-billing"]) {
        return prev;
      }
      return {
        ...prev,
        "workspace-billing": true,
      };
    });
  }, [activeSection, panelMode]);

  const toggleNavGroup = useCallback((groupId: NavGroupId) => {
    setExpandedNavGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const canSwitchWorkspace =
    workspaceOptions.length > 1 && Boolean(onWorkspaceChange);
  const selectedWorkspaceId =
    currentWorkspaceId ?? workspaceOptions[0]?.id ?? "default";
  const selectedWorkspace =
    workspaceOptions.find(
      (workspace) => workspace.id === selectedWorkspaceId,
    ) ??
    workspaceOptions[0] ??
    null;
  const workspaceContextLabel = roleLabel;
  const selectedWorkspaceSubLabel =
    selectedWorkspace?.details ??
    selectedWorkspace?.status ??
    workspaceContextLabel;
  const resolveWorkspacePlanLabel = useCallback(
    (planLabel?: string) => {
      const normalized = planLabel?.trim();
      if (normalized) {
        return normalized;
      }
      return t("billingPage.freePlanLabel");
    },
    [t],
  );
  const selectedWorkspacePlanLabel = resolveWorkspacePlanLabel(
    selectedWorkspace?.planLabel,
  );
  const selectedWorkspacePlanBadge = getPlanBadgeStyle(
    selectedWorkspacePlanLabel,
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    if (!isWorkspaceSwitching) {
      return;
    }
    setAccountMenuOpen(false);
  }, [isWorkspaceSwitching]);

  const handleAccountMenuOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (isWorkspaceSwitching && nextOpen) {
        return;
      }
      setAccountMenuOpen(nextOpen);
    },
    [isWorkspaceSwitching],
  );

  const handleWorkspaceMenuItemSelect = useCallback(
    (workspaceId: string) => {
      if (isWorkspaceSwitching) {
        return;
      }
      flushSync(() => {
        setAccountMenuOpen(false);
      });
      if (workspaceId === selectedWorkspaceId) {
        return;
      }
      window.requestAnimationFrame(() => {
        onWorkspaceChange?.(workspaceId);
      });
    },
    [isWorkspaceSwitching, onWorkspaceChange, selectedWorkspaceId],
  );

  const renderAccountMenuContent = () => {
    const canOpenWorkspaceGovernance =
      canManageWorkspaceGovernance && panelMode === "workspace";
    const canOpenAdminPanel = showAdminSection && panelMode !== "admin";
    const canBackToWorkspace =
      panelMode === "admin" || panelMode === "workspace-governance";
    const hasPanelActions =
      canOpenWorkspaceGovernance || canOpenAdminPanel || canBackToWorkspace;

    return (
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
          const workspacePlanLabel = resolveWorkspacePlanLabel(
            workspace.planLabel,
          );
          const workspacePlanBadge = getPlanBadgeStyle(workspacePlanLabel);
          return (
            <DropdownMenuItem
              key={workspace.id}
              onSelect={(event) => {
                event.preventDefault();
                handleWorkspaceMenuItemSelect(workspace.id);
              }}
              disabled={!canSwitchWorkspace || isWorkspaceSwitching}
              className={cn(
                "rounded-md px-2 py-2",
                isCurrentWorkspace && "bg-muted",
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="truncate text-[12px] font-semibold text-foreground">
                    {workspace.label}
                  </p>
                  <Badge
                    variant={workspacePlanBadge.variant}
                    className={workspacePlanBadge.className}
                  >
                    {workspacePlanLabel}
                  </Badge>
                </div>
                <p className="truncate text-[10px] font-medium text-muted-foreground">
                  {workspace.details ??
                    (isCurrentWorkspace
                      ? t("shell.workspaceSwitcher.current")
                      : t("shell.workspaceSwitcher.switchTo"))}
                </p>
                {workspace.status && (
                  <p className="truncate text-[10px] text-muted-foreground/80">
                    {workspace.status}
                  </p>
                )}
              </div>
              {isCurrentWorkspace && (
                <Check className="h-4 w-4 shrink-0 text-foreground" />
              )}
            </DropdownMenuItem>
          );
        })}
        {showAdminSection && (
          <DropdownMenuItem
            onClick={() => onSectionChange("admin-workspace")}
            className="rounded-md px-2 py-2"
          >
            <Plus className="h-4 w-4" />
            {t("shell.accountMenu.addWorkspace")}
          </DropdownMenuItem>
        )}
        {hasPanelActions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              {t("shell.accountMenu.panels")}
            </DropdownMenuLabel>
          </>
        )}
        {canOpenWorkspaceGovernance && (
          <DropdownMenuItem
            onClick={() => onSectionChange("workspace-admin-overview")}
            className="rounded-md px-2 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[12px] font-semibold text-foreground">
              {t("shell.panelSwitch.toWorkspaceGovernance")}
            </p>
          </DropdownMenuItem>
        )}
        {canOpenAdminPanel && (
          <DropdownMenuItem
            onClick={() => onSectionChange("admin-overview")}
            className="rounded-md px-2 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[12px] font-semibold text-foreground">
              {t("shell.panelSwitch.toAdmin")}
            </p>
          </DropdownMenuItem>
        )}
        {canBackToWorkspace && (
          <DropdownMenuItem
            onClick={() => onSectionChange("profiles")}
            className="rounded-md px-2 py-2"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
              <LifeBuoy className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-[12px] font-semibold text-foreground">
              {t("shell.panelSwitch.toWorkspace")}
            </p>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          disabled={isAuthBusy || !onSignOut}
        >
          <LogOut className="h-4 w-4" />
          {t("shell.auth.signOut")}
        </DropdownMenuItem>
      </>
    );
  };

  const renderNavItem = (item: NavLeafItem) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;

    const button = (
      <button
        type="button"
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "group flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold leading-[1.25] transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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

  const renderNavChildItem = (item: NavLeafItem) => {
    const Icon = item.icon;
    const isActive = activeSection === item.id;
    return (
      <button
        type="button"
        onClick={() => onSectionChange(item.id)}
        className={cn(
          "group flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-[12px] font-semibold transition-colors",
          isActive
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isActive
              ? "text-foreground"
              : "text-muted-foreground group-hover:text-foreground",
          )}
        />
        <span className="min-w-0 truncate">{t(item.labelKey)}</span>
      </button>
    );
  };

  const renderNavGroup = (item: NavGroupItem) => {
    const Icon = item.icon;
    const isActive = item.children.some((child) => child.id === activeSection);
    const isExpanded = expandedNavGroups[item.id] ?? false;

    if (collapsed) {
      const button = (
        <button
          type="button"
          className={cn(
            "group flex h-10 w-full items-center justify-center rounded-md text-left text-[13px] font-semibold leading-[1.25] transition-colors",
            isActive
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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
        </button>
      );

      return (
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            align="start"
            side="right"
            sideOffset={8}
            className="w-[220px]"
          >
            {item.children.map((child) => {
              const ChildIcon = child.icon;
              const isChildActive = activeSection === child.id;
              return (
                <DropdownMenuItem
                  key={child.id}
                  onClick={() => onSectionChange(child.id)}
                  className={cn(
                    "rounded-md px-2 py-2",
                    isChildActive && "bg-muted",
                  )}
                >
                  <ChildIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[12px] font-semibold text-foreground">
                    {t(child.labelKey)}
                  </span>
                  {isChildActive && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-foreground" />
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleNavGroup(item.id)}
          className={cn(
            "group flex h-10 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-semibold leading-[1.25] transition-colors",
            isActive
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
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
          <span className="min-w-0">{t(item.labelKey)}</span>
          <ChevronRight
            className={cn(
              "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        </button>
        <div
          className={cn(
            "ml-4 grid overflow-hidden transition-all duration-200",
            isExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 space-y-0.5">
            {item.children.map((child) => (
              <div key={child.id}>{renderNavChildItem(child)}</div>
            ))}
          </div>
        </div>
      </div>
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
            collapsed
              ? "flex h-11 items-center justify-between px-2"
              : "flex h-11 items-center gap-2 px-3",
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
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => onSectionChange("profiles")}
                  className="flex h-8 w-full items-center rounded-md px-1.5 transition-colors hover:bg-muted/60"
                >
                  <Logo
                    variant="full"
                    className="h-6 w-auto max-w-[168px] shrink-0 object-contain"
                  />
                </button>
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
        {canManageWorkspaceGovernance && (
          <div className="mb-2">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() =>
                      onSectionChange(
                        panelMode === "workspace-governance"
                          ? "profiles"
                          : "workspace-admin-overview",
                      )
                    }
                    className="flex h-9 w-full items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  >
                    {panelMode === "workspace-governance" ? (
                      <LifeBuoy className="h-4 w-4" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {panelMode === "workspace-governance"
                    ? t("shell.panelSwitch.toWorkspace")
                    : t("shell.panelSwitch.toWorkspaceGovernance")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={() =>
                  onSectionChange(
                    panelMode === "workspace-governance"
                      ? "profiles"
                      : "workspace-admin-overview",
                  )
                }
                className="group flex h-10 w-full items-center gap-2.5 rounded-md border border-border bg-muted/20 px-2.5 text-left text-[12px] font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                {panelMode === "workspace-governance" ? (
                  <LifeBuoy className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                ) : (
                  <Users className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                )}
                <span className="min-w-0 truncate">
                  {panelMode === "workspace-governance"
                    ? t("shell.panelSwitch.toWorkspace")
                    : t("shell.panelSwitch.toWorkspaceGovernance")}
                </span>
              </button>
            )}
          </div>
        )}
        <div className="space-y-0.5 pb-2">
          {navItems.map((item) => (
            <div key={item.id}>
              {item.type === "group"
                ? renderNavGroup(item)
                : renderNavItem(item)}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div className="border-t border-border px-3 py-2.5">
        {collapsed ? (
          isAuthenticated ? (
            <DropdownMenu
              open={accountMenuOpen}
              onOpenChange={handleAccountMenuOpenChange}
            >
              <DropdownMenuTrigger asChild disabled={isWorkspaceSwitching}>
                <button
                  type="button"
                  disabled={isWorkspaceSwitching}
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-0 overflow-hidden"
                >
                  {authAvatar ? (
                    <img
                      src={authAvatar}
                      alt={authName || "User Avatar"}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserRound className="h-4 w-4" />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-[292px] data-[state=closed]:animate-none"
              >
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
                  className="mx-auto flex h-8 w-8 items-center justify-center rounded-full text-foreground outline-none transition-colors hover:bg-muted/50 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
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
          <DropdownMenu
            open={accountMenuOpen}
            onOpenChange={handleAccountMenuOpenChange}
          >
            <DropdownMenuTrigger asChild disabled={isWorkspaceSwitching}>
              <button
                type="button"
                disabled={isWorkspaceSwitching}
                className="group flex w-full items-center gap-2 rounded-md px-3.5 py-2.5 text-left outline-none transition-colors hover:bg-muted/50 data-[state=open]:bg-muted/50 focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-70"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-foreground overflow-hidden">
                  {authAvatar ? (
                    <img
                      src={authAvatar}
                      alt={authName || "User Avatar"}
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserRound className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[12px] font-semibold text-foreground">
                      {selectedWorkspace?.label ??
                        t("shell.workspaceSwitcher.placeholder")}
                    </p>
                    {selectedWorkspace && (
                      <Badge
                        variant={selectedWorkspacePlanBadge.variant}
                        className={selectedWorkspacePlanBadge.className}
                      >
                        {selectedWorkspacePlanLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-[11px] font-medium text-muted-foreground">
                    {selectedWorkspaceSubLabel}
                  </p>
                </div>
                {(showAdminSection || canManageWorkspaceGovernance) && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted/70">
                    <Shield className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              className="w-[276px] max-w-[calc(100vw-24px)] data-[state=closed]:animate-none"
            >
              {renderAccountMenuContent()}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-2 rounded-md px-3.5 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-foreground">
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
