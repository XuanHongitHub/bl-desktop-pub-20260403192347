import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthLoginScope } from "@/lib/auth-quick-presets";
import {
  BILLING_PLAN_DEFINITIONS,
  type BillingCycle,
  type BillingPlanId,
} from "@/lib/billing-plans";
import { extractRootError } from "@/lib/error-utils";
import { invokeCached } from "@/lib/ipc-query-cache";
import { normalizeTeamRole } from "@/lib/team-permissions";
import { normalizePlanIdFromLabel } from "@/lib/workspace-billing-logic";
import { buildControlApiUrl } from "@/lib/control-api-routes";
import type {
  CloudAuthState,
  CloudUser,
  ControlWorkspace,
} from "@/types";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface PublicAuthUser {
  id: string;
  email: string;
  platformRole?: "platform_admin" | null;
}

interface PublicAuthResponse {
  user: PublicAuthUser;
}

interface ControlAuthProfileResponse {
  id: string;
  email: string;
  platformRole?: "platform_admin" | null;
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

const AUTH_STATE_PERSIST_DEDUP_WINDOW_MS = 30_000;
const CONTROL_ENRICH_CACHE_TTL_MS = 600_000;
const SYNC_SETTINGS_CACHE_TTL_MS = 30_000;

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

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
}

function getLocalDevControlBaseUrlCandidates(): string[] {
  const candidates = [
    "http://127.0.0.1:12342",
    "http://localhost:12342",
    "http://127.0.0.1:3929",
    "http://localhost:3929",
  ];
  return Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeBaseUrl(candidate))
        .filter((candidate): candidate is string => Boolean(candidate)),
    ),
  );
}

function resolveControlBaseUrlCandidatesFromSettings(
  settings?: SyncSettings | null,
): string[] {
  const configuredBaseUrl = normalizeBaseUrl(settings?.sync_server_url);
  const envBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SYNC_SERVER_URL);
  if (process.env.NODE_ENV !== "production") {
    return Array.from(
      new Set(
        [envBaseUrl, configuredBaseUrl, ...getLocalDevControlBaseUrlCandidates()]
          .filter((candidate): candidate is string => Boolean(candidate)),
      ),
    );
  }

  if (configuredBaseUrl) {
    return [configuredBaseUrl];
  }

  if (envBaseUrl) {
    return [envBaseUrl];
  }

  return [];
}

