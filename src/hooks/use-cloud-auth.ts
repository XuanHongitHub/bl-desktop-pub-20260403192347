import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import type { AuthLoginScope } from "@/lib/auth-quick-presets";
import {
  BILLING_PLAN_DEFINITIONS,
  type BillingCycle,
  type BillingPlanId,
} from "@/lib/billing-plans";
import { extractRootError } from "@/lib/error-utils";
import { listSelfHostedSubscriptions } from "@/lib/self-host-billing";
import { normalizeTeamRole } from "@/lib/team-permissions";
import { normalizePlanIdFromLabel } from "@/lib/workspace-billing-logic";
import type {
  CloudAuthState,
  CloudUser,
  ControlMembership,
  ControlWorkspaceBillingState,
  ControlWorkspace,
  ControlWorkspaceOverview,
} from "@/types";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface ControlBaseUrlResolution {
  baseUrl: string;
  hasExplicitConfig: boolean;
}

interface PublicAuthUser {
  id: string;
  email: string;
  platformRole?: "platform_admin" | null;
}

interface PublicAuthResponse {
  user: PublicAuthUser;
}

interface UseCloudAuthReturn {
  user: CloudUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  registerWithEmail: (
    email: string,
    password: string,
    options?: {
      name?: string;
      avatar?: string;
    },
  ) => Promise<CloudAuthState>;
  loginWithEmail: (
    email: string,
    options?: {
      scope?: AuthLoginScope;
      allowUnassigned?: boolean;
      name?: string;
      avatar?: string;
      password?: string;
      authProvider?: "password" | "google_oauth";
    },
  ) => Promise<CloudAuthState>;
  requestOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string) => Promise<CloudAuthState>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<CloudUser>;
  updateLocalSubscription: (input: {
    planId: BillingPlanId;
    billingCycle: BillingCycle;
    profileLimit: number;
    planLabel: string;
    workspaceId?: string | null;
  }) => Promise<CloudUser>;
}

const LOCAL_AUTH_STORAGE_KEY = "buglogin.auth.local-session.v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requirePassword(password: string | undefined): string {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("password_required");
  }
  if (password.length < 8) {
    throw new Error("password_too_short");
  }
  return password;
}

function supportsLocalDevAuthFallback(email: string): boolean {
  return email.endsWith("@buglogin.local");
}

function resolveLocalDevPlatformRole(
  email: string,
  scope?: AuthLoginScope,
): "platform_admin" | null {
  if (scope === "platform_admin") {
    return "platform_admin";
  }
  return email === "platform.admin@buglogin.local" ? "platform_admin" : null;
}

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
}

function resolveControlBaseUrlFromSettings(
  settings?: SyncSettings | null,
): ControlBaseUrlResolution {
  const configuredBaseUrl = normalizeBaseUrl(settings?.sync_server_url);
  if (configuredBaseUrl) {
    return {
      baseUrl: configuredBaseUrl,
      hasExplicitConfig: true,
    };
  }

  const envBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SYNC_SERVER_URL);
  if (envBaseUrl) {
    return {
      baseUrl: envBaseUrl,
      hasExplicitConfig: true,
    };
  }

  return {
    baseUrl: "http://127.0.0.1:3929",
    hasExplicitConfig: false,
  };
}

