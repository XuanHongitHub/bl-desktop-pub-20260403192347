"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import {
  createSelfHostedCoupon,
  listSelfHostedCoupons,
  revokeSelfHostedCoupon,
  seedSelfHostedBillingForUser,
} from "@/lib/self-host-billing";
import type {
  ControlAdminOverview,
  ControlAuditLog,
  ControlCoupon,
  ControlInvite,
  ControlMembership,
  ControlShareGrant,
  ControlWorkspace,
  ControlWorkspaceOverview,
  EntitlementState,
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
  createWorkspace: (
    name: string,
    mode: "personal" | "team",
  ) => Promise<ControlWorkspace>;
  createInvite: (
    workspaceId: string,
    email: string,
    role: TeamRole,
  ) => Promise<ControlInvite>;
  revokeInvite: (
    workspaceId: string,
    inviteId: string,
    reason: string,
  ) => Promise<ControlInvite>;
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

function buildLocalFallbackWorkspaces(
  user: ReturnType<typeof useCloudAuth>["user"],
): ControlWorkspace[] {
  if (!user) {
    return [];
  }

  const createdAt = new Date().toISOString();
  const createdBy = user.id;
  const rows: ControlWorkspace[] = [];

  const seeds = user.workspaceSeeds ?? [];
  if (seeds.length > 0) {
    return seeds.map((seed) => ({
      id: seed.id,
      name: seed.name,
      mode: seed.mode,
      createdAt,
      createdBy,
    }));
  }

  if (user.teamId || user.teamName) {
    rows.push({
      id: user.teamId ?? "team",
      name: user.teamName ?? "Team Workspace",
      mode: "team",
      createdAt,
      createdBy,
    });
  }

  rows.push({
    id: "personal",
    name: "Personal Workspace",
    mode: "personal",
    createdAt,
    createdBy,
  });
  return rows;
}

function buildLocalFallbackOverview(
  user: ReturnType<typeof useCloudAuth>["user"],
  workspaceId: string,
): ControlWorkspaceOverview {
  const seed = user?.workspaceSeeds?.find((item) => item.id === workspaceId);
  return {
    workspaceId,
    members: seed?.members ?? 1,
    activeInvites: seed?.activeInvites ?? 0,
    activeShareGrants: seed?.activeShareGrants ?? 0,
    entitlementState: seed?.entitlementState ?? "active",
  };
}

interface LocalControlPlaneState {
  workspaces: ControlWorkspace[];
  membershipsByWorkspace: Record<string, ControlMembership[]>;
  invitesByWorkspace: Record<string, ControlInvite[]>;
  shareGrantsByWorkspace: Record<string, ControlShareGrant[]>;
  entitlementByWorkspace: Record<string, EntitlementState>;
}

function createLocalId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function areWorkspaceRowsEqual(
  left: ControlWorkspace[],
  right: ControlWorkspace[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRow = left[index];
    const rightRow = right[index];
    if (
      leftRow.id !== rightRow.id ||
      leftRow.name !== rightRow.name ||
      leftRow.mode !== rightRow.mode ||
      leftRow.createdAt !== rightRow.createdAt ||
      leftRow.createdBy !== rightRow.createdBy
    ) {
      return false;
    }
  }

  return true;
}

function buildLocalControlPlaneState(
  user: ReturnType<typeof useCloudAuth>["user"],
): LocalControlPlaneState {
  const workspaces = buildLocalFallbackWorkspaces(user);
  const now = new Date().toISOString();
  const membershipsByWorkspace: Record<string, ControlMembership[]> = {};
  const invitesByWorkspace: Record<string, ControlInvite[]> = {};
  const shareGrantsByWorkspace: Record<string, ControlShareGrant[]> = {};
  const entitlementByWorkspace: Record<string, EntitlementState> = {};

  for (const workspace of workspaces) {
    const seed = user?.workspaceSeeds?.find((item) => item.id === workspace.id);
    const defaultRole: TeamRole =
      user?.platformRole === "platform_admin"
        ? "owner"
        : (seed?.role ??
          (workspace.mode === "team" ? (user?.teamRole ?? "owner") : "owner"));
    membershipsByWorkspace[workspace.id] = user
      ? [
          {
            workspaceId: workspace.id,
            userId: user.id,
            email: user.email,
            role: defaultRole,
            createdAt: now,
          },
        ]
      : [];
    invitesByWorkspace[workspace.id] = [];
    shareGrantsByWorkspace[workspace.id] = [];
    entitlementByWorkspace[workspace.id] = seed?.entitlementState ?? "active";
  }

  return {
    workspaces,
    membershipsByWorkspace,
    invitesByWorkspace,
    shareGrantsByWorkspace,
    entitlementByWorkspace,
  };
}

function buildLocalOverviewFromState(
  localState: LocalControlPlaneState,
  workspaceId: string,
  user: ReturnType<typeof useCloudAuth>["user"],
): ControlWorkspaceOverview {
  const fallback = buildLocalFallbackOverview(user, workspaceId);
  const memberships = localState.membershipsByWorkspace[workspaceId] ?? [];
  const invites = localState.invitesByWorkspace[workspaceId] ?? [];
  const shareGrants = localState.shareGrantsByWorkspace[workspaceId] ?? [];
  return {
    workspaceId,
    members: memberships.length || fallback.members,
    activeInvites: invites.filter((invite) => !invite.consumedAt).length,
    activeShareGrants: shareGrants.filter((grant) => !grant.revokedAt).length,
    entitlementState:
      localState.entitlementByWorkspace[workspaceId] ??
      fallback.entitlementState,
  };
}

export function useControlPlane(): UseControlPlaneResult {
  const { user } = useCloudAuth();
  const isPlatformAdmin = user?.platformRole === "platform_admin";
  const actorUserId = user?.id ?? "anonymous";
  const actorEmail = user?.email ?? "anonymous@local";
  const actorPlatformRole = user?.platformRole ?? null;
  const localStateUserKey = JSON.stringify({
    id: user?.id ?? null,
    email: user?.email ?? null,
    platformRole: user?.platformRole ?? null,
    teamId: user?.teamId ?? null,
    teamName: user?.teamName ?? null,
    teamRole: user?.teamRole ?? null,
    plan: user?.plan ?? null,
    subscriptionStatus: user?.subscriptionStatus ?? null,
    profileLimit: user?.profileLimit ?? null,
    cloudProfilesUsed: user?.cloudProfilesUsed ?? null,
    workspaceSeeds: user?.workspaceSeeds ?? [],
  });
  const [runtime, setRuntime] = useState<ControlPlaneRuntime>({
    baseUrl: null,
    token: null,
  });
  const [workspaces, setWorkspaces] = useState<ControlWorkspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
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
  const localStateRef = useRef<LocalControlPlaneState>(
    buildLocalControlPlaneState(user),
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const lastLocalUserKeyRef = useRef<string>("");
  useEffect(() => {
    const nextUserKey = localStateUserKey;
    if (lastLocalUserKeyRef.current === nextUserKey) {
      return;
    }
    lastLocalUserKeyRef.current = nextUserKey;
    localStateRef.current = buildLocalControlPlaneState(user);
    seedSelfHostedBillingForUser(user);
  }, [localStateUserKey, user]);

  const request = useCallback(
    async <T>(method: HttpMethod, path: string, body?: unknown): Promise<T> => {
      if (!runtime.baseUrl) {
        throw new Error("control_plane_not_configured");
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": actorUserId,
        "x-user-email": actorEmail,
      };

      if (actorPlatformRole) {
        headers["x-platform-role"] = actorPlatformRole;
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
    [
      actorEmail,
      actorPlatformRole,
      actorUserId,
      runtime.baseUrl,
      runtime.token,
    ],
  );

  const runWithLoading = useCallback(async <T>(run: () => Promise<T>) => {
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
      const localRows = localStateRef.current.workspaces;
      setWorkspaces((current) =>
        areWorkspaceRowsEqual(current, localRows) ? current : localRows,
      );
      setSelectedWorkspaceId((current) => {
        if (!localRows.length) {
          return null;
        }
        if (
          current &&
          localRows.some((workspace) => workspace.id === current)
        ) {
          return current;
        }
        return localRows[0].id;
      });
      setError(null);
      return;
    }

    await runWithLoading(async () => {
      setError(null);
      const rows = await request<ControlWorkspace[]>(
        "GET",
        "/v1/control/workspaces",
      );
      setWorkspaces((current) =>
        areWorkspaceRowsEqual(current, rows) ? current : rows,
      );
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
        if (!workspaceId) {
          setOverview(null);
          setMemberships([]);
          setInvites([]);
          setShareGrants([]);
          return;
        }

        const localOverview = buildLocalOverviewFromState(
          localStateRef.current,
          workspaceId,
          user,
        );
        setOverview(localOverview);
        setMemberships(
          localStateRef.current.membershipsByWorkspace[workspaceId] ?? [],
        );
        setInvites(localStateRef.current.invitesByWorkspace[workspaceId] ?? []);
        setShareGrants(
          localStateRef.current.shareGrantsByWorkspace[workspaceId] ?? [],
        );
        setError(null);
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
    [request, runWithLoading, runtime.baseUrl, user],
  );

  const refreshAdminData = useCallback(async () => {
    if (!runtime.baseUrl || !isPlatformAdmin) {
      const localWorkspaces = localStateRef.current.workspaces;
      const localCoupons = isPlatformAdmin ? listSelfHostedCoupons() : [];
      setAdminOverview(
        isPlatformAdmin
          ? {
              workspaces: localWorkspaces.length,
              members: actorUserId === "anonymous" ? 0 : 1,
              activeInvites: 0,
              activeShareGrants: 0,
              activeCoupons: localCoupons.filter((coupon) => !coupon.revokedAt)
                .length,
              entitlementActive: 1,
              entitlementGrace: 0,
              entitlementReadOnly: 0,
              auditsLast24h: 0,
            }
          : null,
      );
      setCoupons(localCoupons);
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
          request<ControlAuditLog[]>(
            "GET",
            "/v1/control/admin/audit-logs?limit=50",
          ),
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
  }, [actorUserId, isPlatformAdmin, request, runWithLoading, runtime.baseUrl]);

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
        if (!runtime.baseUrl) {
          if (!user) {
            throw new Error("auth_required");
          }
          const now = new Date().toISOString();
          const created: ControlWorkspace = {
            id: createLocalId("ws"),
            name,
            mode,
            createdAt: now,
            createdBy: user.id,
          };
          localStateRef.current.workspaces = [
            ...localStateRef.current.workspaces,
            created,
          ];
          localStateRef.current.membershipsByWorkspace[created.id] = [
            {
              workspaceId: created.id,
              userId: user.id,
              email: user.email,
              role: "owner",
              createdAt: now,
            },
          ];
          localStateRef.current.invitesByWorkspace[created.id] = [];
          localStateRef.current.shareGrantsByWorkspace[created.id] = [];
          localStateRef.current.entitlementByWorkspace[created.id] = "active";
          await refreshWorkspaceList();
          setSelectedWorkspaceId(created.id);
          await refreshWorkspaceDetails(created.id);
          return created;
        }
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
    [
      refreshWorkspaceDetails,
      refreshWorkspaceList,
      request,
      runWithLoading,
      runtime.baseUrl,
      user,
    ],
  );

  const createInvite = useCallback(
    async (workspaceId: string, email: string, role: TeamRole) => {
      return runWithLoading(async () => {
        setError(null);
        if (role !== "member" && role !== "viewer") {
          throw new Error("invalid_invite_role");
        }
        if (!runtime.baseUrl) {
          if (!user) {
            throw new Error("auth_required");
          }
          const now = new Date();
          const invite: ControlInvite = {
            id: createLocalId("invite"),
            workspaceId,
            email,
            role,
            token: createLocalId("token"),
            expiresAt: new Date(
              now.getTime() + 7 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            createdAt: now.toISOString(),
            createdBy: user.id,
            consumedAt: null,
          };
          const currentRows =
            localStateRef.current.invitesByWorkspace[workspaceId] ?? [];
          localStateRef.current.invitesByWorkspace[workspaceId] = [
            invite,
            ...currentRows,
          ];
          await refreshWorkspaceDetails(workspaceId);
          return invite;
        }
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, user],
  );

  const revokeInvite = useCallback(
    async (workspaceId: string, inviteId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl) {
          const currentRows =
            localStateRef.current.invitesByWorkspace[workspaceId] ?? [];
          const target = currentRows.find((invite) => invite.id === inviteId);
          if (!target) {
            throw new Error("invite_not_found");
          }
          localStateRef.current.invitesByWorkspace[workspaceId] =
            currentRows.filter((invite) => invite.id !== inviteId);
          await refreshWorkspaceDetails(workspaceId);
          return {
            ...target,
            consumedAt: target.consumedAt ?? new Date().toISOString(),
          };
        }
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl],
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
        if (!runtime.baseUrl) {
          const rows =
            localStateRef.current.membershipsByWorkspace[workspaceId] ?? [];
          const nextRows = rows.map((item) =>
            item.userId === targetUserId ? { ...item, role } : item,
          );
          const target = nextRows.find((item) => item.userId === targetUserId);
          if (!target) {
            throw new Error("membership_not_found");
          }
          localStateRef.current.membershipsByWorkspace[workspaceId] = nextRows;
          await refreshWorkspaceDetails(workspaceId);
          return target;
        }
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl],
  );

  const removeMembership = useCallback(
    async (workspaceId: string, targetUserId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl) {
          const rows =
            localStateRef.current.membershipsByWorkspace[workspaceId] ?? [];
          const target = rows.find((item) => item.userId === targetUserId);
          if (!target) {
            throw new Error("membership_not_found");
          }
          const ownerCount = rows.filter(
            (item) => item.role === "owner",
          ).length;
          if (target.role === "owner" && ownerCount <= 1) {
            throw new Error("workspace_owner_required");
          }
          localStateRef.current.membershipsByWorkspace[workspaceId] =
            rows.filter((item) => item.userId !== targetUserId);
          await refreshWorkspaceDetails(workspaceId);
          return target;
        }
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl],
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
        if (!runtime.baseUrl) {
          if (!user) {
            throw new Error("auth_required");
          }
          const grant: ControlShareGrant = {
            id: createLocalId("share"),
            workspaceId,
            resourceType,
            resourceId,
            recipientEmail,
            accessMode: "full",
            createdAt: new Date().toISOString(),
            createdBy: user.id,
            revokedAt: null,
          };
          const rows =
            localStateRef.current.shareGrantsByWorkspace[workspaceId] ?? [];
          localStateRef.current.shareGrantsByWorkspace[workspaceId] = [
            grant,
            ...rows,
          ];
          await refreshWorkspaceDetails(workspaceId);
          return grant;
        }
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, user],
  );

  const revokeShareGrant = useCallback(
    async (workspaceId: string, shareGrantId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl) {
          const rows =
            localStateRef.current.shareGrantsByWorkspace[workspaceId] ?? [];
          const nextRows = rows.map((item) =>
            item.id === shareGrantId
              ? {
                  ...item,
                  revokedAt: item.revokedAt ?? new Date().toISOString(),
                }
              : item,
          );
          const target = nextRows.find((item) => item.id === shareGrantId);
          if (!target) {
            throw new Error("share_grant_not_found");
          }
          localStateRef.current.shareGrantsByWorkspace[workspaceId] = nextRows;
          await refreshWorkspaceDetails(workspaceId);
          return target;
        }
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl],
  );

  const createCoupon = useCallback(
    async (input: CreateCouponInput) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl) {
          const created = createSelfHostedCoupon({
            ...input,
            actorUserId,
          });
          await refreshAdminData();
          return created;
        }
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
    [actorUserId, refreshAdminData, request, runWithLoading, runtime.baseUrl],
  );

  const revokeCoupon = useCallback(
    async (couponId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl) {
          const result = revokeSelfHostedCoupon(couponId);
          await refreshAdminData();
          return result;
        }
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
    [refreshAdminData, request, runWithLoading, runtime.baseUrl],
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
        ? (workspaces.find(
            (workspace) => workspace.id === selectedWorkspaceId,
          ) ?? null)
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
