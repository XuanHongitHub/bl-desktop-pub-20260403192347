"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthPricingWorkspace } from "@/components/auth-pricing-workspace";
import { CamoufoxConfigDialog } from "@/components/camoufox-config-dialog";
import { CloneProfileDialog } from "@/components/clone-profile-dialog";
import { CookieCopyDialog } from "@/components/cookie-copy-dialog";
import { CookieManagementDialog } from "@/components/cookie-management-dialog";
import { CreateProfileDialog } from "@/components/create-profile-dialog";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { ExtensionGroupAssignmentDialog } from "@/components/extension-group-assignment-dialog";
import { ExtensionManagementDialog } from "@/components/extension-management-dialog";
import { GroupAssignmentDialog } from "@/components/group-assignment-dialog";
import { GroupBadges } from "@/components/group-badges";
import { GroupManagementDialog } from "@/components/group-management-dialog";
import { ImportProfileDialog } from "@/components/import-profile-dialog";
import { IntegrationsDialog } from "@/components/integrations-dialog";
import { LaunchOnLoginDialog } from "@/components/launch-on-login-dialog";
import { PermissionDialog } from "@/components/permission-dialog";
import { PlatformAdminWorkspace } from "@/components/platform-admin-workspace";
import { ProfilesDataTable } from "@/components/profile-data-table";
import { ProfileSelectorDialog } from "@/components/profile-selector-dialog";
import { ProfileSyncDialog } from "@/components/profile-sync-dialog";
import {
  ProfilesWorkspaceHeaderActions,
  ProfilesWorkspaceToolbar,
} from "@/components/profiles-workspace-chrome";
import { ProxyAssignmentDialog } from "@/components/proxy-assignment-dialog";
import { ProxyManagementDialog } from "@/components/proxy-management-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { SyncAllDialog } from "@/components/sync-all-dialog";
import { SyncConfigDialog } from "@/components/sync-config-dialog";
import { WorkspaceBillingPage } from "@/components/workspace-billing-page";
import { WorkspacePricingPage } from "@/components/workspace-pricing-page";
import { WayfernTermsDialog } from "@/components/wayfern-terms-dialog";
import { WindowResizeWarningDialog } from "@/components/window-resize-warning-dialog";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { useAppUpdateNotifications } from "@/hooks/use-app-update-notifications";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import { useGroupEvents } from "@/hooks/use-group-events";
import type { PermissionType } from "@/hooks/use-permissions";
import { usePermissions } from "@/hooks/use-permissions";
import { useProfileEvents } from "@/hooks/use-profile-events";
import { useProxyEvents } from "@/hooks/use-proxy-events";
import { useRuntimeAccess } from "@/hooks/use-runtime-access";
import { useUpdateNotifications } from "@/hooks/use-update-notifications";
import { useVersionUpdater } from "@/hooks/use-version-updater";
import { useVpnEvents } from "@/hooks/use-vpn-events";
import { useWayfernTerms } from "@/hooks/use-wayfern-terms";
import { extractRootError } from "@/lib/error-utils";
import {
  canPerformTeamAction,
  normalizeTeamRole,
  type TeamAction,
} from "@/lib/team-permissions";
import {
  dismissToast,
  showErrorToast,
  showSuccessToast,
  showSyncProgressToast,
  showToast,
} from "@/lib/toast-utils";
import {
  alignEntityScopesFromProfileReferences,
  DATA_SCOPE_CHANGED_EVENT,
  distributeUnscopedEntityIdsForAccount,
  getScopedEntityCountsForWorkspaces,
  migrateDataScopeAccount,
  normalizeDataScopeWorkspacesForAccount,
  setCurrentDataScope,
  toDataScopeKey,
} from "@/lib/workspace-data-scope";
import type {
  AppSection,
  BrowserProfile,
  CamoufoxConfig,
  ControlWorkspace,
  ControlWorkspaceOverview,
  TeamRole,
  WayfernConfig,
} from "@/types";

type BrowserTypeString =
  | "firefox"
  | "firefox-developer"
  | "chromium"
  | "brave"
  | "zen"
  | "camoufox"
  | "wayfern";

interface PendingUrl {
  id: string;
  url: string;
}

interface SavedProfileView {
  id: string;
  name: string;
  searchQuery: string;
  groupId: string;
  pinnedOnly?: boolean;
}

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface WorkspaceSwitcherOption {
  id: string;
  label: string;
  details?: string;
  status?: string;
  planLabel?: string;
}

interface WorkspaceSwitcherSummary {
  id: string;
  name: string;
  mode: "personal" | "team";
  role: TeamRole;
  members: number;
  activeInvites: number;
  activeShareGrants: number;
  entitlementState: "active" | "grace_active" | "read_only";
  profileLimit: number | null;
  profilesUsed: number;
  planLabel: string | null;
  expiresAt: string | null;
}

interface WorkspaceBillingContext {
  id: string;
  name: string;
  mode: "personal" | "team";
  role: TeamRole;
  planLabel: string | null;
  profileLimit: number | null;
  profilesUsed: number;
  entitlementState: "active" | "grace_active" | "read_only";
}

type ProfileViewMode = "active" | "archived";
const ALL_GROUP_ID = "all";

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
}

function formatPlanLabel(plan?: string | null): string | null {
  if (!plan) {
    return null;
  }
  const normalized = plan.trim();
  if (!normalized) {
    return null;
  }
  return normalized
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function resolveWorkspaceRole(input: {
  workspaceId: string;
  workspaceMode: "personal" | "team";
  platformRole?: string | null;
  workspaceSeedRole?: TeamRole | null;
  teamWorkspaceId?: string | null;
  userTeamRole?: TeamRole | null;
}): TeamRole {
  if (input.platformRole === "platform_admin") {
    return "owner";
  }
  if (input.workspaceMode === "personal" || input.workspaceId === "personal") {
    return "owner";
  }
  if (input.workspaceSeedRole) {
    return input.workspaceSeedRole;
  }
  if (input.teamWorkspaceId && input.workspaceId === input.teamWorkspaceId) {
    return input.userTeamRole ?? "member";
  }
  return "member";
}

function extractInviteTokenFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const token =
      parsed.searchParams.get("token") ||
      parsed.searchParams.get("invite_token") ||
      parsed.searchParams.get("inviteToken");
    if (!token) {
      return null;
    }
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      return null;
    }
    return normalizedToken;
  } catch {
    return null;
  }
}

