"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrent } from "@tauri-apps/plugin-deep-link";
import dynamic from "next/dynamic";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { AppSidebar } from "@/components/app-sidebar";
import { MainWorkspaceTopBar } from "@/components/main-workspace-topbar";
import {
  ProfilesWorkspaceHeaderActions,
  ProfilesWorkspaceToolbar,
} from "@/components/profiles-workspace-chrome";
import { Button } from "@/components/ui/button";
import { PageLoader, PageLoaderOverlay } from "@/components/ui/page-loader";
import { WorkspacePageShell } from "@/components/workspace-page-shell";
import { useAppUpdateNotifications } from "@/hooks/use-app-update-notifications";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import type { PermissionType } from "@/hooks/use-permissions";
import { usePermissions } from "@/hooks/use-permissions";
import { useProfileEvents } from "@/hooks/use-profile-events";
import { useProxyEvents } from "@/hooks/use-proxy-events";
import { useRuntimeAccess } from "@/hooks/use-runtime-access";
import { useUpdateNotifications } from "@/hooks/use-update-notifications";
import { useVpnEvents } from "@/hooks/use-vpn-events";
import { useWayfernTerms } from "@/hooks/use-wayfern-terms";
import { getBrowserDisplayName } from "@/lib/browser-utils";
import { extractRootError } from "@/lib/error-utils";
import { invokeCached } from "@/lib/ipc-query-cache";
import { formatLocaleDate } from "@/lib/locale-format";
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
import { openWebBillingPortal } from "@/lib/web-billing-desktop";
import { normalizePlanIdFromLabel } from "@/lib/workspace-billing-logic";
import {
  DATA_SCOPE_CHANGED_EVENT,
  distributeUnscopedEntityIdsForAccount,
  getScopedEntityCountsForWorkspaces,
  migrateDataScopeAccount,
  normalizeDataScopeWorkspacesForAccount,
  setCurrentDataScope,
  toDataScopeKey,
} from "@/lib/workspace-data-scope";
import { updateWorkspaceProfilesUsed } from "@/lib/workspace-switcher";
import type {
  AppSection,
  BrowserProfile,
  CamoufoxConfig,
  ControlWorkspace,
  TeamRole,
  WayfernConfig,
} from "@/types";

const PortalAuthPage = dynamic(
  () =>
    import("@/components/portal/auth/portal-auth-page").then(
      (mod) => mod.PortalAuthPage,
    ),
  { ssr: false, loading: () => <PageLoader /> },
);

const CreateProfileDialog = dynamic(
  () =>
    import("@/components/create-profile-dialog").then(
      (mod) => mod.CreateProfileDialog,
    ),
  { ssr: false },
);

const ImportProfileDialog = dynamic(
  () =>
    import("@/components/import-profile-dialog").then(
      (mod) => mod.ImportProfileDialog,
    ),
  { ssr: false },
);

const CamoufoxConfigDialog = dynamic(
  () =>
    import("@/components/camoufox-config-dialog").then(
      (mod) => mod.CamoufoxConfigDialog,
    ),
  { ssr: false },
);

const CloneProfileDialog = dynamic(
  () =>
    import("@/components/clone-profile-dialog").then(
      (mod) => mod.CloneProfileDialog,
    ),
  { ssr: false },
);

const CookieCopyDialog = dynamic(
  () =>
    import("@/components/cookie-copy-dialog").then(
      (mod) => mod.CookieCopyDialog,
    ),
  { ssr: false },
);

const CookieManagementDialog = dynamic(
  () =>
    import("@/components/cookie-management-dialog").then(
      (mod) => mod.CookieManagementDialog,
    ),
  { ssr: false },
);

const DeleteConfirmationDialog = dynamic(
  () =>
    import("@/components/delete-confirmation-dialog").then(
      (mod) => mod.DeleteConfirmationDialog,
    ),
  { ssr: false },
);

const ExtensionGroupAssignmentDialog = dynamic(
  () =>
    import("@/components/extension-group-assignment-dialog").then(
      (mod) => mod.ExtensionGroupAssignmentDialog,
    ),
  { ssr: false },
);

const ExtensionManagementDialog = dynamic(
  () =>
    import("@/components/extension-management-dialog").then(
      (mod) => mod.ExtensionManagementDialog,
    ),
  { ssr: false },
);

const GroupAssignmentDialog = dynamic(
  () =>
    import("@/components/group-assignment-dialog").then(
      (mod) => mod.GroupAssignmentDialog,
    ),
  { ssr: false },
);

const GroupManagementPanel = dynamic(
  () =>
    import("@/components/group-management-dialog").then(
      (mod) => mod.GroupManagementPanel,
    ),
  { ssr: false, loading: () => <PageLoader className="min-h-0 flex-1" /> },
);

const IntegrationsDialog = dynamic(
  () =>
    import("@/components/integrations-dialog").then(
      (mod) => mod.IntegrationsDialog,
    ),
  { ssr: false, loading: () => <PageLoader /> },
);

const LaunchOnLoginDialog = dynamic(
  () =>
    import("@/components/launch-on-login-dialog").then(
      (mod) => mod.LaunchOnLoginDialog,
    ),
  { ssr: false },
);

const PermissionDialog = dynamic(
  () =>
    import("@/components/permission-dialog").then(
      (mod) => mod.PermissionDialog,
    ),
  { ssr: false },
);

const PlatformAdminWorkspace = dynamic(
  () =>
    import("@/components/platform-admin-workspace").then(
      (mod) => mod.PlatformAdminWorkspace,
    ),
  { ssr: false, loading: () => <PageLoader /> },
);

const ProfilesDataTable = dynamic(
  () =>
    import("@/components/profile-data-table").then(
      (mod) => mod.ProfilesDataTable,
    ),
  {
    ssr: false,
    loading: () => <PageLoader className="min-h-0 flex-1" />,
  },
);

const ProfileSelectorDialog = dynamic(
  () =>
    import("@/components/profile-selector-dialog").then(
      (mod) => mod.ProfileSelectorDialog,
    ),
  { ssr: false },
);

const ProfileSyncDialog = dynamic(
  () =>
    import("@/components/profile-sync-dialog").then(
      (mod) => mod.ProfileSyncDialog,
    ),
  { ssr: false },
);

const ProxyAssignmentDialog = dynamic(
  () =>
    import("@/components/proxy-assignment-dialog").then(
      (mod) => mod.ProxyAssignmentDialog,
    ),
  { ssr: false },
);

const ProxyManagementDialog = dynamic(
  () =>
    import("@/components/proxy-management-dialog").then(
      (mod) => mod.ProxyManagementDialog,
    ),
  { ssr: false, loading: () => <PageLoader /> },
);

const SettingsDialog = dynamic(
  () =>
    import("@/components/settings-dialog").then((mod) => mod.SettingsDialog),
  { ssr: false, loading: () => <PageLoader /> },
);

const SyncAllDialog = dynamic(
  () => import("@/components/sync-all-dialog").then((mod) => mod.SyncAllDialog),
  { ssr: false },
);

const SyncConfigDialog = dynamic(
  () =>
    import("@/components/sync-config-dialog").then(
      (mod) => mod.SyncConfigDialog,
    ),
  { ssr: false },
);

const WayfernTermsDialog = dynamic(
  () =>
    import("@/components/wayfern-terms-dialog").then(
      (mod) => mod.WayfernTermsDialog,
    ),
  { ssr: false },
);

const WindowResizeWarningDialog = dynamic(
  () =>
    import("@/components/window-resize-warning-dialog").then(
      (mod) => mod.WindowResizeWarningDialog,
    ),
  { ssr: false },
);

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
  web_portal_url?: string;
}

interface WorkspaceSwitcherOption {
  id: string;
  label: string;
  details?: string;
  status?: string;
  planLabel?: string;
  profileLimit?: number | null;
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
  expiresAt: string | null;
  entitlementState: "active" | "grace_active" | "read_only";
}

type ProfileViewMode = "active" | "archived";
const ALL_GROUP_ID = "all";
const FREE_WORKSPACE_PROFILE_LIMIT = 3;
const PLAN_PROFILE_LIMIT_FALLBACK: Record<
  "starter" | "growth" | "scale" | "custom",
  number
> = {
  starter: 100,
  growth: 300,
  scale: 1000,
  custom: 2000,
};
const WORKSPACE_SWITCH_MIN_DURATION_MS = 1100;
const POST_LOGIN_TRANSITION_MIN_DURATION_MS = 700;
const SECTION_SWITCH_MIN_DURATION_MS = 180;
const URL_DEDUP_WINDOW_MS = 8_000;
const WORKSPACE_DATA_CACHE_TTL_MS = 4_000;
const SYNC_SETTINGS_CACHE_TTL_MS = 30_000;
const LIST_BROWSER_PROFILES_CACHE_KEY = "list_browser_profiles_light";
const ACTIVE_SECTION_STORAGE_NAMESPACE = "buglogin.activeSection.v2";
const DEPRECATED_PROFILES_WARNING_ONCE_KEY =
  "buglogin.notice.deprecatedProfiles.v1";
const BROWSER_SUPPORT_ENDING_WARNING_ONCE_KEY =
  "buglogin.notice.browserSupportEnding.v2";
let hasCheckedMissingBinariesGlobally = false;
let hasEnsuredActiveBrowsersGlobally = false;
let hasCheckedStartupUrlGlobally = false;

function hasShownNoticeOnce(storageKey: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function markNoticeShownOnce(storageKey: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // ignore localStorage failures (private mode / policy restriction)
  }
}
const APP_SECTION_VALUES: AppSection[] = [
  "profiles",
  "profiles-create",
  "groups",
  "bugidea-automation",
  "proxies",
  "pricing",
  "billing",
  "workspace-owner-overview",
  "workspace-owner-directory",
  "workspace-owner-permissions",
  "super-admin-overview",
  "super-admin-workspace",
  "super-admin-billing",
  "super-admin-cookies",
  "super-admin-audit",
  "super-admin-system",
  "super-admin-analytics",
  "workspace-admin-overview",
  "workspace-admin-directory",
  "workspace-admin-permissions",
  "workspace-admin-members",
  "workspace-admin-access",
  "workspace-admin-workspace",
  "workspace-admin-audit",
  "workspace-admin-system",
  "workspace-admin-analytics",
  "workspace-governance",
  "settings",
  "integrations",
  "admin-overview",
  "admin-workspace",
  "admin-billing",
  "admin-cookies",
  "admin-audit",
  "admin-system",
  "admin-analytics",
];
const APP_SECTION_SET = new Set<AppSection>(APP_SECTION_VALUES);
const WORKSPACE_OWNER_SECTIONS: AppSection[] = [
  "workspace-owner-overview",
  "workspace-owner-directory",
  "workspace-owner-permissions",
  "workspace-admin-overview",
  "workspace-admin-directory",
  "workspace-admin-permissions",
  "workspace-admin-members",
  "workspace-admin-access",
  "workspace-admin-workspace",
  "workspace-admin-audit",
  "workspace-admin-system",
  "workspace-admin-analytics",
  "workspace-governance",
];

const WORKSPACE_OWNER_LEGACY_SECTION_MAP: Partial<
  Record<AppSection, AppSection>
> = {
  "workspace-governance": "workspace-owner-overview",
  "workspace-admin-overview": "workspace-owner-overview",
  "workspace-owner-directory": "workspace-admin-members",
  "workspace-admin-directory": "workspace-admin-members",
  "workspace-owner-permissions": "workspace-admin-access",
  "workspace-admin-permissions": "workspace-admin-access",
  "workspace-admin-system": "workspace-owner-overview",
  "workspace-admin-analytics": "workspace-owner-overview",
};

const SUPER_ADMIN_LEGACY_SECTION_MAP: Partial<Record<AppSection, AppSection>> =
  {
    "admin-overview": "super-admin-overview",
    "admin-workspace": "super-admin-workspace",
    "admin-billing": "super-admin-billing",
    "admin-cookies": "super-admin-cookies",
    "admin-audit": "super-admin-audit",
    "admin-system": "super-admin-overview",
    "admin-analytics": "super-admin-overview",
    "super-admin-system": "super-admin-overview",
    "super-admin-analytics": "super-admin-overview",
  };

const BILLING_LEGACY_SECTION_MAP: Record<string, AppSection> = {
  "billing-checkout": "billing",
  "billing-coupon": "billing",
  "billing-license": "billing",
};

function normalizeLegacyAppSection(section: string): AppSection {
  const fromBillingLegacy = BILLING_LEGACY_SECTION_MAP[section];
  if (fromBillingLegacy) {
    return fromBillingLegacy;
  }
  const typedSection = section as AppSection;
  return (
    WORKSPACE_OWNER_LEGACY_SECTION_MAP[typedSection] ??
    SUPER_ADMIN_LEGACY_SECTION_MAP[typedSection] ??
    typedSection
  );
}

function isWorkspaceOwnerSection(section: AppSection): boolean {
  const normalizedSection = normalizeLegacyAppSection(section);
  return WORKSPACE_OWNER_SECTIONS.includes(normalizedSection);
}

function isSuperAdminSection(section: AppSection): boolean {
  return section.startsWith("super-admin-") || section.startsWith("admin-");
}

