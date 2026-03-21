"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppSidebar } from "@/components/app-sidebar";
import { CamoufoxConfigDialog } from "@/components/camoufox-config-dialog";
import { CloneProfileDialog } from "@/components/clone-profile-dialog";
import { CloudAuthDialog } from "@/components/cloud-auth-dialog";
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
import type {
  AppSection,
  BrowserProfile,
  CamoufoxConfig,
  WayfernConfig,
} from "@/types";
import { Button } from "@/components/ui/button";

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

type ProfileViewMode = "active" | "archived";

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
  const { entitlement, isReadOnly, runtimeConfig } = useRuntimeAccess();
  const syncUnlocked = runtimeConfig?.s3_sync === "ready";
  const canAccessAdminWorkspace = Boolean(cloudUser);

  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<AppSection>("profiles");
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
  const [selectedGroupId, setSelectedGroupId] = useState<string>("default");
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
  const [cloudAuthDialogOpen, setCloudAuthDialogOpen] = useState(false);
  const [prefilledInviteToken, setPrefilledInviteToken] = useState<
    string | null
  >(null);
  const [profileSyncDialogOpen, setProfileSyncDialogOpen] = useState(false);
  const [currentProfileForSync, setCurrentProfileForSync] =
    useState<BrowserProfile | null>(null);
  const { isMicrophoneAccessGranted, isCameraAccessGranted, isInitialized } =
    usePermissions();

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
      const raw = window.localStorage.getItem("buglogin.profile.savedViews.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedProfileView[];
      if (Array.isArray(parsed)) {
        setSavedViews(parsed);
      }
    } catch {
      setSavedViews([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "buglogin.profile.savedViews.v1",
        JSON.stringify(savedViews),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [savedViews]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        "buglogin.profile.archivedIds.v1",
      );
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setArchivedProfileIds(parsed);
      }
    } catch {
      setArchivedProfileIds([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "buglogin.profile.archivedIds.v1",
        JSON.stringify(archivedProfileIds),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [archivedProfileIds]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("buglogin.profile.pinnedIds.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      if (Array.isArray(parsed)) {
        setPinnedProfileIds(parsed);
      }
    } catch {
      setPinnedProfileIds([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "buglogin.profile.pinnedIds.v1",
        JSON.stringify(pinnedProfileIds),
      );
    } catch {
      // Ignore storage errors.
    }
  }, [pinnedProfileIds]);

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

      if (canPerformTeamAction(teamRole, action)) {
        return true;
      }

      showErrorToast(t("sync.team.permissionDenied"), {
        description: "permission_denied",
      });
      return false;
    },
    [isReadOnly, t, teamRole],
  );

  const pendingConfigMessages = useMemo(() => {
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
  }, [runtimeConfig, t]);

  useEffect(() => {
    if (activeSection === "admin" && !canAccessAdminWorkspace) {
      setActiveSection("profiles");
      showErrorToast(t("adminWorkspace.noAccessTitle"), {
        description: t("adminWorkspace.noAccessDescription"),
      });
    }
  }, [activeSection, canAccessAdminWorkspace, t]);

  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    setSelectedProfiles([]);
  }, []);

  const handleCreateSavedView = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && selectedGroupId === "default" && !showPinnedOnly) {
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
      setSelectedGroupId(view.groupId);
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
          setCloudAuthDialogOpen(true);
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
              (selectedGroupId !== "default" ? selectedGroupId : undefined),
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
    if (!selectedGroupId || selectedGroupId === "default") {
      filtered = filtered.filter((profile) => !profile.group_id);
    } else {
      filtered = filtered.filter(
        (profile) => profile.group_id === selectedGroupId,
      );
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
      case "integrations":
        return (
          <IntegrationsDialog
            isOpen={true}
            onClose={() => void 0}
            mode="page"
          />
        );
      case "admin":
        if (!canAccessAdminWorkspace) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.admin")}
              description={t("adminWorkspace.noAccessDescription")}
              actions={
                !cloudUser ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setPrefilledInviteToken(null);
                      setCloudAuthDialogOpen(true);
                    }}
                  >
                    {t("shell.auth.signIn")}
                  </Button>
                ) : undefined
              }
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {!cloudUser
                  ? t("adminWorkspace.signInRequired")
                  : t("adminWorkspace.noAccessDescription")}
              </div>
            </WorkspacePageShell>
          );
        }
        return (
          <WorkspacePageShell
            title={t("shell.sections.admin")}
            description={t("adminWorkspace.subtitle")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <PlatformAdminWorkspace
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
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
              crossOsUnlocked={crossOsUnlocked}
              syncUnlocked={syncUnlocked}
            />
          </WorkspacePageShell>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-[13px] leading-[1.35] tracking-[-0.005em] font-(family-name:--font-sans)">
      <AppSidebar
        activeSection={activeSection}
        collapsed={sidebarCollapsed}
        onSectionChange={setActiveSection}
        onCollapsedChange={setSidebarCollapsed}
        showAdminSection={canAccessAdminWorkspace}
        authEmail={cloudUser?.email ?? null}
        isAuthenticated={Boolean(cloudUser)}
        isAuthBusy={isCloudAuthLoading}
        onSignIn={() => {
          setPrefilledInviteToken(null);
          setCloudAuthDialogOpen(true);
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

      <CloudAuthDialog
        isOpen={cloudAuthDialogOpen}
        prefilledInviteToken={prefilledInviteToken}
        onClose={() => {
          setCloudAuthDialogOpen(false);
          setPrefilledInviteToken(null);
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
