"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import type {
  ControlAdminOverview,
  ControlAuditLog,
  ControlCoupon,
  ControlInvite,
  ControlMembership,
  ControlShareGrant,
  ControlWorkspace,
  ControlWorkspaceOverview,
  SyncServerConfigStatus,
  TeamRole,
} from "@/types";
import { useCloudAuth } from "./use-cloud-auth";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

type HttpMethod = "GET" | "POST" | "PATCH";

interface ControlPlaneRuntime {
  baseUrl: string | null;
  token: string | null;
}

interface CreateCouponInput {
  code: string;
  source: "internal" | "stripe";
  discountPercent: number;
  maxRedemptions: number;
  expiresAt: string;
  workspaceAllowlist?: string[];
  workspaceDenylist?: string[];
}

interface UseControlPlaneResult {
  runtime: ControlPlaneRuntime;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
  workspaces: ControlWorkspace[];
  selectedWorkspaceId: string | null;
  selectedWorkspace: ControlWorkspace | null;
  overview: ControlWorkspaceOverview | null;
  memberships: ControlMembership[];
  invites: ControlInvite[];
  shareGrants: ControlShareGrant[];
  coupons: ControlCoupon[];
  auditLogs: ControlAuditLog[];
  adminOverview: ControlAdminOverview | null;
  serverConfigStatus: SyncServerConfigStatus | null;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  refreshRuntime: () => Promise<void>;
  refreshWorkspaceList: () => Promise<void>;
  refreshWorkspaceDetails: (workspaceId: string) => Promise<void>;
  refreshAdminData: () => Promise<void>;
  refreshServerConfigStatus: () => Promise<void>;
  createWorkspace: (name: string, mode: "personal" | "team") => Promise<ControlWorkspace>;
  createInvite: (workspaceId: string, email: string, role: TeamRole) => Promise<ControlInvite>;
  revokeInvite: (workspaceId: string, inviteId: string, reason: string) => Promise<ControlInvite>;
  updateMembershipRole: (
    workspaceId: string,
    targetUserId: string,
    role: TeamRole,
    reason: string,
  ) => Promise<ControlMembership>;
  removeMembership: (
    workspaceId: string,
    targetUserId: string,
    reason: string,
  ) => Promise<ControlMembership>;
  createShareGrant: (
    workspaceId: string,
    resourceType: "profile" | "group",
    resourceId: string,
    recipientEmail: string,
    reason: string,
  ) => Promise<ControlShareGrant>;
  revokeShareGrant: (
    workspaceId: string,
    shareGrantId: string,
    reason: string,
  ) => Promise<ControlShareGrant>;
  createCoupon: (input: CreateCouponInput) => Promise<ControlCoupon>;
  revokeCoupon: (couponId: string, reason: string) => Promise<ControlCoupon>;
}

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
}

