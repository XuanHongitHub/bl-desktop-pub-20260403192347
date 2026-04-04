"use client";

import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getAuthMeProfile,
  getWorkspaceBillingState,
  listWorkspaces,
  type WebBillingConnection,
  type WebBillingWorkspaceListItem,
} from "@/components/web-billing/control-api";
import { usePortalSessionStore } from "@/hooks/use-portal-session-store";
import {
  createPortalSessionRecord,
  mergePortalSessionCurrent,
  PORTAL_GOOGLE_STORAGE_KEY,
  readPortalSessionStorage,
  writePortalSessionStorage,
} from "@/lib/portal-session";
import { readWebBillingPortalContextFromHash } from "@/lib/web-billing-portal";
import type { ControlWorkspaceBillingState } from "@/types";

interface GooglePortalProfile {
  email?: string;
  name?: string;
  avatar?: string;
}

const PORTAL_SELECTED_WORKSPACE_STORAGE_PREFIX =
  "buglogin.portal.selected-workspace.v1";

function buildSelectedWorkspaceStorageKey(userId: string): string {
  return `${PORTAL_SELECTED_WORKSPACE_STORAGE_PREFIX}:${userId.trim()}`;
}

function readSelectedWorkspaceFromStorage(userId: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  const key = buildSelectedWorkspaceStorageKey(userId);
  return window.localStorage.getItem(key)?.trim() ?? "";
}

function writeSelectedWorkspaceToStorage(userId: string, workspaceId: string) {
  if (typeof window === "undefined") {
    return;
  }
  const key = buildSelectedWorkspaceStorageKey(userId);
  const normalized = workspaceId.trim();
  if (normalized) {
    window.localStorage.setItem(key, normalized);
    return;
  }
  window.localStorage.removeItem(key);
}

function parseGoogleProfile(raw: string | null): GooglePortalProfile | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as GooglePortalProfile;
    return parsed;
  } catch {
    return null;
  }
}

