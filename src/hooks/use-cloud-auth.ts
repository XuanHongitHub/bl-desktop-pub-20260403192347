import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import { normalizeTeamRole } from "@/lib/team-permissions";
import type {
  CloudAuthState,
  CloudUser,
  ControlMembership,
  ControlWorkspace,
  TeamRole,
} from "@/types";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

type LoginScope = "workspace_user" | "platform_admin";

interface UseCloudAuthReturn {
  user: CloudUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  loginWithEmail: (
    email: string,
    options?: {
      scope?: LoginScope;
      allowUnassigned?: boolean;
    },
  ) => Promise<CloudAuthState>;
  requestOtp: (email: string) => Promise<string>;
  verifyOtp: (email: string, code: string) => Promise<CloudAuthState>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<CloudUser>;
}

const LOCAL_AUTH_STORAGE_KEY = "buglogin.auth.local-session.v1";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
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
  scope: LoginScope = "workspace_user",
): CloudUser {
  return {
    id: deriveLocalUserId(normalizedEmail),
    email: normalizedEmail,
    plan: "self_hosted",
    planPeriod: null,
    subscriptionStatus: "active",
    profileLimit: 0,
    cloudProfilesUsed: 0,
    proxyBandwidthLimitMb: 0,
    proxyBandwidthUsedMb: 0,
    proxyBandwidthExtraMb: 0,
    teamRole: undefined,
    platformRole: scope === "platform_admin" ? "platform_admin" : undefined,
  };
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

export function useCloudAuth(): UseCloudAuthReturn {
  const [authState, setAuthState] = useState<CloudAuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const normalizeUser = useCallback((user: CloudUser): CloudUser => {
    const normalizedRole = normalizeTeamRole(user.teamRole);
    return {
      ...user,
      teamRole: normalizedRole ?? undefined,
    };
  }, []);

  const updateAuthState = useCallback(
    (state: CloudAuthState | null) => {
      setAuthState(
        state
          ? {
              ...state,
              user: normalizeUser(state.user),
            }
          : null,
      );
      writeLocalAuthState(state);
    },
    [normalizeUser],
  );

  const enrichUserFromControlPlane = useCallback(async (user: CloudUser) => {
    let syncSettings: SyncSettings | null = null;
    try {
      syncSettings = await invoke<SyncSettings>("get_sync_settings");
    } catch {
      return user;
    }

    const baseUrl = normalizeBaseUrl(syncSettings.sync_server_url);
    if (!baseUrl) {
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
    if (syncSettings.sync_token?.trim()) {
      headers.Authorization = `Bearer ${syncSettings.sync_token.trim()}`;
    }

    try {
      const workspacesResponse = await fetch(`${baseUrl}/v1/control/workspaces`, {
        method: "GET",
        headers,
      });
      if (!workspacesResponse.ok) {
        return user;
      }

      const workspaces = (await workspacesResponse.json()) as ControlWorkspace[];
      if (!Array.isArray(workspaces) || workspaces.length === 0) {
        return {
          ...user,
          teamRole: undefined,
        };
      }

      let detectedRole: TeamRole | null = null;
      for (const workspace of workspaces.slice(0, 5)) {
        const membersResponse = await fetch(
          `${baseUrl}/v1/control/workspaces/${workspace.id}/members`,
          {
            method: "GET",
            headers,
          },
        );
        if (!membersResponse.ok) {
          continue;
        }
        const members = (await membersResponse.json()) as ControlMembership[];
        const membership = members.find(
          (member) =>
            member.userId === user.id || member.email.toLowerCase() === user.email,
        );
        if (membership) {
          detectedRole = membership.role;
          break;
        }
      }

      return {
        ...user,
        teamRole: normalizeTeamRole(detectedRole) ?? undefined,
      };
    } catch {
      return user;
    }
  }, []);

  const loginWithEmail = useCallback(
    async (
      email: string,
      options?: {
        scope?: LoginScope;
        allowUnassigned?: boolean;
      },
    ): Promise<CloudAuthState> => {
      const normalizedEmail = normalizeEmail(email);
      if (!isValidEmail(normalizedEmail)) {
        throw new Error("invalid_email");
      }

      const localUser = defaultLocalUser(normalizedEmail, options?.scope);
      const baseState: CloudAuthState = {
        user: localUser,
        logged_in_at: new Date().toISOString(),
      };
      updateAuthState(baseState);

      const enrichedUser = await enrichUserFromControlPlane(localUser);
      const enrichedState: CloudAuthState = {
        ...baseState,
        user: enrichedUser,
      };

      const isPlatformAdmin = options?.scope === "platform_admin";
      const allowUnassigned = options?.allowUnassigned ?? false;
      if (!isPlatformAdmin && !allowUnassigned && !enrichedUser.teamRole) {
        updateAuthState(null);
        throw new Error("invite_required");
      }

      updateAuthState(enrichedState);
      return enrichedState;
    },
    [enrichUserFromControlPlane, updateAuthState],
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
        return loginWithEmail(email);
      }
    },
    [loginWithEmail, updateAuthState],
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

  return {
    user: authState?.user ?? null,
    isLoggedIn: authState !== null,
    isLoading,
    loginWithEmail,
    requestOtp,
    verifyOtp,
    logout,
    refreshProfile,
  };
}
