"use client";

import {
  Building2,
  Check,
  ChevronRight,
  ChevronsUpDown,
  Cookie,
  Crown,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  PanelLeftClose,
  Receipt,
  Settings2,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSectionIcon } from "@/lib/app-icon-registry";
import {
  getUnifiedPlanLabel,
  getUnifiedPlanToneClass,
  resolveUnifiedPlanId,
} from "@/lib/plan-display";
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
  automationFlowPreset?: "signup" | "signup_seller" | "update_cookie";
};

type NavGroupItem = {
  type: "group";
  id:
    | "workspace-billing"
    | "automation-menu"
    | "commerce-menu"
    | "super-command-menu"
    | "super-identity-menu"
    | "super-revenue-menu"
    | "super-governance-menu"
    | "super-operations-menu";
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  children: NavLeafItem[];
};

type NavEntry = NavLeafItem | NavGroupItem;
type NavGroupId = NavGroupItem["id"];
type NavSection = {
  id: "platform" | "projects";
  label: string;
  items: NavEntry[];
};
const SIDEBAR_NAV_ITEM_CLASS =
  "group flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left text-xs font-semibold leading-[1.2] tracking-normal transition-colors";
const SIDEBAR_NAV_CHILD_ITEM_CLASS =
  "group flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[11px] font-semibold tracking-normal transition-colors";
const SIDEBAR_NAV_ICON_CLASS = "h-4 w-4 shrink-0";
const SIDEBAR_ACCOUNT_TITLE_CLASS =
  "truncate text-xs leading-[1.25] font-semibold tracking-normal text-sidebar-foreground";
const SIDEBAR_ACCOUNT_META_CLASS =
  "truncate text-[11px] leading-[1.25] font-medium tracking-normal text-sidebar-foreground/70";
const SIDEBAR_ACCOUNT_ACTION_CLASS =
  "rounded-md px-2.5 py-2 text-xs leading-[1.2] font-semibold [&_svg:not([class*='size-'])]:size-4";
const SIDEBAR_WORKSPACE_ITEM_CLASS = "rounded-md px-2 py-1.5";
const SIDEBAR_TRIGGER_CLASS =
  "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none transition-colors hover:bg-sidebar-accent/80 data-[state=open]:bg-sidebar-accent/80 focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-70";
const SIDEBAR_EXPANDED_WIDTH_CLASS = "w-[248px] basis-[248px]";
const SIDEBAR_COLLAPSED_WIDTH_CLASS = "w-12 basis-12";
const AUTOMATION_FLOW_STORAGE_KEY = "buglogin.automation.flow";

const PROFILES_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "profiles",
  labelKey: "shell.sections.profiles",
  icon: getSectionIcon("profiles"),
};

const GROUPS_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "groups",
  labelKey: "shell.sections.groups",
  icon: getSectionIcon("groups"),
};

const AUTOMATION_SIGNUP_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "bugidea-automation",
  labelKey: "shell.sections.automationSignupTiktok",
  icon: UserPlus,
  automationFlowPreset: "signup",
};

const AUTOMATION_UPDATE_COOKIES_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "bugidea-automation",
  labelKey: "shell.sections.automationUpdateCookies",
  icon: Cookie,
  automationFlowPreset: "update_cookie",
};

const AUTOMATION_SIGNUP_TIKTOK_SELLER_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "bugidea-automation",
  labelKey: "shell.sections.automationSignupTiktokSeller",
  icon: UserRound,
  automationFlowPreset: "signup_seller",
};

const AUTOMATION_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "automation-menu",
  labelKey: "shell.sections.automation",
  icon: getSectionIcon("bugidea-automation"),
  children: [
    AUTOMATION_SIGNUP_NAV_ITEM,
    AUTOMATION_SIGNUP_TIKTOK_SELLER_NAV_ITEM,
    AUTOMATION_UPDATE_COOKIES_NAV_ITEM,
  ],
};

const PROXIES_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "proxies",
  labelKey: "shell.sections.proxies",
  icon: getSectionIcon("proxies"),
};

const PRICING_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "pricing",
  labelKey: "shell.sections.pricing",
  icon: getSectionIcon("pricing"),
};

const SETTINGS_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "settings",
  labelKey: "shell.sections.settings",
  icon: getSectionIcon("settings"),
};

const WORKSPACE_NAV_BASE_ITEMS: NavLeafItem[] = [
  PROFILES_NAV_ITEM,
  GROUPS_NAV_ITEM,
  PROXIES_NAV_ITEM,
  SETTINGS_NAV_ITEM,
];

const BILLING_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "billing",
  labelKey: "shell.sections.billingManagement",
  icon: getSectionIcon("billing"),
};

const _WORKSPACE_BILLING_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "workspace-billing",
  labelKey: "shell.sections.billing",
  icon: getSectionIcon("billing"),
  children: [PRICING_NAV_ITEM, BILLING_NAV_ITEM],
};