function usePortalBillingDataState() {
  const session = usePortalSessionStore();
  const authProfileRefreshKeyRef = useRef<string | null>(null);
  const [workspaces, setWorkspaces] = useState<WebBillingWorkspaceListItem[]>(
    [],
  );
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [billingState, setBillingState] =
    useState<ControlWorkspaceBillingState | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  const connection = useMemo<WebBillingConnection | null>(() => {
    const controlBaseUrl = session?.connection.controlBaseUrl?.trim() ?? "";
    const controlToken = session?.connection.controlToken?.trim() ?? "";
    const userId = session?.connection.userId?.trim() ?? "";
    const userEmail = session?.connection.userEmail?.trim() ?? "";
    const platformRole =
      session?.connection.platformRole ?? session?.user.platformRole ?? null;

    if (!controlBaseUrl || !controlToken || !userId || !userEmail) {
      return null;
    }

    return {
      controlBaseUrl,
      controlToken,
      userId,
      userEmail,
      platformRole,
    };
  }, [
    session?.connection.controlBaseUrl,
    session?.connection.controlToken,
    session?.connection.userId,
    session?.connection.userEmail,
    session?.connection.platformRole,
    session?.user.platformRole,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const context = readWebBillingPortalContextFromHash(window.location.hash);
    if (context) {
      const profile = parseGoogleProfile(
        window.sessionStorage.getItem(PORTAL_GOOGLE_STORAGE_KEY),
      );

      const record = createPortalSessionRecord({
        user: {
          id: context.userId,
          email: profile?.email?.trim() || context.userEmail,
          name: profile?.name?.trim() || null,
          avatar: profile?.avatar?.trim() || null,
          platformRole: context.platformRole ?? null,
        },
        connection: {
          controlBaseUrl: context.controlBaseUrl,
          controlToken: context.controlToken,
          userId: context.userId,
          userEmail: context.userEmail,
          platformRole: context.platformRole ?? null,
        },
      });

      writePortalSessionStorage(record);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
      return;
    }
  }, []);

  useEffect(() => {
    if (!connection || !session) {
      return;
    }

    const refreshKey = [
      connection.controlBaseUrl,
      connection.controlToken,
      connection.userId,
      connection.userEmail,
    ].join("|");
    if (authProfileRefreshKeyRef.current === refreshKey) {
      return;
    }
    authProfileRefreshKeyRef.current = refreshKey;

    let canceled = false;
    void (async () => {
      try {
        const profile = await getAuthMeProfile(connection);
        if (canceled) {
          return;
        }
        const nextRole =
          profile.platformRole === "platform_admin" ? "platform_admin" : null;
        const hasSessionChange =
          profile.id !== session.user.id ||
          profile.email !== session.user.email ||
          profile.id !== session.connection.userId ||
          profile.email !== session.connection.userEmail ||
          nextRole !== (session.user.platformRole ?? null) ||
          nextRole !== (session.connection.platformRole ?? null);
        if (!hasSessionChange) {
          return;
        }
        writePortalSessionStorage({
          ...session,
          user: {
            ...session.user,
            id: profile.id,
            email: profile.email,
            platformRole: nextRole,
          },
          connection: {
            ...session.connection,
            userId: profile.id,
            userEmail: profile.email,
            platformRole: nextRole,
          },
        });
      } catch {
        // Ignore auth profile refresh failures and keep existing session.
      }
    })();

    return () => {
      canceled = true;
    };
  }, [connection, session]);

  const loadWorkspaces = useCallback(
    async (connectionInput: WebBillingConnection) => {
      setLoadingWorkspaces(true);
      setWorkspacesError(null);
      try {
        const items = await listWorkspaces(connectionInput);
        setWorkspaces(items);

        setSelectedWorkspaceId((current) => {
          if (current && items.some((workspace) => workspace.id === current)) {
            return current;
          }

          const currentSessionInfo = typeof window !== "undefined" ? readPortalSessionStorage() : null;
          const fromSession = currentSessionInfo?.current?.workspaceId?.trim() ?? "";
          if (
            fromSession &&
            items.some((workspace) => workspace.id === fromSession)
          ) {
            return fromSession;
          }

          const fromStorage = readSelectedWorkspaceFromStorage(
            connectionInput.userId,
          );
          if (
            fromStorage &&
            items.some((workspace) => workspace.id === fromStorage)
          ) {
            return fromStorage;
          }

          if (typeof window !== "undefined") {
            const fromQuery =
              new URLSearchParams(window.location.search).get("workspaceId") ??
              "";
            const normalizedQuery = fromQuery.trim();
            if (
              normalizedQuery &&
              items.some((workspace) => workspace.id === normalizedQuery)
            ) {
              return normalizedQuery;
            }
          }

          return items[0]?.id ?? "";
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown_error";
        setWorkspaces([]);
        setSelectedWorkspaceId("");
        setWorkspacesError(message);
      } finally {
        setLoadingWorkspaces(false);
      }
    },
    [],
  );

  const loadBilling = useCallback(
    async (connectionInput: WebBillingConnection, workspaceId: string) => {
      if (!workspaceId.trim()) {
        setBillingState(null);
        setBillingError(null);
        return;
      }

      setLoadingBilling(true);
      setBillingError(null);
      try {
        const state = await getWorkspaceBillingState(
          connectionInput,
          workspaceId,
        );
        setBillingState(state);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "unknown_error";
        setBillingState(null);
        setBillingError(message);
      } finally {
        setLoadingBilling(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!connection) {
      setWorkspaces([]);
      setSelectedWorkspaceId("");
      setBillingState(null);
      setWorkspacesError(null);
      setBillingError(null);
      setLoadingWorkspaces(false);
      setLoadingBilling(false);
      return;
    }

    void loadWorkspaces(connection);
  }, [connection, loadWorkspaces]);

  useEffect(() => {
    if (!connection || !selectedWorkspaceId) {
      setBillingState(null);
      setBillingError(null);
      setLoadingBilling(false);
      return;
    }
    void loadBilling(connection, selectedWorkspaceId);
  }, [connection, loadBilling, selectedWorkspaceId]);

  useEffect(() => {
    if (!billingState?.subscription || !selectedWorkspaceId) {
      return;
    }
    setWorkspaces((current) => {
      let hasChanges = false;
      const nextWorkspaces = current.map((workspace) => {
        if (workspace.id !== selectedWorkspaceId) {
          return workspace;
        }
        const nextPlanLabel =
          billingState.subscription.planLabel || workspace.planLabel;
        const nextBillingCycle = billingState.subscription.billingCycle;
        const nextStatus = billingState.subscription.status;
        const nextExpiresAt = billingState.subscription.expiresAt;
        const nextProfileLimit = billingState.subscription.profileLimit;
        const nextMemberLimit = billingState.subscription.memberLimit;
        if (
          workspace.planLabel === nextPlanLabel &&
          workspace.billingCycle === nextBillingCycle &&
          workspace.subscriptionStatus === nextStatus &&
          workspace.expiresAt === nextExpiresAt &&
          workspace.profileLimit === nextProfileLimit &&
          workspace.memberLimit === nextMemberLimit
        ) {
          return workspace;
        }
        hasChanges = true;
        return {
          ...workspace,
          planLabel: nextPlanLabel,
          billingCycle: nextBillingCycle,
          subscriptionStatus: nextStatus,
          expiresAt: nextExpiresAt,
          profileLimit: nextProfileLimit,
          memberLimit: nextMemberLimit,
        };
      });
      return hasChanges ? nextWorkspaces : current;
    });
  }, [billingState, selectedWorkspaceId]);

  const refreshWorkspaces = useCallback(async () => {
    if (!connection) {
      return;
    }
    await loadWorkspaces(connection);
  }, [connection, loadWorkspaces]);

  const refreshBilling = useCallback(async () => {
    if (!connection || !selectedWorkspaceId) {
      return;
    }
    await loadBilling(connection, selectedWorkspaceId);
  }, [connection, loadBilling, selectedWorkspaceId]);

  const selectedWorkspace = useMemo(() => {
    return (
      workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ??
      null
    );
  }, [selectedWorkspaceId, workspaces]);

  useEffect(() => {
    if (typeof window === "undefined" || !session) {
      return;
    }

    const nextSession = mergePortalSessionCurrent(session, {
      workspaceId: selectedWorkspace?.id ?? billingState?.workspaceId ?? "",
      workspaceName: selectedWorkspace?.name ?? null,
      planId: billingState?.subscription.planId ?? null,
      planLabel:
        billingState?.subscription.planLabel ??
        selectedWorkspace?.planLabel ??
        null,
      billingCycle:
        billingState?.subscription.billingCycle ??
        selectedWorkspace?.billingCycle ??
        null,
      subscriptionStatus:
        billingState?.subscription.status ??
        selectedWorkspace?.subscriptionStatus ??
        null,
    });

    if (JSON.stringify(nextSession) === JSON.stringify(session)) {
      return;
    }

    writePortalSessionStorage(nextSession);
  }, [billingState, selectedWorkspace, session]);

  useEffect(() => {
    if (!connection) {
      return;
    }
    writeSelectedWorkspaceToStorage(connection.userId, selectedWorkspaceId);
  }, [connection, selectedWorkspaceId]);

  const setPortalWorkspaceId = useCallback((workspaceId: string) => {
    const normalized = workspaceId.trim();
    setSelectedWorkspaceId(normalized);

    if (typeof window === "undefined") {
      return;
    }

    const record = readPortalSessionStorage();
    if (record) {
      const nextRecord = mergePortalSessionCurrent(record, {
        workspaceId: normalized,
      });
      writePortalSessionStorage(nextRecord);
    }

    const userId = record?.connection.userId?.trim();
    if (userId) {
      writeSelectedWorkspaceToStorage(userId, normalized);
    }
  }, []);

  return {
    session,
    sessionReady: true,
    connection,
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId: setPortalWorkspaceId,
    selectedWorkspace,
    billingState,
    loadingWorkspaces,
    loadingBilling,
    workspacesError,
    billingError,
    refreshWorkspaces,
    refreshBilling,
  };
}

type PortalBillingDataValue = ReturnType<typeof usePortalBillingDataState>;

const PortalBillingDataContext = createContext<PortalBillingDataValue | null>(
  null,
);

export function PortalBillingDataProvider({
  children,
}: {
  children: ReactNode;
}) {
  const value = usePortalBillingDataState();
  return createElement(PortalBillingDataContext.Provider, { value }, children);
}

export function usePortalBillingData(): PortalBillingDataValue {
  const context = useContext(PortalBillingDataContext);
  if (!context) {
    throw new Error(
      "usePortalBillingData must be used within PortalBillingDataProvider",
    );
  }
  return context;
}