function hydrateUserFromSelfHostedSubscriptions(user: CloudUser): CloudUser {
  const subscriptions = listSelfHostedSubscriptions(user.id);
  if (subscriptions.length === 0) {
    return user;
  }

  const workspaceSeeds = [...(user.workspaceSeeds ?? [])];
  const workspaceSeedById = new Map(
    workspaceSeeds.map((workspace, index) => [workspace.id, index] as const),
  );
  let hasPersonalWorkspace = workspaceSeeds.some(
    (workspace) => workspace.mode === "personal",
  );

  for (const subscription of subscriptions) {
    const existingIndex = workspaceSeedById.get(subscription.workspaceId);
    if (typeof existingIndex === "number") {
      const existing = workspaceSeeds[existingIndex];
      workspaceSeeds[existingIndex] = {
        ...existing,
        name: existing.name || subscription.workspaceName,
        planLabel: subscription.planLabel,
        profileLimit: subscription.profileLimit,
        entitlementState: "active",
      };
      continue;
    }

    const mode =
      subscription.workspaceId === "personal"
        ? "personal"
        : user.teamId && subscription.workspaceId === user.teamId
          ? "team"
          : !hasPersonalWorkspace && subscriptions.length === 1
            ? "personal"
            : "team";
    const role =
      mode === "personal"
        ? "owner"
        : normalizeTeamRole(user.teamRole) ?? "owner";
    workspaceSeedById.set(subscription.workspaceId, workspaceSeeds.length);
    workspaceSeeds.push({
      id: subscription.workspaceId,
      name: subscription.workspaceName || user.email,
      mode,
      role,
      members: 1,
      activeInvites: 0,
      activeShareGrants: 0,
      entitlementState: "active",
      profileLimit: subscription.profileLimit,
      profilesUsed: 0,
      planLabel: subscription.planLabel,
      expiresAt: null,
    });
    if (mode === "personal") {
      hasPersonalWorkspace = true;
    }
  }

  const teamWorkspace =
    workspaceSeeds.find((workspace) => workspace.id === user.teamId) ??
    workspaceSeeds.find((workspace) => workspace.mode === "team") ??
    null;
  const personalWorkspace =
    workspaceSeeds.find((workspace) => workspace.mode === "personal") ?? null;
  const primaryWorkspace = teamWorkspace ?? personalWorkspace ?? workspaceSeeds[0];
  const primarySubscription =
    subscriptions.find(
      (subscription) => subscription.workspaceId === primaryWorkspace?.id,
    ) ?? subscriptions[0];
  const primaryPlanId =
    primarySubscription?.planId ??
    normalizePlanIdFromLabel(primaryWorkspace?.planLabel);
  const primaryPlanConfig = primaryPlanId
    ? BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === primaryPlanId)
    : null;
  const primaryProxyBandwidthLimitMb = primaryPlanConfig
    ? Math.max(0, Math.round(primaryPlanConfig.proxyGb * 1024))
    : user.proxyBandwidthLimitMb;

  return {
    ...user,
    plan: primaryPlanId ?? user.plan,
    planPeriod: primarySubscription?.billingCycle ?? user.planPeriod,
    subscriptionStatus: "active",
    profileLimit: primaryWorkspace?.profileLimit ?? user.profileLimit,
    proxyBandwidthLimitMb: primaryProxyBandwidthLimitMb,
    proxyBandwidthUsedMb: Math.min(
      user.proxyBandwidthUsedMb,
      primaryProxyBandwidthLimitMb,
    ),
    teamId: teamWorkspace?.id ?? user.teamId,
    teamName: teamWorkspace?.name ?? user.teamName,
    teamRole:
      normalizeTeamRole(teamWorkspace?.role) ??
      normalizeTeamRole(user.teamRole) ??
      undefined,
    workspaceSeeds,
  };
}

function deriveLocalUserId(normalizedEmail: string): string {
  let hash = 0;
  for (const char of normalizedEmail) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  const compactEmail = normalizedEmail.replace(/[^a-z0-9]/g, "").slice(0, 16);
  return `local-${compactEmail || "user"}-${Math.abs(hash).toString(36)}`;
}

function defaultLocalUser(
  normalizedEmail: string,
  _scope: AuthLoginScope = "workspace_user",
  name?: string,
  avatar?: string,
): CloudUser {
  return {
    id: deriveLocalUserId(normalizedEmail),
    email: normalizedEmail,
    name,
    avatar,
    plan: "free",
    planPeriod: null,
    subscriptionStatus: "active",
    profileLimit: 3,
    cloudProfilesUsed: 0,
    proxyBandwidthLimitMb: 1024,
    proxyBandwidthUsedMb: 0,
    proxyBandwidthExtraMb: 0,
    teamId: undefined,
    teamName: undefined,
    teamRole: undefined,
    platformRole: undefined,
    workspaceSeeds: [],
  };
}

function normalizeWorkspaceSeedDisplayName<T extends { name: string }>(
  workspace: T,
): T {
  return workspace;
}

function resolveWorkspaceName(input: {
  name: string | null | undefined;
  mode: "personal" | "team";
  userEmail: string;
}): string {
  const normalizedName = input.name?.trim() ?? "";
  if (input.mode === "personal") {
    const lower = normalizedName.toLowerCase();
    if (!normalizedName || lower === "personal workspace") {
      return input.userEmail;
    }
  }
  return normalizedName || input.userEmail;
}

