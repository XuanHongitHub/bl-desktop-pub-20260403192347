"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
  writePortalSessionStorage,
} from "@/lib/portal-session";
import { readWebBillingPortalContextFromHash } from "@/lib/web-billing-portal";
import type { ControlWorkspaceBillingState } from "@/types";

interface GooglePortalProfile {
  email?: string;
  name?: string;
  avatar?: string;
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

export function usePortalBillingData() {
  const session = usePortalSessionStore();
  const [workspaces, setWorkspaces] = useState<WebBillingWorkspaceListItem[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [billingState, setBillingState] =
    useState<ControlWorkspaceBillingState | null>(null);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [workspacesError, setWorkspacesError] = useState<string | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  const connection = useMemo<WebBillingConnection | null>(() => {
    if (!session) {
      return null;
    }
    return {
      controlBaseUrl: session.connection.controlBaseUrl,
      controlToken: session.connection.controlToken,
      userId: session.connection.userId,
      userEmail: session.connection.userEmail,
      platformRole:
        session.connection.platformRole ?? session.user.platformRole ?? null,
    };
  }, [session]);

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
    };
  }, []);

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
        const message = error instanceof Error ? error.message : "unknown_error";
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
        const message = error instanceof Error ? error.message : "unknown_error";
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

  return {
    session,
    sessionReady: true,
    connection,
    workspaces,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
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