export function useControlPlane(): UseControlPlaneResult {
  const { user } = useCloudAuth();
  const isPlatformAdmin = user?.platformRole === "platform_admin";
  const [runtime, setRuntime] = useState<ControlPlaneRuntime>({
    baseUrl: null,
    token: null,
  });
  const [workspaces, setWorkspaces] = useState<ControlWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] =
    useState<string | null>(null);
  const [overview, setOverview] = useState<ControlWorkspaceOverview | null>(
    null,
  );
  const [memberships, setMemberships] = useState<ControlMembership[]>([]);
  const [invites, setInvites] = useState<ControlInvite[]>([]);
  const [shareGrants, setShareGrants] = useState<ControlShareGrant[]>([]);
  const [coupons, setCoupons] = useState<ControlCoupon[]>([]);
  const [auditLogs, setAuditLogs] = useState<ControlAuditLog[]>([]);
  const [adminOverview, setAdminOverview] =
    useState<ControlAdminOverview | null>(null);
  const [serverConfigStatus, setServerConfigStatus] =
    useState<SyncServerConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const request = useCallback(
    async <T>(method: HttpMethod, path: string, body?: unknown): Promise<T> => {
      if (!runtime.baseUrl) {
        throw new Error("control_plane_not_configured");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": user?.id ?? "anonymous",
        "x-user-email": user?.email ?? "anonymous@local",
      };

      if (user?.platformRole) {
        headers["x-platform-role"] = user.platformRole;
      }

      if (runtime.token) {
        headers.Authorization = `Bearer ${runtime.token}`;
      }

      const response = await fetch(`${runtime.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => "");
        throw new Error(`control_plane_${response.status}:${rawBody}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    },
    [runtime.baseUrl, runtime.token, user],
  );

  const runWithLoading = useCallback(async <T,>(run: () => Promise<T>) => {
    setIsLoading(true);
    try {
      return await run();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshRuntime = useCallback(async () => {
    try {
      setError(null);
      const settings = await invoke<SyncSettings>("get_sync_settings");
      setRuntime({
        baseUrl: normalizeBaseUrl(settings.sync_server_url),
        token: settings.sync_token?.trim() || null,
      });
    } catch (runtimeError) {
      setRuntime({
        baseUrl: null,
        token: null,
      });
      setError(extractRootError(runtimeError));
    }
  }, []);

  const refreshWorkspaceList = useCallback(async () => {
    if (!runtime.baseUrl) {
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      return;
    }

    await runWithLoading(async () => {
      setError(null);
      const rows = await request<ControlWorkspace[]>("GET", "/v1/control/workspaces");
      setWorkspaces(rows);
      setSelectedWorkspaceId((current) => {
        if (!rows.length) {
          return null;
        }
        if (current && rows.some((workspace) => workspace.id === current)) {
          return current;
        }
        return rows[0].id;
      });
    }).catch((requestError) => {
      setError(extractRootError(requestError));
    });
  }, [request, runWithLoading, runtime.baseUrl]);

  const refreshWorkspaceDetails = useCallback(
    async (workspaceId: string) => {
      if (!runtime.baseUrl || !workspaceId) {
        setOverview(null);
        setMemberships([]);
        setInvites([]);
        setShareGrants([]);
        return;
      }

      await runWithLoading(async () => {
        setError(null);
        const [nextOverview, nextMemberships, nextInvites, nextShareGrants] =
          await Promise.all([
            request<ControlWorkspaceOverview>(
              "GET",
              `/v1/control/workspaces/${workspaceId}/overview`,
            ),
            request<ControlMembership[]>(
              "GET",
              `/v1/control/workspaces/${workspaceId}/members`,
            ),
            request<ControlInvite[]>(
              "GET",
              `/v1/control/workspaces/${workspaceId}/invites`,
            ),
            request<ControlShareGrant[]>(
              "GET",
              `/v1/control/workspaces/${workspaceId}/share-grants`,
            ),
          ]);
        setOverview(nextOverview);
        setMemberships(nextMemberships);
        setInvites(nextInvites);
        setShareGrants(nextShareGrants);
      }).catch((requestError) => {
        setError(extractRootError(requestError));
      });
    },
    [request, runWithLoading, runtime.baseUrl],
  );

  const refreshAdminData = useCallback(async () => {
    if (!runtime.baseUrl || !isPlatformAdmin) {
      setAdminOverview(null);
      setCoupons([]);
      setAuditLogs([]);
      setError(null);
      return;
    }

    await runWithLoading(async () => {
      setError(null);
      try {
        const [nextOverview, nextCoupons, nextAuditLogs] = await Promise.all([
          request<ControlAdminOverview>("GET", "/v1/control/admin/overview"),
          request<ControlCoupon[]>("GET", "/v1/control/admin/coupons"),
          request<ControlAuditLog[]>("GET", "/v1/control/admin/audit-logs?limit=50"),
        ]);
        setAdminOverview(nextOverview);
        setCoupons(nextCoupons);
        setAuditLogs(nextAuditLogs);
      } catch (requestError) {
        setAdminOverview(null);
        setCoupons([]);
        setAuditLogs([]);
        setError(extractRootError(requestError));
      }
    });
  }, [isPlatformAdmin, request, runWithLoading, runtime.baseUrl]);

  const refreshServerConfigStatus = useCallback(async () => {
    if (!runtime.baseUrl) {
      setServerConfigStatus(null);
      return;
    }

    await runWithLoading(async () => {
      setError(null);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (runtime.token) {
          headers.Authorization = `Bearer ${runtime.token}`;
        }

        const response = await fetch(`${runtime.baseUrl}/config-status`, {
          method: "GET",
          headers,
        });
        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new Error(`config_status_${response.status}:${body}`);
        }

        const status = (await response.json()) as SyncServerConfigStatus;
        setServerConfigStatus(status);
      } catch (requestError) {
        setServerConfigStatus(null);
        setError(extractRootError(requestError));
      }
    });
  }, [runWithLoading, runtime.baseUrl, runtime.token]);

  const createWorkspace = useCallback(
    async (name: string, mode: "personal" | "team") => {
      return runWithLoading(async () => {
        setError(null);
        const created = await request<ControlWorkspace>(
          "POST",
          "/v1/control/workspaces",
          {
            name,
            mode,
          },
        );
        await refreshWorkspaceList();
        setSelectedWorkspaceId(created.id);
        return created;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshWorkspaceList, request, runWithLoading],
  );

  const createInvite = useCallback(
    async (workspaceId: string, email: string, role: TeamRole) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlInvite>(
          "POST",
          `/v1/control/workspaces/${workspaceId}/members/invite`,
          { email, role },
        );
        await refreshWorkspaceDetails(workspaceId);
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, refreshWorkspaceDetails, runWithLoading],
  );

  const revokeInvite = useCallback(
    async (workspaceId: string, inviteId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlInvite>(
          "POST",
          `/v1/control/workspaces/${workspaceId}/invites/${inviteId}/revoke`,
          { reason },
        );
        await refreshWorkspaceDetails(workspaceId);
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, refreshWorkspaceDetails, runWithLoading],
  );

  const updateMembershipRole = useCallback(
    async (
      workspaceId: string,
      targetUserId: string,
      role: TeamRole,
      reason: string,
    ) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlMembership>(
          "PATCH",
          `/v1/control/workspaces/${workspaceId}/members/${targetUserId}/role`,
          { role, reason },
        );
        await refreshWorkspaceDetails(workspaceId);
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, refreshWorkspaceDetails, runWithLoading],
  );

  const removeMembership = useCallback(
    async (workspaceId: string, targetUserId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlMembership>(
          "POST",
          `/v1/control/workspaces/${workspaceId}/members/${targetUserId}/remove`,
          { reason },
        );
        await refreshWorkspaceDetails(workspaceId);
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, refreshWorkspaceDetails, runWithLoading],
  );

  const createShareGrant = useCallback(
    async (
      workspaceId: string,
      resourceType: "profile" | "group",
      resourceId: string,
      recipientEmail: string,
      reason: string,
    ) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlShareGrant>(
          "POST",
          `/v1/control/workspaces/${workspaceId}/share-grants`,
          {
            resourceType,
            resourceId,
            recipientEmail,
            reason,
          },
        );
        await refreshWorkspaceDetails(workspaceId);
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, refreshWorkspaceDetails, runWithLoading],
  );

  const revokeShareGrant = useCallback(
    async (workspaceId: string, shareGrantId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlShareGrant>(
          "POST",
          `/v1/control/workspaces/${workspaceId}/share-grants/${shareGrantId}/revoke`,
          { reason },
        );
        await refreshWorkspaceDetails(workspaceId);
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, refreshWorkspaceDetails, runWithLoading],
  );

  const createCoupon = useCallback(
    async (input: CreateCouponInput) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlCoupon>(
          "POST",
          "/v1/control/admin/coupons",
          input,
        );
        await refreshAdminData();
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshAdminData, request, runWithLoading],
  );

  const revokeCoupon = useCallback(
    async (couponId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        const result = await request<ControlCoupon>(
          "POST",
          `/v1/control/admin/coupons/${couponId}/revoke`,
          { reason },
        );
        await refreshAdminData();
        return result;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshAdminData, request, runWithLoading],
  );

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    void refreshWorkspaceList();
    void refreshAdminData();
    void refreshServerConfigStatus();
  }, [refreshAdminData, refreshServerConfigStatus, refreshWorkspaceList]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      setOverview(null);
      setMemberships([]);
      setInvites([]);
      setShareGrants([]);
      return;
    }
    void refreshWorkspaceDetails(selectedWorkspaceId);
  }, [refreshWorkspaceDetails, selectedWorkspaceId]);

  const selectedWorkspace = useMemo(
    () =>
      selectedWorkspaceId
        ? workspaces.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
        : null,
    [selectedWorkspaceId, workspaces],
  );

  return {
    runtime,
    isLoading,
    error,
    clearError,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    overview,
    memberships,
    invites,
    shareGrants,
    coupons,
    auditLogs,
    adminOverview,
    serverConfigStatus,
    setSelectedWorkspaceId,
    refreshRuntime,
    refreshWorkspaceList,
    refreshWorkspaceDetails,
    refreshAdminData,
    refreshServerConfigStatus,
    createWorkspace,
    createInvite,
    revokeInvite,
    updateMembershipRole,
    removeMembership,
    createShareGrant,
    revokeShareGrant,
    createCoupon,
    revokeCoupon,
  };
}