function parsePersistedAppSection(
  value: string | null | undefined,
): AppSection | null {
  if (!value) {
    return null;
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  const normalizedSection = normalizeLegacyAppSection(normalizedValue);
  if (!APP_SECTION_SET.has(normalizedSection)) {
    return null;
  }
  return normalizedSection;
}

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
    .map(
      (token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase(),
    )
    .join(" ");
}

function resolveWorkspaceProfileLimit(input: {
  workspaceId: string;
  workspaceMode: "personal" | "team";
  planLabel: string | null;
  profileLimit: number | null | undefined;
}): number | null {
  const explicitLimit =
    typeof input.profileLimit === "number" && input.profileLimit > 0
      ? Math.round(input.profileLimit)
      : null;

  if (explicitLimit !== null) {
    return explicitLimit;
  }

  const normalizedPlanId = normalizePlanIdFromLabel(input.planLabel);
  if (!normalizedPlanId) {
    const normalizedLabel = input.planLabel?.trim().toLowerCase() ?? "";
    const looksLikeFreePlan =
      !normalizedLabel ||
      normalizedLabel.includes("free") ||
      normalizedLabel.includes("miễn") ||
      normalizedLabel.includes("không trả");
    return looksLikeFreePlan
      ? FREE_WORKSPACE_PROFILE_LIMIT
      : PLAN_PROFILE_LIMIT_FALLBACK.starter;
  }

  return PLAN_PROFILE_LIMIT_FALLBACK[normalizedPlanId];
}

function resolveWorkspaceDisplayName(input: {
  name: string | null | undefined;
  mode: "personal" | "team";
  userEmail: string | null | undefined;
}): string {
  const normalizedName = input.name?.trim() ?? "";
  if (input.mode === "personal") {
    const lower = normalizedName.toLowerCase();
    if (!normalizedName || lower === "personal workspace") {
      return input.userEmail?.trim() || normalizedName || "Workspace";
    }
  }
  return normalizedName || input.userEmail?.trim() || "Workspace";
}

function resolveWorkspaceRole(input: {
  workspaceId: string;
  workspaceMode: "personal" | "team";
  workspaceActorRole?: TeamRole | null;
  platformRole?: string | null;
  workspaceSeedRole?: TeamRole | null;
  teamWorkspaceId?: string | null;
  userTeamRole?: TeamRole | null;
}): TeamRole {
  if (input.workspaceActorRole) {
    return input.workspaceActorRole;
  }
  if (input.workspaceSeedRole) {
    return input.workspaceSeedRole;
  }
  if (input.platformRole === "platform_admin") {
    return "admin";
  }
  if (input.workspaceMode === "personal" || input.workspaceId === "personal") {
    return "owner";
  }
  if (input.teamWorkspaceId && input.workspaceId === input.teamWorkspaceId) {
    return input.userTeamRole ?? "member";
  }
  return "member";
}

type OAuthCallbackPayload = {
  email?: string;
  name?: string;
  avatar?: string;
  idToken?: string;
  error?: string;
};

type CheckoutCallbackPayload = {
  status: "success" | "cancel";
  sessionId?: string;
};

type ProfileScopeRow = {
  id: string;
  group_id?: string;
  proxy_id?: string;
  vpn_id?: string;
};

function decodeJwtPayload(idToken: string): Record<string, unknown> | null {
  try {
    const payloadBase64 = idToken.split(".")[1];
    if (!payloadBase64) {
      return null;
    }
    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractOAuthCallbackPayload(
  rawUrl: string,
): OAuthCallbackPayload | null {
  try {
    const parsed = new URL(rawUrl);
    const isBugloginCallback =
      parsed.protocol === "buglogin:" && parsed.hostname === "oauth-callback";
    const isLocalhostCallback =
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.hostname === "localhost" &&
      parsed.pathname === "/oauth-callback";
    if (!isBugloginCallback && !isLocalhostCallback) {
      return null;
    }

    const hashParams = new URLSearchParams(
      parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash,
    );
    const getParam = (key: string) =>
      parsed.searchParams.get(key) ?? hashParams.get(key);

    const error = getParam("error");
    if (error) {
      return { error };
    }

    const email = getParam("email");
    if (email) {
      return {
        email,
        name: getParam("name") ?? undefined,
        avatar: getParam("avatar") ?? undefined,
      };
    }

    const idToken = getParam("id_token");
    if (!idToken) {
      return { error: "invalid_callback_payload" };
    }

    const payload = decodeJwtPayload(idToken);
    const payloadEmail =
      payload && typeof payload.email === "string" ? payload.email : null;
    if (!payloadEmail) {
      return { error: "invalid_callback_payload" };
    }

    return {
      email: payloadEmail,
      name:
        payload && typeof payload.name === "string" ? payload.name : undefined,
      avatar:
        payload && typeof payload.picture === "string"
          ? payload.picture
          : undefined,
      idToken,
    };
  } catch {
    return null;
  }
}

function extractCheckoutCallbackPayload(
  rawUrl: string,
): CheckoutCallbackPayload | null {
  try {
    const parsed = new URL(rawUrl);
    const isBugloginCallback =
      parsed.protocol === "buglogin:" &&
      parsed.hostname === "checkout-callback";
    const isLocalhostCallback =
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") &&
      (parsed.pathname === "/checkout/success" ||
        parsed.pathname === "/checkout/cancel");
    if (!isBugloginCallback && !isLocalhostCallback) {
      return null;
    }

    const status =
      parsed.searchParams.get("status") ??
      (parsed.pathname.endsWith("/success") ? "success" : "cancel");
    if (status !== "success" && status !== "cancel") {
      return null;
    }

    const sessionId = parsed.searchParams.get("session_id") ?? undefined;
    return { status, sessionId };
  } catch {
    return null;
  }
}

function buildUrlProcessingKey(rawUrl: string): string {
  const normalizedUrl = rawUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  const oauthPayload = extractOAuthCallbackPayload(normalizedUrl);
  if (oauthPayload) {
    if (oauthPayload.error) {
      return `oauth:error:${oauthPayload.error}`;
    }
    const normalizedEmail = oauthPayload.email?.trim().toLowerCase() ?? "";
    if (normalizedEmail) {
      return `oauth:email:${normalizedEmail}`;
    }
    return `oauth:raw:${normalizedUrl}`;
  }

  const checkoutPayload = extractCheckoutCallbackPayload(normalizedUrl);
  if (checkoutPayload) {
    return checkoutPayload.status === "success"
      ? `checkout:success:${checkoutPayload.sessionId ?? "unknown"}`
      : "checkout:cancel";
  }

  return `url:${normalizedUrl}`;
}

export default function Home() {
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const showRuntimeConfigHints =
    process.env.NEXT_PUBLIC_SHOW_RUNTIME_CONFIG_HINTS === "1";
  const isDeveloperBuild =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXT_PUBLIC_ENABLE_LOCAL_DEV_AUTH === "1";

  useEffect(() => {
    setMounted(true);
  }, []);

  const [activeSection, setActiveSection] = useState<AppSection>("profiles");
  const normalizedActiveSection = normalizeLegacyAppSection(activeSection);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const isProfilesSectionActive = normalizedActiveSection === "profiles";
  const isBugideaSectionActive =
    normalizedActiveSection === "bugidea-automation";
  const isWorkspaceOwnerPanelActive = isWorkspaceOwnerSection(
    normalizedActiveSection,
  );
  const isSuperAdminPanelActive = isSuperAdminSection(normalizedActiveSection);
  const shouldLoadSupportRuntimeData = normalizedActiveSection !== "profiles";
  const shouldLoadWorkspaceEntityData =
    isProfilesSectionActive ||
    isBugideaSectionActive ||
    isWorkspaceOwnerPanelActive ||
    isSuperAdminPanelActive;
  const [hasHydratedGroupData, setHasHydratedGroupData] = useState(true);
  const [hasHydratedProxyData, setHasHydratedProxyData] = useState(false);
  const [hasHydratedVpnData, setHasHydratedVpnData] = useState(false);
  const shouldLoadProfileGroupData =
    isProfilesSectionActive && hasHydratedGroupData;
  const shouldLoadProxyEntityData =
    hasHydratedProxyData || isProfilesSectionActive || isBugideaSectionActive;
  const shouldLoadVpnEntityData =
    hasHydratedVpnData || isProfilesSectionActive || isBugideaSectionActive;
  const shouldLoadWorkspaceProfileUsage = shouldLoadWorkspaceEntityData;
  const shouldLoadWorkspaceSwitcherData = false;
  const shouldSeedWorkspaceScopes = shouldLoadWorkspaceEntityData;

  // Use the new profile events hook for centralized profile management
  const {
    profiles,
    groups: groupsData,
    runningProfiles,
    isLoading: profilesLoading,
    error: profilesError,
    loadProfiles: reloadProfiles,
    loadGroups: reloadGroups,
  } = useProfileEvents({
    enabled: shouldLoadWorkspaceEntityData,
    includeGroups: shouldLoadProfileGroupData,
    includeRunningStateSync: false,
  });

  const {
    storedProxies,
    isLoading: proxiesLoading,
    error: proxiesError,
    loadProxies: reloadProxies,
  } = useProxyEvents({
    enabled: shouldLoadProxyEntityData,
    includeUsage: false,
  });

  const {
    vpnConfigs,
    isLoading: vpnConfigsLoading,
    loadVpnConfigs: reloadVpnConfigs,
  } = useVpnEvents({
    enabled: shouldLoadVpnEntityData,
    includeUsage: false,
  });

  // Wayfern terms hooks
  const {
    termsAccepted,
    isLoading: termsLoading,
    checkTerms,
  } = useWayfernTerms({ enabled: shouldLoadSupportRuntimeData });
  const {
    user: cloudUser,
    logout: cloudLogout,
    isLoading: isCloudAuthLoading,
    loginWithEmail,
    refreshProfile,
  } = useCloudAuth();
  const [isSectionSwitching, setIsSectionSwitching] = useState(false);
  const sectionSwitchTimerRef = useRef<number | null>(null);
  const handleSectionChange = useCallback(
    (nextSection: AppSection) => {
      const normalizedSection = normalizeLegacyAppSection(nextSection);
      if (normalizedSection === activeSection) {
        return;
      }
      setActiveSection(normalizedSection);
      setIsSectionSwitching(true);
      if (
        typeof window !== "undefined" &&
        sectionSwitchTimerRef.current !== null
      ) {
        window.clearTimeout(sectionSwitchTimerRef.current);
      }
      if (typeof window === "undefined") {
        setIsSectionSwitching(false);
        return;
      }
      sectionSwitchTimerRef.current = window.setTimeout(() => {
        setIsSectionSwitching(false);
        sectionSwitchTimerRef.current = null;
      }, SECTION_SWITCH_MIN_DURATION_MS);
    },
    [activeSection],
  );
  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        sectionSwitchTimerRef.current !== null
      ) {
        window.clearTimeout(sectionSwitchTimerRef.current);
        sectionSwitchTimerRef.current = null;
      }
    };
  }, []);
  const [isPostLoginTransitioning, setIsPostLoginTransitioning] =
    useState(false);
  const hasShownAuthScreenRef = useRef(false);
  const postLoginTransitionTimerRef = useRef<number | null>(null);
  const { entitlement, featureAccess, isReadOnly, runtimeConfig } =
    useRuntimeAccess({ enabled: shouldLoadSupportRuntimeData });
  const crossOsUnlocked = featureAccess?.cross_os_spoofing ?? false;
  const extensionManagementUnlocked =
    featureAccess?.extension_management ?? false;
  const cookieManagementUnlocked = featureAccess?.cookie_management ?? false;
  const syncEncryptionUnlocked = featureAccess?.sync_encryption ?? false;
  const teamRole = normalizeTeamRole(cloudUser?.teamRole);
  const isPlatformAdmin = cloudUser?.platformRole === "platform_admin";
  const syncUnlocked = runtimeConfig?.s3_sync === "ready";
  const activeSectionStorageKey = useMemo(
    () => `${ACTIVE_SECTION_STORAGE_NAMESPACE}.${cloudUser?.id ?? "guest"}`,
    [cloudUser?.id],
  );
  const didRestoreActiveSectionRef = useRef(false);
  const [workspaceSwitcherSummaries, setWorkspaceSwitcherSummaries] = useState<
    WorkspaceSwitcherSummary[]
  >([]);
  const [workspaceSwitcherError, setWorkspaceSwitcherError] = useState<
    string | null
  >(null);
  const [workspaceProfilesUsed, setWorkspaceProfilesUsed] = useState<
    Record<string, number>
  >({});
  const listProfilesSnapshot = useCallback(async (): Promise<
    ProfileScopeRow[]
  > => {
    return invokeCached<ProfileScopeRow[]>(
      "list_browser_profiles_light",
      undefined,
      {
        key: LIST_BROWSER_PROFILES_CACHE_KEY,
        ttlMs: WORKSPACE_DATA_CACHE_TTL_MS,
      },
    );
  }, []);

  useEffect(() => {
    if (!cloudUser && !isCloudAuthLoading) {
      hasShownAuthScreenRef.current = true;
      setIsPostLoginTransitioning(false);
      if (
        typeof window !== "undefined" &&
        postLoginTransitionTimerRef.current !== null
      ) {
        window.clearTimeout(postLoginTransitionTimerRef.current);
        postLoginTransitionTimerRef.current = null;
      }
      return;
    }

    if (!cloudUser || isCloudAuthLoading || !hasShownAuthScreenRef.current) {
      return;
    }

    hasShownAuthScreenRef.current = false;
    setIsPostLoginTransitioning(true);
    if (typeof window === "undefined") {
      return;
    }
    if (postLoginTransitionTimerRef.current !== null) {
      window.clearTimeout(postLoginTransitionTimerRef.current);
    }
    postLoginTransitionTimerRef.current = window.setTimeout(() => {
      setIsPostLoginTransitioning(false);
      postLoginTransitionTimerRef.current = null;
    }, POST_LOGIN_TRANSITION_MIN_DURATION_MS);
  }, [cloudUser, isCloudAuthLoading]);

  useEffect(() => {
    return () => {
      if (
        typeof window !== "undefined" &&
        postLoginTransitionTimerRef.current !== null
      ) {
        window.clearTimeout(postLoginTransitionTimerRef.current);
      }
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
    const freePlanLabel = t("billingPage.freePlanLabel");

    if (cloudUser?.workspaceSeeds && cloudUser?.workspaceSeeds.length > 0) {
      return cloudUser?.workspaceSeeds.map((workspace) => {
        const planLabel = workspace.planLabel ?? null;
        const workspaceName = resolveWorkspaceDisplayName({
          name: workspace.name,
          mode: workspace.mode,
          userEmail: cloudUser?.email,
        });
        return {
          id: workspace.id,
          name: workspaceName,
          mode: workspace.mode,
          role: resolveWorkspaceRole({
            workspaceId: workspace.id,
            workspaceMode: workspace.mode,
            platformRole: cloudUser?.platformRole,
            workspaceSeedRole: workspace.role ?? null,
            teamWorkspaceId: cloudUser?.teamId ?? null,
            userTeamRole: teamRole,
          }),
          planLabel,
          entitlementState: workspace.entitlementState ?? "active",
          profileLimit: resolveWorkspaceProfileLimit({
            workspaceId: workspace.id,
            workspaceMode: workspace.mode,
            planLabel,
            profileLimit: workspace.profileLimit,
          }),
          expiresAt: workspace.expiresAt ?? null,
        };
      });
    }

    const defaultPersonalPlanLabel =
      formatPlanLabel(cloudUser?.plan) ?? freePlanLabel;
    const defaultPersonalName = resolveWorkspaceDisplayName({
      name: cloudUser?.email,
      mode: "personal",
      userEmail: cloudUser?.email,
    });

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
    if (cloudUser?.teamId || cloudUser?.teamName) {
      const teamPlanLabel = formatPlanLabel(cloudUser?.plan);
      rows.push({
        id: cloudUser?.teamId ?? "team",
        name: cloudUser?.teamName ?? t("shell.workspaceSwitcher.teamWorkspace"),
        mode: "team",
        role: teamRole ?? "member",
        planLabel: teamPlanLabel,
        entitlementState: "active",
        profileLimit: resolveWorkspaceProfileLimit({
          workspaceId: cloudUser?.teamId ?? "team",
          workspaceMode: "team",
          planLabel: teamPlanLabel,
          profileLimit: cloudUser?.profileLimit,
        }),
        expiresAt: null,
      });
    }
    rows.push({
      id: "personal",
      name: defaultPersonalName,
      mode: "personal",
      role: "owner",
      planLabel: defaultPersonalPlanLabel,
      entitlementState: "active",
      profileLimit: resolveWorkspaceProfileLimit({
        workspaceId: "personal",
        workspaceMode: "personal",
        planLabel: defaultPersonalPlanLabel,
        profileLimit: cloudUser?.profileLimit,
      }),
      expiresAt: null,
    });
    return rows;
  }, [cloudUser, t, teamRole]);

  const workspaceSeedSignature = useMemo(() => {
    const seeds = cloudUser?.workspaceSeeds ?? [];
    if (seeds.length === 0) {
      return "";
    }
    return seeds
      .map((seed) =>
        [
          seed.id,
          seed.mode,
          seed.role ?? "",
          seed.planLabel ?? "",
          seed.profileLimit ?? "",
          seed.entitlementState ?? "",
          seed.expiresAt ?? "",
        ].join(":"),
      )
      .sort()
      .join("|");
  }, [cloudUser?.workspaceSeeds]);

  const [sidebarWorkspaceId, setSidebarWorkspaceId] =
    useState<string>("personal");
  const [workspaceSwitchState, setWorkspaceSwitchState] = useState<{
    targetWorkspaceId: string;
    startedAt: number;
  } | null>(null);
  const workspaceScopeRecoveryKeyRef = useRef<string>("");
  const didRestoreWorkspaceSelectionRef = useRef(false);
  const [isWorkspaceSelectionReady, setIsWorkspaceSelectionReady] =
    useState(false);
  const handleWorkspaceChange = useCallback(
    (nextWorkspaceId: string) => {
      if (nextWorkspaceId === sidebarWorkspaceId) {
        return;
      }
      setWorkspaceSwitchState({
        targetWorkspaceId: nextWorkspaceId,
        startedAt: Date.now(),
      });
      setSidebarWorkspaceId(nextWorkspaceId);
    },
    [sidebarWorkspaceId],
  );

  useEffect(() => {
    setWorkspaceProfilesUsed((current) =>
      updateWorkspaceProfilesUsed(current, {
        enabled: shouldLoadWorkspaceProfileUsage && !profilesLoading,
        hasUser: Boolean(cloudUser),
        workspaceId: sidebarWorkspaceId,
        profilesLength: profiles.length,
      }),
    );
  }, [
    shouldLoadWorkspaceProfileUsage,
    profilesLoading,
    cloudUser?.id,
    profiles.length,
    sidebarWorkspaceId,
  ]);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();
    const loadWorkspaceSwitcher = async () => {
      if (!shouldLoadWorkspaceSwitcherData) {
        return;
      }
      if (!cloudUser) {
        setWorkspaceSwitcherSummaries([]);
        setWorkspaceSwitcherError(null);
        return;
      }

      const persistedSeeds = cloudUser.workspaceSeeds ?? [];
      if (persistedSeeds.length > 0) {
        const summaryRows: WorkspaceSwitcherSummary[] = persistedSeeds.map(
          (workspace) => ({
            id: workspace.id,
            name: resolveWorkspaceDisplayName({
              name: workspace.name,
              mode: workspace.mode,
              userEmail: cloudUser?.email,
            }),
            mode: workspace.mode,
            role: resolveWorkspaceRole({
              workspaceId: workspace.id,
              workspaceMode: workspace.mode,
              workspaceActorRole: null,
              platformRole: cloudUser?.platformRole,
              workspaceSeedRole: workspace.role ?? null,
              teamWorkspaceId: cloudUser?.teamId ?? null,
              userTeamRole: teamRole,
            }),
            members: workspace.members ?? 0,
            activeInvites: workspace.activeInvites ?? 0,
            activeShareGrants: workspace.activeShareGrants ?? 0,
            entitlementState: workspace.entitlementState ?? "active",
            profileLimit: resolveWorkspaceProfileLimit({
              workspaceId: workspace.id,
              workspaceMode: workspace.mode,
              planLabel: workspace.planLabel,
              profileLimit: workspace.profileLimit,
            }),
            profilesUsed:
              workspaceProfilesUsed[workspace.id] ??
              (workspace.id === sidebarWorkspaceId ? profiles.length : 0),
            planLabel: workspace.planLabel ?? null,
            expiresAt: workspace.expiresAt ?? null,
          }),
        );
        setWorkspaceSwitcherSummaries(summaryRows);
        setWorkspaceSwitcherError(null);
        return;
      }

      try {
        const settings = await invokeCached<SyncSettings>(
          "get_sync_settings",
          undefined,
          {
            key: "get_sync_settings",
            ttlMs: SYNC_SETTINGS_CACHE_TTL_MS,
          },
        );
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
          "x-user-id": cloudUser?.id as string,
          "x-user-email": cloudUser?.email as string,
        };
        if (cloudUser?.platformRole) {
          headers["x-platform-role"] = cloudUser?.platformRole;
        }
        if (settings.sync_token?.trim()) {
          headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
        }

        const workspaceResponse = await fetch(
          `${baseUrl}/v1/control/workspaces?scope=member`,
          {
            method: "GET",
            headers,
            signal: abortController.signal,
          },
        );
        if (!workspaceResponse.ok) {
          if (!isCancelled) {
            setWorkspaceSwitcherSummaries([]);
            setWorkspaceSwitcherError(
              `${workspaceResponse.status}:${workspaceResponse.statusText}`,
            );
          }
          return;
        }

        const workspaces =
          (await workspaceResponse.json()) as ControlWorkspace[];
        if (!Array.isArray(workspaces) || workspaces.length === 0) {
          if (!isCancelled) {
            setWorkspaceSwitcherSummaries([]);
            setWorkspaceSwitcherError(null);
          }
          return;
        }

        let profilesUsedByWorkspace: Record<string, number> = {};
        try {
          const profileRows = await listProfilesSnapshot();
          profilesUsedByWorkspace = getScopedEntityCountsForWorkspaces(
            "profiles",
            profileRows.map((row) => row.id),
            cloudUser?.id as string,
            workspaces.map((workspace) => workspace.id),
          );
        } catch {
          profilesUsedByWorkspace = {};
        }

        if (isCancelled) {
          return;
        }

        const summaryRows: WorkspaceSwitcherSummary[] = workspaces.map(
          (workspace) => {
            const seed = cloudUser?.workspaceSeeds?.find(
              (item) => item.id === workspace.id,
            );
            const fallbackPlanLabel =
              workspace.planLabel ??
              (workspace.id === cloudUser?.teamId
                ? formatPlanLabel(cloudUser?.plan)
                : null);
            const planLabel =
              workspace.planLabel ?? seed?.planLabel ?? fallbackPlanLabel;
            const workspaceName = resolveWorkspaceDisplayName({
              name: workspace.name,
              mode: workspace.mode,
              userEmail: cloudUser?.email,
            });
            const workspaceRole = resolveWorkspaceRole({
              workspaceId: workspace.id,
              workspaceMode: workspace.mode,
              workspaceActorRole: workspace.actorRole ?? null,
              platformRole: cloudUser?.platformRole,
              workspaceSeedRole: seed?.role ?? null,
              teamWorkspaceId: cloudUser?.teamId ?? null,
              userTeamRole: teamRole,
            });
            return {
              id: workspace.id,
              name: workspaceName,
              mode: workspace.mode,
              role: workspaceRole,
              members: seed?.members ?? 0,
              activeInvites: seed?.activeInvites ?? 0,
              activeShareGrants: seed?.activeShareGrants ?? 0,
              entitlementState: seed?.entitlementState ?? "active",
              profileLimit: resolveWorkspaceProfileLimit({
                workspaceId: workspace.id,
                workspaceMode: workspace.mode,
                planLabel,
                profileLimit:
                  typeof workspace.profileLimit === "number"
                    ? workspace.profileLimit
                    : seed?.profileLimit,
              }),
              profilesUsed: profilesUsedByWorkspace[workspace.id] ?? 0,
              planLabel,
              expiresAt: workspace.expiresAt ?? seed?.expiresAt ?? null,
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
      abortController.abort();
    };
  }, [
    shouldLoadWorkspaceSwitcherData,
    cloudUser?.email,
    cloudUser?.id,
    cloudUser?.platformRole,
    cloudUser?.teamId,
    cloudUser?.teamName,
    cloudUser?.plan,
    profiles.length,
    sidebarWorkspaceId,
    teamRole,
    workspaceProfilesUsed,
    workspaceSeedSignature,
    listProfilesSnapshot,
  ]);

  const workspaceOptions = useMemo<WorkspaceSwitcherOption[]>(() => {
    if (!cloudUser) {
      return [];
    }

    const freePlanLabel = t("billingPage.freePlanLabel");

    if (workspaceSwitcherSummaries.length > 0) {
      return workspaceSwitcherSummaries.map((workspace) => ({
        id: workspace.id,
        label: workspace.name,
        details:
          workspace.profilesUsed > 0
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
                date: formatLocaleDate(workspace.expiresAt),
              })
            : t(
                `shell.workspaceSwitcher.entitlement.${workspace.entitlementState}`,
              )),
        planLabel: workspace.planLabel ?? undefined,
        profileLimit: workspace.profileLimit,
      }));
    }

    if (fallbackWorkspaceDescriptors.length > 0) {
      return fallbackWorkspaceDescriptors.map((workspace) => {
        const usedProfilesFromCache = workspaceProfilesUsed[workspace.id];
        const usedProfiles =
          typeof usedProfilesFromCache === "number" &&
          Number.isFinite(usedProfilesFromCache)
            ? usedProfilesFromCache
            : workspace.id === sidebarWorkspaceId && !profilesLoading
              ? profiles.length
              : undefined;

        return {
          id: workspace.id,
          label: workspace.name,
          details:
            typeof usedProfiles === "number"
              ? t("shell.workspaceSwitcher.usageProfiles", {
                  used: usedProfiles,
                  limit: workspace.profileLimit || "∞",
                })
              : t("shell.workspaceSwitcher.membersInvites", {
                  members: 0,
                  invites: 0,
                }),
          status: workspace.expiresAt
            ? t("shell.workspaceSwitcher.planExpiry", {
                plan: `${t(`shell.roles.${workspace.role}`)} · ${workspace.planLabel ?? t("billingPage.planFallback")}`,
                date: formatLocaleDate(workspace.expiresAt),
              })
            : t("shell.workspaceSwitcher.planSummary", {
                plan: `${t(`shell.roles.${workspace.role}`)} · ${workspace.planLabel ?? t("billingPage.planFallback")}`,
                status: t(
                  `shell.workspaceSwitcher.entitlement.${workspace.entitlementState}`,
                ),
              }),
          planLabel: workspace.planLabel ?? undefined,
          profileLimit: workspace.profileLimit,
        };
      });
    }

    const options: WorkspaceSwitcherOption[] = [];
    if (cloudUser?.teamId || cloudUser?.teamName) {
      const teamPlanLabel = formatPlanLabel(cloudUser?.plan);
      const teamProfileLimit = resolveWorkspaceProfileLimit({
        workspaceId: cloudUser?.teamId ?? "team",
        workspaceMode: "team",
        planLabel: teamPlanLabel,
        profileLimit: cloudUser?.profileLimit,
      });
      options.push({
        id: cloudUser?.teamId ?? "team",
        label:
          cloudUser?.teamName ?? t("shell.workspaceSwitcher.teamWorkspace"),
        details: t("shell.workspaceSwitcher.usageProfiles", {
          used: cloudUser?.cloudProfilesUsed,
          limit: teamProfileLimit || "∞",
        }),
        status: t("shell.workspaceSwitcher.planSummary", {
          plan: `${t(`shell.roles.${teamRole ?? "member"}`)} · ${cloudUser?.plan}`,
          status: cloudUser?.subscriptionStatus,
        }),
        planLabel: teamPlanLabel ?? undefined,
        profileLimit: teamProfileLimit,
      });
    }
    const defaultPersonalPlanLabel =
      formatPlanLabel(cloudUser?.plan) ?? freePlanLabel;
    const defaultPersonalName = resolveWorkspaceDisplayName({
      name: cloudUser?.email,
      mode: "personal",
      userEmail: cloudUser?.email,
    });
    const personalProfileLimit = resolveWorkspaceProfileLimit({
      workspaceId: "personal",
      workspaceMode: "personal",
      planLabel: defaultPersonalPlanLabel,
      profileLimit: cloudUser?.profileLimit,
    });
    options.push({
      id: "personal",
      label: defaultPersonalName,
      details: t("shell.workspaceSwitcher.usageProfiles", {
        used: cloudUser?.cloudProfilesUsed,
        limit: personalProfileLimit || "∞",
      }),
      status: t("shell.workspaceSwitcher.planSummary", {
        plan: `${t("shell.roles.owner")} · ${defaultPersonalPlanLabel}`,
        status: cloudUser?.subscriptionStatus,
      }),
      planLabel: defaultPersonalPlanLabel,
      profileLimit: personalProfileLimit,
    });

    if (
      workspaceSwitcherError &&
      cloudUser?.platformRole === "platform_admin"
    ) {
      options.unshift({
        id: "platform-fallback",
        label: "Bug Media",
        details: t("shell.workspaceSwitcher.syncUnavailable"),
        status: workspaceSwitcherError,
        planLabel: formatPlanLabel(cloudUser?.plan) ?? undefined,
        profileLimit: resolveWorkspaceProfileLimit({
          workspaceId: "platform-fallback",
          workspaceMode: "team",
          planLabel: formatPlanLabel(cloudUser?.plan),
          profileLimit: cloudUser?.profileLimit,
        }),
      });
    }

    return options;
  }, [
    cloudUser,
    fallbackWorkspaceDescriptors,
    t,
    workspaceProfilesUsed,
    profiles.length,
    profilesLoading,
    sidebarWorkspaceId,
    workspaceSwitcherError,
    workspaceSwitcherSummaries,
    teamRole,
  ]);

  const selectedWorkspaceContext =
    useMemo<WorkspaceBillingContext | null>(() => {
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
          expiresAt: fromSummary.expiresAt ?? null,
          entitlementState: fromSummary.entitlementState,
        };
      }

      const fromFallback = fallbackWorkspaceDescriptors.find(
        (workspace) => workspace.id === sidebarWorkspaceId,
      );
      if (fromFallback) {
        const fallbackUsed = workspaceProfilesUsed[fromFallback.id];
        return {
          id: fromFallback.id,
          name: fromFallback.name,
          mode: fromFallback.mode,
          role: fromFallback.role,
          planLabel: fromFallback.planLabel ?? null,
          profileLimit: fromFallback.profileLimit ?? null,
          profilesUsed:
            typeof fallbackUsed === "number" && Number.isFinite(fallbackUsed)
              ? fallbackUsed
              : !profilesLoading
                ? profiles.length
                : 0,
          expiresAt: fromFallback.expiresAt ?? null,
          entitlementState: fromFallback.entitlementState,
        };
      }

      return null;
    }, [
      fallbackWorkspaceDescriptors,
      profiles.length,
      profilesLoading,
      sidebarWorkspaceId,
      workspaceProfilesUsed,
      workspaceSwitcherSummaries,
    ]);

  useEffect(() => {
    if (!shouldLoadWorkspaceEntityData) {
      return;
    }
    if (!isWorkspaceSelectionReady || workspaceSwitchState) {
      return;
    }
    const usage = selectedWorkspaceContext?.profilesUsed ?? 0;
    if (usage <= 0 || profiles.length > 0) {
      workspaceScopeRecoveryKeyRef.current = "";
      return;
    }
    const recoveryKey = `${cloudUser?.id ?? "guest"}::${sidebarWorkspaceId}`;
    if (workspaceScopeRecoveryKeyRef.current === recoveryKey) {
      return;
    }
    workspaceScopeRecoveryKeyRef.current = recoveryKey;
    void reloadProfiles();
  }, [
    cloudUser?.id,
    shouldLoadWorkspaceEntityData,
    isWorkspaceSelectionReady,
    profiles.length,
    reloadProfiles,
    selectedWorkspaceContext?.profilesUsed,
    sidebarWorkspaceId,
    workspaceSwitchState,
  ]);

  const selectedWorkspaceRole: TeamRole =
    selectedWorkspaceContext?.role ?? "member";
  const lastWorkspaceSubscriptionSyncRef = useRef<string>("");
  const hasSkippedInitialWorkspaceSubscriptionSyncRef = useRef(false);

  useEffect(() => {
    if (!cloudUser || !selectedWorkspaceContext || !isWorkspaceSelectionReady) {
      return;
    }

    const normalizedPlanId = normalizePlanIdFromLabel(
      selectedWorkspaceContext.planLabel,
    );
    const nextPlan = normalizedPlanId ?? "free";
    const nextSubscriptionStatus =
      selectedWorkspaceContext.entitlementState === "read_only"
        ? "inactive"
        : "active";
    const nextTeamRole = selectedWorkspaceContext.role ?? teamRole ?? "member";
    const syncKey = [
      cloudUser?.id,
      selectedWorkspaceContext.id,
      nextPlan,
      cloudUser?.planPeriod ?? "",
      nextSubscriptionStatus,
      nextTeamRole,
    ].join("::");
    if (lastWorkspaceSubscriptionSyncRef.current === syncKey) {
      return;
    }
    if (!hasSkippedInitialWorkspaceSubscriptionSyncRef.current) {
      hasSkippedInitialWorkspaceSubscriptionSyncRef.current = true;
      lastWorkspaceSubscriptionSyncRef.current = syncKey;
      return;
    }
    lastWorkspaceSubscriptionSyncRef.current = syncKey;

    void invoke("cloud_sync_local_subscription_state", {
      state: {
        plan: nextPlan,
        planPeriod: cloudUser?.planPeriod ?? null,
        subscriptionStatus: nextSubscriptionStatus,
        teamRole: nextTeamRole,
      },
    }).catch(() => {
      // Keep workspace switch non-blocking if backend sync fails.
    });
  }, [
    cloudUser,
    isWorkspaceSelectionReady,
    selectedWorkspaceContext,
    teamRole,
  ]);

  const canAccessSuperAdminPanel = isPlatformAdmin;
  const canAccessBugIdeaAdmin = isPlatformAdmin;
  const canManageSelectedWorkspaceBilling =
    isPlatformAdmin ||
    selectedWorkspaceRole === "owner" ||
    selectedWorkspaceRole === "admin";
  const canManageSelectedWorkspaceGovernance =
    cloudUser?.platformRole === "platform_admin" ||
    selectedWorkspaceRole === "owner" ||
    selectedWorkspaceRole === "admin";
  const canAccessSelectedWorkspaceGovernance =
    Boolean(cloudUser) && canManageSelectedWorkspaceGovernance;
  const [isOpeningWebPortal, setIsOpeningWebPortal] = useState(false);

  const showWebBillingPortalError = useCallback(
    (error: unknown) => {
      const message = extractRootError(error);
      if (message.includes("web_billing_portal_url_missing")) {
        showErrorToast(t("webBilling.desktopPortalMissing"));
        return;
      }
      if (message.includes("web_billing_context_missing")) {
        showErrorToast(t("webBilling.desktopContextMissing"));
        return;
      }
      showErrorToast(t("webBilling.desktopPortalOpenFailed"), {
        description: message,
      });
    },
    [t],
  );

  const openBillingPortal = useCallback(async () => {
    if (!cloudUser) {
      return;
    }
    const workspaceId = selectedWorkspaceContext?.id ?? sidebarWorkspaceId;
    const workspaceName = selectedWorkspaceContext?.name ?? null;
    setIsOpeningWebPortal(true);
    try {
      await openWebBillingPortal({
        route: "management",
        user: cloudUser,
        workspaceId,
        workspaceName,
      });
    } catch (error) {
      showWebBillingPortalError(error);
    } finally {
      setIsOpeningWebPortal(false);
    }
  }, [
    cloudUser,
    selectedWorkspaceContext?.id,
    selectedWorkspaceContext?.name,
    showWebBillingPortalError,
    sidebarWorkspaceId,
  ]);

  const openPricingPortal = useCallback(async () => {
    if (!cloudUser) {
      return;
    }
    const workspaceId = selectedWorkspaceContext?.id ?? sidebarWorkspaceId;
    const workspaceName = selectedWorkspaceContext?.name ?? null;
    setIsOpeningWebPortal(true);
    try {
      await openWebBillingPortal({
        route: "pricing",
        user: cloudUser,
        workspaceId,
        workspaceName,
      });
    } catch (error) {
      showWebBillingPortalError(error);
    } finally {
      setIsOpeningWebPortal(false);
    }
  }, [
    cloudUser,
    selectedWorkspaceContext?.id,
    selectedWorkspaceContext?.name,
    showWebBillingPortalError,
    sidebarWorkspaceId,
  ]);

  const [importProfileDialogOpen, setImportProfileDialogOpen] = useState(false);
  const [camoufoxConfigDialogOpen, setCamoufoxConfigDialogOpen] =
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
  const [selectedGroupId, setSelectedGroupId] = useState<string>(ALL_GROUP_ID);
  const [selectedProfilesForGroup, setSelectedProfilesForGroup] = useState<
    string[]
  >([]);
  const [selectedProfilesForProxy, setSelectedProfilesForProxy] = useState<
    string[]
  >([]);
  const selectedProfilesRef = useRef<string[]>([]);
  const [selectionResetNonce, setSelectionResetNonce] = useState(0);
  const [bulkDeleteSelection, setBulkDeleteSelection] = useState<string[]>([]);
  const updateSelectedProfilesRef = useCallback((nextSelected: string[]) => {
    selectedProfilesRef.current = nextSelected;
  }, []);
  const resetSelectedProfiles = useCallback(() => {
    selectedProfilesRef.current = [];
    setSelectionResetNonce((current) => current + 1);
  }, []);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [savedViews, setSavedViews] = useState<SavedProfileView[]>([]);
  const [profileViewMode, setProfileViewMode] =
    useState<ProfileViewMode>("active");
  const [archivedProfileIds, setArchivedProfileIds] = useState<string[]>([]);
  const [pinnedProfileIds, setPinnedProfileIds] = useState<string[]>([]);
  // O(1) lookup sets derived from the arrays (kept as arrays for localStorage compat)
  const archivedProfileIdsSet = useMemo(
    () => new Set(archivedProfileIds),
    [archivedProfileIds],
  );
  const pinnedProfileIdsSet = useMemo(
    () => new Set(pinnedProfileIds),
    [pinnedProfileIds],
  );
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pendingUrls, setPendingUrls] = useState<PendingUrl[]>([]);
  const [currentProfileForCamoufoxConfig, setCurrentProfileForCamoufoxConfig] =
    useState<BrowserProfile | null>(null);
  const [cloneProfile, setCloneProfile] = useState<BrowserProfile | null>(null);
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
  const [profileSyncDialogOpen, setProfileSyncDialogOpen] = useState(false);
  const [currentProfileForSync, setCurrentProfileForSync] =
    useState<BrowserProfile | null>(null);
  const { isMicrophoneAccessGranted, isCameraAccessGranted, isInitialized } =
    usePermissions();

  useEffect(() => {
    if (
      normalizedActiveSection === "groups" ||
      normalizedActiveSection === "profiles-create" ||
      groupAssignmentDialogOpen ||
      extensionGroupAssignmentDialogOpen ||
      selectedGroupId !== ALL_GROUP_ID
    ) {
      setHasHydratedGroupData(true);
    }
  }, [
    extensionGroupAssignmentDialogOpen,
    groupAssignmentDialogOpen,
    normalizedActiveSection,
    selectedGroupId,
  ]);

  useEffect(() => {
    if (
      normalizedActiveSection === "proxies" ||
      normalizedActiveSection === "profiles-create" ||
      proxyAssignmentDialogOpen
    ) {
      setHasHydratedProxyData(true);
      setHasHydratedVpnData(true);
    }
  }, [normalizedActiveSection, proxyAssignmentDialogOpen]);

  useEffect(() => {
    didRestoreActiveSectionRef.current = false;
  }, [activeSectionStorageKey]);

  useEffect(() => {
    if (isCloudAuthLoading) {
      return;
    }
    if (didRestoreActiveSectionRef.current) {
      return;
    }
    didRestoreActiveSectionRef.current = true;

    if (!cloudUser) {
      return;
    }

    try {
      const restoredSection = parsePersistedAppSection(
        window.localStorage.getItem(activeSectionStorageKey),
      );
      if (restoredSection && restoredSection !== activeSection) {
        setActiveSection(restoredSection);
      }
    } catch {
      // Ignore localStorage read errors.
    }
  }, [activeSection, activeSectionStorageKey, cloudUser, isCloudAuthLoading]);

  useEffect(() => {
    const normalizedSection = normalizeLegacyAppSection(activeSection);
    if (normalizedSection !== activeSection) {
      setActiveSection(normalizedSection);
    }
  }, [activeSection]);
  useEffect(() => {
    if (!cloudUser) {
      return;
    }
    try {
      window.localStorage.setItem(
        activeSectionStorageKey,
        normalizeLegacyAppSection(activeSection),
      );
    } catch {
      // Ignore localStorage write errors.
    }
  }, [activeSection, activeSectionStorageKey, cloudUser]);
  const inAdminPanel = isSuperAdminSection(normalizedActiveSection);
  const inWorkspaceGovernancePanel = isWorkspaceOwnerSection(
    normalizedActiveSection,
  );

  const selectedWorkspaceOption = useMemo(
    () =>
      workspaceOptions.find(
        (workspace) => workspace.id === sidebarWorkspaceId,
      ) ??
      workspaceOptions[0] ??
      null,
    [sidebarWorkspaceId, workspaceOptions],
  );
  const workspaceOptionIds = useMemo(
    () =>
      workspaceOptions
        .map((workspace) => workspace.id)
        .filter((workspaceId) => workspaceId !== "platform-fallback"),
    [workspaceOptions],
  );
  const lastScopeSeedRequestKeyRef = useRef<string>("");

  useEffect(() => {
    setCurrentDataScope({
      accountId: cloudUser?.id ?? "guest",
      workspaceId: sidebarWorkspaceId,
    });
  }, [cloudUser?.id, sidebarWorkspaceId]);

  useEffect(() => {
    if (!isWorkspaceSelectionReady) {
      return;
    }
    resetSelectedProfiles();
    setSelectedGroupId(ALL_GROUP_ID);
    setSearchQuery("");
    setShowPinnedOnly(false);
    setProfileViewMode("active");
  }, [isWorkspaceSelectionReady, resetSelectedProfiles]);

  useEffect(() => {
    if (!shouldLoadWorkspaceEntityData) {
      setWorkspaceSwitchState(null);
      return;
    }
    if (!workspaceSwitchState) {
      return;
    }
    if (sidebarWorkspaceId !== workspaceSwitchState.targetWorkspaceId) {
      return;
    }

    let isCancelled = false;
    const switchStartedAt = workspaceSwitchState.startedAt;
    const switchTargetId = workspaceSwitchState.targetWorkspaceId;

    const performWorkspaceSwitchWarmup = async () => {
      await reloadProfiles();

      const elapsed = Date.now() - switchStartedAt;
      const remaining = Math.max(0, WORKSPACE_SWITCH_MIN_DURATION_MS - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }
      if (isCancelled) {
        return;
      }
      setWorkspaceSwitchState((current) => {
        if (!current) {
          return current;
        }
        if (
          current.startedAt !== switchStartedAt ||
          current.targetWorkspaceId !== switchTargetId
        ) {
          return current;
        }
        return null;
      });
    };

    void performWorkspaceSwitchWarmup();

    return () => {
      isCancelled = true;
    };
  }, [
    shouldLoadWorkspaceEntityData,
    reloadProfiles,
    sidebarWorkspaceId,
    workspaceSwitchState,
  ]);

  useEffect(() => {
    if (!shouldSeedWorkspaceScopes) {
      return;
    }
    if (!cloudUser || workspaceOptionIds.length === 0) {
      return;
    }
    if (!isWorkspaceSelectionReady) {
      return;
    }

    let isCancelled = false;
    const accountScopeKeys = workspaceOptionIds.map((workspaceId) =>
      toDataScopeKey({
        accountId: cloudUser?.id as string,
        workspaceId,
      }),
    );
    const currentSeedRequestKey = [
      cloudUser?.id,
      sidebarWorkspaceId,
      accountScopeKeys.join("|"),
    ].join("::");
    if (lastScopeSeedRequestKeyRef.current === currentSeedRequestKey) {
      return;
    }
    lastScopeSeedRequestKeyRef.current = currentSeedRequestKey;
    const preferredScopeKey = toDataScopeKey({
      accountId: cloudUser?.id as string,
      workspaceId: sidebarWorkspaceId,
    });

    const seedWorkspaceDataScopes = async () => {
      try {
        const migrationWorkspaceIds = [sidebarWorkspaceId];
        const didMigrateGuest = migrateDataScopeAccount(
          "guest",
          cloudUser?.id as string,
          migrationWorkspaceIds,
          sidebarWorkspaceId,
        );
        const didNormalizeScopes = normalizeDataScopeWorkspacesForAccount(
          cloudUser?.id as string,
          workspaceOptionIds,
          sidebarWorkspaceId,
        );

        if (workspaceOptionIds.length <= 1) {
          if (didMigrateGuest || didNormalizeScopes) {
            window.dispatchEvent(new Event(DATA_SCOPE_CHANGED_EVENT));
          }
          return;
        }

        const profileRows = await listProfilesSnapshot();

        if (isCancelled) {
          return;
        }

        const didChangeProfiles = distributeUnscopedEntityIdsForAccount(
          "profiles",
          profileRows.map((row) => row.id),
          accountScopeKeys,
          preferredScopeKey,
        );

        if (didMigrateGuest || didNormalizeScopes || didChangeProfiles) {
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
  }, [
    shouldSeedWorkspaceScopes,
    cloudUser,
    isWorkspaceSelectionReady,
    listProfilesSnapshot,
    sidebarWorkspaceId,
    workspaceOptionIds,
  ]);

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
      setActiveSection("profiles");
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
      window.localStorage.setItem(
        savedViewsStorageKey,
        JSON.stringify(savedViews),
      );
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
      window.localStorage.setItem(
        pinnedIdsStorageKey,
        JSON.stringify(pinnedProfileIds),
      );
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

      if (
        isPlatformAdmin ||
        canPerformTeamAction(selectedWorkspaceRole, action)
      ) {
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
    if (!cloudUser) {
      return;
    }
    if (canAccessSuperAdminPanel) {
      return;
    }
    if (!isSuperAdminSection(activeSection)) {
      return;
    }
    const nextSection: AppSection =
      activeSection === "super-admin-cookies" && canAccessBugIdeaAdmin
        ? "bugidea-automation"
        : canAccessSelectedWorkspaceGovernance
          ? "workspace-owner-overview"
          : "profiles";
    setActiveSection(nextSection);
    showErrorToast(t("adminWorkspace.noAccessTitle"), {
      description: t("adminWorkspace.noAccessDescription"),
    });
  }, [
    activeSection,
    canAccessBugIdeaAdmin,
    canAccessSuperAdminPanel,
    canAccessSelectedWorkspaceGovernance,
    canManageSelectedWorkspaceGovernance,
    cloudUser,
    t,
  ]);

  useEffect(() => {
    const isBugIdeaSection =
      activeSection === "super-admin-cookies" ||
      activeSection === "bugidea-automation";
    if (!cloudUser || !isBugIdeaSection) {
      return;
    }
    if (canAccessBugIdeaAdmin) {
      return;
    }
    setActiveSection(
      activeSection === "super-admin-cookies"
        ? canAccessSelectedWorkspaceGovernance
          ? "workspace-owner-overview"
          : "profiles"
        : "profiles",
    );
    showErrorToast(t("adminWorkspace.noAccessTitle"), {
      description: t("adminWorkspace.bugideaDevOnlyDescription"),
    });
  }, [
    activeSection,
    canAccessBugIdeaAdmin,
    canAccessSelectedWorkspaceGovernance,
    canManageSelectedWorkspaceGovernance,
    cloudUser,
    t,
  ]);

  useEffect(() => {
    if (!cloudUser) {
      return;
    }
    if (!isWorkspaceOwnerSection(activeSection)) {
      return;
    }
    if (!canAccessSelectedWorkspaceGovernance) {
      setActiveSection("profiles");
      showErrorToast(t("adminWorkspace.noAccessTitle"), {
        description: t("adminWorkspace.ownerOnlyGovernance"),
      });
    }
  }, [activeSection, canAccessSelectedWorkspaceGovernance, cloudUser, t]);

  useEffect(() => {
    didRestoreWorkspaceSelectionRef.current = false;
    workspaceScopeRecoveryKeyRef.current = "";
    lastScopeSeedRequestKeyRef.current = "";
    lastWorkspaceSubscriptionSyncRef.current = "";
    setWorkspaceSwitchState(null);
    setIsWorkspaceSelectionReady(false);
    setWorkspaceSwitcherSummaries([]);
    setWorkspaceSwitcherError(null);
    setWorkspaceProfilesUsed({});
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
    if (!workspaceSwitchState) {
      return;
    }
    const stillExists = workspaceOptions.some(
      (item) => item.id === workspaceSwitchState.targetWorkspaceId,
    );
    if (stillExists) {
      return;
    }
    setWorkspaceSwitchState(null);
  }, [workspaceOptions, workspaceSwitchState]);

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

  const handleSelectGroup = useCallback(
    (groupId: string) => {
      setSelectedGroupId(groupId);
      resetSelectedProfiles();
    },
    [resetSelectedProfiles],
  );

  const handleCreateSavedView = useCallback(() => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery && selectedGroupId === ALL_GROUP_ID && !showPinnedOnly) {
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
      resetSelectedProfiles();
      showSuccessToast(t("header.savedViews.applied"));
    },
    [resetSelectedProfiles, savedViews, t],
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
          console.log("Found missing GeoIP database for Bugox");
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
            missingList += ", GeoIP database for Bugox";
          } else {
            missingList = "GeoIP database for Bugox";
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

  const processingUrlsRef = useRef<Set<string>>(new Set());
  const recentlyProcessedUrlsRef = useRef<Map<string, number>>(new Map());
  const profilesRef = useRef<BrowserProfile[]>([]);
  const translationRef = useRef(t);
  const handleUrlOpenRef = useRef<(url: string) => Promise<void>>(async () => {
    return;
  });
  const hasCheckedMissingBinariesRef = useRef(
    hasCheckedMissingBinariesGlobally,
  );
  const hasEnsuredActiveBrowsersRef = useRef(hasEnsuredActiveBrowsersGlobally);
  const windowResizeWarningDismissedRef = useRef<boolean | null>(null);
  const hasShownDeprecatedProfilesWarningRef = useRef(false);
  const hasShownBrowserSupportEndingWarningRef = useRef(false);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    translationRef.current = t;
  }, [t]);

  const handleUrlOpen = useCallback(
    async (url: string) => {
      const normalizedUrl = url.trim();
      if (!normalizedUrl) {
        return;
      }
      const processingKey = buildUrlProcessingKey(normalizedUrl);
      if (!processingKey) {
        return;
      }
      const now = Date.now();
      const lastProcessedAt =
        recentlyProcessedUrlsRef.current.get(processingKey);
      if (
        typeof lastProcessedAt === "number" &&
        now - lastProcessedAt < URL_DEDUP_WINDOW_MS
      ) {
        return;
      }

      // Prevent duplicate processing of the same URL
      if (processingUrlsRef.current.has(processingKey)) {
        console.log("URL already being processed:", processingKey);
        return;
      }

      processingUrlsRef.current.add(processingKey);

      try {
        console.log("URL received for opening:", normalizedUrl);
        const oauthPayload = extractOAuthCallbackPayload(normalizedUrl);
        if (oauthPayload) {
          setIsPostLoginTransitioning(true);
          if (oauthPayload.error) {
            const oauthErrorKey = oauthPayload.error.toLowerCase();
            const oauthErrorDescriptionMap: Record<string, string> = {
              invalid_callback_payload: t(
                "authLanding.googleErrorInvalidCallback",
              ),
              invalid_token_payload: t("authLanding.googleErrorInvalidToken"),
              google_userinfo_unreachable: t("authLanding.googleErrorUserinfo"),
              authorization_code_not_supported: t(
                "authLanding.googleErrorAuthCodeUnsupported",
              ),
              missing_oauth_tokens: t("authLanding.googleErrorMissingTokens"),
              access_denied: t("authLanding.googleErrorAccessDenied"),
            };
            showErrorToast(t("authLanding.googleLoginErrorTitle"), {
              description:
                oauthErrorDescriptionMap[oauthErrorKey] ?? oauthPayload.error,
            });
            setIsPostLoginTransitioning(false);
            return;
          }
          if (!oauthPayload.email) {
            showErrorToast(t("authLanding.googleLoginErrorTitle"), {
              description: "invalid_callback_payload",
            });
            setIsPostLoginTransitioning(false);
            return;
          }

          try {
            await loginWithEmail(oauthPayload.email, {
              scope: "workspace_user",
              authProvider: "google_oauth",
              name: oauthPayload.name,
              avatar: oauthPayload.avatar,
              idToken: oauthPayload.idToken,
            });
            await refreshProfile().catch(() => null);
            setActiveSection("profiles");
            showSuccessToast(t("authDialog.loginSuccess"));
          } catch (authError) {
            const authMessage = extractRootError(authError);
            if (
              authMessage.includes("control_auth_unreachable") ||
              authMessage.includes("control_auth_not_configured")
            ) {
              showErrorToast(t("authLanding.controlAuthUnavailableTitle"), {
                description: t("authLanding.controlAuthUnavailableDescription"),
              });
              setIsPostLoginTransitioning(false);
              return;
            }
            if (
              authMessage.includes("password_required") ||
              authMessage.includes("password_login_required")
            ) {
              showErrorToast(t("authLanding.googleSoon"));
              setIsPostLoginTransitioning(false);
              return;
            }
            showErrorToast(t("authDialog.loginFailed"), {
              description: authMessage,
            });
            setIsPostLoginTransitioning(false);
          }
          return;
        }

        const checkoutPayload = extractCheckoutCallbackPayload(normalizedUrl);
        if (checkoutPayload) {
          if (checkoutPayload.status === "success") {
            setActiveSection("billing");
            showSuccessToast(t("webBilling.desktopCheckoutReturnSuccess"));
            return;
          }

          setActiveSection("billing");
          showErrorToast(t("webBilling.desktopCheckoutReturnCancelled"));
          return;
        }

        // Always show profile selector for manual selection - never auto-open
        // Replace any existing pending URL with the new one
        setActiveSection("profiles");
        setPendingUrls([{ id: Date.now().toString(), url: normalizedUrl }]);
      } finally {
        processingUrlsRef.current.delete(processingKey);
        const markedAt = Date.now();
        recentlyProcessedUrlsRef.current.set(processingKey, markedAt);
        for (const [
          entryKey,
          entryTime,
        ] of recentlyProcessedUrlsRef.current.entries()) {
          if (markedAt - entryTime > URL_DEDUP_WINDOW_MS * 2) {
            recentlyProcessedUrlsRef.current.delete(entryKey);
          }
        }
      }
    },
    [
      handleWorkspaceChange,
      loginWithEmail,
      refreshProfile,
      sidebarWorkspaceId,
      t,
    ],
  );

  useEffect(() => {
    handleUrlOpenRef.current = handleUrlOpen;
  }, [handleUrlOpen]);

  // Auto-update functionality - use the existing hook for compatibility
  const updateNotifications = useUpdateNotifications();
  const { checkForUpdates, isUpdating } = updateNotifications;
  const [isCheckingHeaderUpdates, setIsCheckingHeaderUpdates] = useState(false);
  const isCheckingHeaderUpdatesRef = useRef(false);

  const { checkForAppUpdatesManual: checkForAppUpdatesManualApp } =
    useAppUpdateNotifications();

  const handleCheckForUpdates = useCallback(async () => {
    if (isCheckingHeaderUpdatesRef.current) {
      return;
    }
    isCheckingHeaderUpdatesRef.current = true;
    setIsCheckingHeaderUpdates(true);
    try {
      await Promise.allSettled([
        checkForUpdates(),
        checkForAppUpdatesManualApp(),
      ]);
    } finally {
      isCheckingHeaderUpdatesRef.current = false;
      setIsCheckingHeaderUpdates(false);
    }
  }, [checkForAppUpdatesManualApp, checkForUpdates]);

  const topbarNotifications = useMemo(
    () =>
      updateNotifications.notifications.map((notification) => ({
        id: notification.id,
        title: t("shell.topbar.notificationTitle", {
          browser: getBrowserDisplayName(notification.browser),
        }),
        description: t("shell.topbar.notificationDescription", {
          current: notification.current_version,
          next: notification.new_version,
          profiles: notification.affected_profiles.length,
        }),
        isUpdating: isUpdating(notification.browser),
      })),
    [isUpdating, t, updateNotifications.notifications],
  );

  // Check for startup URLs but only process them once
  const hasCheckedStartupUrlRef = useRef(hasCheckedStartupUrlGlobally);
  const checkCurrentUrl = useCallback(async () => {
    if (hasCheckedStartupUrlRef.current || hasCheckedStartupUrlGlobally) return;

    try {
      const currentUrl = await getCurrent();
      if (currentUrl && currentUrl.length > 0) {
        console.log("Startup URL detected:", currentUrl[0]);
        void handleUrlOpenRef.current(currentUrl[0]);
      }
    } catch (error) {
      console.error("Failed to check current URL:", error);
    } finally {
      hasCheckedStartupUrlRef.current = true;
      hasCheckedStartupUrlGlobally = true;
    }
  }, []);

  // Handle profile errors from useProfileEvents hook
  useEffect(() => {
    if (profilesError) {
      showErrorToast(profilesError);
    }
  }, [profilesError]);

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
      const unlistenUrlOpenRequest = await listen<string>(
        "url-open-request",
        (event) => {
          console.log("Received URL open request:", event.payload);
          void handleUrlOpenRef.current(event.payload);
        },
      );

      // Listen for show profile selector events
      const unlistenShowProfileSelector = await listen<string>(
        "show-profile-selector",
        (event) => {
          console.log("Received show profile selector request:", event.payload);
          void handleUrlOpenRef.current(event.payload);
        },
      );

      // Listen for show create profile dialog events
      const unlistenShowCreateProfileDialog = await listen<string>(
        "show-create-profile-dialog",
        (event) => {
          console.log(
            "Received show create profile dialog request:",
            event.payload,
          );
          showErrorToast(
            "No profiles available. Please create a profile first before opening URLs.",
          );
          setHasHydratedGroupData(true);
          setHasHydratedProxyData(true);
          setHasHydratedVpnData(true);
          setActiveSection("profiles-create");
        },
      );

      // Listen for custom logo click events
      const handleLogoUrlEvent = (event: CustomEvent) => {
        console.log("Received logo URL event:", event.detail);
        void handleUrlOpenRef.current(event.detail);
      };

      window.addEventListener(
        "url-open-request",
        handleLogoUrlEvent as EventListener,
      );

      // Return cleanup function
      return () => {
        unlistenUrlOpenRequest();
        unlistenShowProfileSelector();
        unlistenShowCreateProfileDialog();
        window.removeEventListener(
          "url-open-request",
          handleLogoUrlEvent as EventListener,
        );
      };
    } catch (error) {
      console.error("Failed to setup URL listener:", error);
    }
  }, []);
  const checkCurrentUrlRef = useRef(checkCurrentUrl);
  const listenForUrlEventsRef = useRef(listenForUrlEvents);

  useEffect(() => {
    checkCurrentUrlRef.current = checkCurrentUrl;
  }, [checkCurrentUrl]);

  useEffect(() => {
    listenForUrlEventsRef.current = listenForUrlEvents;
  }, [listenForUrlEvents]);

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

      const workspaceProfileLimit = selectedWorkspaceContext?.profileLimit;
      const workspaceProfilesUsed = selectedWorkspaceContext?.profilesUsed ?? 0;
      if (
        typeof workspaceProfileLimit === "number" &&
        workspaceProfileLimit > 0 &&
        workspaceProfilesUsed >= workspaceProfileLimit
      ) {
        showErrorToast(
          t("toasts.error.profileLimitReached", {
            used: workspaceProfilesUsed,
            limit: workspaceProfileLimit,
          }),
        );
        throw new Error("profile_limit_reached");
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
              (selectedGroupId !== ALL_GROUP_ID && selectedGroupId !== "default"
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
          await invoke<BrowserProfile>("launch_browser_profile_by_id", {
            profileId: profile.id,
          });
          showSuccessToast(t("toasts.success.profileLaunched"));
        } else {
          showSuccessToast(t("toasts.success.profileCreated"));
        }
      } catch (error) {
        const rawError =
          error instanceof Error ? error.message : String(error ?? "");
        const normalizedRawError = rawError.toLowerCase();
        const detailMessages: string[] = [];

        if (normalizedRawError.includes("sync server url not configured")) {
          detailMessages.push(t("toasts.error.profileCreateSyncServerMissing"));
        }
        if (
          normalizedRawError.includes(
            "cross-os fingerprinting requires a paid plan",
          ) ||
          normalizedRawError.includes("provide a wayferntoken parameter")
        ) {
          detailMessages.push(
            t("toasts.error.profileCreateWayfernTokenRequired"),
          );
        }

        showErrorToast(t("toasts.error.profileCreateFailed"), {
          description:
            detailMessages.length > 0
              ? detailMessages.join(" ")
              : extractRootError(error),
        });
        throw error;
      } finally {
        dismissToast(loadingToastId);
      }
    },
    [requireTeamPermission, selectedGroupId, selectedWorkspaceContext, t],
  );

  const launchProfile = useCallback(
    async (profile: BrowserProfile) => {
      const launchStartedAt = performance.now();
      const launchToastId = `profile-launch-${profile.id}`;
      showToast({
        id: launchToastId,
        type: "loading",
        title: t("toasts.loading.launchingProfile", { name: profile.name }),
        duration: Number.POSITIVE_INFINITY,
      });
      console.log("Starting launch for profile:", profile.name);

      if (
        !hasCheckedMissingBinariesRef.current &&
        !hasCheckedMissingBinariesGlobally
      ) {
        hasCheckedMissingBinariesRef.current = true;
        hasCheckedMissingBinariesGlobally = true;
        // Run this in the background so first launch click isn't blocked by
        // binary verification/download preflight.
        void checkMissingBinaries();
      }

      if (
        !hasEnsuredActiveBrowsersRef.current &&
        !hasEnsuredActiveBrowsersGlobally
      ) {
        hasEnsuredActiveBrowsersRef.current = true;
        hasEnsuredActiveBrowsersGlobally = true;
        void invoke("ensure_active_browsers_downloaded").catch(
          (err: unknown) => {
            console.error("Failed to ensure active browsers:", err);
          },
        );
      }

      // Show one-time warning about window resizing for fingerprinted browsers
      if (
        profile.browser === "camoufox" ||
        profile.browser === "wayfern" ||
        profile.browser === "bugox" ||
        profile.browser === "bugium"
      ) {
        try {
          const dismissed =
            windowResizeWarningDismissedRef.current ??
            (await invoke<boolean>("get_window_resize_warning_dismissed"));
          windowResizeWarningDismissedRef.current = dismissed;
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
        const result = await invoke<BrowserProfile>(
          "launch_browser_profile_by_id",
          {
            profileId: profile.id,
          },
        );
        dismissToast(launchToastId);
        const elapsedMs = Math.round(performance.now() - launchStartedAt);
        console.info(`[perf] launch_profile:${profile.id} ${elapsedMs}ms`);
        console.log("Successfully launched profile:", result.name);
        showSuccessToast(t("toasts.success.profileLaunched"));
      } catch (err: unknown) {
        dismissToast(launchToastId);
        const elapsedMs = Math.round(performance.now() - launchStartedAt);
        console.info(
          `[perf] launch_profile_failed:${profile.id} ${elapsedMs}ms`,
        );
        console.error("Failed to launch browser:", err);
        showErrorToast(t("toasts.error.profileLaunchFailed"), {
          description: extractRootError(err),
        });
        throw err;
      }
    },
    [checkMissingBinaries, t],
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
      const stopStartedAt = performance.now();
      const stopToastId = `profile-stop-${profile.id}`;
      showToast({
        id: stopToastId,
        type: "loading",
        title: t("toasts.loading.stoppingProfile", { name: profile.name }),
        duration: Number.POSITIVE_INFINITY,
      });
      if (!requireTeamPermission("stop_profile")) {
        dismissToast(stopToastId);
        throw new Error("permission_denied");
      }

      console.log("Starting stop for profile:", profile.name);

      try {
        await invoke("kill_browser_profile", { profile });
        dismissToast(stopToastId);
        const elapsedMs = Math.round(performance.now() - stopStartedAt);
        console.info(`[perf] stop_profile:${profile.id} ${elapsedMs}ms`);
        console.log("Successfully stopped profile:", profile.name);
      } catch (err: unknown) {
        dismissToast(stopToastId);
        const elapsedMs = Math.round(performance.now() - stopStartedAt);
        console.info(`[perf] stop_profile_failed:${profile.id} ${elapsedMs}ms`);
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
      setHasHydratedGroupData(true);
      setSelectedProfilesForGroup(profileIds);
      setGroupAssignmentDialogOpen(true);
    },
    [requireTeamPermission],
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedProfilesRef.current.length === 0) return;
    setBulkDeleteSelection([...selectedProfilesRef.current]);
    setShowBulkDeleteConfirmation(true);
  }, []);

  const confirmBulkDelete = useCallback(async () => {
    if (!requireTeamPermission("delete_selected_profiles")) {
      return;
    }

    const currentSelected = bulkDeleteSelection;
    if (currentSelected.length === 0) return;

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
        profileIds: currentSelected,
      });
      setArchivedProfileIds((prev) =>
        prev.filter((id) => !currentSelected.includes(id)),
      );
      setPinnedProfileIds((prev) =>
        prev.filter((id) => !currentSelected.includes(id)),
      );
      showSuccessToast(t("toasts.success.profileDeleted"));
      resetSelectedProfiles();
      setShowBulkDeleteConfirmation(false);
      setBulkDeleteSelection([]);
    } catch (error) {
      console.error("Failed to delete selected profiles:", error);
      showErrorToast(t("toasts.error.profileDeleteFailed"), {
        description: extractRootError(error),
      });
    } finally {
      dismissToast(loadingToastId);
      setIsBulkDeleting(false);
    }
  }, [bulkDeleteSelection, requireTeamPermission, resetSelectedProfiles, t]);

  const handleArchiveProfile = useCallback(
    (profile: BrowserProfile) => {
      if (!requireTeamPermission("delete_profile")) {
        return;
      }
      setArchivedProfileIds((prev) => {
        if (prev.includes(profile.id)) return prev;
        return [profile.id, ...prev];
      });
      resetSelectedProfiles();
      showSuccessToast(t("profiles.actions.archiveSuccess"));
    },
    [requireTeamPermission, resetSelectedProfiles, t],
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
    const currentSelected = selectedProfilesRef.current;
    if (currentSelected.length === 0) return;
    setArchivedProfileIds((prev) => {
      const next = new Set(prev);
      for (const id of currentSelected) {
        next.add(id);
      }
      return Array.from(next);
    });
    resetSelectedProfiles();
    showSuccessToast(t("profiles.actions.archiveSuccess"));
  }, [requireTeamPermission, resetSelectedProfiles, t]);

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
    const currentSelected = selectedProfilesRef.current;
    if (currentSelected.length === 0) return;
    handleAssignProfilesToGroup(currentSelected);
    resetSelectedProfiles();
  }, [handleAssignProfilesToGroup, resetSelectedProfiles]);

  const handleAssignExtensionGroup = useCallback(
    (profileIds: string[]) => {
      if (!requireTeamPermission("assign_extension_group")) {
        return;
      }
      if (!extensionManagementUnlocked) {
        showErrorToast(t("extensions.proRequired"));
        return;
      }
      setHasHydratedGroupData(true);
      setSelectedProfilesForExtensionGroup(profileIds);
      setExtensionGroupAssignmentDialogOpen(true);
    },
    [extensionManagementUnlocked, requireTeamPermission, t],
  );

  const handleBulkExtensionGroupAssignment = useCallback(() => {
    const currentSelected = selectedProfilesRef.current;
    if (currentSelected.length === 0) return;
    handleAssignExtensionGroup(currentSelected);
    resetSelectedProfiles();
  }, [handleAssignExtensionGroup, resetSelectedProfiles]);

  const handleExtensionGroupAssignmentComplete = useCallback(() => {
    setExtensionGroupAssignmentDialogOpen(false);
    setSelectedProfilesForExtensionGroup([]);
  }, []);

  const handleAssignProfilesToProxy = useCallback(
    (profileIds: string[]) => {
      if (!requireTeamPermission("assign_proxy")) {
        return;
      }
      setHasHydratedProxyData(true);
      setHasHydratedVpnData(true);
      setSelectedProfilesForProxy(profileIds);
      setProxyAssignmentDialogOpen(true);
    },
    [requireTeamPermission],
  );

  const handleBulkProxyAssignment = useCallback(() => {
    const currentSelected = selectedProfilesRef.current;
    if (currentSelected.length === 0) return;
    handleAssignProfilesToProxy(currentSelected);
    resetSelectedProfiles();
  }, [handleAssignProfilesToProxy, resetSelectedProfiles]);

  const handleBulkCopyCookies = useCallback(() => {
    const currentSelected = selectedProfilesRef.current;
    if (currentSelected.length === 0) return;
    if (!cookieManagementUnlocked) {
      showErrorToast(t("pro.cookieCopyLocked"));
      return;
    }
    const eligibleProfiles = profiles.filter(
      (p) =>
        currentSelected.includes(p.id) &&
        (p.browser === "wayfern" || p.browser === "camoufox"),
    );
    if (eligibleProfiles.length === 0) {
      showErrorToast("Cookie copy only works with Bugium and Bugox profiles");
      return;
    }
    setSelectedProfilesForCookies(eligibleProfiles.map((p) => p.id));
    setCookieCopyDialogOpen(true);
  }, [cookieManagementUnlocked, profiles, t]);

  const handleCopyCookiesToProfile = useCallback(
    (profile: BrowserProfile) => {
      if (!cookieManagementUnlocked) {
        showErrorToast(t("pro.cookieCopyLocked"));
        return;
      }
      setSelectedProfilesForCookies([profile.id]);
      setCookieCopyDialogOpen(true);
    },
    [cookieManagementUnlocked, t],
  );

  const handleOpenCookieManagement = useCallback(
    (profile: BrowserProfile) => {
      if (!cookieManagementUnlocked) {
        showErrorToast(t("pro.cookieManagementLocked"));
        return;
      }
      setCurrentProfileForCookieManagement(profile);
      setCookieManagementDialogOpen(true);
    },
    [cookieManagementUnlocked, t],
  );

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
        showSuccessToast(
          enabling
            ? t("profiles.syncToggle.enabledTitle")
            : t("profiles.syncToggle.disabledTitle"),
          {
            description: enabling
              ? t("profiles.syncToggle.enabledDescription")
              : t("profiles.syncToggle.disabledDescription"),
          },
        );
      } catch (error) {
        console.error("Failed to toggle sync:", error);
        showErrorToast(t("profiles.syncToggle.updateFailed"));
      }
    },
    [requireTeamPermission, t],
  );

  useEffect(() => {
    let unlistenStatus: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenRunning: (() => void) | undefined;
    (async () => {
      try {
        unlistenStatus = await listen<{
          profile_id: string;
          status: string;
          error?: string;
        }>("profile-sync-status", (event) => {
          const { profile_id, status, error } = event.payload;
          const toastId = `sync-${profile_id}`;
          const profile = profilesRef.current.find((p) => p.id === profile_id);
          const name =
            profile?.name ?? translationRef.current("common.labels.unknown");

          if (status === "syncing") {
            showToast({
              type: "loading",
              title: translationRef.current(
                "profiles.syncToggle.syncingProfile",
                {
                  name,
                },
              ),
              id: toastId,
              duration: Number.POSITIVE_INFINITY,
              onCancel: () => dismissToast(toastId),
            });
          } else if (status === "waiting" || status === "pending") {
            showToast({
              type: "loading",
              title: translationRef.current("profiles.table.waitingToSync"),
              id: toastId,
              duration: Number.POSITIVE_INFINITY,
              onCancel: () => dismissToast(toastId),
            });
          } else if (status === "synced") {
            dismissToast(toastId);
            showSuccessToast(
              translationRef.current("toasts.success.profileSynced", { name }),
            );
          } else if (status === "error") {
            dismissToast(toastId);
            showErrorToast(
              translationRef.current("toasts.error.profileSyncFailed", {
                name,
              }),
              {
                description: error ?? undefined,
              },
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
          const profile = profilesRef.current.find((p) => p.id === profile_id);
          const name =
            profile?.name ?? translationRef.current("common.labels.unknown");

          showSyncProgressToast(name, total_files ?? 0, total_bytes ?? 0, {
            id: toastId,
          });
        });

        unlistenRunning = await listen<{ id: string; is_running: boolean }>(
          "profile-running-changed",
          (event) => {
            const { id, is_running } = event.payload;
            if (is_running) {
              return;
            }
            const profile = profilesRef.current.find((p) => p.id === id);
            const syncEnabled =
              profile?.sync_mode != null && profile.sync_mode !== "Disabled";
            if (!profile || !syncEnabled) {
              return;
            }
            showToast({
              type: "loading",
              title: translationRef.current("profiles.table.waitingToSync"),
              id: `sync-${id}`,
              duration: Number.POSITIVE_INFINITY,
              onCancel: () => dismissToast(`sync-${id}`),
            });
          },
        );
      } catch (error) {
        console.error("Failed to listen for sync events:", error);
      }
    })();
    return () => {
      if (unlistenStatus) unlistenStatus();
      if (unlistenProgress) unlistenProgress();
      if (unlistenRunning) unlistenRunning();
    };
  }, []);

  useEffect(() => {
    // Check startup prompt/default URL and set URL listeners once.
    void checkCurrentUrlRef.current();

    let isDisposed = false;
    let cleanup: (() => void) | undefined;
    void listenForUrlEventsRef.current().then((cleanupFn) => {
      if (typeof cleanupFn !== "function") {
        return;
      }
      if (isDisposed) {
        cleanupFn();
        return;
      }
      cleanup = cleanupFn;
    });

    return () => {
      isDisposed = true;
      if (cleanup) {
        cleanup();
      }
    };
  }, []);

  // Show deprecation warning for unsupported profiles (with names)
  useEffect(() => {
    const migrationWarningsEnabled = false;
    if (!migrationWarningsEnabled) return;
    if (hasShownDeprecatedProfilesWarningRef.current) return;
    if (hasShownNoticeOnce(DEPRECATED_PROFILES_WARNING_ONCE_KEY)) {
      hasShownDeprecatedProfilesWarningRef.current = true;
      return;
    }
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
      hasShownDeprecatedProfilesWarningRef.current = true;
      markNoticeShownOnce(DEPRECATED_PROFILES_WARNING_ONCE_KEY);
    }
  }, [profiles]);

  // Temporary stable runtime mode:
  // Camoufox/Wayfern remain active engine cores, so suppress migration warning.
  useEffect(() => {
    if (hasShownBrowserSupportEndingWarningRef.current) return;
    if (hasShownNoticeOnce(BROWSER_SUPPORT_ENDING_WARNING_ONCE_KEY)) {
      hasShownBrowserSupportEndingWarningRef.current = true;
      return;
    }
    if (profiles.length === 0) return;

    const unsupportedProfiles: typeof profiles = [];

    if (unsupportedProfiles.length > 0) {
      const unsupportedNames = unsupportedProfiles
        .map((p) => p.name)
        .join(", ");

      showToast({
        id: "browser-support-ending-warning",
        type: "error",
        title: "Browser support ending soon",
        description: `Legacy browser profiles detected: ${unsupportedNames}. Please migrate these profiles to Bugium or Bugox.`,
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
      hasShownBrowserSupportEndingWarningRef.current = true;
      markNoticeShownOnce(BROWSER_SUPPORT_ENDING_WARNING_ONCE_KEY);
    }
  }, [profiles]);

  // Re-check Wayfern terms when a browser download completes
  useEffect(() => {
    if (!shouldLoadSupportRuntimeData) {
      return;
    }
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
  }, [checkTerms, shouldLoadSupportRuntimeData]);

  // Check permissions when they are initialized
  useEffect(() => {
    if (isInitialized) {
      void checkAllPermissions();
    }
  }, [isInitialized, checkAllPermissions]);

  // Filter data by selected group and search query
  const filteredProfiles = useMemo(() => {
    if (!isProfilesSectionActive) {
      return [];
    }
    let filtered =
      profileViewMode === "archived"
        ? profiles.filter((profile) => archivedProfileIdsSet.has(profile.id))
        : profiles.filter((profile) => !archivedProfileIdsSet.has(profile.id));

    // Filter by group
    if (selectedGroupId && selectedGroupId !== ALL_GROUP_ID) {
      filtered = filtered.filter((profile) => {
        if (selectedGroupId === "default") {
          return !profile.group_id || profile.group_id === "default";
        }
        return profile.group_id === selectedGroupId;
      });
    }

    // Filter by search query
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase().trim();
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
      filtered = filtered.filter((profile) => pinnedProfileIdsSet.has(profile.id));
    }

    filtered.sort((left, right) => {
      const leftPinned = pinnedProfileIdsSet.has(left.id) ? 1 : 0;
      const rightPinned = pinnedProfileIdsSet.has(right.id) ? 1 : 0;
      if (leftPinned !== rightPinned) {
        return rightPinned - leftPinned;
      }
      return left.name.localeCompare(right.name);
    });

    return filtered;
  }, [
    profiles,
    selectedGroupId,
    deferredSearchQuery,
    archivedProfileIdsSet,
    pinnedProfileIdsSet,
    profileViewMode,
    showPinnedOnly,
    isProfilesSectionActive,
  ]);

  const hiddenProfilesCount = useMemo(() => {
    return Math.max(0, profiles.length - filteredProfiles.length);
  }, [filteredProfiles.length, profiles.length]);

  const hasProfileVisibilityFilters = useMemo(() => {
    return (
      Boolean(searchQuery.trim()) ||
      showPinnedOnly ||
      profileViewMode === "archived"
    );
  }, [profileViewMode, searchQuery, showPinnedOnly]);

  const handleResetProfileVisibilityFilters = useCallback(() => {
    setSearchQuery("");
    setShowPinnedOnly(false);
    setProfileViewMode("active");
    setSelectedGroupId(ALL_GROUP_ID);
    resetSelectedProfiles();
    showSuccessToast(t("profiles.filterResetSuccess"));
  }, [resetSelectedProfiles, t]);

  useEffect(() => {
    if (!selectedGroupId || selectedGroupId === ALL_GROUP_ID) {
      return;
    }
    if (selectedGroupId === "default") {
      return;
    }
    if (!groupsData.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(ALL_GROUP_ID);
    }
  }, [groupsData, selectedGroupId]);

  // Update loading states
  const isLoading = profilesLoading;
  const sidebarActiveSection: AppSection =
    activeSection === "profiles-create" ? "profiles" : activeSection;

  const renderActiveSection = () => {
    switch (activeSection) {
      case "groups":
        return (
          <WorkspacePageShell
            title={t("shell.sections.groups")}
            contentClassName="w-full max-w-none space-y-4 pb-0"
          >
            <GroupManagementPanel />
          </WorkspacePageShell>
        );
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
            onSectionOpen={setActiveSection}
            onSyncConfigOpen={() => setSyncConfigDialogOpen(true)}
            canUseEncryption={syncEncryptionUnlocked}
            mode="page"
            isPlatformAdmin={isPlatformAdmin}
          />
        );
      case "workspace-owner-overview":
      case "workspace-owner-directory":
      case "workspace-owner-permissions":
      case "workspace-governance":
      case "workspace-admin-overview":
      case "workspace-admin-directory":
      case "workspace-admin-permissions":
      case "workspace-admin-members":
      case "workspace-admin-access":
      case "workspace-admin-workspace":
      case "workspace-admin-audit":
      case "workspace-admin-system":
      case "workspace-admin-analytics": {
        if (!canAccessSelectedWorkspaceGovernance) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.workspaceOwnerPanel")}
              description={t("adminWorkspace.ownerOnlyGovernance")}
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("adminWorkspace.ownerOnlyGovernance")}
              </div>
            </WorkspacePageShell>
          );
        }
        const ownerSidebarTab: "overview" | "workspace" = "workspace";
        const ownerWorkspaceFlow:
          | "overview"
          | "directory"
          | "permissions"
          | "plan" =
          activeSection === "workspace-owner-overview" ||
          activeSection === "workspace-admin-overview"
            ? "overview"
            : activeSection === "workspace-owner-permissions" ||
                activeSection === "workspace-admin-permissions" ||
                activeSection === "workspace-admin-access"
              ? "permissions"
              : activeSection === "workspace-admin-workspace" ||
                  activeSection === "workspace-admin-audit"
                ? "plan"
                : "directory";
        return (
          <WorkspacePageShell
            title={t("shell.sections.workspaceOwnerPanel")}
            description={t("adminWorkspace.workspaceSubtitle")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <PlatformAdminWorkspace
              key={`workspace-owner-${sidebarWorkspaceId}`}
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
              cloudUser={cloudUser}
              platformRole={cloudUser?.platformRole}
              teamRole={selectedWorkspaceRole}
              workspaceProfiles={profiles}
              storedProxies={storedProxies}
              isWorkspaceProfilesLoading={profilesLoading}
              isStoredProxiesLoading={proxiesLoading}
              refreshWorkspaceProfiles={reloadProfiles}
              refreshStoredProxies={reloadProxies}
              sidebarTab={ownerSidebarTab}
              workspaceFlow={ownerWorkspaceFlow}
              showWorkspaceFlowTabs={true}
              workspaceScopedOnly={true}
              minimalView={false}
              workspaceContextId={sidebarWorkspaceId}
              onWorkspaceContextChange={handleWorkspaceChange}
              onNavigateSection={setActiveSection}
            />
          </WorkspacePageShell>
        );
      }
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
            description={t("shell.webPortal.billingDescription")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {t("shell.webPortal.movedDescription")}
              </p>
              <Button
                type="button"
                className="mt-3"
                onClick={() => {
                  void openBillingPortal();
                }}
                disabled={isOpeningWebPortal}
              >
                {isOpeningWebPortal
                  ? t("shell.webPortal.opening")
                  : t("shell.webPortal.openBilling")}
              </Button>
            </div>
          </WorkspacePageShell>
        );
      case "pricing":
        return (
          <WorkspacePageShell
            title={t("shell.sections.pricing")}
            description={t("shell.webPortal.pricingDescription")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground">
                {t("shell.webPortal.movedDescription")}
              </p>
              <Button
                type="button"
                className="mt-3"
                onClick={() => {
                  void openPricingPortal();
                }}
                disabled={isOpeningWebPortal}
              >
                {isOpeningWebPortal
                  ? t("shell.webPortal.opening")
                  : t("shell.webPortal.openPricing")}
              </Button>
            </div>
          </WorkspacePageShell>
        );
      case "bugidea-automation":
        if (!canAccessBugIdeaAdmin) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.bugideaAutomation")}
              description={t("adminWorkspace.bugideaDevOnlyDescription")}
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("adminWorkspace.bugideaDevOnlyDescription")}
              </div>
            </WorkspacePageShell>
          );
        }
        return (
          <WorkspacePageShell
            title=""
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <PlatformAdminWorkspace
              key="super-bugidea-automation"
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
              cloudUser={cloudUser}
              platformRole={cloudUser?.platformRole}
              teamRole={selectedWorkspaceRole}
              workspaceProfiles={profiles}
              storedProxies={storedProxies}
              isWorkspaceProfilesLoading={profilesLoading}
              isStoredProxiesLoading={proxiesLoading}
              refreshWorkspaceProfiles={reloadProfiles}
              refreshStoredProxies={reloadProxies}
              sidebarTab="cookies"
              minimalView={true}
              workspaceScopedOnly={false}
              workspaceContextId={sidebarWorkspaceId}
              onWorkspaceContextChange={handleWorkspaceChange}
            />
          </WorkspacePageShell>
        );
      case "super-admin-overview":
      case "super-admin-workspace":
      case "super-admin-billing":
      case "super-admin-cookies":
      case "super-admin-audit":
      case "super-admin-system":
      case "super-admin-analytics":
      case "admin-overview":
      case "admin-workspace":
      case "admin-billing":
      case "admin-cookies":
      case "admin-audit":
      case "admin-system":
      case "admin-analytics": {
        if (!canAccessSuperAdminPanel) {
          return (
            <WorkspacePageShell
              title={t("shell.sections.superAdminPanel")}
              description={t("adminWorkspace.noAccessDescription")}
              contentClassName="max-w-none space-y-4 pb-0"
            >
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("adminWorkspace.noAccessDescription")}
              </div>
            </WorkspacePageShell>
          );
        }
        const superSidebarTab:
          | "overview"
          | "workspace"
          | "billing"
          | "cookies"
          | "audit" =
          activeSection === "super-admin-workspace" ||
          activeSection === "admin-workspace"
            ? "workspace"
            : activeSection === "super-admin-billing" ||
                activeSection === "admin-billing"
              ? "billing"
              : activeSection === "super-admin-cookies" ||
                  activeSection === "admin-cookies"
                ? "cookies"
                : activeSection === "super-admin-audit" ||
                    activeSection === "admin-audit"
                  ? "audit"
                  : "overview";
        return (
          <WorkspacePageShell
            title={t("shell.sections.superAdminPanel")}
            description={t("adminWorkspace.subtitle")}
            contentClassName="max-w-none space-y-4 pb-0"
          >
            <PlatformAdminWorkspace
              key={`super-admin-${sidebarWorkspaceId}`}
              runtimeConfig={runtimeConfig}
              entitlement={entitlement}
              cloudUser={cloudUser}
              platformRole={cloudUser?.platformRole}
              teamRole={selectedWorkspaceRole}
              workspaceProfiles={profiles}
              storedProxies={storedProxies}
              isWorkspaceProfilesLoading={profilesLoading}
              isStoredProxiesLoading={proxiesLoading}
              refreshWorkspaceProfiles={reloadProfiles}
              refreshStoredProxies={reloadProxies}
              sidebarTab={superSidebarTab}
              minimalView={false}
              workspaceScopedOnly={false}
              workspaceContextId={sidebarWorkspaceId}
              onWorkspaceContextChange={handleWorkspaceChange}
              onNavigateSection={setActiveSection}
            />
          </WorkspacePageShell>
        );
      }
      case "profiles-create":
        return (
          <WorkspacePageShell
            title={t("createProfile.workspace.title")}
            description={t("createProfile.workspace.description")}
            contentClassName="max-w-none space-y-2.5 pb-0"
          >
            <CreateProfileDialog
              isOpen={true}
              mode="page"
              onClose={() => setActiveSection("profiles")}
              onCreateProfile={handleCreateProfile}
              selectedGroupId={selectedGroupId}
              crossOsUnlocked={crossOsUnlocked}
            />
          </WorkspacePageShell>
        );
      default:
        return (
          <WorkspacePageShell
            title={t("shell.sections.profiles")}
            actions={
              <ProfilesWorkspaceHeaderActions
                onCreateProfileDialogOpen={(open) => {
                  if (!open) {
                    return;
                  }
                  setHasHydratedGroupData(true);
                  setHasHydratedProxyData(true);
                  setHasHydratedVpnData(true);
                  setActiveSection("profiles-create");
                }}
                onGroupsPageOpen={() => setActiveSection("groups")}
                onImportProfileDialogOpen={setImportProfileDialogOpen}
                onProxyPageOpen={() => setActiveSection("proxies")}
                onSettingsPageOpen={() => setActiveSection("settings")}
                onSyncConfigDialogOpen={setSyncConfigDialogOpen}
                onIntegrationsPageOpen={() => setActiveSection("integrations")}
                onExtensionManagementDialogOpen={
                  setExtensionManagementDialogOpen
                }
                extensionManagementUnlocked={extensionManagementUnlocked}
              />
            }
            toolbar={
              <ProfilesWorkspaceToolbar
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                selectedGroupId={selectedGroupId}
                groups={groupsData}
                onSelectedGroupChange={handleSelectGroup}
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
            shellClassName="gap-2.5"
            toolbarClassName="mt-2"
            contentClassName="max-w-none space-y-2.5 pb-0"
          >
            {filteredProfiles.length === 0 &&
              profiles.length > 0 &&
              hasProfileVisibilityFilters && (
                <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    {t("profiles.filteredStateHint", {
                      visible: filteredProfiles.length,
                      total: profiles.length,
                      hidden: hiddenProfilesCount,
                    })}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    onClick={handleResetProfileVisibilityFilters}
                  >
                    {t("profiles.resetFilters")}
                  </Button>
                </div>
              )}
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex min-h-0 flex-1 flex-col">
                <ProfilesDataTable
                  profiles={filteredProfiles}
                  isLoading={isLoading}
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
                  onSelectionChange={updateSelectedProfilesRef}
                  selectionResetNonce={selectionResetNonce}
                  onBulkDelete={handleBulkDelete}
                  onBulkGroupAssignment={handleBulkGroupAssignment}
                  onBulkProxyAssignment={handleBulkProxyAssignment}
                  onBulkCopyCookies={handleBulkCopyCookies}
                  onBulkExtensionGroupAssignment={
                    handleBulkExtensionGroupAssignment
                  }
                  onBulkArchive={handleArchiveSelectedProfiles}
                  onAssignExtensionGroup={handleAssignExtensionGroup}
                  onOpenProxyCenter={() => setActiveSection("proxies")}
                  onOpenProfileSyncDialog={handleOpenProfileSyncDialog}
                  onToggleProfileSync={handleToggleProfileSync}
                  onArchiveProfile={handleArchiveProfile}
                  onRestoreProfile={handleRestoreProfile}
                  isProfileArchived={(profileId) =>
                    archivedProfileIdsSet.has(profileId)
                  }
                  onPinProfile={handlePinProfile}
                  onUnpinProfile={handleUnpinProfile}
                  isProfilePinned={(profileId) =>
                    pinnedProfileIdsSet.has(profileId)
                  }
                  workspaceRole={selectedWorkspaceRole}
                  fallbackTeamRole={teamRole}
                  currentUserId={cloudUser?.id ?? null}
                  isEntitlementReadOnly={isReadOnly}
                  crossOsUnlocked={crossOsUnlocked}
                  extensionManagementUnlocked={extensionManagementUnlocked}
                  cookieManagementUnlocked={cookieManagementUnlocked}
                  syncUnlocked={syncUnlocked}
                  storedProxies={storedProxies}
                  vpnConfigs={vpnConfigs}
                  isProxyVpnCatalogLoading={proxiesLoading || vpnConfigsLoading}
                />
              </div>
            </div>
          </WorkspacePageShell>
        );
    }
  };

  if (!mounted) {
    return null;
  }

  if (!cloudUser && isCloudAuthLoading) {
    return <PageLoader mode="fullscreen" className="type-ui" />;
  }

  if (!cloudUser) {
    return (
      <div className="type-ui relative flex min-h-screen bg-background">
        {pendingConfigMessages.length > 0 && (
          <div className="type-section fixed top-0 left-0 right-0 z-50 flex justify-center border-b border-border bg-muted/80 px-4 py-2 uppercase text-muted-foreground backdrop-blur-md">
            {pendingConfigMessages.join(" • ")}
          </div>
        )}
        <PortalAuthPage surface="desktop" />
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

  if (isPostLoginTransitioning) {
    return <PageLoader mode="fullscreen" className="type-ui" />;
  }

  return (
    <div className="type-ui flex h-screen overflow-hidden bg-background">
      <AppSidebar
        activeSection={sidebarActiveSection}
        collapsed={sidebarCollapsed}
        onSectionChange={handleSectionChange}
        onCollapsedChange={setSidebarCollapsed}
        showAdminSection={isPlatformAdmin}
        teamRole={teamRole}
        currentWorkspaceRole={selectedWorkspaceRole}
        platformRole={cloudUser?.platformRole ?? null}
        isDeveloperBuild={isDeveloperBuild}
        workspaceOptions={workspaceOptions}
        currentWorkspaceId={sidebarWorkspaceId}
        onWorkspaceChange={handleWorkspaceChange}
        isWorkspaceSwitching={Boolean(workspaceSwitchState)}
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

      <main className="app-shell-safe flex min-w-0 flex-1 flex-col overflow-hidden pl-3 pb-2.5 md:pl-4 md:pb-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <MainWorkspaceTopBar
            workspaceName={
              selectedWorkspaceContext?.name ??
              selectedWorkspaceOption?.label ??
              t("shell.workspaceSwitcher.placeholder")
            }
            workspaceRoleLabel={
              isPlatformAdmin
                ? t("shell.roles.platform_admin")
                : t(`shell.roles.${selectedWorkspaceRole}`)
            }
            notifications={topbarNotifications}
            isCheckingUpdates={isCheckingHeaderUpdates}
            onCheckUpdates={() => {
              void handleCheckForUpdates();
            }}
            onOpenSettings={() => setActiveSection("settings")}
            onOpenAdminPanel={() => {
              setActiveSection("super-admin-overview");
            }}
            onOpenWorkspaceGovernancePanel={() => {
              setActiveSection("workspace-owner-overview");
            }}
            onOpenWorkspacePanel={() => setActiveSection("profiles")}
            onSignOut={() => {
              void handleCloudSignOut();
            }}
            authEmail={cloudUser?.email ?? ""}
            authAvatar={cloudUser?.avatar ?? null}
            inAdminPanel={inAdminPanel}
            inWorkspaceGovernancePanel={inWorkspaceGovernancePanel}
            canAccessAdminPanel={canAccessSuperAdminPanel}
            canAccessWorkspaceGovernancePanel={
              canAccessSelectedWorkspaceGovernance
            }
          />
          {renderActiveSection()}
        </div>
      </main>

      <PageLoaderOverlay
        open={Boolean(workspaceSwitchState)}
        overlayClassName="bg-background"
      />
      <PageLoaderOverlay
        open={isSectionSwitching && !workspaceSwitchState}
        overlayClassName="bg-background/45"
      />
      {importProfileDialogOpen && (
        <ImportProfileDialog
          isOpen={importProfileDialogOpen}
          onClose={() => {
            setImportProfileDialogOpen(false);
          }}
        />
      )}

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

      {permissionDialogOpen && (
        <PermissionDialog
          isOpen={permissionDialogOpen}
          onClose={() => {
            setPermissionDialogOpen(false);
          }}
          permissionType={currentPermissionType}
          onPermissionGranted={checkNextPermission}
        />
      )}

      {cloneProfile && (
        <CloneProfileDialog
          isOpen={Boolean(cloneProfile)}
          onClose={() => setCloneProfile(null)}
          profile={cloneProfile}
        />
      )}

      {camoufoxConfigDialogOpen && (
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
      )}

      {extensionManagementDialogOpen && (
        <ExtensionManagementDialog
          isOpen={extensionManagementDialogOpen}
          onClose={() => setExtensionManagementDialogOpen(false)}
          limitedMode={!extensionManagementUnlocked}
        />
      )}

      {groupAssignmentDialogOpen && (
        <GroupAssignmentDialog
          isOpen={groupAssignmentDialogOpen}
          onClose={() => {
            setGroupAssignmentDialogOpen(false);
          }}
          selectedProfiles={selectedProfilesForGroup}
          onAssignmentComplete={handleGroupAssignmentComplete}
          profiles={profiles}
        />
      )}

      {extensionGroupAssignmentDialogOpen && (
        <ExtensionGroupAssignmentDialog
          isOpen={extensionGroupAssignmentDialogOpen}
          onClose={() => {
            setExtensionGroupAssignmentDialogOpen(false);
          }}
          selectedProfiles={selectedProfilesForExtensionGroup}
          onAssignmentComplete={handleExtensionGroupAssignmentComplete}
          profiles={profiles}
          limitedMode={!extensionManagementUnlocked}
        />
      )}

      {proxyAssignmentDialogOpen && (
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
      )}

      {cookieCopyDialogOpen && (
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
      )}

      {cookieManagementDialogOpen && (
        <CookieManagementDialog
          isOpen={cookieManagementDialogOpen}
          onClose={() => {
            setCookieManagementDialogOpen(false);
            setCurrentProfileForCookieManagement(null);
          }}
          profile={currentProfileForCookieManagement}
        />
      )}

      {showBulkDeleteConfirmation && (
        <DeleteConfirmationDialog
          isOpen={showBulkDeleteConfirmation}
          onClose={() => {
            setShowBulkDeleteConfirmation(false);
            setBulkDeleteSelection([]);
          }}
          onConfirm={confirmBulkDelete}
          title={t("profiles.bulkDelete.title")}
          description={t("profiles.bulkDelete.description", {
            count: bulkDeleteSelection.length,
          })}
          confirmButtonText={t("profiles.bulkDelete.confirmButton", {
            count: bulkDeleteSelection.length,
          })}
          isLoading={isBulkDeleting}
          profileIds={bulkDeleteSelection}
          profiles={profiles.map((p) => ({ id: p.id, name: p.name }))}
        />
      )}

      {syncConfigDialogOpen && (
        <SyncConfigDialog
          isOpen={syncConfigDialogOpen}
          onClose={(loginOccurred) => {
            setSyncConfigDialogOpen(false);
            if (loginOccurred) {
              setSyncAllDialogOpen(true);
            }
          }}
        />
      )}

      {syncAllDialogOpen && (
        <SyncAllDialog
          isOpen={syncAllDialogOpen}
          onClose={() => setSyncAllDialogOpen(false)}
        />
      )}

      {profileSyncDialogOpen && (
        <ProfileSyncDialog
          isOpen={profileSyncDialogOpen}
          onClose={() => {
            setProfileSyncDialogOpen(false);
            setCurrentProfileForSync(null);
          }}
          profile={currentProfileForSync}
          onSyncConfigOpen={() => setSyncConfigDialogOpen(true)}
          canUseEncryption={syncEncryptionUnlocked}
        />
      )}

      {!termsLoading && termsAccepted === false && (
        <WayfernTermsDialog
          isOpen={!termsLoading && termsAccepted === false}
          onAccepted={checkTerms}
        />
      )}

      {launchOnLoginDialogOpen && (
        <LaunchOnLoginDialog
          isOpen={launchOnLoginDialogOpen}
          onClose={() => setLaunchOnLoginDialogOpen(false)}
        />
      )}

      {windowResizeWarningOpen && (
        <WindowResizeWarningDialog
          isOpen={windowResizeWarningOpen}
          browserType={windowResizeWarningBrowserType}
          onResult={(proceed) => {
            if (proceed) {
              void invoke<boolean>("get_window_resize_warning_dismissed")
                .then((dismissed) => {
                  windowResizeWarningDismissedRef.current = dismissed;
                })
                .catch(() => {
                  // Keep current cache on read failure.
                });
            }
            setWindowResizeWarningOpen(false);
            windowResizeWarningResolver.current?.(proceed);
            windowResizeWarningResolver.current = null;
          }}
        />
      )}
    </div>
  );
}