const WORKSPACE_OWNER_PANEL_NAV_ITEMS: NavLeafItem[] = [
  {
    type: "item",
    id: "workspace-owner-overview",
    labelKey: "shell.sections.workspaceAdminOverview",
    icon: getSectionIcon("workspace-owner-overview"),
  },
  {
    type: "item",
    id: "workspace-admin-members",
    labelKey: "shell.sections.workspaceAdminMembers",
    icon: getSectionIcon("workspace-admin-members"),
  },
  {
    type: "item",
    id: "workspace-admin-workspace",
    labelKey: "shell.sections.workspaceOwnerPlanManagement",
    icon: getSectionIcon("workspace-admin-workspace"),
  },
  {
    type: "item",
    id: "workspace-admin-access",
    labelKey: "shell.sections.workspaceOwnerUserPermissions",
    icon: getSectionIcon("workspace-admin-access"),
  },
];

const COMMERCE_COUPONS_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "super-admin-commerce-coupons",
  labelKey: "portalSite.admin.nav.coupons",
  icon: getSectionIcon("super-admin-commerce-coupons"),
};

const COMMERCE_AUDIT_NAV_ITEM: NavLeafItem = {
  type: "item",
  id: "super-admin-commerce-audit",
  labelKey: "adminWorkspace.panelTree.super.pages.commerceAudit.title",
  icon: getSectionIcon("super-admin-commerce-audit"),
};

const SUPER_ADMIN_COMMAND_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "super-command-menu",
  labelKey: "portalSite.admin.menu.commandCenter",
  icon: getSectionIcon("super-admin-overview"),
  children: [
    {
      type: "item",
      id: "super-admin-overview",
      labelKey: "portalSite.admin.nav.dashboard",
      icon: getSectionIcon("super-admin-overview"),
    },
    {
      type: "item",
      id: "super-admin-incident-board",
      labelKey: "portalSite.admin.nav.incidentBoard",
      icon: getSectionIcon("super-admin-incident-board"),
    },
    {
      type: "item",
      id: "super-admin-jobs-queues",
      labelKey: "portalSite.admin.nav.jobsQueues",
      icon: getSectionIcon("super-admin-jobs-queues"),
    },
    {
      type: "item",
      id: "super-admin-support-console",
      labelKey: "portalSite.admin.nav.supportConsole",
      icon: getSectionIcon("super-admin-support-console"),
    },
  ],
};

const SUPER_ADMIN_IDENTITY_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "super-identity-menu",
  labelKey: "portalSite.admin.menu.identityWorkspace",
  icon: getSectionIcon("super-admin-workspace"),
  children: [
    {
      type: "item",
      id: "super-admin-workspace",
      labelKey: "portalSite.admin.nav.workspaces",
      icon: getSectionIcon("super-admin-workspace"),
    },
    {
      type: "item",
      id: "super-admin-permissions",
      labelKey: "portalSite.admin.nav.permissions",
      icon: getSectionIcon("super-admin-permissions"),
    },
    {
      type: "item",
      id: "super-admin-memberships",
      labelKey: "portalSite.admin.nav.memberships",
      icon: getSectionIcon("super-admin-memberships"),
    },
    {
      type: "item",
      id: "super-admin-users",
      labelKey: "portalSite.adminUsers.navTitle",
      icon: getSectionIcon("super-admin-users"),
    },
    {
      type: "item",
      id: "super-admin-abuse-trust",
      labelKey: "portalSite.admin.nav.abuseTrust",
      icon: getSectionIcon("super-admin-abuse-trust"),
    },
    {
      type: "item",
      id: "super-admin-impersonation-center",
      labelKey: "portalSite.admin.nav.impersonationCenter",
      icon: getSectionIcon("super-admin-impersonation-center"),
    },
  ],
};

const SUPER_ADMIN_REVENUE_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "super-revenue-menu",
  labelKey: "portalSite.admin.menu.revenueCommerce",
  icon: getSectionIcon("super-admin-billing"),
  children: [
    {
      type: "item",
      id: "super-admin-subscriptions",
      labelKey: "portalSite.admin.nav.subscriptions",
      icon: getSectionIcon("super-admin-subscriptions"),
    },
    {
      type: "item",
      id: "super-admin-invoices",
      labelKey: "portalSite.admin.nav.invoices",
      icon: getSectionIcon("super-admin-invoices"),
    },
    COMMERCE_COUPONS_NAV_ITEM,
  ],
};

const SUPER_ADMIN_GOVERNANCE_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "super-governance-menu",
  labelKey: "portalSite.admin.menu.governanceSecurity",
  icon: getSectionIcon("super-admin-policy-center"),
  children: [
    {
      type: "item",
      id: "super-admin-policy-center",
      labelKey: "portalSite.admin.nav.policyCenter",
      icon: getSectionIcon("super-admin-policy-center"),
    },
    {
      type: "item",
      id: "super-admin-data-governance",
      labelKey: "portalSite.admin.nav.dataGovernance",
      icon: getSectionIcon("super-admin-data-governance"),
    },
    {
      type: "item",
      id: "super-admin-feature-flags",
      labelKey: "portalSite.admin.nav.featureFlags",
      icon: getSectionIcon("super-admin-feature-flags"),
    },
    {
      type: "item",
      id: "super-admin-audit",
      labelKey: "portalSite.admin.nav.audit",
      icon: getSectionIcon("super-admin-audit"),
    },
  ],
};