export default function Home() {
  const { t } = useTranslation();
  const showRuntimeConfigHints = process.env.NODE_ENV !== "production";

  // Mount global version update listener/toasts
  useVersionUpdater();

  // Use the new profile events hook for centralized profile management
  const {
    profiles,
    runningProfiles,
    isLoading: profilesLoading,
    error: profilesError,
  } = useProfileEvents();

  const {
    groups: groupsData,
    isLoading: groupsLoading,
    error: groupsError,
  } = useGroupEvents();

  const {
    storedProxies,
    isLoading: proxiesLoading,
    error: proxiesError,
  } = useProxyEvents();

  const { vpnConfigs } = useVpnEvents();

  // Wayfern terms hooks
  const {
    termsAccepted,
    isLoading: termsLoading,
    checkTerms,
  } = useWayfernTerms();
  const {
    user: cloudUser,
    logout: cloudLogout,
    isLoading: isCloudAuthLoading,
  } = useCloudAuth();
  const crossOsUnlocked = true;
  const teamRole = normalizeTeamRole(cloudUser?.teamRole);
  const isPlatformAdmin = cloudUser?.platformRole === "platform_admin";
  const { entitlement, isReadOnly, runtimeConfig } = useRuntimeAccess();
  const syncUnlocked = runtimeConfig?.s3_sync === "ready";
  const [workspaceSwitcherSummaries, setWorkspaceSwitcherSummaries] = useState<
    WorkspaceSwitcherSummary[]
  >([]);
  const [workspaceSwitcherError, setWorkspaceSwitcherError] = useState<
    string | null
  >(null);
  const [workspaceProfilesUsed, setWorkspaceProfilesUsed] = useState<
    Record<string, number>
  >({});
  const [dataScopeVersion, setDataScopeVersion] = useState(0);

  useEffect(() => {
    const handleDataScopeChanged = () => {
      setDataScopeVersion((current) => current + 1);
    };

    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleDataScopeChanged);
    return () => {
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleDataScopeChanged);
    };
  }, []);

  const fallbackWorkspaceDescriptors = useMemo<
    Array<{
      id: string;
      name: string;
      mode: "personal" | "team";
      role: TeamRole;
      planLabel: string | null;
      entitlementState: "active" | "grace_active" | "read_only";
      profileLimit: number | null;
      expiresAt: string | null;
    }>
  >(() => {
    if (!cloudUser) {
      return [];
    }

    if (cloudUser.workspaceSeeds && cloudUser.workspaceSeeds.length > 0) {
      return cloudUser.workspaceSeeds.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        mode: workspace.mode,
        role: resolveWorkspaceRole({
          workspaceId: workspace.id,
          workspaceMode: workspace.mode,
          platformRole: cloudUser.platformRole,
          workspaceSeedRole: workspace.role ?? null,
          teamWorkspaceId: cloudUser.teamId ?? null,
          userTeamRole: teamRole,
        }),
        planLabel: workspace.planLabel ?? null,
        entitlementState: workspace.entitlementState ?? "active",
        profileLimit:
          typeof workspace.profileLimit === "number" ? workspace.profileLimit : null,
        expiresAt: workspace.expiresAt ?? null,
      }));
    }

    const rows: Array<{
      id: string;
      name: string;
      mode: "personal" | "team";
      role: TeamRole;
      planLabel: string | null;
      entitlementState: "active" | "grace_active" | "read_only";
      profileLimit: number | null;
      expiresAt: string | null;
    }> = [];
    if (cloudUser.teamId || cloudUser.teamName) {
      rows.push({
        id: cloudUser.teamId ?? "team",
        name: cloudUser.teamName ?? t("shell.workspaceSwitcher.teamWorkspace"),
        mode: "team",
        role: teamRole ?? "member",
        planLabel: formatPlanLabel(cloudUser.plan),
        entitlementState: "active",
        profileLimit:
          typeof cloudUser.profileLimit === "number" ? cloudUser.profileLimit : null,
        expiresAt: null,
      });
    }
    rows.push({
      id: "personal",
      name: t("shell.workspaceSwitcher.personalWorkspace"),
      mode: "personal",
      role: "owner",
      planLabel: formatPlanLabel(cloudUser.plan),
      entitlementState: "active",
      profileLimit:
        typeof cloudUser.profileLimit === "number" ? cloudUser.profileLimit : null,
      expiresAt: null,
    });
    return rows;
  }, [cloudUser, t]);

  useEffect(() => {
    let isCancelled = false;

    const loadWorkspaceProfileUsage = async () => {
      if (!cloudUser || fallbackWorkspaceDescriptors.length === 0) {
        setWorkspaceProfilesUsed({});
        return;
      }

      try {
        const profileRows = await invoke<Array<{ id: string }>>(
          "list_browser_profiles",
        );
        if (isCancelled) {
          return;
        }
        const usage = getScopedEntityCountsForWorkspaces(
          "profiles",
          profileRows.map((row) => row.id),
          cloudUser.id,
          fallbackWorkspaceDescriptors.map((workspace) => workspace.id),
        );
        setWorkspaceProfilesUsed(usage);
      } catch {
        if (!isCancelled) {
          setWorkspaceProfilesUsed({});
        }
      }
    };

    void loadWorkspaceProfileUsage();

    return () => {
      isCancelled = true;
    };
  }, [
    cloudUser?.id,
    dataScopeVersion,
    JSON.stringify(fallbackWorkspaceDescriptors),
    profiles.length,
  ]);

  useEffect(() => {
    let isCancelled = false;
    const loadWorkspaceSwitcher = async () => {
      if (!cloudUser) {
        setWorkspaceSwitcherSummaries([]);
        setWorkspaceSwitcherError(null);
        return;
      }

      try {
        const settings = await invoke<SyncSettings>("get_sync_settings");
        const baseUrl = normalizeBaseUrl(settings.sync_server_url);
        if (!baseUrl) {
          if (!isCancelled) {
            setWorkspaceSwitcherSummaries([]);
            setWorkspaceSwitcherError(null);
          }
          return;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-user-id": cloudUser.id,
          "x-user-email": cloudUser.email,
        };
        if (cloudUser.platformRole) {
          headers["x-platform-role"] = cloudUser.platformRole;
        }
        if (settings.sync_token?.trim()) {
          headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
        }

        const workspaceResponse = await fetch(`${baseUrl}/v1/control/workspaces`, {
          method: "GET",
          headers,
        });
        if (!workspaceResponse.ok) {
          if (!isCancelled) {
            setWorkspaceSwitcherSummaries([]);
            setWorkspaceSwitcherError(
              `${workspaceResponse.status}:${workspaceResponse.statusText}`,
            );
          }
          return;
        }

        const workspaces = (await workspaceResponse.json()) as ControlWorkspace[];
        if (!Array.isArray(workspaces) || workspaces.length === 0) {
          if (!isCancelled) {
            setWorkspaceSwitcherSummaries([]);
            setWorkspaceSwitcherError(null);
          }
          return;
        }

        let profilesUsedByWorkspace: Record<string, number> = {};
        try {
          const profileRows = await invoke<Array<{ id: string }>>(
            "list_browser_profiles",
          );
          profilesUsedByWorkspace = getScopedEntityCountsForWorkspaces(
            "profiles",
            profileRows.map((row) => row.id),
            cloudUser.id,
            workspaces.map((workspace) => workspace.id),
          );
        } catch {
          profilesUsedByWorkspace = {};
        }

        const overviewRows = await Promise.all(
          workspaces.map(async (workspace) => {
            try {
              const response = await fetch(
                `${baseUrl}/v1/control/workspaces/${workspace.id}/overview`,
                {
                  method: "GET",
                  headers,
                },
              );
              if (!response.ok) {
                return null;
              }
              return (await response.json()) as ControlWorkspaceOverview;
            } catch {
              return null;
            }
          }),
        );

        if (isCancelled) {
          return;
        }

        const summaryRows: WorkspaceSwitcherSummary[] = workspaces.map(
          (workspace, index) => {
            const overview = overviewRows[index];
            const seed = cloudUser.workspaceSeeds?.find(
              (item) => item.id === workspace.id,
            );
            const fallbackPlanLabel =
              workspace.id === cloudUser.teamId || workspace.id === "personal"
                ? formatPlanLabel(cloudUser.plan)
                : null;
            const workspaceRole = resolveWorkspaceRole({
              workspaceId: workspace.id,
              workspaceMode: workspace.mode,
              platformRole: cloudUser.platformRole,
              workspaceSeedRole: seed?.role ?? null,
              teamWorkspaceId: cloudUser.teamId ?? null,
              userTeamRole: teamRole,
            });
            return {
              id: workspace.id,
              name: workspace.name,
              mode: workspace.mode,
              role: workspaceRole,
              members: overview?.members ?? 0,
              activeInvites: overview?.activeInvites ?? 0,
              activeShareGrants: overview?.activeShareGrants ?? 0,
              entitlementState: overview?.entitlementState ?? "active",
              profileLimit:
                typeof seed?.profileLimit === "number" ? seed.profileLimit : null,
              profilesUsed: profilesUsedByWorkspace[workspace.id] ?? 0,
              planLabel: seed?.planLabel ?? fallbackPlanLabel,
              expiresAt: seed?.expiresAt ?? null,
            };
          },
        );
        setWorkspaceSwitcherSummaries(summaryRows);
        setWorkspaceSwitcherError(null);
      } catch (error) {
        if (!isCancelled) {
          setWorkspaceSwitcherSummaries([]);
          setWorkspaceSwitcherError(extractRootError(error));
        }
      }
    };

    void loadWorkspaceSwitcher();

    return () => {
      isCancelled = true;
    };
  }, [
    cloudUser?.email,
    cloudUser?.id,
    cloudUser?.platformRole,
    cloudUser?.teamId,
    cloudUser?.teamName,
    dataScopeVersion,
    JSON.stringify(cloudUser?.workspaceSeeds || []),
    profiles.length,
  ]);

  const workspaceOptions = useMemo<WorkspaceSwitcherOption[]>(() => {
    if (!cloudUser) {
      return [];
    }

    if (workspaceSwitcherSummaries.length > 0) {
      return workspaceSwitcherSummaries.map((workspace) => ({
        id: workspace.id,
        label: workspace.name,
        details: workspace.profilesUsed > 0
          ? workspace.profileLimit !== null && workspace.profileLimit > 0
            ? t("shell.workspaceSwitcher.usageProfiles", {
                used: workspace.profilesUsed,
                limit: workspace.profileLimit || "∞",
              })
            : t("shell.workspaceSwitcher.usageProfilesUsedOnly", {
                used: workspace.profilesUsed,
              })
          : t("shell.workspaceSwitcher.membersInvites", {
              members: workspace.members,
              invites: workspace.activeInvites,
            }),
        status:
          `${t(`shell.roles.${workspace.role}`)} · ` +
          (workspace.expiresAt
            ? t("shell.workspaceSwitcher.expiresOn", {
                date: new Date(workspace.expiresAt).toLocaleDateString(),
              })
            : t(`shell.workspaceSwitcher.entitlement.${workspace.entitlementState}`)),
        planLabel: workspace.planLabel ?? undefined,
      }));
    }

    if (fallbackWorkspaceDescriptors.length > 0) {
      return fallbackWorkspaceDescriptors.map((workspace) => ({
        id: workspace.id,
        label: workspace.name,
        details: t("shell.workspaceSwitcher.usageProfiles", {
          used: workspaceProfilesUsed[workspace.id] ?? 0,
          limit: workspace.profileLimit || "∞",
        }),
        status: workspace.expiresAt
          ? t("shell.workspaceSwitcher.planExpiry", {
              plan: `${t(`shell.roles.${workspace.role}`)} · ${workspace.planLabel ?? t("billingPage.planFallback")}`,
              date: new Date(workspace.expiresAt).toLocaleDateString(),
            })
          : t("shell.workspaceSwitcher.planSummary", {
              plan: `${t(`shell.roles.${workspace.role}`)} · ${workspace.planLabel ?? t("billingPage.planFallback")}`,
              status: t(`shell.workspaceSwitcher.entitlement.${workspace.entitlementState}`),
            }),
        planLabel: workspace.planLabel ?? undefined,
      }));
    }

    const options: WorkspaceSwitcherOption[] = [];
    if (cloudUser.teamId || cloudUser.teamName) {
      options.push({
        id: cloudUser.teamId ?? "team",
        label: cloudUser.teamName ?? t("shell.workspaceSwitcher.teamWorkspace"),
        details: t("shell.workspaceSwitcher.usageProfiles", {
          used: cloudUser.cloudProfilesUsed,
          limit: cloudUser.profileLimit || "∞",
        }),
        status: t("shell.workspaceSwitcher.planSummary", {
          plan: `${t(`shell.roles.${teamRole ?? "member"}`)} · ${cloudUser.plan}`,
          status: cloudUser.subscriptionStatus,
        }),
        planLabel: formatPlanLabel(cloudUser.plan) ?? undefined,
      });
    }
    options.push({
      id: "personal",
      label: t("shell.workspaceSwitcher.personalWorkspace"),
      details: t("shell.workspaceSwitcher.usageProfiles", {
        used: cloudUser.cloudProfilesUsed,
        limit: cloudUser.profileLimit || "∞",
      }),
      status: t("shell.workspaceSwitcher.planSummary", {
        plan: `${t("shell.roles.owner")} · ${cloudUser.plan}`,
        status: cloudUser.subscriptionStatus,
      }),
      planLabel: formatPlanLabel(cloudUser.plan) ?? undefined,
    });

    if (workspaceSwitcherError && cloudUser.platformRole === "platform_admin") {
      options.unshift({
        id: "platform-fallback",
        label: "Bug Media",
        details: t("shell.workspaceSwitcher.syncUnavailable"),
        status: workspaceSwitcherError,
        planLabel: formatPlanLabel(cloudUser.plan) ?? undefined,
      });
    }

    return options;
  }, [
    cloudUser,
    fallbackWorkspaceDescriptors,
    t,
    workspaceProfilesUsed,
    workspaceSwitcherError,
    workspaceSwitcherSummaries,
  ]);

  const [sidebarWorkspaceId, setSidebarWorkspaceId] = useState<string>("personal");

  const selectedWorkspaceContext = useMemo<WorkspaceBillingContext | null>(() => {
    const fromSummary = workspaceSwitcherSummaries.find(
      (workspace) => workspace.id === sidebarWorkspaceId,
    );
    if (fromSummary) {
      return {
        id: fromSummary.id,
        name: fromSummary.name,
        mode: fromSummary.mode,
        role: fromSummary.role,
        planLabel: fromSummary.planLabel ?? null,
        profileLimit: fromSummary.profileLimit ?? null,
        profilesUsed: fromSummary.profilesUsed,
        entitlementState: fromSummary.entitlementState,
      };
    }

    const fromFallback = fallbackWorkspaceDescriptors.find(
      (workspace) => workspace.id === sidebarWorkspaceId,
    );
    if (fromFallback) {
      return {
        id: fromFallback.id,
        name: fromFallback.name,
        mode: fromFallback.mode,
        role: fromFallback.role,
        planLabel: fromFallback.planLabel ?? null,
        profileLimit: fromFallback.profileLimit ?? null,
        profilesUsed: workspaceProfilesUsed[fromFallback.id] ?? 0,
        entitlementState: fromFallback.entitlementState,
      };
    }

    return null;
  }, [
    fallbackWorkspaceDescriptors,
    sidebarWorkspaceId,
    workspaceProfilesUsed,
    workspaceSwitcherSummaries,
  ]);

  const selectedWorkspaceRole: TeamRole = selectedWorkspaceContext?.role ?? "member";
  const canAccessAdminWorkspace =
    isPlatformAdmin ||
    selectedWorkspaceRole === "owner" ||
    selectedWorkspaceRole === "admin";
  const canManageSelectedWorkspaceBilling =
    isPlatformAdmin ||
    selectedWorkspaceRole === "owner" ||
    selectedWorkspaceRole === "admin";
  const canManageSelectedWorkspaceGovernance =
    cloudUser?.platformRole === "platform_admin" ||
    selectedWorkspaceRole === "owner" ||
    selectedWorkspaceRole === "admin";

  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("profiles");
  const didRestoreWorkspaceSelectionRef = useRef(false);
  const [isWorkspaceSelectionReady, setIsWorkspaceSelectionReady] =
    useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [importProfileDialogOpen, setImportProfileDialogOpen] = useState(false);
  const [camoufoxConfigDialogOpen, setCamoufoxConfigDialogOpen] =
    useState(false);
  const [groupManagementDialogOpen, setGroupManagementDialogOpen] =
    useState(false);
  const [extensionManagementDialogOpen, setExtensionManagementDialogOpen] =
    useState(false);
  const [groupAssignmentDialogOpen, setGroupAssignmentDialogOpen] =
    useState(false);
  const [
    extensionGroupAssignmentDialogOpen,
    setExtensionGroupAssignmentDialogOpen,
  ] = useState(false);
  const [
    selectedProfilesForExtensionGroup,
    setSelectedProfilesForExtensionGroup,
  ] = useState<string[]>([]);
  const [proxyAssignmentDialogOpen, setProxyAssignmentDialogOpen] =
    useState(false);
  const [cookieCopyDialogOpen, setCookieCopyDialogOpen] = useState(false);
  const [cookieManagementDialogOpen, setCookieManagementDialogOpen] =
    useState(false);
  const [
    currentProfileForCookieManagement,
    setCurrentProfileForCookieManagement,
  ] = useState<BrowserProfile | null>(null);
  const [selectedProfilesForCookies, setSelectedProfilesForCookies] = useState<
    string[]
  >([]);
  const [selectedGroupId, setSelectedGroupId] =
    useState<string>(ALL_GROUP_ID);
  const [selectedProfilesForGroup, setSelectedProfilesForGroup] = useState<
    string[]
  >([]);
  const [selectedProfilesForProxy, setSelectedProfilesForProxy] = useState<
    string[]
  >([]);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [savedViews, setSavedViews] = useState<SavedProfileView[]>([]);
  const [profileViewMode, setProfileViewMode] =
    useState<ProfileViewMode>("active");
  const [archivedProfileIds, setArchivedProfileIds] = useState<string[]>([]);
  const [pinnedProfileIds, setPinnedProfileIds] = useState<string[]>([]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pendingUrls, setPendingUrls] = useState<PendingUrl[]>([]);
  const [currentProfileForCamoufoxConfig, setCurrentProfileForCamoufoxConfig] =
    useState<BrowserProfile | null>(null);
  const [cloneProfile, setCloneProfile] = useState<BrowserProfile | null>(null);
  const [hasCheckedStartupPrompt, setHasCheckedStartupPrompt] = useState(false);
  const [launchOnLoginDialogOpen, setLaunchOnLoginDialogOpen] = useState(false);
  const [windowResizeWarningOpen, setWindowResizeWarningOpen] = useState(false);
  const [windowResizeWarningBrowserType, setWindowResizeWarningBrowserType] =
    useState<string | undefined>(undefined);
  const windowResizeWarningResolver = useRef<
    ((proceed: boolean) => void) | null
  >(null);
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [currentPermissionType, setCurrentPermissionType] =
    useState<PermissionType>("microphone");
  const [showBulkDeleteConfirmation, setShowBulkDeleteConfirmation] =
    useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [syncConfigDialogOpen, setSyncConfigDialogOpen] = useState(false);
  const [syncAllDialogOpen, setSyncAllDialogOpen] = useState(false);
  const [prefilledInviteToken, setPrefilledInviteToken] = useState<
    string | null
  >(null);
  const [profileSyncDialogOpen, setProfileSyncDialogOpen] = useState(false);
  const [currentProfileForSync, setCurrentProfileForSync] =
    useState<BrowserProfile | null>(null);
  const { isMicrophoneAccessGranted, isCameraAccessGranted, isInitialized } =
    usePermissions();

  useEffect(() => {
    setCurrentDataScope({
      accountId: cloudUser?.id ?? "guest",
      workspaceId: sidebarWorkspaceId,
    });
  }, [cloudUser?.id, sidebarWorkspaceId]);

  useEffect(() => {
    if (!cloudUser || workspaceOptions.length === 0) {
      return;
    }
    if (!isWorkspaceSelectionReady) {
      return;
    }

    let isCancelled = false;
    const accountScopeKeys = workspaceOptions.map((workspace) =>
      toDataScopeKey({
        accountId: cloudUser.id,
        workspaceId: workspace.id,
      }),
    );
    const preferredScopeKey = toDataScopeKey({
      accountId: cloudUser.id,
      workspaceId: sidebarWorkspaceId,
    });

    const seedWorkspaceDataScopes = async () => {
      try {
        const migrationWorkspaceIds = [sidebarWorkspaceId];
        const didMigrateGuest = migrateDataScopeAccount(
          "guest",
          cloudUser.id,
          migrationWorkspaceIds,
          sidebarWorkspaceId,
        );
        const didNormalizeScopes = normalizeDataScopeWorkspacesForAccount(
          cloudUser.id,
          workspaceOptions.map((workspace) => workspace.id),
          sidebarWorkspaceId,
        );

        const [profileRows, groupRows, proxyRows, vpnRows] = await Promise.all([
          invoke<Array<{ id: string; group_id?: string; proxy_id?: string; vpn_id?: string }>>("list_browser_profiles"),
          invoke<Array<{ id: string }>>("get_profile_groups"),
          invoke<Array<{ id: string }>>("get_stored_proxies"),
          invoke<Array<{ id: string }>>("list_vpn_configs"),
        ]);

        if (isCancelled) {
          return;
        }

        const didAlignGroupScopes = alignEntityScopesFromProfileReferences(
          cloudUser.id,
          "groups",
          profileRows
            .filter((row) => row.group_id && row.group_id !== "default")
            .map((row) => ({
              entityId: row.group_id as string,
              profileId: row.id,
            })),
        );
        const didAlignProxyScopes = alignEntityScopesFromProfileReferences(
          cloudUser.id,
          "proxies",
          profileRows
            .filter((row) => Boolean(row.proxy_id))
            .map((row) => ({
              entityId: row.proxy_id as string,
              profileId: row.id,
            })),
        );
        const didAlignVpnScopes = alignEntityScopesFromProfileReferences(
          cloudUser.id,
          "vpns",
          profileRows
            .filter((row) => Boolean(row.vpn_id))
            .map((row) => ({
              entityId: row.vpn_id as string,
              profileId: row.id,
            })),
        );

        const didChangeProfiles = distributeUnscopedEntityIdsForAccount(
          "profiles",
          profileRows.map((row) => row.id),
          accountScopeKeys,
          preferredScopeKey,
        );
        const didChangeGroups = distributeUnscopedEntityIdsForAccount(
          "groups",
          groupRows
            .map((row) => row.id)
            .filter((groupId) => groupId && groupId !== "default"),
          accountScopeKeys,
          preferredScopeKey,
        );
        const didChangeProxies = distributeUnscopedEntityIdsForAccount(
          "proxies",
          proxyRows.map((row) => row.id),
          accountScopeKeys,
          preferredScopeKey,
        );
        const didChangeVpns = distributeUnscopedEntityIdsForAccount(
          "vpns",
          vpnRows.map((row) => row.id),
          accountScopeKeys,
          preferredScopeKey,
        );

        if (
          didMigrateGuest ||
          didNormalizeScopes ||
          didAlignGroupScopes ||
          didAlignProxyScopes ||
          didAlignVpnScopes ||
          didChangeProfiles ||
          didChangeGroups ||
          didChangeProxies ||
          didChangeVpns
        ) {
          window.dispatchEvent(new Event(DATA_SCOPE_CHANGED_EVENT));
        }
      } catch {
        // Seed is best-effort in local mode.
      }
    };

    void seedWorkspaceDataScopes();

    return () => {
      isCancelled = true;
    };
  }, [cloudUser, isWorkspaceSelectionReady, sidebarWorkspaceId, workspaceOptions]);

  const profileDataScopeKey = useMemo(
    () => `${cloudUser?.id ?? "guest"}::${sidebarWorkspaceId}`,
    [cloudUser?.id, sidebarWorkspaceId],
  );
  const workspaceSelectionStorageKey = useMemo(
    () => `buglogin.workspace.last.v1.${cloudUser?.id ?? "guest"}`,
    [cloudUser?.id],
  );
  const savedViewsStorageKey = `buglogin.profile.savedViews.v1.${profileDataScopeKey}`;
  const archivedIdsStorageKey = `buglogin.profile.archivedIds.v1.${profileDataScopeKey}`;
  const pinnedIdsStorageKey = `buglogin.profile.pinnedIds.v1.${profileDataScopeKey}`;

  const handleCloudSignOut = useCallback(async () => {
    try {
      await cloudLogout();
      showSuccessToast(t("authDialog.logoutSuccess"));
    } catch (error) {
      showErrorToast(t("authDialog.logoutFailed"), {
        description: extractRootError(error),
      });
    }
  }, [cloudLogout, t]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(savedViewsStorageKey);
      if (!raw) {
        setSavedViews([]);
        return;
      }
      const parsed = JSON.parse(raw) as SavedProfileView[];
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch {
      setSavedViews([]);
    }
  }, [savedViewsStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(savedViewsStorageKey, JSON.stringify(savedViews));
    } catch {
      // Ignore storage errors.
    }
  }, [savedViews, savedViewsStorageKey]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(archivedIdsStorageKey);
      if (!raw) {
        setArchivedProfileIds([]);
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setArchivedProfileIds(parsed);
      }
    } catch {
      setArchivedProfileIds([]);
    }
  }, [archivedIdsStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        archivedIdsStorageKey,
        JSON.stringify(archivedProfileIds),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [archivedIdsStorageKey, archivedProfileIds]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(pinnedIdsStorageKey);
      if (!raw) {
        setPinnedProfileIds([]);
        return;
      }
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setPinnedProfileIds(parsed);
      }
    } catch {
      setPinnedProfileIds([]);
    }
  }, [pinnedIdsStorageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(pinnedIdsStorageKey, JSON.stringify(pinnedProfileIds));
    } catch {
      // Ignore storage errors.
    }
  }, [pinnedIdsStorageKey, pinnedProfileIds]);

  useEffect(() => {
    const profileIdSet = new Set(profiles.map((profile) => profile.id));
    setArchivedProfileIds((prev) => prev.filter((id) => profileIdSet.has(id)));
    setPinnedProfileIds((prev) => prev.filter((id) => profileIdSet.has(id)));
  }, [profiles]);

  const requireTeamPermission = useCallback(
    (action: TeamAction): boolean => {
      if (isReadOnly) {
        showErrorToast(t("entitlement.readOnlyDenied"), {
          description: t("entitlement.readOnlyDescription"),
        });
        return false;
      }

      if (isPlatformAdmin || canPerformTeamAction(selectedWorkspaceRole, action)) {
        return true;
      }

      showErrorToast(t("sync.team.permissionDenied"), {
        description: "permission_denied",
      });
      return false;
    },
    [isPlatformAdmin, isReadOnly, selectedWorkspaceRole, t],
  );

  const pendingConfigMessages = useMemo(() => {
    if (!showRuntimeConfigHints) {
      return [];
    }
    const messages: string[] = [];

    if (runtimeConfig?.auth === "pending_config") {
      messages.push(t("runtime.pendingAuth"));
    }

    if (runtimeConfig?.stripe === "pending_config") {
      messages.push(t("runtime.pendingStripe"));
    }

    if (runtimeConfig?.s3_sync === "pending_config") {
      messages.push(t("runtime.pendingSync"));
    }

    return messages;
  }, [runtimeConfig, showRuntimeConfigHints, t]);

  useEffect(() => {
    if (activeSection.startsWith("admin-") && !canAccessAdminWorkspace) {
      setActiveSection("profiles");
      showErrorToast(t("adminWorkspace.noAccessTitle"), {
        description: t("adminWorkspace.noAccessDescription"),
      });
    }
  }, [activeSection, canAccessAdminWorkspace, t]);

  useEffect(() => {
    const isPlatformOnlySection =
      activeSection === "admin-billing" || activeSection === "admin-audit";
    if (isPlatformOnlySection && !isPlatformAdmin) {
      setActiveSection("admin-overview");
      showErrorToast(t("adminWorkspace.noAccessTitle"), {
        description: t("adminWorkspace.noAccessDescription"),
      });
    }
  }, [activeSection, isPlatformAdmin, t]);

  useEffect(() => {
    if (activeSection !== "workspace-governance" || canManageSelectedWorkspaceGovernance) {
      return;
    }
    setActiveSection("profiles");
    showErrorToast(t("adminWorkspace.noAccessTitle"), {
      description: t("adminWorkspace.ownerOnlyGovernance"),
    });
  }, [activeSection, canManageSelectedWorkspaceGovernance, t]);

  useEffect(() => {
    didRestoreWorkspaceSelectionRef.current = false;
    setIsWorkspaceSelectionReady(false);
  }, [workspaceSelectionStorageKey]);

  useEffect(() => {
    if (workspaceOptions.length === 0) {
      setSidebarWorkspaceId("personal");
      setIsWorkspaceSelectionReady(false);
      return;
    }

    const hasCurrentWorkspace = workspaceOptions.some(
      (item) => item.id === sidebarWorkspaceId,
    );

    if (!didRestoreWorkspaceSelectionRef.current) {
      didRestoreWorkspaceSelectionRef.current = true;
      try {
        const raw = window.localStorage
          .getItem(workspaceSelectionStorageKey)
          ?.trim();
        if (raw && workspaceOptions.some((item) => item.id === raw)) {
          if (raw !== sidebarWorkspaceId) {
            setSidebarWorkspaceId(raw);
          }
          setIsWorkspaceSelectionReady(true);
          return;
        }
      } catch {
        // Ignore localStorage read errors.
      }
      setIsWorkspaceSelectionReady(true);
    }

    if (!hasCurrentWorkspace) {
      setSidebarWorkspaceId(workspaceOptions[0].id);
    }
  }, [sidebarWorkspaceId, workspaceOptions, workspaceSelectionStorageKey]);

  useEffect(() => {
    if (!isWorkspaceSelectionReady) {
      return;
    }
    if (!workspaceOptions.some((item) => item.id === sidebarWorkspaceId)) {
      return;
    }
    try {
      window.localStorage.setItem(
        workspaceSelectionStorageKey,
        sidebarWorkspaceId,
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [
    isWorkspaceSelectionReady,
    sidebarWorkspaceId,
    workspaceOptions,
    workspaceSelectionStorageKey,
  ]);

  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedProfiles([]);
  }, []);

  const handleCreateSavedView = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    if (
      !trimmedQuery &&
      (selectedGroupId === ALL_GROUP_ID || selectedGroupId === "default") &&
      !showPinnedOnly
    ) {
      showErrorToast(t("header.savedViews.nothingToSave"));
      return;
    }

    const nextIndex = savedViews.length + 1;
    const viewName = `${t("header.savedViews.defaultName")} ${nextIndex}`;
    const nextView: SavedProfileView = {
      id: crypto.randomUUID(),
      name: viewName,
      searchQuery: trimmedQuery,
      groupId: selectedGroupId,
      pinnedOnly: showPinnedOnly,
    };

    setSavedViews((prev) => [nextView, ...prev].slice(0, 20));
    showSuccessToast(t("header.savedViews.saved"));
  }, [savedViews.length, searchQuery, selectedGroupId, showPinnedOnly, t]);

  const handleApplySavedView = useCallback(
    (id: string) => {
      const view = savedViews.find((item) => item.id === id);
      if (!view) {
        showErrorToast(t("header.savedViews.notFound"));
        return;
      }
      setSearchQuery(view.searchQuery);
      setSelectedGroupId(
        view.groupId === "default" ? ALL_GROUP_ID : view.groupId,
      );
      setShowPinnedOnly(view.pinnedOnly ?? false);
      setSelectedProfiles([]);
      showSuccessToast(t("header.savedViews.applied"));
    },
    [savedViews, t],
  );

  const handleDeleteSavedView = useCallback(
    (id: string) => {
      setSavedViews((prev) => prev.filter((item) => item.id !== id));
      showSuccessToast(t("header.savedViews.deleted"));
    },
    [t],
  );

  // Check for missing binaries and offer to download them
  const checkMissingBinaries = useCallback(async () => {
    try {
      const missingBinaries = await invoke<[string, string, string][]>(
        "check_missing_binaries",
      );

      // Also check for missing GeoIP database
      const missingGeoIP = await invoke<boolean>(
        "check_missing_geoip_database",
      );

      if (missingBinaries.length > 0 || missingGeoIP) {
        if (missingBinaries.length > 0) {
          console.log("Found missing binaries:", missingBinaries);
        }
        if (missingGeoIP) {
          console.log("Found missing GeoIP database for Camoufox");
        }

        // Group missing binaries by browser type to avoid concurrent downloads
        const browserMap = new Map<string, string[]>();
        for (const [profileName, browser, version] of missingBinaries) {
          if (!browserMap.has(browser)) {
            browserMap.set(browser, []);
          }
          const versions = browserMap.get(browser);
          if (versions) {
            versions.push(`${version} (for ${profileName})`);
          }
        }

        // Show a toast notification about missing binaries and auto-download them
        let missingList = Array.from(browserMap.entries())
          .map(([browser, versions]) => `${browser}: ${versions.join(", ")}`)
          .join(", ");

        if (missingGeoIP) {
          if (missingList) {
            missingList += ", GeoIP database for Camoufox";
          } else {
            missingList = "GeoIP database for Camoufox";
          }
        }

        console.log(`Downloading missing components: ${missingList}`);

        try {
          // Download missing binaries and GeoIP database sequentially to prevent conflicts
          const downloaded = await invoke<string[]>(
            "ensure_all_binaries_exist",
          );
          if (downloaded.length > 0) {
            console.log(
              "Successfully downloaded missing components:",
              downloaded,
            );
          }
        } catch (downloadError) {
          console.error(
            "Failed to download missing components:",
            downloadError,
          );
        }
      }
    } catch (err: unknown) {
      console.error("Failed to check missing components:", err);
    }
  }, []);

  const [processingUrls, setProcessingUrls] = useState<Set<string>>(new Set());

  const handleUrlOpen = useCallback(
    async (url: string) => {
      // Prevent duplicate processing of the same URL
      if (processingUrls.has(url)) {
        console.log("URL already being processed:", url);
        return;
      }

      setProcessingUrls((prev) => new Set(prev).add(url));

      try {
        console.log("URL received for opening:", url);
        const inviteToken = extractInviteTokenFromUrl(url);
        if (inviteToken) {
          setPrefilledInviteToken(inviteToken);
          setActiveSection("profiles");
          showSuccessToast(t("authDialog.inviteDetected"));
          return;
        }

        // Always show profile selector for manual selection - never auto-open
        // Replace any existing pending URL with the new one
        setPendingUrls([{ id: Date.now().toString(), url }]);
      } finally {
        // Remove URL from processing set after a short delay to prevent rapid duplicates
        setTimeout(() => {
          setProcessingUrls((prev) => {
            const next = new Set(prev);
            next.delete(url);
            return next;
          });
        }, 1000);
      }
    },
    [processingUrls, t],
  );

  // Auto-update functionality - use the existing hook for compatibility
  const updateNotifications = useUpdateNotifications();
  const { checkForUpdates, isUpdating } = updateNotifications;

  useAppUpdateNotifications();

  // Check for startup URLs but only process them once
  const [hasCheckedStartupUrl, setHasCheckedStartupUrl] = useState(false);
  const checkCurrentUrl = useCallback(async () => {
    if (hasCheckedStartupUrl) return;

    try {
      const currentUrl = await getCurrent();
      if (currentUrl && currentUrl.length > 0) {
        console.log("Startup URL detected:", currentUrl[0]);
        void handleUrlOpen(currentUrl[0]);
      }
    } catch (error) {
      console.error("Failed to check current URL:", error);
    } finally {
      setHasCheckedStartupUrl(true);
    }
  }, [handleUrlOpen, hasCheckedStartupUrl]);

  const checkStartupPrompt = useCallback(async () => {
    // Only check once during app startup to prevent reopening after dismissing notifications
    if (hasCheckedStartupPrompt) return;

    try {
      const shouldShow = await invoke<boolean>(
        "should_show_launch_on_login_prompt",
      );
      if (shouldShow) {
        setLaunchOnLoginDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to check startup prompt:", error);
    } finally {
      setHasCheckedStartupPrompt(true);
    }
  }, [hasCheckedStartupPrompt]);

  // Handle profile errors from useProfileEvents hook
  useEffect(() => {
    if (profilesError) {
      showErrorToast(profilesError);
    }
  }, [profilesError]);

  // Handle group errors from useGroupEvents hook
  useEffect(() => {
    if (groupsError) {
      showErrorToast(groupsError);
    }
  }, [groupsError]);

  // Handle proxy errors from useProxyEvents hook
  useEffect(() => {
    if (proxiesError) {
      showErrorToast(proxiesError);
    }
  }, [proxiesError]);

  const checkAllPermissions = useCallback(async () => {
    try {
      // Wait for permissions to be initialized before checking
      if (!isInitialized) {
        return;
      }

      // Check if any permissions are not granted - prioritize missing permissions
      if (!isMicrophoneAccessGranted) {
        setCurrentPermissionType("microphone");
        setPermissionDialogOpen(true);
      } else if (!isCameraAccessGranted) {
        setCurrentPermissionType("camera");
        setPermissionDialogOpen(true);
      }
    } catch (error) {
      console.error("Failed to check permissions:", error);
    }
  }, [isMicrophoneAccessGranted, isCameraAccessGranted, isInitialized]);

  const checkNextPermission = useCallback(() => {
    try {
      if (!isMicrophoneAccessGranted) {
        setCurrentPermissionType("microphone");
        setPermissionDialogOpen(true);
      } else if (!isCameraAccessGranted) {
        setCurrentPermissionType("camera");
        setPermissionDialogOpen(true);
      } else {
        setPermissionDialogOpen(false);
      }
    } catch (error) {
      console.error("Failed to check next permission:", error);
    }
  }, [isMicrophoneAccessGranted, isCameraAccessGranted]);

  const listenForUrlEvents = useCallback(async () => {
    try {
      // Listen for URL open events from the deep link handler (when app is already running)
      await listen<string>("url-open-request", (event) => {
        console.log("Received URL open request:", event.payload);
        void handleUrlOpen(event.payload);
      });

      // Listen for show profile selector events
      await listen<string>("show-profile-selector", (event) => {
        console.log("Received show profile selector request:", event.payload);
        void handleUrlOpen(event.payload);
      });

      // Listen for show create profile dialog events
      await listen<string>("show-create-profile-dialog", (event) => {
        console.log(
          "Received show create profile dialog request:",
          event.payload,
        );
        showErrorToast(
          "No profiles available. Please create a profile first before opening URLs.",
        );
        setCreateProfileDialogOpen(true);
      });

      // Listen for custom logo click events
      const handleLogoUrlEvent = (event: CustomEvent) => {
        console.log("Received logo URL event:", event.detail);
        void handleUrlOpen(event.detail);
      };

      window.addEventListener(
        "url-open-request",
        handleLogoUrlEvent as EventListener,
      );

      // Return cleanup function
      return () => {
        window.removeEventListener(
          "url-open-request",
          handleLogoUrlEvent as EventListener,
        );
      };
    } catch (error) {
      console.error("Failed to setup URL listener:", error);
    }
  }, [handleUrlOpen]);

  const handleConfigureCamoufox = useCallback((profile: BrowserProfile) => {
    setCurrentProfileForCamoufoxConfig(profile);
    setCamoufoxConfigDialogOpen(true);
  }, []);

  const handleSaveCamoufoxConfig = useCallback(
    async (profile: BrowserProfile, config: CamoufoxConfig) => {
      try {
        await invoke("update_camoufox_config", {
          profileId: profile.id,
          config,
        });
        // No need to manually reload - useProfileEvents will handle the update
        setCamoufoxConfigDialogOpen(false);
      } catch (err: unknown) {
        console.error("Failed to update camoufox config:", err);
        showErrorToast(
          `Failed to update camoufox config: ${JSON.stringify(err)}`,
        );
        throw err;
      }
    },
    [],
  );

  const handleSaveWayfernConfig = useCallback(
    async (profile: BrowserProfile, config: WayfernConfig) => {
      try {
        await invoke("update_wayfern_config", {
          profileId: profile.id,
          config,
        });
        // No need to manually reload - useProfileEvents will handle the update
        setCamoufoxConfigDialogOpen(false);
      } catch (err: unknown) {
        console.error("Failed to update wayfern config:", err);
        showErrorToast(
          `Failed to update wayfern config: ${JSON.stringify(err)}`,
        );
        throw err;
      }
    },
    [],
  );

  const handleCreateProfile = useCallback(
    async (profileData: {
      name: string;
      browserStr: BrowserTypeString;
      version: string;
      releaseType: string;
      proxyId?: string;
      vpnId?: string;
      camoufoxConfig?: CamoufoxConfig;
      wayfernConfig?: WayfernConfig;
      groupId?: string;
      extensionGroupId?: string;
      ephemeral?: boolean;
      launchAfterCreate?: boolean;
    }) => {
      if (!requireTeamPermission("create_profile")) {
        throw new Error("permission_denied");
      }

      const loadingToastId = `profile-create-${Date.now()}`;
      showToast({
        id: loadingToastId,
        type: "loading",
        title: t("common.buttons.loading"),
        duration: Number.POSITIVE_INFINITY,
      });
      try {
        const profile = await invoke<BrowserProfile>(
          "create_browser_profile_new",
          {
            name: profileData.name,
            browserStr: profileData.browserStr,
            version: profileData.version,
            releaseType: profileData.releaseType,
            proxyId: profileData.proxyId,
            vpnId: profileData.vpnId,
            camoufoxConfig: profileData.camoufoxConfig,
            wayfernConfig: profileData.wayfernConfig,
            groupId:
              profileData.groupId ||
              (selectedGroupId !== ALL_GROUP_ID &&
              selectedGroupId !== "default"
                ? selectedGroupId
                : undefined),
            ephemeral: profileData.ephemeral,
          },
        );

        if (profileData.extensionGroupId) {
          try {
            await invoke("assign_extension_group_to_profile", {
              profileId: profile.id,
              extensionGroupId: profileData.extensionGroupId,
            });
          } catch (err) {
            console.error("Failed to assign extension group:", err);
          }
        }

        if (profileData.launchAfterCreate) {
          await invoke<BrowserProfile>("launch_browser_profile", { profile });
          showSuccessToast(t("toasts.success.profileLaunched"));
        } else {
          showSuccessToast(t("toasts.success.profileCreated"));
        }
      } catch (error) {
        showErrorToast(t("toasts.error.profileCreateFailed"), {
          description: extractRootError(error),
        });
        throw error;
      } finally {
        dismissToast(loadingToastId);
      }
    },
    [requireTeamPermission, selectedGroupId, t],
  );

  const launchProfile = useCallback(
    async (profile: BrowserProfile) => {
      console.log("Starting launch for profile:", profile.name);

      // Show one-time warning about window resizing for fingerprinted browsers
      if (profile.browser === "camoufox" || profile.browser === "wayfern") {
        try {
          const dismissed = await invoke<boolean>(
            "get_window_resize_warning_dismissed",
          );
          if (!dismissed) {
            const proceed = await new Promise<boolean>((resolve) => {
              windowResizeWarningResolver.current = resolve;
              setWindowResizeWarningBrowserType(profile.browser);
              setWindowResizeWarningOpen(true);
            });
            if (!proceed) {
              return;
            }
          }
        } catch (error) {
          console.error("Failed to check window resize warning:", error);
        }
      }

      try {
        const result = await invoke<BrowserProfile>("launch_browser_profile", {
          profile,
        });
        console.log("Successfully launched profile:", result.name);
        showSuccessToast(t("toasts.success.profileLaunched"));
      } catch (err: unknown) {
        console.error("Failed to launch browser:", err);
        showErrorToast(t("toasts.error.profileLaunchFailed"), {
          description: extractRootError(err),
        });
        throw err;
      }
    },
    [t],
  );

  const handleCloneProfile = useCallback(
    (profile: BrowserProfile) => {
      if (!requireTeamPermission("clone_profile")) {
        return;
      }
      setCloneProfile(profile);
    },
    [requireTeamPermission],
  );

  const handleDeleteProfile = useCallback(
    async (profile: BrowserProfile) => {
      if (!requireTeamPermission("delete_profile")) {
        return;
      }

      console.log("Attempting to delete profile:", profile.name);

      try {
        // First check if the browser is running for this profile
        const isRunning = await invoke<boolean>("check_browser_status", {
          profile,
        });

        if (isRunning) {
          showErrorToast(
            "Cannot delete profile while browser is running. Please stop the browser first.",
          );
          return;
        }

        // Attempt to delete the profile
        await invoke("delete_profile", { profileId: profile.id });
        setArchivedProfileIds((prev) => prev.filter((id) => id !== profile.id));
        setPinnedProfileIds((prev) => prev.filter((id) => id !== profile.id));
        console.log("Profile deletion command completed successfully");
        showSuccessToast(t("toasts.success.profileDeleted"));

        // No need to manually reload - useProfileEvents will handle the update
        console.log("Profile deleted successfully");
      } catch (err: unknown) {
        console.error("Failed to delete profile:", err);
        showErrorToast(t("toasts.error.profileDeleteFailed"), {
          description: extractRootError(err),
        });
      }
    },
    [requireTeamPermission, t],
  );

  const handleRenameProfile = useCallback(
    async (profileId: string, newName: string) => {
      if (!requireTeamPermission("rename_profile")) {
        throw new Error("permission_denied");
      }

      try {
        await invoke("rename_profile", { profileId, newName });
        showSuccessToast(t("toasts.success.profileUpdated"));
      } catch (err: unknown) {
        console.error("Failed to rename profile:", err);
        showErrorToast(t("toasts.error.profileUpdateFailed"), {
          description: extractRootError(err),
        });
        throw err;
      }
    },
    [requireTeamPermission, t],
  );

  const handleKillProfile = useCallback(
    async (profile: BrowserProfile) => {
      if (!requireTeamPermission("stop_profile")) {
        throw new Error("permission_denied");
      }

      console.log("Starting stop for profile:", profile.name);

      try {
        await invoke("kill_browser_profile", { profile });
        console.log("Successfully stopped profile:", profile.name);
      } catch (err: unknown) {
        console.error("Failed to stop browser:", err);
        showErrorToast(t("toasts.error.profileUpdateFailed"), {
          description: extractRootError(err),
        });
        // Re-throw the error so the table component can handle loading state cleanup
        throw err;
      }
    },
    [requireTeamPermission, t],
  );

  const handleDeleteSelectedProfiles = useCallback(
    async (profileIds: string[]) => {
      if (!requireTeamPermission("delete_selected_profiles")) {
        return;
      }

      try {
        await invoke("delete_selected_profiles", { profileIds });
        setArchivedProfileIds((prev) =>
          prev.filter((id) => !profileIds.includes(id)),
        );
        setPinnedProfileIds((prev) =>
          prev.filter((id) => !profileIds.includes(id)),
        );
        showSuccessToast(t("toasts.success.profileDeleted"));
      } catch (err: unknown) {
        console.error("Failed to delete selected profiles:", err);
        showErrorToast(t("toasts.error.profileDeleteFailed"), {
          description: extractRootError(err),
        });
      }
    },
    [requireTeamPermission, t],
  );

  const handleAssignProfilesToGroup = useCallback(
    (profileIds: string[]) => {
      if (!requireTeamPermission("assign_group")) {
        return;
      }
      setSelectedProfilesForGroup(profileIds);
      setGroupAssignmentDialogOpen(true);
    },
    [requireTeamPermission],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedProfiles.length === 0) return;
    setShowBulkDeleteConfirmation(true);
  }, [selectedProfiles]);

  const confirmBulkDelete = useCallback(async () => {
    if (!requireTeamPermission("delete_selected_profiles")) {
      return;
    }

    if (selectedProfiles.length === 0) return;

    setIsBulkDeleting(true);
    const loadingToastId = `profile-bulk-delete-${Date.now()}`;
    showToast({
      id: loadingToastId,
      type: "loading",
      title: t("common.buttons.loading"),
      duration: Number.POSITIVE_INFINITY,
    });
    try {
      await invoke("delete_selected_profiles", {
        profileIds: selectedProfiles,
      });
      setArchivedProfileIds((prev) =>
        prev.filter((id) => !selectedProfiles.includes(id)),
      );
      setPinnedProfileIds((prev) =>
        prev.filter((id) => !selectedProfiles.includes(id)),
      );
      showSuccessToast(t("toasts.success.profileDeleted"));
      setSelectedProfiles([]);
      setShowBulkDeleteConfirmation(false);
    } catch (error) {
      console.error("Failed to delete selected profiles:", error);
      showErrorToast(t("toasts.error.profileDeleteFailed"), {
        description: extractRootError(error),
      });
    } finally {
      dismissToast(loadingToastId);
      setIsBulkDeleting(false);
    }
  }, [requireTeamPermission, selectedProfiles, t]);

  const handleArchiveProfile = useCallback(
    (profile: BrowserProfile) => {
      if (!requireTeamPermission("delete_profile")) {
        return;
      }
      setArchivedProfileIds((prev) => {
        if (prev.includes(profile.id)) return prev;
        return [profile.id, ...prev];
      });
      setSelectedProfiles((prev) => prev.filter((id) => id !== profile.id));
      showSuccessToast(t("profiles.actions.archiveSuccess"));
    },
    [requireTeamPermission, t],
  );

  const handleRestoreProfile = useCallback(
    (profile: BrowserProfile) => {
      setArchivedProfileIds((prev) => prev.filter((id) => id !== profile.id));
      showSuccessToast(t("profiles.actions.restoreSuccess"));
    },
    [t],
  );

  const handleArchiveSelectedProfiles = useCallback(() => {
    if (!requireTeamPermission("delete_selected_profiles")) {
      return;
    }
    if (selectedProfiles.length === 0) return;
    setArchivedProfileIds((prev) => {
      const next = new Set(prev);
      for (const id of selectedProfiles) {
        next.add(id);
      }
      return Array.from(next);
    });
    setSelectedProfiles([]);
    showSuccessToast(t("profiles.actions.archiveSuccess"));
  }, [requireTeamPermission, selectedProfiles, t]);

  const handlePinProfile = useCallback(
    (profile: BrowserProfile) => {
      setPinnedProfileIds((prev) => {
        if (prev.includes(profile.id)) return prev;
        return [profile.id, ...prev];
      });
      showSuccessToast(t("profiles.actions.pinSuccess"));
    },
    [t],
  );

  const handleUnpinProfile = useCallback(
    (profile: BrowserProfile) => {
      setPinnedProfileIds((prev) => prev.filter((id) => id !== profile.id));
      showSuccessToast(t("profiles.actions.unpinSuccess"));
    },
    [t],
  );

  const handleBulkGroupAssignment = useCallback(() => {
    if (selectedProfiles.length === 0) return;
    handleAssignProfilesToGroup(selectedProfiles);
    setSelectedProfiles([]);
  }, [selectedProfiles, handleAssignProfilesToGroup]);

  const handleAssignExtensionGroup = useCallback(
    (profileIds: string[]) => {
      if (!requireTeamPermission("assign_extension_group")) {
        return;
      }
      setSelectedProfilesForExtensionGroup(profileIds);
      setExtensionGroupAssignmentDialogOpen(true);
    },
    [requireTeamPermission],
  );

  const handleBulkExtensionGroupAssignment = useCallback(() => {
    if (selectedProfiles.length === 0) return;
    handleAssignExtensionGroup(selectedProfiles);
    setSelectedProfiles([]);
  }, [selectedProfiles, handleAssignExtensionGroup]);

  const handleExtensionGroupAssignmentComplete = useCallback(() => {
    setExtensionGroupAssignmentDialogOpen(false);
    setSelectedProfilesForExtensionGroup([]);
  }, []);

  const handleAssignProfilesToProxy = useCallback(
    (profileIds: string[]) => {
      if (!requireTeamPermission("assign_proxy")) {
        return;
      }
      setSelectedProfilesForProxy(profileIds);
      setProxyAssignmentDialogOpen(true);
    },
    [requireTeamPermission],
  );

  const handleBulkProxyAssignment = useCallback(() => {
    if (selectedProfiles.length === 0) return;
    handleAssignProfilesToProxy(selectedProfiles);
    setSelectedProfiles([]);
  }, [selectedProfiles, handleAssignProfilesToProxy]);

  const handleBulkCopyCookies = useCallback(() => {
    if (selectedProfiles.length === 0) return;
    const eligibleProfiles = profiles.filter(
      (p) =>
        selectedProfiles.includes(p.id) &&
        (p.browser === "wayfern" || p.browser === "camoufox"),
    );
    if (eligibleProfiles.length === 0) {
      showErrorToast(
        "Cookie copy only works with Wayfern and Camoufox profiles",
      );
      return;
    }
    setSelectedProfilesForCookies(eligibleProfiles.map((p) => p.id));
    setCookieCopyDialogOpen(true);
  }, [selectedProfiles, profiles]);

  const handleCopyCookiesToProfile = useCallback((profile: BrowserProfile) => {
    setSelectedProfilesForCookies([profile.id]);
    setCookieCopyDialogOpen(true);
  }, []);

  const handleOpenCookieManagement = useCallback((profile: BrowserProfile) => {
    setCurrentProfileForCookieManagement(profile);
    setCookieManagementDialogOpen(true);
  }, []);

  const handleGroupAssignmentComplete = useCallback(async () => {
    // No need to manually reload - useProfileEvents will handle the update
    setGroupAssignmentDialogOpen(false);
    setSelectedProfilesForGroup([]);
  }, []);

  const handleProxyAssignmentComplete = useCallback(async () => {
    // No need to manually reload - useProfileEvents will handle the update
    setProxyAssignmentDialogOpen(false);
    setSelectedProfilesForProxy([]);
  }, []);

  const handleGroupManagementComplete = useCallback(async () => {
    // No need to manually reload - useProfileEvents will handle the update
  }, []);

  const handleOpenProfileSyncDialog = useCallback((profile: BrowserProfile) => {
    setCurrentProfileForSync(profile);
    setProfileSyncDialogOpen(true);
  }, []);

  const handleToggleProfileSync = useCallback(
    async (profile: BrowserProfile) => {
      if (!requireTeamPermission("toggle_profile_sync")) {
        return;
      }

      try {
        const enabling = !profile.sync_mode || profile.sync_mode === "Disabled";
        await invoke("set_profile_sync_mode", {
          profileId: profile.id,
          syncMode: enabling ? "Regular" : "Disabled",
        });
        showSuccessToast(enabling ? "Sync enabled" : "Sync disabled", {
          description: enabling
            ? "Profile sync has been enabled"
            : "Profile sync has been disabled",
        });
      } catch (error) {
        console.error("Failed to toggle sync:", error);
        showErrorToast("Failed to update sync settings");
      }
    },
    [requireTeamPermission],
  );

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    (async () => {
      try {
        unlistenStatus = await listen<{
          profile_id: string;
          status: string;
          error?: string;
        }>("profile-sync-status", (event) => {
          const { profile_id, status, error } = event.payload;
          const toastId = `sync-${profile_id}`;
          const profile = profiles.find((p) => p.id === profile_id);
          const name = profile?.name ?? "Unknown";

          if (status === "syncing") {
            showToast({
              type: "loading",
              title: `Syncing profile '${name}'...`,
              id: toastId,
              duration: Number.POSITIVE_INFINITY,
              onCancel: () => dismissToast(toastId),
            });
          } else if (status === "synced") {
            dismissToast(toastId);
            showSuccessToast(`Profile '${name}' synced successfully`);
          } else if (status === "error") {
            dismissToast(toastId);
            showErrorToast(
              `Failed to sync profile '${name}'${error ? `: ${error}` : ""}`,
            );
          }
        });

        unlistenProgress = await listen<{
          profile_id: string;
          phase: string;
          total_files?: number;
          total_bytes?: number;
        }>("profile-sync-progress", (event) => {
          const { profile_id, phase, total_files, total_bytes } = event.payload;
          if (phase !== "started") return;

          const toastId = `sync-${profile_id}`;
          const profile = profiles.find((p) => p.id === profile_id);
          const name = profile?.name ?? "Unknown";

          showSyncProgressToast(name, total_files ?? 0, total_bytes ?? 0, {
            id: toastId,
          });
        });
      } catch (error) {
        console.error("Failed to listen for sync events:", error);
      }
    })();
    return () => {
      if (unlistenStatus) unlistenStatus();
      if (unlistenProgress) unlistenProgress();
    };
  }, [profiles]);

  useEffect(() => {
    // Check for startup default browser prompt
    void checkStartupPrompt();

    // Listen for URL open events and get cleanup function
    const setupListeners = async () => {
      const cleanup = await listenForUrlEvents();
      return cleanup;
    };

    let cleanup: (() => void) | undefined;
    setupListeners().then((cleanupFn) => {
      cleanup = cleanupFn;
    });

    // Check for startup URLs (when app was launched as default browser)
    void checkCurrentUrl();

    // Set up periodic update checks (every 30 minutes)
    const updateInterval = setInterval(
      () => {
        void checkForUpdates();
      },
      30 * 60 * 1000,
    );

    // Check for missing binaries after initial profile load
    if (!profilesLoading && profiles.length > 0) {
      void checkMissingBinaries();
    }

    // Proactively download Wayfern and Camoufox if not already available
    if (!profilesLoading) {
      void invoke("ensure_active_browsers_downloaded").catch((err: unknown) => {
        console.error("Failed to auto-download browsers:", err);
      });
    }

    return () => {
      clearInterval(updateInterval);
      if (cleanup) {
        cleanup();
      }
    };
  }, [
    checkForUpdates,
    checkStartupPrompt,
    listenForUrlEvents,
    checkCurrentUrl,
    checkMissingBinaries,
    profilesLoading,
    profiles.length,
  ]);

  // Show deprecation warning for unsupported profiles (with names)
  useEffect(() => {
    if (profiles.length === 0) return;

    const deprecatedProfiles = profiles.filter(
      (p) => p.release_type === "nightly" && p.browser !== "firefox-developer",
    );

    if (deprecatedProfiles.length > 0) {
      const deprecatedNames = deprecatedProfiles.map((p) => p.name).join(", ");

      // Use a stable id to avoid duplicate toasts on re-renders
      showToast({
        id: "deprecated-profiles-warning",
        type: "error",
        title: "Some profiles will be deprecated soon",
        description: `The following profiles will be deprecated soon: ${deprecatedNames}. Nightly profiles (except Firefox Developers Edition) will be removed in upcoming versions. Please check GitHub for migration instructions.`,
        duration: 15000,
        action: {
          label: "Learn more",
          onClick: () => {
            showToast({
              type: "success",
              title: "Migration note",
              description:
                "Review migration guidance in your internal BugLogin documentation.",
              duration: 8000,
            });
          },
        },
      });
    }
  }, [profiles]);

  // Show warning for non-wayfern/camoufox profiles (support ending March 15, 2026)
  useEffect(() => {
    if (profiles.length === 0) return;

    const unsupportedProfiles = profiles.filter(
      (p) => p.browser !== "wayfern" && p.browser !== "camoufox",
    );

    if (unsupportedProfiles.length > 0) {
      const unsupportedNames = unsupportedProfiles
        .map((p) => p.name)
        .join(", ");

      showToast({
        id: "browser-support-ending-warning",
        type: "error",
        title: "Browser support ending soon",
        description: `Support for the following profiles will be removed on March 15, 2026: ${unsupportedNames}. Please migrate to Wayfern or Camoufox profiles.`,
        duration: 15000,
        action: {
          label: "Learn more",
          onClick: () => {
            showToast({
              type: "success",
              title: "Migration note",
              description:
                "Review migration guidance in your internal BugLogin documentation.",
              duration: 8000,
            });
          },
        },
      });
    }
  }, [profiles]);

  // Re-check Wayfern terms when a browser download completes
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      unlisten = await listen<{ stage: string }>(
        "download-progress",
        (event) => {
          if (event.payload.stage === "completed") {
            void checkTerms();
          }
        },
      );
    };
    void setup();
    return () => {
      if (unlisten) unlisten();
    };
  }, [checkTerms]);

  // Check permissions when they are initialized
  useEffect(() => {
    if (isInitialized) {
      void checkAllPermissions();
    }
  }, [isInitialized, checkAllPermissions]);

  // Filter data by selected group and search query
  const filteredProfiles = useMemo(() => {
    const archivedIdSet = new Set(archivedProfileIds);
    const pinnedIdSet = new Set(pinnedProfileIds);
    let filtered =
      profileViewMode === "archived"
        ? profiles.filter((profile) => archivedIdSet.has(profile.id))
        : profiles.filter((profile) => !archivedIdSet.has(profile.id));

    // Filter by group
    if (
      selectedGroupId &&
      selectedGroupId !== ALL_GROUP_ID &&
      selectedGroupId !== "default"
    ) {
      filtered = filtered.filter((profile) => {
        return profile.group_id === selectedGroupId;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((profile) => {
        // Search in profile name
        if (profile.name.toLowerCase().includes(query)) return true;

        // Search in note
        if (profile.note?.toLowerCase().includes(query)) return true;

        // Search in tags
        if (profile.tags?.some((tag) => tag.toLowerCase().includes(query)))
          return true;

        return false;
      });
    }

    if (showPinnedOnly) {
      filtered = filtered.filter((profile) => pinnedIdSet.has(profile.id));
    }

    filtered.sort((left, right) => {
      const leftPinned = pinnedIdSet.has(left.id) ? 1 : 0;
      const rightPinned = pinnedIdSet.has(right.id) ? 1 : 0;
      if (leftPinned !== rightPinned) {
        return rightPinned - leftPinned;
      }
      return left.name.localeCompare(right.name);
    });

    return filtered;
  }, [
    profiles,
    selectedGroupId,
    searchQuery,
    archivedProfileIds,
    pinnedProfileIds,
    profileViewMode,
    showPinnedOnly,
  ]);

  useEffect(() => {
    if (
      !selectedGroupId ||
      selectedGroupId === ALL_GROUP_ID ||
      selectedGroupId === "default"
    ) {
      return;
    }
    if (!groupsData.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(ALL_GROUP_ID);
    }
  }, [groupsData, selectedGroupId]);

  // Update loading states
  const isLoading = profilesLoading || groupsLoading || proxiesLoading;

  const renderActiveSection = () => {
    switch (activeSection) {
      case "proxies":
        return (
          <ProxyManagementDialog
            isOpen={true}
            onClose={() => void 0}
            mode="page"
          />
        );
      case "settings":
        return (
          <SettingsDialog
            isOpen={true}
            onClose={() => void 0}
            onIntegrationsOpen={() => setActiveSection("integrations")}
            mode="page"
          />
        );
      case "workspace-governance":
        if (!canManageSelectedWorkspaceGovernance) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.workspaceGovernance")}
              description={t("adminWorkspace.ownerOnlyGovernance")}
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("adminWorkspace.ownerOnlyGovernance")}
              </div>
            </WorkspacePageShell>
          );
        }
        return (
          <WorkspacePageShell
            title={t("shell.sections.workspaceGovernance")}
            description={t("adminWorkspace.workspaceSubtitle")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <PlatformAdminWorkspace
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
              platformRole={cloudUser?.platformRole}
              teamRole={selectedWorkspaceRole}
              sidebarTab="workspace"
              workspaceContextId={sidebarWorkspaceId}
              onWorkspaceContextChange={setSidebarWorkspaceId}
            />
          </WorkspacePageShell>
        );
      case "integrations":
        return (
          <IntegrationsDialog
            isOpen={true}
            onClose={() => void 0}
            mode="page"
          />
        );
      case "billing":
        if (!canManageSelectedWorkspaceBilling) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.billingManagement")}
              description={t("billingPage.ownerOnlyDescription")}
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("billingPage.ownerOnlyDescription")}
              </div>
            </WorkspacePageShell>
          );
        }
        return (
          <WorkspacePageShell
            title={t("shell.sections.billingManagement")}
            description={t("billingPage.managementPageDescription")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <WorkspaceBillingPage
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
              user={cloudUser!}
              teamRole={selectedWorkspaceRole}
              workspaceId={selectedWorkspaceContext?.id ?? null}
              workspaceName={selectedWorkspaceContext?.name ?? null}
              workspacePlanLabel={selectedWorkspaceContext?.planLabel ?? null}
              workspaceProfileLimit={selectedWorkspaceContext?.profileLimit ?? null}
              workspaceProfilesUsed={selectedWorkspaceContext?.profilesUsed ?? 0}
              onOpenAdminWorkspace={() => setActiveSection("admin-overview")}
              onOpenSyncConfig={() => setSyncConfigDialogOpen(true)}
              onOpenPricingPage={() => setActiveSection("pricing")}
            />
          </WorkspacePageShell>
        );
      case "pricing":
        return (
          <WorkspacePageShell
            title={t("shell.sections.pricing")}
            description={t("pricingPage.description")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <WorkspacePricingPage
              user={cloudUser!}
              teamRole={selectedWorkspaceRole}
              workspaceId={selectedWorkspaceContext?.id ?? null}
              workspaceName={selectedWorkspaceContext?.name ?? null}
              workspacePlanLabel={selectedWorkspaceContext?.planLabel ?? null}
              onOpenBillingManagement={() => setActiveSection("billing")}
            />
          </WorkspacePageShell>
        );
      case "admin-overview":
      case "admin-workspace":
      case "admin-billing":
      case "admin-audit":
      case "admin-system":
      case "admin-analytics":
        const adminSectionToTab = {
          "admin-overview": "overview",
          "admin-workspace": "workspace",
          "admin-billing": "billing",
          "admin-audit": "audit",
          "admin-system": "system",
          "admin-analytics": "analytics",
        } as const;
        const adminTab = adminSectionToTab[activeSection];
        const adminDescription =
          cloudUser?.platformRole === "platform_admin"
            ? t("adminWorkspace.subtitle")
            : t("adminWorkspace.workspaceSubtitle");
        if (!canAccessAdminWorkspace) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.adminPanel")}
              description={t("adminWorkspace.noAccessDescription")}
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("adminWorkspace.noAccessDescription")}
              </div>
            </WorkspacePageShell>
          );
        }
        return (
          <WorkspacePageShell
            title={t(`adminWorkspace.tabs.${adminTab}`)}
            description={adminDescription}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <PlatformAdminWorkspace
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
              platformRole={cloudUser?.platformRole}
              teamRole={selectedWorkspaceRole}
              sidebarTab={adminTab}
              workspaceContextId={sidebarWorkspaceId}
              onWorkspaceContextChange={setSidebarWorkspaceId}
            />
          </WorkspacePageShell>
        );
      default:
        return (
          <WorkspacePageShell
            title={t("shell.sections.profiles")}
            actions={
              <ProfilesWorkspaceHeaderActions
                onCreateProfileDialogOpen={setCreateProfileDialogOpen}
                onGroupManagementDialogOpen={setGroupManagementDialogOpen}
                onImportProfileDialogOpen={setImportProfileDialogOpen}
                onProxyPageOpen={() => setActiveSection("proxies")}
                onSettingsPageOpen={() => setActiveSection("settings")}
                onSyncConfigDialogOpen={setSyncConfigDialogOpen}
                onIntegrationsPageOpen={() => setActiveSection("integrations")}
                onExtensionManagementDialogOpen={
                  setExtensionManagementDialogOpen
                }
                crossOsUnlocked={crossOsUnlocked}
              />
            }
            toolbar={
              <ProfilesWorkspaceToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                selectedGroupId={selectedGroupId}
                savedViews={savedViews}
                onCreateSavedView={handleCreateSavedView}
                onApplySavedView={handleApplySavedView}
                onDeleteSavedView={handleDeleteSavedView}
                profileViewMode={profileViewMode}
                onToggleProfileViewMode={() =>
                  setProfileViewMode((prev) =>
                    prev === "active" ? "archived" : "active",
                  )
                }
                archivedCount={archivedProfileIds.length}
                pinnedCount={pinnedProfileIds.length}
                showPinnedOnly={showPinnedOnly}
                onTogglePinnedOnly={() => setShowPinnedOnly((prev) => !prev)}
              />
            }
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <GroupBadges
              selectedGroupId={selectedGroupId}
              onGroupSelect={handleSelectGroup}
              groups={groupsData}
              isLoading={isLoading}
            />
            <ProfilesDataTable
              profiles={filteredProfiles}
              onLaunchProfile={launchProfile}
              onKillProfile={handleKillProfile}
              onCloneProfile={handleCloneProfile}
              onDeleteProfile={handleDeleteProfile}
              onRenameProfile={handleRenameProfile}
              onConfigureCamoufox={handleConfigureCamoufox}
              onCopyCookiesToProfile={handleCopyCookiesToProfile}
              onOpenCookieManagement={handleOpenCookieManagement}
              runningProfiles={runningProfiles}
              isUpdating={isUpdating}
              onDeleteSelectedProfiles={handleDeleteSelectedProfiles}
              onAssignProfilesToGroup={handleAssignProfilesToGroup}
              selectedGroupId={selectedGroupId}
              selectedProfiles={selectedProfiles}
              onSelectedProfilesChange={setSelectedProfiles}
              onBulkDelete={handleBulkDelete}
              onBulkGroupAssignment={handleBulkGroupAssignment}
              onBulkProxyAssignment={handleBulkProxyAssignment}
              onBulkCopyCookies={handleBulkCopyCookies}
              onBulkExtensionGroupAssignment={
                handleBulkExtensionGroupAssignment
              }
              onBulkArchive={handleArchiveSelectedProfiles}
              onAssignExtensionGroup={handleAssignExtensionGroup}
              onOpenProfileSyncDialog={handleOpenProfileSyncDialog}
              onToggleProfileSync={handleToggleProfileSync}
              onArchiveProfile={handleArchiveProfile}
              onRestoreProfile={handleRestoreProfile}
              isProfileArchived={(profileId) =>
                archivedProfileIds.includes(profileId)
              }
              onPinProfile={handlePinProfile}
              onUnpinProfile={handleUnpinProfile}
              isProfilePinned={(profileId) =>
                pinnedProfileIds.includes(profileId)
              }
              workspaceRole={selectedWorkspaceRole}
              crossOsUnlocked={crossOsUnlocked}
              syncUnlocked={syncUnlocked}
            />
          </WorkspacePageShell>
        );
    }
  };

  if (!cloudUser) {
    if (isCloudAuthLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background text-[13px] leading-[1.35] tracking-[-0.005em] font-(family-name:--font-sans)">
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
            <div className="w-6 h-6 rounded-full border-[2px] border-primary/20 border-t-primary animate-spin" />
            <span className="text-muted-foreground font-medium text-[12px] uppercase tracking-wider">Bug Login</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen bg-background text-[13px] leading-[1.35] tracking-[-0.005em] font-(family-name:--font-sans) relative">
        {pendingConfigMessages.length > 0 && (
          <div className="fixed top-0 left-0 right-0 z-50 flex justify-center border-b border-border bg-muted/80 backdrop-blur-md px-4 py-2 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {pendingConfigMessages.join(" • ")}
          </div>
        )}
        <AuthPricingWorkspace
          runtimeConfig={runtimeConfig}
          prefilledInviteToken={prefilledInviteToken}
          onConsumeInviteToken={() => setPrefilledInviteToken(null)}
          onOpenSyncConfig={() => setSyncConfigDialogOpen(true)}
        />
        <SyncConfigDialog
          isOpen={syncConfigDialogOpen}
          onClose={(loginOccurred) => {
            setSyncConfigDialogOpen(false);
            if (loginOccurred) {
              setSyncAllDialogOpen(true);
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-[13px] leading-[1.35] tracking-[-0.005em] font-(family-name:--font-sans)">
      <AppSidebar
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        onSectionChange={setActiveSection}
        onCollapsedChange={setSidebarCollapsed}
        showAdminSection={canAccessAdminWorkspace}
        teamRole={teamRole}
        currentWorkspaceRole={selectedWorkspaceRole}
        platformRole={cloudUser?.platformRole ?? null}
        workspaceOptions={workspaceOptions}
        currentWorkspaceId={sidebarWorkspaceId}
        onWorkspaceChange={setSidebarWorkspaceId}
        authEmail={cloudUser?.email ?? null}
        authName={cloudUser?.name ?? null}
        authAvatar={cloudUser?.avatar ?? null}
        isAuthenticated={Boolean(cloudUser)}
        isAuthBusy={isCloudAuthLoading}
        onSignIn={() => {
          setActiveSection("profiles");
        }}
        onSignOut={() => {
          void handleCloudSignOut();
        }}
      />

      <main className="app-shell-safe flex min-w-0 flex-1 flex-col overflow-hidden pl-6 pb-4 md:pl-8 md:pb-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {pendingConfigMessages.length > 0 && (
            <div className="mb-3 rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
              {pendingConfigMessages.join(" • ")}
            </div>
          )}
          {renderActiveSection()}
        </div>
      </main>

      <CreateProfileDialog
        isOpen={createProfileDialogOpen}
        onClose={() => {
          setCreateProfileDialogOpen(false);
        }}
        onCreateProfile={handleCreateProfile}
        selectedGroupId={selectedGroupId}
        crossOsUnlocked={crossOsUnlocked}
      />

      <ImportProfileDialog
        isOpen={importProfileDialogOpen}
        onClose={() => {
          setImportProfileDialogOpen(false);
        }}
      />

      {pendingUrls.map((pendingUrl) => (
        <ProfileSelectorDialog
          key={pendingUrl.id}
          isOpen={true}
          onClose={() => {
            setPendingUrls((prev) =>
              prev.filter((u) => u.id !== pendingUrl.id),
            );
          }}
          url={pendingUrl.url}
          isUpdating={isUpdating}
          runningProfiles={runningProfiles}
        />
      ))}

      <PermissionDialog
        isOpen={permissionDialogOpen}
        onClose={() => {
          setPermissionDialogOpen(false);
        }}
        permissionType={currentPermissionType}
        onPermissionGranted={checkNextPermission}
      />

      <CloneProfileDialog
        isOpen={!!cloneProfile}
        onClose={() => setCloneProfile(null)}
        profile={cloneProfile}
      />

      <CamoufoxConfigDialog
        isOpen={camoufoxConfigDialogOpen}
        onClose={() => {
          setCamoufoxConfigDialogOpen(false);
        }}
        profile={currentProfileForCamoufoxConfig}
        onSave={handleSaveCamoufoxConfig}
        onSaveWayfern={handleSaveWayfernConfig}
        isRunning={
          currentProfileForCamoufoxConfig
            ? runningProfiles.has(currentProfileForCamoufoxConfig.id)
            : false
        }
        crossOsUnlocked={crossOsUnlocked}
      />

      <GroupManagementDialog
        isOpen={groupManagementDialogOpen}
        onClose={() => {
          setGroupManagementDialogOpen(false);
        }}
        onGroupManagementComplete={handleGroupManagementComplete}
      />

      <ExtensionManagementDialog
        isOpen={extensionManagementDialogOpen}
        onClose={() => setExtensionManagementDialogOpen(false)}
        limitedMode={!crossOsUnlocked}
      />

      <GroupAssignmentDialog
        isOpen={groupAssignmentDialogOpen}
        onClose={() => {
          setGroupAssignmentDialogOpen(false);
        }}
        selectedProfiles={selectedProfilesForGroup}
        onAssignmentComplete={handleGroupAssignmentComplete}
        profiles={profiles}
      />

      <ExtensionGroupAssignmentDialog
        isOpen={extensionGroupAssignmentDialogOpen}
        onClose={() => {
          setExtensionGroupAssignmentDialogOpen(false);
        }}
        selectedProfiles={selectedProfilesForExtensionGroup}
        onAssignmentComplete={handleExtensionGroupAssignmentComplete}
        profiles={profiles}
      />

      <ProxyAssignmentDialog
        isOpen={proxyAssignmentDialogOpen}
        onClose={() => {
          setProxyAssignmentDialogOpen(false);
        }}
        selectedProfiles={selectedProfilesForProxy}
        onAssignmentComplete={handleProxyAssignmentComplete}
        profiles={profiles}
        storedProxies={storedProxies}
        vpnConfigs={vpnConfigs}
      />

      <CookieCopyDialog
        isOpen={cookieCopyDialogOpen}
        onClose={() => {
          setCookieCopyDialogOpen(false);
          setSelectedProfilesForCookies([]);
        }}
        selectedProfiles={selectedProfilesForCookies}
        profiles={profiles}
        runningProfiles={runningProfiles}
        onCopyComplete={() => setSelectedProfilesForCookies([])}
      />

      <CookieManagementDialog
        isOpen={cookieManagementDialogOpen}
        onClose={() => {
          setCookieManagementDialogOpen(false);
          setCurrentProfileForCookieManagement(null);
        }}
        profile={currentProfileForCookieManagement}
      />

      <DeleteConfirmationDialog
        isOpen={showBulkDeleteConfirmation}
        onClose={() => setShowBulkDeleteConfirmation(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Selected Profiles"
        description={`This action cannot be undone. This will permanently delete ${selectedProfiles.length} profile${selectedProfiles.length !== 1 ? "s" : ""} and all associated data.`}
        confirmButtonText={`Delete ${selectedProfiles.length} Profile${selectedProfiles.length !== 1 ? "s" : ""}`}
        isLoading={isBulkDeleting}
        profileIds={selectedProfiles}
        profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
      />

      <SyncConfigDialog
        isOpen={syncConfigDialogOpen}
        onClose={(loginOccurred) => {
          setSyncConfigDialogOpen(false);
          if (loginOccurred) {
            setSyncAllDialogOpen(true);
          }
        }}
      />

      <SyncAllDialog
        isOpen={syncAllDialogOpen}
        onClose={() => setSyncAllDialogOpen(false)}
      />

      <ProfileSyncDialog
        isOpen={profileSyncDialogOpen}
        onClose={() => {
          setProfileSyncDialogOpen(false);
          setCurrentProfileForSync(null);
        }}
        profile={currentProfileForSync}
        onSyncConfigOpen={() => setSyncConfigDialogOpen(true)}
      />

      {/* Wayfern Terms and Conditions Dialog - shown if terms not accepted */}
      <WayfernTermsDialog
        isOpen={!termsLoading && termsAccepted === false}
        onAccepted={checkTerms}
      />

      {/* Launch on Login Dialog - shown on every startup until enabled or declined */}
      <LaunchOnLoginDialog
        isOpen={launchOnLoginDialogOpen}
        onClose={() => setLaunchOnLoginDialogOpen(false)}
      />

      <WindowResizeWarningDialog
        isOpen={windowResizeWarningOpen}
        browserType={windowResizeWarningBrowserType}
        onResult={(proceed) => {
          setWindowResizeWarningOpen(false);
          windowResizeWarningResolver.current?.(proceed);
          windowResizeWarningResolver.current = null;
        }}
      />
    </div>
  );
}