function deriveProfileLimitFromPlanLabel(
  planLabel: string | null | undefined,
  mode: "personal" | "team",
): number {
  const normalizedPlanId = normalizePlanIdFromLabel(planLabel);
  if (normalizedPlanId === "starter") {
    return 100;
  }
  if (normalizedPlanId === "growth") {
    return 300;
  }
  if (normalizedPlanId === "scale") {
    return 1000;
  }
  if (normalizedPlanId === "custom") {
    return 2000;
  }
  return mode === "personal" ? 3 : 100;
}

function readLocalAuthState(): CloudAuthState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LOCAL_AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CloudAuthState;
    if (!parsed?.user?.email || !parsed?.user?.id) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeLocalAuthState(state: CloudAuthState | null) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!state) {
      window.localStorage.removeItem(LOCAL_AUTH_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(LOCAL_AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors to keep login flow non-blocking.
  }
}

function isCloudAuthDisabledError(error: unknown): boolean {
  const message = extractRootError(error).toLowerCase();
  return (
    message.includes("cloud auth is disabled") ||
    message.includes("self-hosted sync")
  );
}

async function parseHttpError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as
      | { message?: string | string[]; error?: string }
      | undefined;
    const rawMessage = payload?.message;
    if (Array.isArray(rawMessage)) {
      const firstMessage = rawMessage.find(
        (item) => typeof item === "string" && item.trim().length > 0,
      );
      if (firstMessage) {
        return firstMessage;
      }
    } else if (typeof rawMessage === "string" && rawMessage.trim().length > 0) {
      return rawMessage;
    }
    if (typeof payload?.error === "string" && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // Ignore invalid JSON response bodies.
  }
  return response.statusText || `http_${response.status}`;
}