const SUPER_ADMIN_OPERATIONS_NAV_GROUP: NavGroupItem = {
  type: "group",
  id: "super-operations-menu",
  labelKey: "portalSite.admin.menu.operations",
  icon: getSectionIcon("super-admin-system"),
  children: [
    {
      type: "item",
      id: "super-admin-browser-update",
      labelKey: "portalSite.admin.nav.browserUpdate",
      icon: getSectionIcon("super-admin-browser-update"),
    },
    {
      type: "item",
      id: "super-admin-system",
      labelKey: "portalSite.admin.nav.system",
      icon: getSectionIcon("super-admin-system"),
    },
    COMMERCE_AUDIT_NAV_ITEM,
  ],
};

const SUPER_ADMIN_PANEL_NAV_ITEMS: NavEntry[] = [
  SUPER_ADMIN_COMMAND_NAV_GROUP,
  SUPER_ADMIN_IDENTITY_NAV_GROUP,
  SUPER_ADMIN_REVENUE_NAV_GROUP,
  SUPER_ADMIN_GOVERNANCE_NAV_GROUP,
  SUPER_ADMIN_OPERATIONS_NAV_GROUP,
];

function isSuperAdminPanelSection(section: AppSection): boolean {
  return section.startsWith("super-admin-") || section.startsWith("admin-");
}

type PanelMode = "workspace" | "workspace-owner" | "super-admin";

type NavBuildInput = {
  panelMode: PanelMode;
  isAuthenticated: boolean;
  isPlatformAdmin: boolean;
  isDeveloperBuild: boolean;
  canAccessBugIdeaWorkspace: boolean;
  canAccessWorkspaceGovernance: boolean;
  isTeamOperator: boolean;
  canManageWorkspaceBilling: boolean;
  canManageWorkspaceGovernance: boolean;
  teamRole: TeamRole | null;
};