function resolveControlTokenFromSettings(
  settings?: SyncSettings | null,
): string | null {
  const configuredToken = settings?.sync_token?.trim();
  const envToken = process.env.NEXT_PUBLIC_SYNC_TOKEN?.trim();

  if (process.env.NODE_ENV !== "production") {
    if (envToken && envToken.length > 0) {
      return envToken;
    }
    if (configuredToken && configuredToken.length > 0) {
      return configuredToken;
    }
    return null;
  }

  if (configuredToken && configuredToken.length > 0) {
    return configuredToken;
  }

  return null;
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

function writeLocalAuthState(state: CloudAuthState | null) {
  void state;
}

function buildAuthPersistSignature(state: CloudAuthState): string {
  const seeds = (state.user.workspaceSeeds ?? [])
    .map((seed) => ({
      id: seed.id,
      mode: seed.mode,
      role: seed.role ?? null,
      planLabel: seed.planLabel ?? null,
      entitlementState: seed.entitlementState ?? null,
      profileLimit: seed.profileLimit ?? null,
      expiresAt: seed.expiresAt ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));

  return JSON.stringify({
    user: {
      id: state.user.id,
      email: state.user.email,
      plan: state.user.plan ?? null,
      planPeriod: state.user.planPeriod ?? null,
      subscriptionStatus: state.user.subscriptionStatus ?? null,
      profileLimit: state.user.profileLimit ?? null,
      teamId: state.user.teamId ?? null,
      teamRole: state.user.teamRole ?? null,
      teamName: state.user.teamName ?? null,
      platformRole: state.user.platformRole ?? null,
      workspaceSeeds: seeds,
    },
  });
}

function areAuthStatesEqual(
  left: CloudAuthState | null,
  right: CloudAuthState | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
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
  const suppressAuthChangedEventUntilRef = useRef(0);
  const loadUserInFlightRef = useRef<Promise<void> | null>(null);
  const lastLoadTriggeredAtRef = useRef(0);
  const lastEnrichedAtRef = useRef(0);
  const lastEnrichedUserIdRef = useRef<string | null>(null);
  const lastPersistedAuthStateSignatureRef = useRef("");
  const lastPersistedAuthStateAtRef = useRef(0);
  const enrichUserCacheRef = useRef<{
    key: string;
    expiresAt: number;
    user: CloudUser;
  } | null>(null);
  const enrichUserInFlightRef = useRef<Map<string, Promise<CloudUser>>>(
    new Map(),
  );

  const resetEnrichCaches = useCallback(() => {
    enrichUserCacheRef.current = null;
    enrichUserInFlightRef.current.clear();
    lastEnrichedAtRef.current = 0;
    lastEnrichedUserIdRef.current = null;
  }, []);

  const normalizeUser = useCallback((user: CloudUser): CloudUser => {
    const normalizedRole = normalizeTeamRole(user.teamRole);
    const normalizedWorkspaceSeeds = user.workspaceSeeds?.map(
      normalizeWorkspaceSeedDisplayName,
    );
    return {
      ...user,
      teamRole: normalizedRole ?? undefined,
      platformRole:
        user.platformRole === "platform_admin" ? "platform_admin" : undefined,
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
      setAuthState((current) => {
        if (areAuthStatesEqual(current, normalizedState)) {
          return current;
        }
        writeLocalAuthState(normalizedState);
        return normalizedState;
      });
    },
    [normalizeUser],
  );

  const persistSelfHostAuthState = useCallback(async (state: CloudAuthState) => {
    const signature = buildAuthPersistSignature(state);
    const now = Date.now();
    if (
      signature === lastPersistedAuthStateSignatureRef.current &&
      now - lastPersistedAuthStateAtRef.current <
        AUTH_STATE_PERSIST_DEDUP_WINDOW_MS
    ) {
      return;
    }
    suppressAuthChangedEventUntilRef.current = now + 1200;
    await invoke("cloud_set_self_host_auth_state", { state });
    lastPersistedAuthStateSignatureRef.current = signature;
    lastPersistedAuthStateAtRef.current = Date.now();
  }, []);

  const enrichUserFromControlPlane = useCallback(async (user: CloudUser) => {
    const cacheKey = `${user.id}::${user.email}::${user.platformRole ?? "-"}`;
    const cached = enrichUserCacheRef.current;
    if (
      cached &&
      cached.key === cacheKey &&
      cached.expiresAt > Date.now()
    ) {
      return cached.user;
    }
    const inFlight = enrichUserInFlightRef.current.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const task = (async (): Promise<CloudUser> => {
    let syncSettings: SyncSettings | null = null;
      try {
      syncSettings = await invokeCached<SyncSettings>(
        "get_sync_settings",
        undefined,
        {
          key: "get_sync_settings",
          ttlMs: SYNC_SETTINGS_CACHE_TTL_MS,
        },
      );
    } catch {
      syncSettings = null;
    }

    const baseUrls = resolveControlBaseUrlCandidatesFromSettings(syncSettings);
    if (baseUrls.length === 0) {
      return user;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-user-id": user.id,
      "x-user-email": user.email,
    };
    if (user.platformRole) {
      headers["x-platform-role"] = user.platformRole;
    }
    const controlToken = resolveControlTokenFromSettings(syncSettings);
    if (controlToken) {
      headers.Authorization = `Bearer ${controlToken}`;
    }

    const enrichFromBaseUrl = async (baseUrl: string): Promise<CloudUser | null> => {
      const actorResponse = await fetch(buildControlApiUrl(baseUrl, "authMe"), {
        method: "GET",
        headers,
      }).catch(() => null);
      const actorProfile = actorResponse?.ok
        ? ((await actorResponse.json()) as ControlAuthProfileResponse)
        : null;
      const effectiveHeaders =
        actorProfile?.platformRole === "platform_admin"
          ? {
              ...headers,
              "x-platform-role": "platform_admin",
            }
          : headers;

      const loadWorkspaces = async () => {
        const response = await fetch(
          buildControlApiUrl(baseUrl, "workspaces", { scope: "member" }),
          {
          method: "GET",
          headers: effectiveHeaders,
          },
        );
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as ControlWorkspace[];
      };

      let workspaces = await loadWorkspaces();
      if (!workspaces) {
        return null;
      }

      if (workspaces.length === 0) {
        await fetch(buildControlApiUrl(baseUrl, "workspaces"), {
          method: "POST",
          headers: effectiveHeaders,
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
          platformRole:
            actorProfile?.platformRole === "platform_admin"
              ? "platform_admin"
              : user.platformRole,
          teamRole: undefined,
          workspaceSeeds: [],
        };
        return emptyWorkspaceUser;
      }

      const workspaceSeeds: NonNullable<CloudUser["workspaceSeeds"]> =
        workspaces.map((workspace) => {
        const planLabel =
          workspace.planLabel ??
          (workspace.mode === "personal" ? "Free" : "Starter");
        const apiWorkspaceRole = normalizeTeamRole(workspace.actorRole ?? null);
        const inferredRole =
          apiWorkspaceRole ??
          (workspace.mode === "personal"
            ? "owner"
            : workspace.id === user.teamId
              ? (normalizeTeamRole(user.teamRole) ?? "member")
              : "member");
        return {
          id: workspace.id,
          name: resolveWorkspaceName({
            name: workspace.name,
            mode: workspace.mode,
            userEmail: user.email,
          }),
          mode: workspace.mode,
          role: inferredRole,
          members: 0,
          activeInvites: 0,
          activeShareGrants: 0,
          entitlementState: "active",
          profileLimit:
            typeof workspace.profileLimit === "number"
              ? workspace.profileLimit
              : deriveProfileLimitFromPlanLabel(planLabel, workspace.mode),
          profilesUsed: 0,
          planLabel,
          expiresAt: workspace.expiresAt ?? null,
        };
      });

      const teamDetail =
        workspaces.find((workspace) => workspace.id === user.teamId) ??
        workspaces.find((workspace) => workspace.mode === "team") ??
        null;
      const teamRole = normalizeTeamRole(user.teamRole) ?? undefined;
      const personalDetail =
        workspaces.find((workspace) => workspace.mode === "personal") ?? null;
      const primaryDetail = teamDetail ?? personalDetail ?? workspaces[0] ?? null;
      const primaryPlanLabel =
        primaryDetail?.planLabel ??
        "Free";
      const primaryPlanPeriod =
        primaryDetail?.billingCycle ??
        null;
      const primarySubscriptionStatus =
        primaryDetail?.subscriptionStatus ??
        "active";
      const primaryProfileLimit =
        typeof primaryDetail?.profileLimit === "number"
          ? primaryDetail.profileLimit
            : user.profileLimit;
      const normalizedPlanId =
        normalizePlanIdFromLabel(primaryPlanLabel) ??
        "free";

      return {
        ...user,
        platformRole:
          actorProfile?.platformRole === "platform_admin"
            ? "platform_admin"
            : user.platformRole,
        plan: normalizedPlanId,
        planPeriod: primaryPlanPeriod,
        subscriptionStatus: primarySubscriptionStatus,
        profileLimit: primaryProfileLimit,
        teamId: teamDetail?.id,
        teamName: teamDetail?.name,
        teamRole,
        workspaceSeeds,
      };
    };

    for (const baseUrl of baseUrls) {
      try {
        const enriched = await enrichFromBaseUrl(baseUrl);
        if (enriched) {
          enrichUserCacheRef.current = {
            key: cacheKey,
            expiresAt: Date.now() + CONTROL_ENRICH_CACHE_TTL_MS,
            user: enriched,
          };
          return enriched;
        }
      } catch {
        // Try next candidate URL in self-host local dev fallback list.
      }
    }

    enrichUserCacheRef.current = {
      key: cacheKey,
      expiresAt: Date.now() + CONTROL_ENRICH_CACHE_TTL_MS,
      user,
    };
    return user;
    })();

    enrichUserInFlightRef.current.set(cacheKey, task);
    try {
      return await task;
    } finally {
      enrichUserInFlightRef.current.delete(cacheKey);
    }
  }, []);

  const requestControlPublicAuth = useCallback(
    async (
      route: "register" | "login" | "google",
      payload: {
        email: string;
        password?: string;
        name?: string;
        avatar?: string;
      },
    ): Promise<PublicAuthResponse> => {
      let syncSettings: SyncSettings | null = null;
      try {
        syncSettings = await invokeCached<SyncSettings>(
          "get_sync_settings",
          undefined,
          {
            key: "get_sync_settings",
            ttlMs: SYNC_SETTINGS_CACHE_TTL_MS,
          },
        );
      } catch {
        syncSettings = null;
      }

      const baseUrls = resolveControlBaseUrlCandidatesFromSettings(syncSettings);
      if (baseUrls.length === 0) {
        throw new Error("control_auth_not_configured");
      }

      for (const baseUrl of baseUrls) {
        let response: Response;
        try {
          response = await fetch(buildControlApiUrl(baseUrl, "publicAuth", { route }), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });
        } catch {
          continue;
        }
        if (!response.ok) {
          if (response.status === 404 && baseUrls.length > 1) {
            continue;
          }
          throw new Error(await parseHttpError(response));
        }
        const parsed = (await response.json()) as PublicAuthResponse;
        if (!parsed?.user?.id || !parsed.user.email) {
          throw new Error("invalid_auth_response");
        }
        return parsed;
      }

      throw new Error("control_auth_unreachable");
    },
    [],
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
      resetEnrichCaches();
      const resolvedPlatformRole =
        publicUser.platformRole === "platform_admin" ? "platform_admin" : undefined;
      const seedUser: CloudUser = {
        ...defaultLocalUser(
          normalizedEmail,
          options?.scope,
          options?.name,
          options?.avatar,
        ),
        id: publicUser.id,
        email: normalizedEmail,
        platformRole: resolvedPlatformRole,
      };
      const enrichedUser = await enrichUserFromControlPlane(seedUser);
      const finalState: CloudAuthState = {
        logged_in_at: new Date().toISOString(),
        user: {
          ...enrichedUser,
          id: publicUser.id,
          email: normalizedEmail,
          platformRole: resolvedPlatformRole ?? enrichedUser.platformRole,
        },
      };
      try {
        await persistSelfHostAuthState(finalState);
      } catch {
        // Keep the self-host login flow usable even if the Tauri bridge is unavailable.
      }
      updateAuthState(finalState);
      return finalState;
    },
    [
      enrichUserFromControlPlane,
      persistSelfHostAuthState,
      resetEnrichCaches,
      updateAuthState,
    ],
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
      const response = await requestControlPublicAuth("register", {
        email: normalizedEmail,
        password: normalizedPassword,
      });
      return buildAuthStateFromPublicUser(response.user, {
        name: options?.name,
        avatar: options?.avatar,
      });
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
        const response = await requestControlPublicAuth("google", {
          email: normalizedEmail,
          name: options?.name,
          avatar: options?.avatar,
        });
        return buildAuthStateFromPublicUser(response.user, {
          scope: options?.scope,
          name: options?.name,
          avatar: options?.avatar,
        });
      }

      const normalizedPassword = requirePassword(options?.password);
      const response = await requestControlPublicAuth("login", {
        email: normalizedEmail,
        password: normalizedPassword,
      });
      return buildAuthStateFromPublicUser(response.user, {
        scope: options?.scope,
        name: options?.name,
        avatar: options?.avatar,
      });
    },
    [buildAuthStateFromPublicUser, requestControlPublicAuth],
  );

  const loadUser = useCallback(async () => {
    if (loadUserInFlightRef.current) {
      await loadUserInFlightRef.current;
      return;
    }

    const task = (async () => {
      try {
        const state = await invoke<CloudAuthState | null>("cloud_get_user");
        if (state) {
          const normalizedState = {
            ...state,
            user: normalizeUser(state.user),
          };
          updateAuthState(normalizedState);
          const hasPersistedWorkspaceSeeds =
            Array.isArray(normalizedState.user.workspaceSeeds) &&
            normalizedState.user.workspaceSeeds.length > 0;
          const now = Date.now();
          const shouldEnrich =
            !hasPersistedWorkspaceSeeds &&
            (lastEnrichedUserIdRef.current !== normalizedState.user.id ||
              now - lastEnrichedAtRef.current >= CONTROL_ENRICH_CACHE_TTL_MS);
          if (hasPersistedWorkspaceSeeds) {
            lastEnrichedAtRef.current = now;
            lastEnrichedUserIdRef.current = normalizedState.user.id;
          }
          if (!shouldEnrich) {
            return;
          }
          const enrichedUser = await enrichUserFromControlPlane(
            normalizedState.user,
          );
          const nextState: CloudAuthState = {
            ...normalizedState,
            user: enrichedUser,
          };
          if (!areAuthStatesEqual(normalizedState, nextState)) {
            try {
              await persistSelfHostAuthState(nextState);
            } catch {
              // Keep boot usable even if the Tauri bridge write-back is unavailable.
            }
          }
          updateAuthState(nextState);
          lastEnrichedAtRef.current = Date.now();
          lastEnrichedUserIdRef.current = normalizedState.user.id;
          return;
        }
        resetEnrichCaches();
        updateAuthState(null);
      } catch {
        resetEnrichCaches();
        updateAuthState(null);
      } finally {
        setIsLoading(false);
      }
    })();

    loadUserInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (loadUserInFlightRef.current === task) {
        loadUserInFlightRef.current = null;
      }
    }
  }, [
    enrichUserFromControlPlane,
    normalizeUser,
    persistSelfHostAuthState,
    resetEnrichCaches,
    updateAuthState,
  ]);
  const loadUserRef = useRef(loadUser);
  const updateAuthStateRef = useRef(updateAuthState);

  useEffect(() => {
    loadUserRef.current = loadUser;
  }, [loadUser]);

  useEffect(() => {
    updateAuthStateRef.current = updateAuthState;
  }, [updateAuthState]);

  useEffect(() => {
    void loadUserRef.current();

    if (!isTauri()) {
      return;
    }

    const unlistenExpired = listen("cloud-auth-expired", () => {
      resetEnrichCaches();
      updateAuthStateRef.current(null);
    });

    const unlistenChanged = listen("cloud-auth-changed", () => {
      if (Date.now() < suppressAuthChangedEventUntilRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastLoadTriggeredAtRef.current < 120_000) {
        return;
      }
      lastLoadTriggeredAtRef.current = now;
      void loadUserRef.current();
    });

    return () => {
      void unlistenExpired.then((unlisten) => {
        unlisten();
      });
      void unlistenChanged.then((unlisten) => {
        unlisten();
      });
    };
  }, [resetEnrichCaches]);

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
    resetEnrichCaches();
    updateAuthState(null);
    setIsLoading(false);
  }, [resetEnrichCaches, updateAuthState]);

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
      if (!areAuthStatesEqual(authState, nextState)) {
        try {
          await persistSelfHostAuthState(nextState);
        } catch {
          // Keep self-host profile refresh usable even if state write-back fails.
        }
      }
      updateAuthState(nextState);
      return enrichedUser;
    }
  }, [
    authState,
    enrichUserFromControlPlane,
    normalizeUser,
    persistSelfHostAuthState,
    updateAuthState,
  ]);

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