export function useCloudAuth(): UseCloudAuthReturn {
  const [authState, setAuthState] = useState<CloudAuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeUser = useCallback((user: CloudUser): CloudUser => {
    const normalizedRole = normalizeTeamRole(user.teamRole);
    const normalizedWorkspaceSeeds = user.workspaceSeeds?.map(
      normalizeWorkspaceSeedDisplayName,
    );
    return {
      ...user,
      teamRole: normalizedRole ?? undefined,
      teamName: user.teamName
        ? normalizeWorkspaceSeedDisplayName({ name: user.teamName }).name
        : user.teamName,
      workspaceSeeds: normalizedWorkspaceSeeds,
    };
  }, []);

  const updateAuthState = useCallback(
    (state: CloudAuthState | null) => {
      const normalizedState = state
        ? {
            ...state,
            user: normalizeUser(state.user),
          }
        : null;
      setAuthState(normalizedState);
      writeLocalAuthState(normalizedState);
      void invoke("cloud_sync_local_subscription_state", {
        state: normalizedState
          ? {
              plan: normalizedState.user.plan,
              planPeriod: normalizedState.user.planPeriod ?? null,
              subscriptionStatus: normalizedState.user.subscriptionStatus,
              teamRole: normalizedState.user.teamRole ?? null,
            }
          : null,
      }).catch(() => {
        // Keep local auth flow non-blocking when backend sync fails.
      });
    },
    [normalizeUser],
  );

  const enrichUserFromControlPlane = useCallback(async (user: CloudUser) => {
    let syncSettings: SyncSettings | null = null;
    try {
      syncSettings = await invoke<SyncSettings>("get_sync_settings");
    } catch {
      syncSettings = null;
    }

    const { baseUrl, hasExplicitConfig } =
      resolveControlBaseUrlFromSettings(syncSettings);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": user.id,
      "x-user-email": user.email,
    };
    if (user.platformRole) {
      headers["x-platform-role"] = user.platformRole;
    }
    if (syncSettings?.sync_token?.trim()) {
      headers.Authorization = `Bearer ${syncSettings.sync_token.trim()}`;
    }

    try {
      const loadWorkspaces = async () => {
        const response = await fetch(`${baseUrl}/v1/control/workspaces`, {
          method: "GET",
          headers,
        });
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as ControlWorkspace[];
      };

      let workspaces = await loadWorkspaces();
      if (!workspaces) {
        return hasExplicitConfig
          ? user
          : hydrateUserFromSelfHostedSubscriptions(user);
      }

      if (workspaces.length === 0) {
        await fetch(`${baseUrl}/v1/control/workspaces`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: user.email,
            mode: "personal",
          }),
        }).catch(() => null);
        workspaces = await loadWorkspaces();
      }

      if (!workspaces || workspaces.length === 0) {
        const emptyWorkspaceUser: CloudUser = {
          ...user,
          teamRole: undefined,
          workspaceSeeds: [],
        };
        return hasExplicitConfig
          ? emptyWorkspaceUser
          : hydrateUserFromSelfHostedSubscriptions(emptyWorkspaceUser);
      }

      const details = await Promise.all(
        workspaces.map(async (workspace) => {
          const [membersResponse, overviewResponse, billingResponse] =
            await Promise.all([
              fetch(`${baseUrl}/v1/control/workspaces/${workspace.id}/members`, {
                method: "GET",
                headers,
              }),
              fetch(
                `${baseUrl}/v1/control/workspaces/${workspace.id}/overview`,
                {
                  method: "GET",
                  headers,
                },
              ),
              fetch(
                `${baseUrl}/v1/control/workspaces/${workspace.id}/billing/state`,
                {
                  method: "GET",
                  headers,
                },
              ),
            ]);

          const members = membersResponse.ok
            ? ((await membersResponse.json()) as ControlMembership[])
            : [];
          const overview = overviewResponse.ok
            ? ((await overviewResponse.json()) as ControlWorkspaceOverview)
            : null;
          const billingState = billingResponse.ok
            ? ((await billingResponse.json()) as ControlWorkspaceBillingState)
            : null;
          const membership = members.find(
            (member) =>
              member.userId === user.id ||
              member.email.toLowerCase() === user.email.toLowerCase(),
          );
          return {
            workspace,
            membership,
            overview,
            billingState,
          };
        }),
      );

      const workspaceSeeds = details.map((item) => {
        const billingSubscription = item.billingState?.subscription ?? null;
        const planLabel =
          item.workspace.planLabel ??
          billingSubscription?.planLabel ??
          (item.workspace.mode === "personal" ? "Free" : "Starter");
        return {
          id: item.workspace.id,
          name: resolveWorkspaceName({
            name: item.workspace.name,
            mode: item.workspace.mode,
            userEmail: user.email,
          }),
          mode: item.workspace.mode,
          role: item.membership?.role ?? "member",
          members: item.overview?.members ?? 0,
          activeInvites: item.overview?.activeInvites ?? 0,
          activeShareGrants: item.overview?.activeShareGrants ?? 0,
          entitlementState: item.overview?.entitlementState ?? "active",
          profileLimit:
            typeof item.workspace.profileLimit === "number"
              ? item.workspace.profileLimit
              : typeof billingSubscription?.profileLimit === "number"
                ? billingSubscription.profileLimit
                : deriveProfileLimitFromPlanLabel(planLabel, item.workspace.mode),
          profilesUsed: 0,
          planLabel,
          expiresAt:
            item.workspace.expiresAt ?? billingSubscription?.expiresAt ?? null,
        };
      });

      const teamDetail =
        details.find(
          (item) =>
            item.workspace.mode === "team" &&
            (item.membership?.role === "owner" ||
              item.membership?.role === "admin" ||
              item.membership?.role === "member" ||
              item.membership?.role === "viewer"),
        ) ??
        details.find((item) => item.workspace.mode === "team") ??
        null;

      const teamMembership = details.find(
        (item) => item.workspace.id === teamDetail?.workspace.id,
      )?.membership;
      const teamRole = normalizeTeamRole(teamMembership?.role) ?? undefined;
      const personalDetail =
        details.find((item) => item.workspace.mode === "personal") ?? null;
      const primaryDetail = teamDetail ?? personalDetail ?? details[0] ?? null;
      const primaryPlanLabel =
        primaryDetail?.workspace.planLabel ??
        primaryDetail?.billingState?.subscription.planLabel ??
        "Free";
      const primaryPlanPeriod =
        primaryDetail?.workspace.billingCycle ??
        primaryDetail?.billingState?.subscription.billingCycle ??
        null;
      const primarySubscriptionStatus =
        primaryDetail?.workspace.subscriptionStatus ??
        primaryDetail?.billingState?.subscription.status ??
        "active";
      const primaryProfileLimit =
        typeof primaryDetail?.workspace.profileLimit === "number"
          ? primaryDetail.workspace.profileLimit
          : typeof primaryDetail?.billingState?.subscription.profileLimit ===
                "number"
            ? primaryDetail.billingState.subscription.profileLimit
            : user.profileLimit;
      const normalizedPlanId =
        primaryDetail?.billingState?.subscription.planId ??
        normalizePlanIdFromLabel(primaryPlanLabel) ??
        "free";

      return {
        ...user,
        plan: normalizedPlanId,
        planPeriod: primaryPlanPeriod,
        subscriptionStatus: primarySubscriptionStatus,
        profileLimit: primaryProfileLimit,
        teamId: teamDetail?.workspace.id,
        teamName: teamDetail?.workspace.name,
        teamRole,
        workspaceSeeds,
      };
    } catch {
      return hasExplicitConfig
        ? user
        : hydrateUserFromSelfHostedSubscriptions(user);
    }
  }, []);

  const resolveControlBaseUrl = useCallback(async (): Promise<string> => {
    let syncSettings: SyncSettings | null = null;
    try {
      syncSettings = await invoke<SyncSettings>("get_sync_settings");
    } catch {
      syncSettings = null;
    }
    return resolveControlBaseUrlFromSettings(syncSettings).baseUrl;
  }, []);

  const requestControlPublicAuth = useCallback(
    async (
      route: "register" | "login",
      payload: { email: string; password: string },
    ): Promise<PublicAuthResponse> => {
      const baseUrl = await resolveControlBaseUrl();
      let response: Response;
      try {
        response = await fetch(`${baseUrl}/v1/control/public/auth/${route}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch {
        throw new Error("control_auth_unreachable");
      }
      if (!response.ok) {
        throw new Error(await parseHttpError(response));
      }
      const parsed = (await response.json()) as PublicAuthResponse;
      if (!parsed?.user?.id || !parsed.user.email) {
        throw new Error("invalid_auth_response");
      }
      return parsed;
    },
    [resolveControlBaseUrl],
  );

  const buildAuthStateFromPublicUser = useCallback(
    async (
      publicUser: PublicAuthUser,
      options?: {
        scope?: AuthLoginScope;
        name?: string;
        avatar?: string;
      },
    ): Promise<CloudAuthState> => {
      const normalizedEmail = normalizeEmail(publicUser.email);
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("invalid_auth_response");
      }
      const seedUser: CloudUser = {
        ...defaultLocalUser(
          normalizedEmail,
          options?.scope,
          options?.name,
          options?.avatar,
        ),
        id: publicUser.id,
        email: normalizedEmail,
        platformRole:
          publicUser.platformRole === "platform_admin"
            ? "platform_admin"
            : undefined,
      };
      const baseState: CloudAuthState = {
        user: seedUser,
        logged_in_at: new Date().toISOString(),
      };
      updateAuthState(baseState);

      const enrichedUser = await enrichUserFromControlPlane(seedUser);
      const finalState: CloudAuthState = {
        ...baseState,
        user: {
          ...enrichedUser,
          id: publicUser.id,
          email: normalizedEmail,
          platformRole:
            publicUser.platformRole === "platform_admin"
              ? "platform_admin"
              : enrichedUser.platformRole,
        },
      };
      updateAuthState(finalState);
      void emit("cloud-auth-changed");
      return finalState;
    },
    [enrichUserFromControlPlane, updateAuthState],
  );

  const registerWithEmail = useCallback(
    async (
      email: string,
      password: string,
      options?: {
        name?: string;
        avatar?: string;
      },
    ): Promise<CloudAuthState> => {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("invalid_email");
      }
      const normalizedPassword = requirePassword(password);
      try {
        const response = await requestControlPublicAuth("register", {
          email: normalizedEmail,
          password: normalizedPassword,
        });
        return buildAuthStateFromPublicUser(response.user, {
          name: options?.name,
          avatar: options?.avatar,
        });
      } catch (error) {
        const message = extractRootError(error);
        if (
          message.includes("control_auth_unreachable") &&
          supportsLocalDevAuthFallback(normalizedEmail)
        ) {
          return buildAuthStateFromPublicUser(
            {
              id: deriveLocalUserId(normalizedEmail),
              email: normalizedEmail,
              platformRole: resolveLocalDevPlatformRole(normalizedEmail),
            },
            {
              name: options?.name,
              avatar: options?.avatar,
            },
          );
        }
        throw error;
      }
    },
    [buildAuthStateFromPublicUser, requestControlPublicAuth],
  );

  const loginWithEmail = useCallback(
    async (
      email: string,
      options?: {
        scope?: AuthLoginScope;
        allowUnassigned?: boolean;
        name?: string;
        avatar?: string;
        password?: string;
        authProvider?: "password" | "google_oauth";
      },
    ): Promise<CloudAuthState> => {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("invalid_email");
      }

      if (options?.authProvider === "google_oauth") {
        return buildAuthStateFromPublicUser(
          {
            id: deriveLocalUserId(normalizedEmail),
            email: normalizedEmail,
            platformRole: resolveLocalDevPlatformRole(
              normalizedEmail,
              options?.scope,
            ),
          },
          {
            scope: options?.scope,
            name: options?.name,
            avatar: options?.avatar,
          },
        );
      }

      const normalizedPassword = requirePassword(options?.password);
      try {
        const response = await requestControlPublicAuth("login", {
          email: normalizedEmail,
          password: normalizedPassword,
        });
        return buildAuthStateFromPublicUser(response.user, {
          scope: options?.scope,
          name: options?.name,
          avatar: options?.avatar,
        });
      } catch (error) {
        const message = extractRootError(error);
        if (
          message.includes("control_auth_unreachable") &&
          supportsLocalDevAuthFallback(normalizedEmail)
        ) {
          return buildAuthStateFromPublicUser(
            {
              id: deriveLocalUserId(normalizedEmail),
              email: normalizedEmail,
              platformRole: resolveLocalDevPlatformRole(
                normalizedEmail,
                options?.scope,
              ),
            },
            {
              scope: options?.scope,
              name: options?.name,
              avatar: options?.avatar,
            },
          );
        }
        throw error;
      }
    },
    [buildAuthStateFromPublicUser, requestControlPublicAuth],
  );

  const loadUser = useCallback(async () => {
    try {
      const state = await invoke<CloudAuthState | null>("cloud_get_user");
      if (state) {
        updateAuthState(state);
        return;
      }

      const localState = readLocalAuthState();
      if (!localState) {
        updateAuthState(null);
        return;
      }

      const refreshedUser = await enrichUserFromControlPlane(localState.user);
      updateAuthState({
        ...localState,
        user: refreshedUser,
      });
    } catch {
      const localState = readLocalAuthState();
      updateAuthState(localState);
    } finally {
      setIsLoading(false);
    }
  }, [enrichUserFromControlPlane, updateAuthState]);

  useEffect(() => {
    void loadUser();

    const unlistenExpired = listen("cloud-auth-expired", () => {
      updateAuthState(null);
    });

    const unlistenChanged = listen("cloud-auth-changed", () => {
      void loadUser();
    });

    return () => {
      void unlistenExpired.then((unlisten) => {
        unlisten();
      });
      void unlistenChanged.then((unlisten) => {
        unlisten();
      });
    };
  }, [loadUser, updateAuthState]);

  const requestOtp = useCallback(async (email: string): Promise<string> => {
    try {
      return await invoke<string>("cloud_request_otp", { email });
    } catch (error) {
      if (isCloudAuthDisabledError(error)) {
        return "self_hosted_no_otp";
      }
      throw error;
    }
  }, []);

  const verifyOtp = useCallback(
    async (email: string, code: string): Promise<CloudAuthState> => {
      try {
        const state = await invoke<CloudAuthState>("cloud_verify_otp", {
          email,
          code,
        });
        updateAuthState(state);
        return state;
      } catch (error) {
        if (!isCloudAuthDisabledError(error)) {
          throw error;
        }
        throw new Error("password_login_required");
      }
    },
    [updateAuthState],
  );

  const logout = useCallback(async () => {
    try {
      await invoke("cloud_logout");
    } catch {
      // Ignore command failures in self-hosted mode.
    }
    updateAuthState(null);
    setIsLoading(false);
  }, [updateAuthState]);

  const refreshProfile = useCallback(async (): Promise<CloudUser> => {
    try {
      const user = normalizeUser(
        await invoke<CloudUser>("cloud_refresh_profile"),
      );
      const nextState = {
        user,
        logged_in_at: authState?.logged_in_at ?? new Date().toISOString(),
      };
      updateAuthState(nextState);
      return user;
    } catch (error) {
      if (!isCloudAuthDisabledError(error)) {
        throw error;
      }
      if (!authState) {
        throw new Error("not_logged_in");
      }
      const enrichedUser = await enrichUserFromControlPlane(authState.user);
      const nextState = {
        ...authState,
        user: enrichedUser,
      };
      updateAuthState(nextState);
      return enrichedUser;
    }
  }, [authState, enrichUserFromControlPlane, normalizeUser, updateAuthState]);

  const updateLocalSubscription = useCallback(
    async (input: {
      planId: BillingPlanId;
      billingCycle: BillingCycle;
      profileLimit: number;
      planLabel: string;
      workspaceId?: string | null;
    }): Promise<CloudUser> => {
      if (!authState?.user) {
        throw new Error("not_logged_in");
      }

      const currentUser = authState.user;
      const workspaceSeeds = currentUser.workspaceSeeds ?? [];
      const targetWorkspaceId =
        input.workspaceId?.trim() ||
        currentUser.teamId ||
        workspaceSeeds.find((workspace) => workspace.mode === "team")?.id ||
        "personal";
      const targetWorkspace =
        workspaceSeeds.find(
          (workspace) => workspace.id === targetWorkspaceId,
        ) ?? null;
      const now = Date.now();
      const expiresAt = new Date(
        now +
          (input.billingCycle === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000,
      ).toISOString();
      const matchedPlan =
        BILLING_PLAN_DEFINITIONS.find((plan) => plan.id === input.planId) ??
        null;
      const derivedProxyBandwidthLimitMb = matchedPlan
        ? Math.max(0, Math.round(matchedPlan.proxyGb * 1024))
        : currentUser.proxyBandwidthLimitMb;
      const normalizedWorkspaceSeeds = workspaceSeeds.map((workspace) => ({
        ...workspace,
        planLabel:
          workspace.id === targetWorkspaceId
            ? input.planLabel
            : workspace.planLabel,
        profileLimit:
          workspace.id === targetWorkspaceId
            ? input.profileLimit
            : workspace.profileLimit,
        entitlementState:
          workspace.id === targetWorkspaceId
            ? "active"
            : workspace.entitlementState,
        expiresAt:
          workspace.id === targetWorkspaceId ? expiresAt : workspace.expiresAt,
      }));
      const shouldUpdateGlobalPlan =
        !targetWorkspace ||
        targetWorkspaceId === currentUser.teamId ||
        (!currentUser.teamId && targetWorkspace.mode === "team");

      const nextUser = normalizeUser({
        ...currentUser,
        plan: shouldUpdateGlobalPlan ? input.planId : currentUser.plan,
        planPeriod: shouldUpdateGlobalPlan
          ? input.billingCycle
          : currentUser.planPeriod,
        subscriptionStatus: "active",
        profileLimit: shouldUpdateGlobalPlan
          ? input.profileLimit
          : currentUser.profileLimit,
        proxyBandwidthLimitMb: shouldUpdateGlobalPlan
          ? derivedProxyBandwidthLimitMb
          : currentUser.proxyBandwidthLimitMb,
        proxyBandwidthUsedMb: shouldUpdateGlobalPlan
          ? Math.min(
              currentUser.proxyBandwidthUsedMb,
              derivedProxyBandwidthLimitMb,
            )
          : currentUser.proxyBandwidthUsedMb,
        workspaceSeeds: normalizedWorkspaceSeeds,
      });

      const nextState: CloudAuthState = {
        ...authState,
        user: nextUser,
      };
      updateAuthState(nextState);
      void emit("cloud-auth-changed");
      return nextUser;
    },
    [authState, normalizeUser, updateAuthState],
  );

  return {
    user: authState?.user ?? null,
    isLoggedIn: authState !== null,
    isLoading,
    registerWithEmail,
    loginWithEmail,
    requestOtp,
    verifyOtp,
    logout,
    refreshProfile,
    updateLocalSubscription,
  };
}