function buildNavItems(input: NavBuildInput): NavEntry[] {
  if (input.panelMode === "super-admin") {
    return SUPER_ADMIN_PANEL_NAV_ITEMS.filter(
      (item) =>
        item.id !== "super-admin-cookies" || input.canAccessBugIdeaWorkspace,
    );
  }

  if (input.panelMode === "workspace-owner") {
    return WORKSPACE_OWNER_PANEL_NAV_ITEMS.filter((item) => {
      if (item.id === "workspace-admin-access") {
        return input.canManageWorkspaceGovernance;
      }
      return input.canAccessWorkspaceGovernance;
    });
  }

  const base: NavEntry[] = [...WORKSPACE_NAV_BASE_ITEMS];
  if (input.canAccessBugIdeaWorkspace) {
    const profileIndex = base.findIndex(
      (item) => item.type === "item" && item.id === "profiles",
    );
    const bugIdeaInsertIndex = profileIndex >= 0 ? profileIndex + 1 : 0;
    base.splice(bugIdeaInsertIndex, 0, AUTOMATION_NAV_GROUP);
  }
  return base;
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
  isDeveloperBuild?: boolean;
  workspaceOptions?: Array<{
    id: string;
    label: string;
    details?: string;
    status?: string;
    planLabel?: string;
    profileLimit?: number | null;
    profilesUsed?: number | null;
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
  navigationMode?: "default" | "portal-account" | "portal-admin";
};

function AppSidebarComponent({
  activeSection,
  collapsed,
  onSectionChange,
  onCollapsedChange,
  showAdminSection: _showAdminSection = false,
  teamRole = null,
  currentWorkspaceRole = null,
  platformRole = null,
  isDeveloperBuild = false,
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
  navigationMode = "default",
}: Props) {
  const { t } = useTranslation();
  const isPlatformAdmin = platformRole === "platform_admin";
  const effectiveWorkspaceRole = currentWorkspaceRole ?? teamRole;
  const isTeamOperator =
    effectiveWorkspaceRole === "owner" || effectiveWorkspaceRole === "admin";
  const canManageWorkspaceBilling = isPlatformAdmin || isTeamOperator;
  const canManageWorkspaceGovernance = true;
  const canAccessWorkspaceGovernance = true;
  const inSuperAdminPanel = isSuperAdminPanelSection(activeSection);
  const inWorkspaceOwnerPanel =
    activeSection.startsWith("workspace-owner-") ||
    activeSection === "workspace-governance" ||
    activeSection.startsWith("workspace-admin-");
  const panelMode: PanelMode = inSuperAdminPanel
    ? "super-admin"
    : inWorkspaceOwnerPanel
      ? "workspace-owner"
      : "workspace";
  const [automationFlowSelection, setAutomationFlowSelection] = useState<
    "signup" | "signup_seller" | "update_cookie"
  >("signup");
  const effectiveActiveSection = activeSection;
  const roleLabel = isPlatformAdmin
    ? t("shell.roles.platform_admin")
    : effectiveWorkspaceRole
      ? t(`shell.roles.${effectiveWorkspaceRole}`)
      : t("shell.roles.guest");

  const scheduleSectionChange = useCallback(
    (nextSection: AppSection) => {
      if (isWorkspaceSwitching) {
        return;
      }
      onSectionChange(nextSection);
    },
    [isWorkspaceSwitching, onSectionChange],
  );

  const persistAutomationFlowPreset = useCallback(
    (flowPreset?: "signup" | "signup_seller" | "update_cookie") => {
      if (!flowPreset || typeof window === "undefined") {
        return;
      }
      try {
        window.localStorage.setItem(AUTOMATION_FLOW_STORAGE_KEY, flowPreset);
        window.dispatchEvent(
          new CustomEvent("buglogin:automation-flow-changed", {
            detail: flowPreset,
          }),
        );
        setAutomationFlowSelection(flowPreset);
      } catch {
        // Ignore storage errors.
      }
    },
    [],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const persistedFlow = window.localStorage.getItem(
        AUTOMATION_FLOW_STORAGE_KEY,
      );
      if (
        persistedFlow === "signup" ||
        persistedFlow === "signup_seller" ||
        persistedFlow === "update_cookie"
      ) {
        setAutomationFlowSelection(persistedFlow);
      }
    } catch {
      // Ignore storage read errors.
    }
  }, []);

  const navItems = useMemo(() => {
    if (navigationMode === "portal-account") {
      const items: NavEntry[] = [
        {
          type: "item",
          id: "profiles",
          labelKey: "shell.sections.accountOverview",
          icon: LayoutDashboard,
        },
      ];

      if (canManageWorkspaceGovernance) {
        items.push({
          type: "item",
          id: "account-members",
          labelKey: "adminWorkspace.ui.memberList",
          icon: Users,
        });
      }

      items.push(
        {
          type: "item",
          id: "pricing",
          labelKey: "shell.sections.accountBilling",
          icon: Crown,
        },
        {
          type: "item",
          id: "billing",
          labelKey: "shell.sections.accountInvoices",
          icon: Receipt,
        },
        {
          type: "item",
          id: "settings",
          labelKey: "shell.sections.accountSettings",
          icon: Settings2,
        },
      );
      return items;
    }

    return buildNavItems({
      panelMode,
      isAuthenticated,
      isPlatformAdmin,
      isDeveloperBuild,
      canAccessBugIdeaWorkspace: isPlatformAdmin,
      canAccessWorkspaceGovernance,
      isTeamOperator,
      canManageWorkspaceBilling,
      canManageWorkspaceGovernance,
      teamRole: panelMode === "workspace" ? effectiveWorkspaceRole : teamRole,
    });
  }, [
    navigationMode,
    canManageWorkspaceBilling,
    canAccessWorkspaceGovernance,
    canManageWorkspaceGovernance,
    effectiveWorkspaceRole,
    isAuthenticated,
    isDeveloperBuild,
    isPlatformAdmin,
    isTeamOperator,
    panelMode,
    teamRole,
  ]);

  const navSections = useMemo<NavSection[]>(() => {
    if (panelMode !== "workspace") {
      return [
        {
          id: "platform",
          label: t("shell.navigationGroups.platform"),
          items: navItems,
        },
      ];
    }

    const platformItemIds = new Set<AppSection>([
      "profiles",
      "groups",
      "bugidea-automation",
    ]);
    const platformItems: NavEntry[] = [];
    const projectItems: NavEntry[] = [];

    navItems.forEach((item) => {
      if (item.type === "item" && platformItemIds.has(item.id)) {
        platformItems.push(item);
        return;
      }
      projectItems.push(item);
    });

    const sections: NavSection[] = [];
    if (platformItems.length > 0) {
      sections.push({
        id: "platform",
        label: t("shell.navigationGroups.platform"),
        items: platformItems,
      });
    }
    if (projectItems.length > 0) {
      sections.push({
        id: "projects",
        label: t("shell.navigationGroups.projects"),
        items: projectItems,
      });
    }
    return sections;
  }, [navItems, panelMode, t]);
  const [expandedNavGroups, setExpandedNavGroups] = useState<
    Record<NavGroupId, boolean>
  >(() => ({
    "workspace-billing":
      activeSection === "pricing" || activeSection === "billing",
    "automation-menu": true,
    "commerce-menu": activeSection.startsWith("super-admin-commerce-"),
    "super-command-menu":
      activeSection.startsWith("super-admin-overview") ||
      activeSection.startsWith("super-admin-incident-board") ||
      activeSection.startsWith("super-admin-jobs-queues") ||
      activeSection.startsWith("super-admin-support-console"),
    "super-identity-menu":
      activeSection.startsWith("super-admin-workspace") ||
      activeSection.startsWith("super-admin-permissions") ||
      activeSection.startsWith("super-admin-memberships") ||
      activeSection.startsWith("super-admin-users") ||
      activeSection.startsWith("super-admin-abuse-trust") ||
      activeSection.startsWith("super-admin-impersonation-center"),
    "super-revenue-menu":
      activeSection.startsWith("super-admin-billing") ||
      activeSection.startsWith("super-admin-subscriptions") ||
      activeSection.startsWith("super-admin-invoices") ||
      activeSection.startsWith("super-admin-commerce-coupons"),
    "super-governance-menu":
      activeSection.startsWith("super-admin-policy-center") ||
      activeSection.startsWith("super-admin-data-governance") ||
      activeSection.startsWith("super-admin-feature-flags") ||
      activeSection.startsWith("super-admin-audit"),
    "super-operations-menu":
      activeSection.startsWith("super-admin-system") ||
      activeSection.startsWith("super-admin-commerce-audit"),
  }));

  useEffect(() => {
    if (panelMode !== "workspace") {
      return;
    }
    if (activeSection !== "pricing" && activeSection !== "billing") {
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

  useEffect(() => {
    if (panelMode !== "super-admin") {
      return;
    }
    if (!activeSection.startsWith("super-admin-commerce-")) {
      return;
    }
    setExpandedNavGroups((prev) => {
      if (prev["commerce-menu"]) {
        return prev;
      }
      return {
        ...prev,
        "commerce-menu": true,
      };
    });
  }, [activeSection, panelMode]);

  const toggleNavGroup = useCallback((groupId: NavGroupId) => {
    setExpandedNavGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  const isChildSectionActive = useCallback(
    (item: NavLeafItem) => {
      if (effectiveActiveSection !== item.id) {
        return false;
      }
      if (item.id !== "bugidea-automation" || !item.automationFlowPreset) {
        return true;
      }
      return item.automationFlowPreset === automationFlowSelection;
    },
    [automationFlowSelection, effectiveActiveSection],
  );

  const canSwitchWorkspace =
    !(navigationMode === "portal-admin" && panelMode === "super-admin") &&
    workspaceOptions.length > 1 &&
    Boolean(onWorkspaceChange);
  const preferPlanBadgeOnly = navigationMode === "portal-account";
  const selectedWorkspaceId =
    currentWorkspaceId ?? workspaceOptions[0]?.id ?? "default";
  const selectedWorkspace =
    workspaceOptions.find(
      (workspace) => workspace.id === selectedWorkspaceId,
    ) ??
    workspaceOptions[0] ??
    null;
  const workspaceContextLabel = selectedWorkspace?.label ?? roleLabel;
  const accountContextLabel =
    panelMode === "super-admin" ? roleLabel : workspaceContextLabel;
  const resolveWorkspacePlanLabel = useCallback(
    (
      workspace?: {
        planLabel?: string;
        details?: string;
      } | null,
    ) => {
      return getUnifiedPlanLabel({
        planLabel: workspace?.planLabel,
      });
    },
    [],
  );
  const formatWorkspaceQuotaBadge = useCallback(
    (profileLimit?: number | null, profilesUsed?: number | null) => {
      const used =
        typeof profilesUsed === "number" &&
        Number.isFinite(profilesUsed) &&
        profilesUsed >= 0
          ? Math.floor(profilesUsed)
          : 0;
      if (
        typeof profileLimit === "number" &&
        Number.isFinite(profileLimit) &&
        profileLimit > 0
      ) {
        return `${used.toLocaleString("en-US")}/${profileLimit.toLocaleString("en-US")}`;
      }
      return `${used.toLocaleString("en-US")}/∞`;
    },
    [],
  );

  const handleWorkspaceMenuItemSelect = useCallback(
    (workspaceId: string) => {
      if (isWorkspaceSwitching) {
        return;
      }
      if (workspaceId === selectedWorkspaceId) {
        return;
      }
      onWorkspaceChange?.(workspaceId);
    },
    [isWorkspaceSwitching, onWorkspaceChange, selectedWorkspaceId],
  );

  const handleWorkspaceSectionMenuItemSelect = useCallback(
    (workspaceId: string, section: AppSection) => {
      if (isWorkspaceSwitching) {
        return;
      }
      if (workspaceId !== selectedWorkspaceId) {
        onWorkspaceChange?.(workspaceId);
      }
      scheduleSectionChange(section);
    },
    [
      isWorkspaceSwitching,
      onWorkspaceChange,
      scheduleSectionChange,
      selectedWorkspaceId,
    ],
  );

  const renderAccountMenuContent = () => {
    const canOpenWorkspaceOwnerPanel =
      canAccessWorkspaceGovernance && panelMode === "workspace";
    const canOpenSuperAdminPanel = isPlatformAdmin && panelMode === "workspace";
    const canBackToWorkspace = panelMode !== "workspace";
    const isPortalSuperAdminMenu =
      navigationMode === "portal-admin" && panelMode === "super-admin";
    const showWorkspaceSwitcherInMenu =
      !isPortalSuperAdminMenu && workspaceOptions.length > 0;
    const menuWorkspaceId = selectedWorkspaceId;

    return (
      <>
        <DropdownMenuLabel className="space-y-1 px-3 pt-2.5 pb-2">
          <p className={SIDEBAR_ACCOUNT_TITLE_CLASS}>
            {authEmail ?? t("shell.auth.loggedOut")}
          </p>
          <p className={SIDEBAR_ACCOUNT_META_CLASS}>{accountContextLabel}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canOpenSuperAdminPanel && (
          <DropdownMenuItem
            onSelect={() => {
              handleWorkspaceSectionMenuItemSelect(
                menuWorkspaceId,
                "super-admin-overview",
              );
            }}
            disabled={isWorkspaceSwitching}
            className={SIDEBAR_ACCOUNT_ACTION_CLASS}
          >
            <LayoutDashboard className={SIDEBAR_NAV_ICON_CLASS} />
            {t("shell.panelSwitch.toAdmin")}
          </DropdownMenuItem>
        )}
        {canOpenWorkspaceOwnerPanel && (
          <DropdownMenuItem
            onSelect={() => {
              handleWorkspaceSectionMenuItemSelect(
                menuWorkspaceId,
                "workspace-owner-overview",
              );
            }}
            disabled={isWorkspaceSwitching}
            className={SIDEBAR_ACCOUNT_ACTION_CLASS}
          >
            <Users className={SIDEBAR_NAV_ICON_CLASS} />
            {t("shell.panelSwitch.toWorkspaceGovernance")}
          </DropdownMenuItem>
        )}
        {canBackToWorkspace && (
          <DropdownMenuItem
            onSelect={() => {
              handleWorkspaceSectionMenuItemSelect(menuWorkspaceId, "profiles");
            }}
            disabled={isWorkspaceSwitching}
            className={SIDEBAR_ACCOUNT_ACTION_CLASS}
          >
            <LifeBuoy className={SIDEBAR_NAV_ICON_CLASS} />
            {t("shell.panelSwitch.toWorkspace")}
          </DropdownMenuItem>
        )}
        {(canOpenSuperAdminPanel ||
          canOpenWorkspaceOwnerPanel ||
          canBackToWorkspace) && <DropdownMenuSeparator />}
        {showWorkspaceSwitcherInMenu && (
          <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
            {t("shell.accountMenu.workspaces")}
          </DropdownMenuLabel>
        )}
        {showWorkspaceSwitcherInMenu &&
          workspaceOptions.map((workspace) => {
            const isCurrentWorkspace = workspace.id === selectedWorkspaceId;
            const canSwitchToThisWorkspace =
              canSwitchWorkspace && !isCurrentWorkspace;
            const hasUsageQuota =
              !preferPlanBadgeOnly &&
              typeof workspace.profileLimit === "number" &&
              Number.isFinite(workspace.profileLimit) &&
              workspace.profileLimit > 0 &&
              typeof workspace.profilesUsed === "number" &&
              Number.isFinite(workspace.profilesUsed) &&
              workspace.profilesUsed >= 0;
            const workspaceLimitBadge = hasUsageQuota
              ? formatWorkspaceQuotaBadge(
                  workspace.profileLimit,
                  workspace.profilesUsed,
                )
              : null;
            const workspacePlanBadge = resolveWorkspacePlanLabel(workspace);
            const workspacePlanToneClass = getUnifiedPlanToneClass(
              resolveUnifiedPlanId({
                planLabel: workspace.planLabel,
              }),
            );
            return (
              <DropdownMenuItem
                key={workspace.id}
                onSelect={() => {
                  handleWorkspaceMenuItemSelect(workspace.id);
                }}
                disabled={!canSwitchToThisWorkspace || isWorkspaceSwitching}
                className={cn(
                  SIDEBAR_WORKSPACE_ITEM_CLASS,
                  isCurrentWorkspace && "bg-muted",
                )}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-background">
                  <Building2
                    className={`${SIDEBAR_NAV_ICON_CLASS} text-muted-foreground`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={SIDEBAR_ACCOUNT_TITLE_CLASS}>
                    {workspace.label}
                  </p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <p
                      className={`min-w-0 flex-1 ${SIDEBAR_ACCOUNT_META_CLASS}`}
                    >
                      {workspace.details ??
                        (isCurrentWorkspace
                          ? t("shell.workspaceSwitcher.current")
                          : t("shell.workspaceSwitcher.switchTo"))}
                    </p>
                    {workspaceLimitBadge ? (
                      <Badge
                        variant="secondary"
                        className="h-5 shrink-0 rounded-full px-1.5 text-[10px] font-semibold"
                      >
                        {workspaceLimitBadge}
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className={cn(
                          "h-5 shrink-0 rounded-full px-1.5 text-[10px] font-semibold",
                          workspacePlanToneClass,
                        )}
                      >
                        {workspacePlanBadge}
                      </Badge>
                    )}
                  </div>
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
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onSignOut}
          disabled={isAuthBusy || !onSignOut}
          className={SIDEBAR_ACCOUNT_ACTION_CLASS}
        >
          <LogOut className={SIDEBAR_NAV_ICON_CLASS} />
          {t("shell.auth.signOut")}
        </DropdownMenuItem>
      </>
    );
  };

  const renderNavItem = (item: NavLeafItem) => {
    const Icon = item.icon;
    const isActive = effectiveActiveSection === item.id;

    const button = (
      <button
        type="button"
        onClick={() => {
          persistAutomationFlowPreset(item.automationFlowPreset);
          scheduleSectionChange(item.id);
        }}
        className={cn(
          SIDEBAR_NAV_ITEM_CLASS,
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon
          className={cn(
            SIDEBAR_NAV_ICON_CLASS,
            isActive
              ? "text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
          )}
        />
        {!collapsed && (
          <>
            <span className="min-w-0 truncate">{t(item.labelKey)}</span>
            {isActive && (
              <ChevronRight
                className={`ml-auto ${SIDEBAR_NAV_ICON_CLASS} text-sidebar-foreground/70`}
              />
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
    const isActive = isChildSectionActive(item);

    return (
      <button
        type="button"
        onClick={() => {
          persistAutomationFlowPreset(item.automationFlowPreset);
          scheduleSectionChange(item.id);
        }}
        className={cn(
          SIDEBAR_NAV_CHILD_ITEM_CLASS,
          "h-8 gap-2.5 px-3 text-[12px] font-medium",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        )}
      >
        <span className="min-w-0 truncate">{t(item.labelKey)}</span>
      </button>
    );
  };

  const renderNavGroup = (item: NavGroupItem) => {
    const Icon = item.icon;
    const isActive = item.children.some((child) => isChildSectionActive(child));
    const isExpanded = expandedNavGroups[item.id] ?? false;

    if (collapsed) {
      const button = (
        <button
          type="button"
          className={cn(
            "group flex h-9 w-full items-center justify-center rounded-md text-left text-xs font-semibold leading-[1.2] tracking-normal transition-colors",
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon
            className={cn(
              SIDEBAR_NAV_ICON_CLASS,
              isActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
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
              const isChildActive = isChildSectionActive(child);
              const childKey = `${child.id}:${child.automationFlowPreset ?? "default"}`;
              return (
                <DropdownMenuItem
                  key={childKey}
                  onClick={() => {
                    persistAutomationFlowPreset(child.automationFlowPreset);
                    scheduleSectionChange(child.id);
                  }}
                  className={cn(
                    SIDEBAR_WORKSPACE_ITEM_CLASS,
                    isChildActive && "bg-sidebar-accent",
                  )}
                >
                  <span className="text-xs font-medium leading-[1.25] tracking-normal text-sidebar-foreground">
                    {t(child.labelKey)}
                  </span>
                  {isChildActive && (
                    <Check
                      className={`ml-auto ${SIDEBAR_NAV_ICON_CLASS} text-sidebar-accent-foreground`}
                    />
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
            SIDEBAR_NAV_ITEM_CLASS,
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon
            className={cn(
              SIDEBAR_NAV_ICON_CLASS,
              isActive
                ? "text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 group-hover:text-sidebar-accent-foreground",
            )}
          />
          <span className="min-w-0">{t(item.labelKey)}</span>
          <ChevronRight
            className={cn(
              `ml-auto ${SIDEBAR_NAV_ICON_CLASS} text-sidebar-foreground/70 transition-transform duration-200`,
              isExpanded && "rotate-90",
            )}
          />
        </button>
        <div
          className={cn(
            "ml-4 grid overflow-hidden transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
            isExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="min-h-0 space-y-0.5 border-l border-sidebar-border/70 pl-2">
            {item.children.map((child) => {
              const childKey = `${child.id}:${child.automationFlowPreset ?? "default"}`;
              return <div key={childKey}>{renderNavChildItem(child)}</div>;
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "app-shell-sidebar relative flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground tracking-normal transition-[width,flex-basis] duration-150 ease-out will-change-[width,flex-basis] motion-reduce:transition-none",
        collapsed
          ? SIDEBAR_COLLAPSED_WIDTH_CLASS
          : SIDEBAR_EXPANDED_WIDTH_CLASS,
      )}
    >
      <div
        className="shrink-0"
        style={{ height: "var(--window-titlebar-height)" }}
      />

      <div className="shrink-0 border-b border-sidebar-border">
        <div
          className={cn(
            collapsed
              ? "flex h-11 items-center justify-center px-1"
              : "px-2 py-2",
          )}
        >
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (onCollapsedChange) {
                      onCollapsedChange(false);
                      return;
                    }
                    scheduleSectionChange("profiles");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-sidebar-accent/80"
                >
                  <Logo variant="icon" className="h-7 w-7 rounded-md" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">BugLogin</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => scheduleSectionChange("profiles")}
                className="flex h-9 min-w-0 flex-1 items-center rounded-md px-2 transition-colors hover:bg-sidebar-accent/80"
              >
                <Logo variant="full" className="h-7 w-auto max-w-[136px]" />
              </button>

              {onCollapsedChange && (
                <button
                  type="button"
                  onClick={() => onCollapsedChange(true)}
                  aria-label={t("shell.collapseSidebar")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <ScrollArea
        className={cn("flex-1 pb-2 pt-1", collapsed ? "px-1" : "px-1.5")}
      >
        <div className="space-y-3 pb-2">
          {navSections.map((section) => (
            <div key={section.id} className="space-y-1">
              {!collapsed && (
                <p className="px-2.5 text-[11px] font-medium text-sidebar-foreground/60">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const itemKey =
                    item.type === "group"
                      ? item.id
                      : `${item.id}:${item.automationFlowPreset ?? "default"}`;
                  return (
                    <div key={itemKey}>
                      {item.type === "group"
                        ? renderNavGroup(item)
                        : renderNavItem(item)}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* ── Footer ── */}
      <div
        className={cn(
          "border-t border-sidebar-border py-2.5",
          collapsed ? "px-1.5" : "px-2.5",
        )}
      >
        {collapsed ? (
          isAuthenticated ? (
            <DropdownMenu
              modal={false}
              key={`${selectedWorkspaceId}:${isWorkspaceSwitching ? "busy" : "idle"}:collapsed`}
            >
              <DropdownMenuTrigger asChild disabled={isWorkspaceSwitching}>
                <button
                  type="button"
                  disabled={isWorkspaceSwitching}
                  className="mx-auto flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-0"
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
                forceMount
                className="w-[292px] will-change-[opacity,transform] data-[state=open]:duration-100 data-[state=closed]:animate-none"
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
                  className="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/70 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
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
            modal={false}
            key={`${selectedWorkspaceId}:${isWorkspaceSwitching ? "busy" : "idle"}`}
          >
            <DropdownMenuTrigger asChild disabled={isWorkspaceSwitching}>
              <button
                type="button"
                disabled={isWorkspaceSwitching}
                className={SIDEBAR_TRIGGER_CLASS}
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sidebar-accent text-sidebar-accent-foreground">
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
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className={`min-w-0 ${SIDEBAR_ACCOUNT_TITLE_CLASS}`}>
                    {authEmail ?? t("shell.auth.loggedOut")}
                  </p>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                    <p
                      className={`min-w-0 flex-1 ${SIDEBAR_ACCOUNT_META_CLASS}`}
                    >
                      {selectedWorkspace?.label ??
                        t("shell.workspaceSwitcher.placeholder")}
                    </p>
                    {selectedWorkspace &&
                      (() => {
                        const hasUsageQuota =
                          !preferPlanBadgeOnly &&
                          typeof selectedWorkspace.profileLimit === "number" &&
                          Number.isFinite(selectedWorkspace.profileLimit) &&
                          selectedWorkspace.profileLimit > 0 &&
                          typeof selectedWorkspace.profilesUsed === "number" &&
                          Number.isFinite(selectedWorkspace.profilesUsed) &&
                          selectedWorkspace.profilesUsed >= 0;
                        if (hasUsageQuota) {
                          return (
                            <Badge
                              variant="secondary"
                              className="h-4 shrink-0 rounded-full px-1 text-[9px] font-semibold"
                            >
                              {formatWorkspaceQuotaBadge(
                                selectedWorkspace.profileLimit,
                                selectedWorkspace.profilesUsed,
                              )}
                            </Badge>
                          );
                        }
                        const selectedPlanBadge =
                          resolveWorkspacePlanLabel(selectedWorkspace);
                        return (
                          <Badge
                            variant="default"
                            className={cn(
                              "h-4 shrink-0 rounded-full px-1 text-[9px] font-semibold",
                              getUnifiedPlanToneClass(
                                resolveUnifiedPlanId({
                                  planLabel: selectedWorkspace.planLabel,
                                }),
                              ),
                            )}
                          >
                            {selectedPlanBadge}
                          </Badge>
                        );
                      })()}
                  </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/70 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={8}
              forceMount
              className="w-[276px] max-w-[calc(100vw-24px)] will-change-[opacity,transform] data-[state=open]:duration-100 data-[state=closed]:animate-none"
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
              <p className={SIDEBAR_ACCOUNT_TITLE_CLASS}>
                {t("shell.auth.loggedOut")}
              </p>
              <p className={SIDEBAR_ACCOUNT_META_CLASS}>
                {t("shell.auth.disconnected")}
              </p>
            </div>
            <button
              type="button"
              onClick={onSignIn}
              disabled={isAuthBusy || !onSignIn}
              className="type-ui-sm rounded-md border border-border px-2 py-1 text-foreground transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t("shell.auth.signIn")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export const AppSidebar = memo(AppSidebarComponent);
