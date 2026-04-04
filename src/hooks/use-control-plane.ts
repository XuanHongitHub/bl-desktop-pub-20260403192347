"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import { invokeCached } from "@/lib/ipc-query-cache";
import type {
  AdminTiktokAutoWorkflowRunState,
  AdminTiktokOperationProgressState,
  AdminTiktokState,
  AdminTiktokWorkflowRow,
  CloudUser,
  ControlAdminOverview,
  ControlAdminWorkspaceHealthRow,
  ControlAuditLog,
  ControlCoupon,
  ControlInvite,
  ControlMembership,
  ControlShareGrant,
  ControlWorkspace,
  ControlWorkspaceOverview,
  SyncServerConfigStatus,
  TeamRole,
  TiktokAutomationAccountRecord,
  TiktokAutomationFlowType,
  TiktokAutomationItemStatus,
  TiktokAutomationRunItemRecord,
  TiktokAutomationRunMode,
  TiktokAutomationRunRecord,
  TiktokCookieRecord,
  TiktokCookieSourceRecord,
} from "@/types";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface UseControlPlaneOptions {
  includeAdminData?: boolean;
  includeServerConfigStatus?: boolean;
  includeWorkspaceDetails?: boolean;
  includeTiktokData?: boolean;
  workspaceScope?: "member" | "all";
  actorUser?: CloudUser | null;
  actorWorkspaceRole?: TeamRole | null;
  preferredWorkspaceId?: string | null;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface ControlPlaneRuntime {
  baseUrl: string | null;
  token: string | null;
}

const BUGIDEA_TIKTOK_API_PREFIX = "/api/tiktok-cookies";
const CONTROL_PLANE_CAPABILITY_UNSUPPORTED_PREFIX =
  "control_plane_capability_unsupported:";
const CONTROL_PLANE_TIKTOK_AUTOMATION_CAPABILITY =
  "admin_tiktok_automation";
const CONTROL_PLANE_TIKTOK_AUTOMATION_UNSUPPORTED_ERROR =
  `${CONTROL_PLANE_CAPABILITY_UNSUPPORTED_PREFIX}${CONTROL_PLANE_TIKTOK_AUTOMATION_CAPABILITY}`;
const CONTROL_PLANE_GET_DEDUP_TTL_MS = 10_000;
const CONTROL_PLANE_RUNTIME_CACHE_TTL_MS = 4_000;
const SYNC_SETTINGS_CACHE_TTL_MS = 30_000;
const globalGetRequestInFlight = new Map<string, Promise<unknown>>();
const globalGetRequestCache = new Map<
  string,
  { expiresAt: number; payload: unknown }
>();
let runtimeSettingsInFlight: Promise<ControlPlaneRuntime> | null = null;
let runtimeSettingsCache: {
  expiresAt: number;
  runtime: ControlPlaneRuntime;
} | null = null;

interface CreateCouponInput {
  code: string;
  source: "internal" | "stripe";
  discountPercent: number;
  maxRedemptions: number;
  expiresAt: string;
  workspaceAllowlist?: string[];
  workspaceDenylist?: string[];
}

interface CreateTiktokCookieInput {
  label: string;
  cookie: string;
  notes?: string;
}

interface TiktokCookieMutationOptions {
  refresh?: boolean;
}

interface UpdateTiktokCookieInput {
  label?: string;
  cookie?: string;
  status?: string;
  notes?: string;
}

interface SaveAdminTiktokStateInput {
  bearerKey: string;
  workflowRows: AdminTiktokWorkflowRow[];
  rotationCursor: number;
  workflowCaptchaProvider?: "none" | "omocaptcha";
  workflowCaptchaApiKey?: string;
  autoWorkflowRun?: AdminTiktokAutoWorkflowRunState | null;
  operationProgress?: AdminTiktokOperationProgressState | null;
}

interface BulkCreateTiktokCookiesInput {
  cookies: string[];
  prefix?: string;
}

interface ImportTiktokAutomationAccountsInput {
  rows: Array<{
    phone?: string;
    apiPhone?: string;
    cookie?: string;
    username?: string;
    password?: string;
    profileId?: string | null;
    profileName?: string | null;
    source?: "excel_import" | "manual" | "bugidea_pull";
  }>;
  force?: boolean;
  flowType?: TiktokAutomationFlowType;
}

interface CreateTiktokAutomationRunInput {
  flowType: TiktokAutomationFlowType;
  mode: TiktokAutomationRunMode;
  accountIds?: string[];
}

interface UpdateTiktokAutomationRunItemInput {
  status?: TiktokAutomationItemStatus;
  step?: string;
  attempt?: number;
  profileId?: string | null;
  profileName?: string | null;
  cookiePreview?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

interface UseControlPlaneResult {
  runtime: ControlPlaneRuntime;
  isLoading: boolean;
  isTiktokDataBootstrapping: boolean;
  isTiktokDataReady: boolean;
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
  tiktokCookies: TiktokCookieRecord[];
  tiktokCookieSources: TiktokCookieSourceRecord[];
  tiktokAutomationAccounts: TiktokAutomationAccountRecord[];
  tiktokAutomationRuns: TiktokAutomationRunRecord[];
  auditLogs: ControlAuditLog[];
  adminOverview: ControlAdminOverview | null;
  adminWorkspaceHealth: ControlAdminWorkspaceHealthRow[];
  serverConfigStatus: SyncServerConfigStatus | null;
  setSelectedWorkspaceId: (workspaceId: string | null) => void;
  refreshRuntime: () => Promise<void>;
  refreshWorkspaceList: () => Promise<void>;
  refreshWorkspaceDetails: (workspaceId: string) => Promise<void>;
  refreshAdminData: () => Promise<void>;
  refreshTiktokCookies: () => Promise<void>;
  refreshTiktokCookieSources: () => Promise<void>;
  refreshServerConfigStatus: () => Promise<void>;
  createWorkspace: (
    name: string,
    mode: "personal" | "team",
    options?: {
      planId?: "starter" | "team" | "scale" | "enterprise" | null;
      billingCycle?: "monthly" | "yearly";
    },
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
  createTiktokCookie: (
    input: CreateTiktokCookieInput,
    options?: TiktokCookieMutationOptions,
  ) => Promise<TiktokCookieRecord>;
  updateTiktokCookie: (
    id: string,
    input: UpdateTiktokCookieInput,
    options?: TiktokCookieMutationOptions,
  ) => Promise<TiktokCookieRecord>;
  deleteTiktokCookie: (id: string) => Promise<void>;
  testTiktokCookie: (
    id: string,
    options?: TiktokCookieMutationOptions,
  ) => Promise<void>;
  bulkCreateTiktokCookies: (
    input: BulkCreateTiktokCookiesInput,
    options?: TiktokCookieMutationOptions,
  ) => Promise<void>;
  replaceTiktokCookieSources: (
    rows: Array<{
      phone?: string;
      apiPhone?: string;
      cookie?: string;
    }>,
  ) => Promise<TiktokCookieSourceRecord[]>;
  refreshTiktokAutomationAccounts: (
    flowType?: TiktokAutomationFlowType,
  ) => Promise<void>;
  refreshTiktokAutomationRuns: (
    flowType?: TiktokAutomationFlowType,
  ) => Promise<void>;
  importTiktokAutomationAccounts: (
    input: ImportTiktokAutomationAccountsInput,
  ) => Promise<TiktokAutomationAccountRecord[]>;
  deleteTiktokAutomationAccount: (
    accountId: string,
  ) => Promise<TiktokAutomationAccountRecord[]>;
  createTiktokAutomationRun: (
    input: CreateTiktokAutomationRunInput,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  getTiktokAutomationRun: (
    runId: string,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  startTiktokAutomationRun: (
    runId: string,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  pauseTiktokAutomationRun: (
    runId: string,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  resumeTiktokAutomationRun: (
    runId: string,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  stopTiktokAutomationRun: (
    runId: string,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  updateTiktokAutomationRunItem: (
    runId: string,
    itemId: string,
    input: UpdateTiktokAutomationRunItemInput,
  ) => Promise<{
    run: TiktokAutomationRunRecord;
    item: TiktokAutomationRunItemRecord;
    items: TiktokAutomationRunItemRecord[];
  }>;
  pollTiktokAutomationRunEvents: (
    runId: string,
    since?: string | null,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
  adminTiktokState: AdminTiktokState | null;
  refreshAdminTiktokState: () => Promise<void>;
  saveAdminTiktokState: (
    input: SaveAdminTiktokStateInput,
  ) => Promise<AdminTiktokState>;
}

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const normalized = url.trim().replace(/\/$/, "");
  return normalized.length > 0 ? normalized : null;
}

function resolveRuntimeBaseUrl(settings?: SyncSettings | null): string | null {
  const configuredBaseUrl = normalizeBaseUrl(settings?.sync_server_url);
  const envBaseUrl = normalizeBaseUrl(process.env.NEXT_PUBLIC_SYNC_SERVER_URL);

  if (process.env.NODE_ENV !== "production") {
    return envBaseUrl ?? configuredBaseUrl ?? "http://127.0.0.1:12342";
  }

  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  if (envBaseUrl) {
    return envBaseUrl;
  }

  return null;
}

function resolveRuntimeToken(settings?: SyncSettings | null): string | null {
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

  if (envToken && envToken.length > 0) {
    return envToken;
  }

  if (configuredToken && configuredToken.length > 0) {
    return configuredToken;
  }

  return null;
}

function compactWorkflowCookiePreview(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= 96) {
    return trimmed;
  }
  return `${trimmed.slice(0, 96)}...`;
}

function compactAdminTiktokWorkflowRows(
  rows?: AdminTiktokState["workflowRows"],
): AdminTiktokState["workflowRows"] {
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.map((row) => ({
    ...row,
    cookiePreview: compactWorkflowCookiePreview(row?.cookiePreview),
  }));
}

function normalizeAdminTiktokState(
  workspaceId: string,
  input?: Partial<AdminTiktokState> | null,
): AdminTiktokState {
  const normalizedOperationProgress =
    input?.operationProgress &&
    typeof input.operationProgress.operationId === "string" &&
    typeof input.operationProgress.label === "string"
      ? {
          operationId: input.operationProgress.operationId,
          label: input.operationProgress.label,
          status:
            (input.operationProgress.status as AdminTiktokOperationProgressState["status"]) ??
            "idle",
          total: Math.max(0, Number(input.operationProgress.total ?? 0)),
          processed: Math.max(0, Number(input.operationProgress.processed ?? 0)),
          success: Math.max(0, Number(input.operationProgress.success ?? 0)),
          failed: Math.max(0, Number(input.operationProgress.failed ?? 0)),
          skipped: Math.max(0, Number(input.operationProgress.skipped ?? 0)),
          message:
            typeof input.operationProgress.message === "string"
              ? input.operationProgress.message
              : undefined,
          startedAt:
            typeof input.operationProgress.startedAt === "string"
              ? input.operationProgress.startedAt
              : new Date().toISOString(),
          updatedAt:
            typeof input.operationProgress.updatedAt === "string"
              ? input.operationProgress.updatedAt
              : new Date().toISOString(),
        }
      : null;
  return {
    workspaceId,
    bearerKey: input?.bearerKey ?? "",
    workflowRows: compactAdminTiktokWorkflowRows(input?.workflowRows),
    rotationCursor: Number(input?.rotationCursor ?? 0),
    workflowCaptchaProvider:
      input?.workflowCaptchaProvider === "omocaptcha" ? "omocaptcha" : "none",
    workflowCaptchaApiKey:
      typeof input?.workflowCaptchaApiKey === "string"
        ? input.workflowCaptchaApiKey
        : "",
    autoWorkflowRun:
      input?.autoWorkflowRun &&
      Array.isArray(input.autoWorkflowRun.queue) &&
      Number.isFinite(input.autoWorkflowRun.currentIndex)
        ? {
            queue: input.autoWorkflowRun.queue.filter(
              (profileId): profileId is string => typeof profileId === "string",
            ),
            currentIndex: Number(input.autoWorkflowRun.currentIndex ?? 0),
            activeProfileId:
              typeof input.autoWorkflowRun.activeProfileId === "string"
                ? input.autoWorkflowRun.activeProfileId
                : null,
            launching: Boolean(input.autoWorkflowRun.launching),
            observedRunning: Boolean(input.autoWorkflowRun.observedRunning),
            processingClose: Boolean(input.autoWorkflowRun.processingClose),
            windowProcessed: Math.max(
              0,
              Number(input.autoWorkflowRun.windowProcessed ?? 0),
            ),
            windowRejected: Math.max(
              0,
              Number(input.autoWorkflowRun.windowRejected ?? 0),
            ),
            pausedUntilMs:
              typeof input.autoWorkflowRun.pausedUntilMs === "number" &&
              Number.isFinite(input.autoWorkflowRun.pausedUntilMs)
                ? input.autoWorkflowRun.pausedUntilMs
                : null,
          }
        : null,
    operationProgress: normalizedOperationProgress,
    updatedAt: input?.updatedAt ?? new Date().toISOString(),
  };
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
      leftRow.actorRole !== rightRow.actorRole ||
      leftRow.createdAt !== rightRow.createdAt ||
      leftRow.createdBy !== rightRow.createdBy
    ) {
      return false;
    }
  }

  return true;
}

function resolvePreferredWorkspaceId(
  rows: ControlWorkspace[],
  preferredWorkspaceId: string | null,
): string | null {
  const preferred = preferredWorkspaceId?.trim();
  if (!preferred) {
    return null;
  }

  const directMatch = rows.find((workspace) => workspace.id === preferred);
  if (directMatch) {
    return directMatch.id;
  }

  if (preferred === "personal") {
    const personalWorkspace = rows.find((workspace) => workspace.mode === "personal");
    return personalWorkspace?.id ?? null;
  }

  if (preferred === "team") {
    const teamWorkspace = rows.find((workspace) => workspace.mode === "team");
    return teamWorkspace?.id ?? null;
  }

  return null;
}

function normalizeTiktokCookieRows(payload: unknown): TiktokCookieRecord[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object"
      ? ((payload as { data?: unknown }).data ??
          (payload as { items?: unknown }).items ??
          (payload as { cookies?: unknown }).cookies)
      : [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map((row, index) => {
    const candidate = row as Record<string, unknown>;
    return {
      id: `${candidate.id ?? index}`,
      label: `${candidate.label ?? candidate.name ?? `cookie-${index + 1}`}`,
      cookie: `${candidate.cookie ?? candidate.cookie_preview ?? ""}`,
      status: `${candidate.status ?? "unknown"}`,
      notes:
        candidate.notes === null || candidate.notes === undefined
          ? null
          : `${candidate.notes}`,
      testedAt:
        candidate.testedAt === null || candidate.testedAt === undefined
          ? `${candidate.last_used_at ?? candidate.last_tested_at ?? ""}` || null
          : `${candidate.testedAt}`,
      createdAt:
        candidate.createdAt === null || candidate.createdAt === undefined
          ? `${candidate.created_at ?? ""}` || undefined
          : `${candidate.createdAt}`,
      updatedAt:
        candidate.updatedAt === null || candidate.updatedAt === undefined
          ? `${candidate.updated_at ?? ""}` || undefined
          : `${candidate.updatedAt}`,
    } satisfies TiktokCookieRecord;
  });
}

function normalizeTiktokCookieMutationRow(
  payload: unknown,
  fallbackId?: string,
): TiktokCookieRecord | null {
  const normalizedRows = normalizeTiktokCookieRows(payload);
  if (normalizedRows.length > 0) {
    return normalizedRows[0];
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  const idValue = candidate.id ?? fallbackId;
  if (idValue === null || idValue === undefined || `${idValue}`.trim() === "") {
    return null;
  }
  return {
    id: `${idValue}`,
    label: `${candidate.label ?? candidate.name ?? `cookie-${idValue}`}`,
    cookie: `${candidate.cookie ?? candidate.cookie_preview ?? ""}`,
    status: `${candidate.status ?? "unknown"}`,
    notes:
      candidate.notes === null || candidate.notes === undefined
        ? null
        : `${candidate.notes}`,
    testedAt:
      candidate.testedAt === null || candidate.testedAt === undefined
        ? `${candidate.last_used_at ?? candidate.last_tested_at ?? ""}` || null
        : `${candidate.testedAt}`,
    createdAt:
      candidate.createdAt === null || candidate.createdAt === undefined
        ? `${candidate.created_at ?? ""}` || undefined
        : `${candidate.createdAt}`,
    updatedAt:
      candidate.updatedAt === null || candidate.updatedAt === undefined
        ? `${candidate.updated_at ?? ""}` || undefined
        : `${candidate.updatedAt}`,
  };
}

function isBugIdeaTiktokPath(path: string): boolean {
  return path.startsWith(BUGIDEA_TIKTOK_API_PREFIX);
}

function resolveControlPlaneCapability(path: string): string | null {
  const normalizedPath = path.replace(
    /^\/v1\/control\/workspaces\/[^/]+/,
    "",
  );
  if (normalizedPath.startsWith("/admin/tiktok-automation")) {
    return CONTROL_PLANE_TIKTOK_AUTOMATION_CAPABILITY;
  }
  return null;
}

export function useControlPlane(
  options: UseControlPlaneOptions = {},
): UseControlPlaneResult {
  const {
    includeAdminData = true,
    includeServerConfigStatus = true,
    includeWorkspaceDetails = true,
    includeTiktokData = true,
    workspaceScope = "member",
    actorUser = null,
    actorWorkspaceRole = null,
    preferredWorkspaceId = null,
  } = options;
  const user = actorUser;
  const isPlatformAdmin = user?.platformRole === "platform_admin";
  const canAccessBugIdeaProxy =
    isPlatformAdmin ||
    actorWorkspaceRole === "owner" ||
    actorWorkspaceRole === "admin";
  const actorUserId = user?.id ?? "";
  const actorEmail = user?.email ?? "";
  const actorPlatformRole = user?.platformRole ?? null;
  const actorIdentityKey = `${actorUserId}::${actorEmail.toLowerCase()}::${
    actorPlatformRole ?? "-"
  }`;
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
  const [tiktokCookies, setTiktokCookies] = useState<TiktokCookieRecord[]>([]);
  const [tiktokCookieSources, setTiktokCookieSources] = useState<
    TiktokCookieSourceRecord[]
  >([]);
  const [tiktokAutomationAccounts, setTiktokAutomationAccounts] = useState<
    TiktokAutomationAccountRecord[]
  >([]);
  const [tiktokAutomationRuns, setTiktokAutomationRuns] = useState<
    TiktokAutomationRunRecord[]
  >([]);
  const [auditLogs, setAuditLogs] = useState<ControlAuditLog[]>([]);
  const [adminOverview, setAdminOverview] =
    useState<ControlAdminOverview | null>(null);
  const [adminWorkspaceHealth, setAdminWorkspaceHealth] = useState<
    ControlAdminWorkspaceHealthRow[]
  >([]);
  const [adminTiktokState, setAdminTiktokState] =
    useState<AdminTiktokState | null>(null);
  const [serverConfigStatus, setServerConfigStatus] =
    useState<SyncServerConfigStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTiktokDataBootstrapping, setIsTiktokDataBootstrapping] =
    useState(false);
  const [isTiktokDataReady, setIsTiktokDataReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bugIdeaBearerRef = useRef("");
  const unsupportedControlPlaneCapabilitiesRef = useRef<Set<string>>(new Set());
  const tiktokBootstrapWorkspaceRef = useRef<string | null>(null);
  const previousActorIdentityRef = useRef<string | null>(null);
  const previousRuntimeBaseUrlRef = useRef<string | null | undefined>(
    undefined,
  );

  useEffect(() => {
    bugIdeaBearerRef.current = adminTiktokState?.bearerKey?.trim() ?? "";
  }, [adminTiktokState?.bearerKey]);

  useEffect(() => {
    const previousActorIdentity = previousActorIdentityRef.current;
    previousActorIdentityRef.current = actorIdentityKey;
    if (previousActorIdentity === null || previousActorIdentity === actorIdentityKey) {
      return;
    }

    unsupportedControlPlaneCapabilitiesRef.current.clear();
    tiktokBootstrapWorkspaceRef.current = null;
    globalGetRequestInFlight.clear();
    globalGetRequestCache.clear();
    setWorkspaces([]);
    setSelectedWorkspaceId(null);
    setOverview(null);
    setMemberships([]);
    setInvites([]);
    setShareGrants([]);
    setCoupons([]);
    setTiktokCookies([]);
    setTiktokCookieSources([]);
    setTiktokAutomationAccounts([]);
    setTiktokAutomationRuns([]);
    setAuditLogs([]);
    setAdminOverview(null);
    setAdminWorkspaceHealth([]);
    setAdminTiktokState(null);
    setIsTiktokDataBootstrapping(false);
    setIsTiktokDataReady(false);
    setError(null);
  }, [actorIdentityKey]);

  useEffect(() => {
    const previousBaseUrl = previousRuntimeBaseUrlRef.current;
    const didRuntimeSwitch =
      previousBaseUrl !== undefined && previousBaseUrl !== runtime.baseUrl;
    previousRuntimeBaseUrlRef.current = runtime.baseUrl;
    if (!didRuntimeSwitch) {
      return;
    }
    unsupportedControlPlaneCapabilitiesRef.current.clear();
    globalGetRequestInFlight.clear();
    globalGetRequestCache.clear();
  }, [runtime.baseUrl]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const isTiktokAutomationUnsupportedError = useCallback((value: unknown) => {
    return extractRootError(value).includes(
      CONTROL_PLANE_TIKTOK_AUTOMATION_UNSUPPORTED_ERROR,
    );
  }, []);

  const handleTiktokAutomationUnsupported = useCallback(() => {
    setTiktokAutomationAccounts([]);
    setTiktokAutomationRuns([]);
  }, []);

  const assertTiktokAutomationSupported = useCallback(() => {
    if (
      unsupportedControlPlaneCapabilitiesRef.current.has(
        CONTROL_PLANE_TIKTOK_AUTOMATION_CAPABILITY,
      )
    ) {
      throw new Error(CONTROL_PLANE_TIKTOK_AUTOMATION_UNSUPPORTED_ERROR);
    }
  }, []);

  const request = useCallback(
    async <T>(method: HttpMethod, path: string, body?: unknown): Promise<T> => {
      const isGetRequest = method === "GET";
      const serializedBody = body ? JSON.stringify(body) : "";
      const authScope = isBugIdeaTiktokPath(path)
        ? bugIdeaBearerRef.current
        : runtime.token ?? "";
      const cacheKey = [
        runtime.baseUrl ?? "bugidea",
        method,
        path,
        actorUserId,
        actorEmail.toLowerCase(),
        actorPlatformRole ?? "",
        authScope,
        serializedBody,
      ].join("::");
      const now = Date.now();

      if (isGetRequest) {
        const cached = globalGetRequestCache.get(cacheKey);
        if (cached && cached.expiresAt > now) {
          return cached.payload as T;
        }

        const inFlight = globalGetRequestInFlight.get(cacheKey);
        if (inFlight) {
          return inFlight as Promise<T>;
        }
      } else {
        globalGetRequestInFlight.clear();
        globalGetRequestCache.clear();
      }

      const executeRequest = async (): Promise<T> => {
      if (isBugIdeaTiktokPath(path)) {
        if (!canAccessBugIdeaProxy) {
          throw new Error("permission_denied");
        }
        const bearerToken = bugIdeaBearerRef.current;
        if (!bearerToken) {
          throw new Error("bugidea_bearer_required");
        }
        return invoke<T>("bugidea_tiktok_request", {
          method,
          path,
          bearerToken,
          baseUrl: null,
          body: body ?? null,
        });
      }

      if (!runtime.baseUrl || !runtime.token) {
        throw new Error("control_plane_not_configured");
      }
      if (!actorUserId || !actorEmail) {
        throw new Error("auth_required");
      }

      const capability = resolveControlPlaneCapability(path);
      if (
        capability &&
        unsupportedControlPlaneCapabilitiesRef.current.has(capability)
      ) {
        throw new Error(
          `${CONTROL_PLANE_CAPABILITY_UNSUPPORTED_PREFIX}${capability}`,
        );
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": actorUserId,
        "x-user-email": actorEmail,
      };

      if (actorPlatformRole) {
        headers["x-platform-role"] = actorPlatformRole;
      }
      headers.Authorization = `Bearer ${runtime.token}`;

      const response = await fetch(`${runtime.baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const rawBody = await response.text().catch(() => "");
        if (response.status === 404 && capability) {
          unsupportedControlPlaneCapabilitiesRef.current.add(capability);
          throw new Error(
            `${CONTROL_PLANE_CAPABILITY_UNSUPPORTED_PREFIX}${capability}`,
          );
        }
        throw new Error(`control_plane_${response.status}:${rawBody}`);
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
      };

      if (!isGetRequest) {
        return executeRequest();
      }

      const requestPromise = executeRequest()
        .then((payload) => {
          globalGetRequestCache.set(cacheKey, {
            payload,
            expiresAt: Date.now() + CONTROL_PLANE_GET_DEDUP_TTL_MS,
          });
          return payload;
        })
        .finally(() => {
          globalGetRequestInFlight.delete(cacheKey);
        });
      globalGetRequestInFlight.set(cacheKey, requestPromise);
      return requestPromise;
    },
    [
      actorEmail,
      actorPlatformRole,
      actorUserId,
      canAccessBugIdeaProxy,
      runtime.baseUrl,
      runtime.token,
    ],
  );

  const runWithLoading = useCallback(
    async <T>(
      run: () => Promise<T>,
      options?: {
        blocking?: boolean;
      },
    ) => {
      const shouldBlock = options?.blocking ?? true;
      if (shouldBlock) {
        setIsLoading(true);
      }
    try {
      return await run();
    } finally {
      if (shouldBlock) {
        setIsLoading(false);
      }
    }
    },
    [],
  );

  const refreshRuntime = useCallback(async () => {
    try {
      setError(null);
      const now = Date.now();
      if (runtimeSettingsCache && runtimeSettingsCache.expiresAt > now) {
        setRuntime(runtimeSettingsCache.runtime);
        if (
          !runtimeSettingsCache.runtime.baseUrl ||
          !runtimeSettingsCache.runtime.token
        ) {
          setError("control_plane_not_configured");
        }
        return;
      }

      if (!runtimeSettingsInFlight) {
        runtimeSettingsInFlight = (async () => {
          let settings: SyncSettings | null = null;
          try {
            settings = await invokeCached<SyncSettings>(
              "get_sync_settings",
              undefined,
              {
                key: "get_sync_settings",
                ttlMs: SYNC_SETTINGS_CACHE_TTL_MS,
              },
            );
          } catch {
            settings = null;
          }
          const nextRuntime: ControlPlaneRuntime = {
            baseUrl: resolveRuntimeBaseUrl(settings),
            token: resolveRuntimeToken(settings),
          };
          runtimeSettingsCache = {
            runtime: nextRuntime,
            expiresAt: Date.now() + CONTROL_PLANE_RUNTIME_CACHE_TTL_MS,
          };
          return nextRuntime;
        })().finally(() => {
          runtimeSettingsInFlight = null;
        });
      }

      const nextRuntime = await runtimeSettingsInFlight;
      setRuntime(nextRuntime);
      if (!nextRuntime.baseUrl || !nextRuntime.token) {
        setError("control_plane_not_configured");
      }
    } catch (runtimeError) {
      runtimeSettingsCache = null;
      runtimeSettingsInFlight = null;
      setRuntime({
        baseUrl: null,
        token: null,
      });
      setError(extractRootError(runtimeError));
    }
  }, []);

  const refreshWorkspaceList = useCallback(async () => {
    if (!runtime.baseUrl || !runtime.token) {
      setWorkspaces([]);
      setSelectedWorkspaceId(null);
      setError("control_plane_not_configured");
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      const effectiveWorkspaceScope =
        workspaceScope === "all" && isPlatformAdmin ? "all" : "member";
      const rows = await request<ControlWorkspace[]>(
        "GET",
        `/v1/control/workspaces?scope=${effectiveWorkspaceScope}`,
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
        const preferredWorkspace = resolvePreferredWorkspaceId(
          rows,
          preferredWorkspaceId,
        );
        if (preferredWorkspace) {
          return preferredWorkspace;
        }
        return rows[0].id;
      });
      },
      { blocking: false },
    ).catch((requestError) => {
      setError(extractRootError(requestError));
    });
  }, [
    preferredWorkspaceId,
    workspaceScope,
    isPlatformAdmin,
    request,
    runWithLoading,
    runtime.baseUrl,
    runtime.token,
  ]);

  const refreshWorkspaceDetails = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId) {
        setOverview(null);
        setMemberships([]);
        setInvites([]);
        setShareGrants([]);
        return;
      }
      if (!runtime.baseUrl || !runtime.token) {
        setOverview(null);
        setMemberships([]);
        setInvites([]);
        setShareGrants([]);
        setError("control_plane_not_configured");
        return;
      }

      await runWithLoading(
        async () => {
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
        },
        { blocking: false },
      ).catch((requestError) => {
        setError(extractRootError(requestError));
      });
    },
    [request, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const refreshAdminData = useCallback(async () => {
    if (!isPlatformAdmin) {
      setAdminOverview(null);
      setAdminWorkspaceHealth([]);
      setCoupons([]);
      setAuditLogs([]);
      setError(null);
      return;
    }
    if (!runtime.baseUrl || !runtime.token) {
      setAdminOverview(null);
      setAdminWorkspaceHealth([]);
      setCoupons([]);
      setAuditLogs([]);
      setError("control_plane_not_configured");
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        const [nextOverview, nextWorkspaceHealth, nextCoupons, nextAuditLogs] =
          await Promise.all([
          request<ControlAdminOverview>("GET", "/v1/control/admin/overview"),
          request<ControlAdminWorkspaceHealthRow[]>(
            "GET",
            "/v1/control/admin/workspace-health",
          ),
          request<ControlCoupon[]>("GET", "/v1/control/admin/coupons"),
          request<ControlAuditLog[]>(
            "GET",
            "/v1/control/admin/audit-logs?limit=50",
          ),
          ]);
        setAdminOverview(nextOverview);
        setAdminWorkspaceHealth(
          Array.isArray(nextWorkspaceHealth) ? nextWorkspaceHealth : [],
        );
        setCoupons(nextCoupons);
        setAuditLogs(nextAuditLogs);
      } catch (requestError) {
        setAdminOverview(null);
        setAdminWorkspaceHealth([]);
        setCoupons([]);
        setAuditLogs([]);
        setError(extractRootError(requestError));
      }
      },
      { blocking: false },
    );
  }, [isPlatformAdmin, request, runWithLoading, runtime.baseUrl, runtime.token]);

  const refreshTiktokCookies = useCallback(async () => {
    if (!canAccessBugIdeaProxy) {
      setTiktokCookies([]);
      setError(null);
      return;
    }
    if (!adminTiktokState?.bearerKey?.trim()) {
      setTiktokCookies([]);
      setError("bugidea_bearer_required");
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        const payload = await request<unknown>("GET", "/api/tiktok-cookies");
        setTiktokCookies(normalizeTiktokCookieRows(payload));
      } catch (requestError) {
        setTiktokCookies([]);
        setError(extractRootError(requestError));
      }
      },
      { blocking: false },
    );
  }, [
    adminTiktokState?.bearerKey,
    canAccessBugIdeaProxy,
    request,
    runWithLoading,
  ]);

  const refreshTiktokCookieSources = useCallback(async () => {
    if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
      setTiktokCookieSources([]);
      return;
    }
    if (!runtime.baseUrl || !runtime.token) {
      setTiktokCookieSources([]);
      setError("control_plane_not_configured");
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        const rows = await request<TiktokCookieSourceRecord[]>(
          "GET",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-cookie-sources`,
        );
        setTiktokCookieSources(Array.isArray(rows) ? rows : []);
      } catch (requestError) {
        setTiktokCookieSources([]);
        setError(extractRootError(requestError));
      }
      },
      { blocking: false },
    );
  }, [
    canAccessBugIdeaProxy,
    request,
    runWithLoading,
    runtime.baseUrl,
    runtime.token,
    selectedWorkspaceId,
  ]);

  const refreshAdminTiktokState = useCallback(async () => {
    if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
      setAdminTiktokState(null);
      return;
    }
    if (!runtime.baseUrl || !runtime.token) {
      setAdminTiktokState(null);
      setError("control_plane_not_configured");
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        const state = await request<AdminTiktokState>(
          "GET",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-state`,
        );
        setAdminTiktokState(
          normalizeAdminTiktokState(selectedWorkspaceId, state),
        );
      } catch (requestError) {
        setAdminTiktokState(null);
        setError(extractRootError(requestError));
      }
      },
      { blocking: false },
    );
  }, [
    canAccessBugIdeaProxy,
    request,
    runWithLoading,
    runtime.baseUrl,
    runtime.token,
    selectedWorkspaceId,
  ]);

  const saveAdminTiktokState = useCallback(
    async (input: SaveAdminTiktokStateInput) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      return (async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
        }
        const compactInput: SaveAdminTiktokStateInput = {
          ...input,
          workflowRows: compactAdminTiktokWorkflowRows(input.workflowRows),
        };
        const state = await request<AdminTiktokState>(
          "PUT",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-state`,
          compactInput,
        );
        const normalizedState = normalizeAdminTiktokState(
          selectedWorkspaceId,
          state,
        );
        setAdminTiktokState(normalizedState);
        return normalizedState;
      })().catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      canAccessBugIdeaProxy,
      request,
      runtime.baseUrl,
      runtime.token,
      selectedWorkspaceId,
    ],
  );

  const refreshServerConfigStatus = useCallback(async () => {
    if (!runtime.baseUrl || !runtime.token) {
      setServerConfigStatus(null);
      setError("control_plane_not_configured");
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        headers.Authorization = `Bearer ${runtime.token}`;

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
      },
      { blocking: false },
    );
  }, [runWithLoading, runtime.baseUrl, runtime.token]);

  const createWorkspace = useCallback(
    async (
      name: string,
      mode: "personal" | "team",
      options?: {
        planId?: "starter" | "team" | "scale" | "enterprise" | null;
        billingCycle?: "monthly" | "yearly";
      },
    ) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
        }
        const created = await request<ControlWorkspace>(
          "POST",
          "/v1/control/workspaces",
          {
            name,
            mode,
          },
        );
        if (options?.planId && options.billingCycle) {
          await request(
            "PATCH",
            `/v1/control/workspaces/${created.id}/billing/subscription/admin-override`,
            {
              planId: options.planId,
              billingCycle: options.billingCycle,
            },
          );
        }
        await refreshWorkspaceList();
        setSelectedWorkspaceId(created.id);
        return created;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      refreshWorkspaceList,
      request,
      runWithLoading,
      runtime.baseUrl,
      runtime.token,
    ],
  );

  const createInvite = useCallback(
    async (workspaceId: string, email: string, role: TeamRole) => {
      return runWithLoading(async () => {
        setError(null);
        if (role !== "member" && role !== "viewer") {
          throw new Error("invalid_invite_role");
        }
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const revokeInvite = useCallback(
    async (workspaceId: string, inviteId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, runtime.token],
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
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const removeMembership = useCallback(
    async (workspaceId: string, targetUserId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, runtime.token],
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
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const revokeShareGrant = useCallback(
    async (workspaceId: string, shareGrantId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [request, refreshWorkspaceDetails, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const createCoupon = useCallback(
    async (input: CreateCouponInput) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [refreshAdminData, request, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const revokeCoupon = useCallback(
    async (couponId: string, reason: string) => {
      return runWithLoading(async () => {
        setError(null);
        if (!runtime.baseUrl || !runtime.token) {
          throw new Error("control_plane_not_configured");
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
    [refreshAdminData, request, runWithLoading, runtime.baseUrl, runtime.token],
  );

  const createTiktokCookie = useCallback(
    async (
      input: CreateTiktokCookieInput,
      options?: TiktokCookieMutationOptions,
    ) => {
      return runWithLoading(async () => {
        setError(null);
        const createdPayload = await request<unknown>(
          "POST",
          "/api/tiktok-cookies",
          input,
        );
        const created = normalizeTiktokCookieMutationRow(createdPayload);
        if (!created) {
          throw new Error("bugidea_cookie_create_invalid_response");
        }
        setTiktokCookies((current) => {
          const next = [...current];
          const matchedIndex = next.findIndex((row) => row.id === created.id);
          if (matchedIndex >= 0) {
            next[matchedIndex] = created;
          } else {
            next.unshift(created);
          }
          return next;
        });
        if (options?.refresh !== false) {
          await refreshTiktokCookies();
        }
        return created;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshTiktokCookies, request, runWithLoading],
  );

  const updateTiktokCookie = useCallback(
    async (
      id: string,
      input: UpdateTiktokCookieInput,
      options?: TiktokCookieMutationOptions,
    ) => {
      return runWithLoading(async () => {
        setError(null);
        const updatedPayload = await request<unknown>(
          "PUT",
          `/api/tiktok-cookies/${id}`,
          input,
        );
        const updated = normalizeTiktokCookieMutationRow(updatedPayload, id);
        if (!updated) {
          throw new Error("bugidea_cookie_update_invalid_response");
        }
        setTiktokCookies((current) =>
          current.map((row) => (row.id === id ? updated : row)),
        );
        if (options?.refresh !== false) {
          await refreshTiktokCookies();
        }
        return updated;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshTiktokCookies, request, runWithLoading],
  );

  const deleteTiktokCookie = useCallback(
    async (id: string) => {
      return runWithLoading(async () => {
        setError(null);
        await request<void>("DELETE", `/api/tiktok-cookies/${id}`);
        setTiktokCookies((current) => current.filter((row) => row.id !== id));
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [request, runWithLoading],
  );

  const testTiktokCookie = useCallback(
    async (id: string, options?: TiktokCookieMutationOptions) => {
      return runWithLoading(async () => {
        setError(null);
        await request<void>("POST", `/api/tiktok-cookies/${id}/test`);
        if (options?.refresh !== false) {
          await refreshTiktokCookies();
        }
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshTiktokCookies, request, runWithLoading],
  );

  const bulkCreateTiktokCookies = useCallback(
    async (
      input: BulkCreateTiktokCookiesInput,
      options?: TiktokCookieMutationOptions,
    ) => {
      return runWithLoading(async () => {
        setError(null);
        await request<void>("POST", "/api/tiktok-cookies/bulk", input);
        if (options?.refresh !== false) {
          await refreshTiktokCookies();
        }
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [refreshTiktokCookies, request, runWithLoading],
  );

  const replaceTiktokCookieSources = useCallback(
    async (
      rows: Array<{
        phone?: string;
        apiPhone?: string;
        cookie?: string;
      }>,
    ) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      return runWithLoading(async () => {
        setError(null);
        const nextRows = await request<TiktokCookieSourceRecord[]>(
          "PUT",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-cookie-sources`,
          { rows },
        );
        const normalizedRows = Array.isArray(nextRows) ? nextRows : [];
        setTiktokCookieSources(normalizedRows);
        return normalizedRows;
      }).catch((requestError) => {
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [canAccessBugIdeaProxy, request, runWithLoading, selectedWorkspaceId],
  );

  const refreshTiktokAutomationAccounts = useCallback(
    async (flowType?: TiktokAutomationFlowType) => {
    if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
      setTiktokAutomationAccounts([]);
      return;
    }
    if (!runtime.baseUrl || !runtime.token) {
      setTiktokAutomationAccounts([]);
      setError("control_plane_not_configured");
      return;
    }
    if (
      unsupportedControlPlaneCapabilitiesRef.current.has(
        CONTROL_PLANE_TIKTOK_AUTOMATION_CAPABILITY,
      )
    ) {
      setTiktokAutomationAccounts([]);
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        assertTiktokAutomationSupported();
        const query =
          flowType && flowType.trim().length > 0
            ? `?flowType=${encodeURIComponent(flowType)}`
            : "";
        const rows = await request<TiktokAutomationAccountRecord[]>(
          "GET",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/accounts${query}`,
        );
        setTiktokAutomationAccounts(Array.isArray(rows) ? rows : []);
      } catch (requestError) {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
          return;
        }
        setTiktokAutomationAccounts([]);
        setError(extractRootError(requestError));
      }
      },
      { blocking: false },
    );
    },
    [
    assertTiktokAutomationSupported,
    handleTiktokAutomationUnsupported,
    canAccessBugIdeaProxy,
    isTiktokAutomationUnsupportedError,
    request,
    runWithLoading,
    runtime.baseUrl,
    runtime.token,
    selectedWorkspaceId,
    ],
  );

  const refreshTiktokAutomationRuns = useCallback(
    async (flowType?: TiktokAutomationFlowType) => {
    if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
      setTiktokAutomationRuns([]);
      return;
    }
    if (!runtime.baseUrl || !runtime.token) {
      setTiktokAutomationRuns([]);
      setError("control_plane_not_configured");
      return;
    }
    if (
      unsupportedControlPlaneCapabilitiesRef.current.has(
        CONTROL_PLANE_TIKTOK_AUTOMATION_CAPABILITY,
      )
    ) {
      setTiktokAutomationRuns([]);
      return;
    }

    await runWithLoading(
      async () => {
      setError(null);
      try {
        assertTiktokAutomationSupported();
        const query =
          flowType && flowType.trim().length > 0
            ? `?flowType=${encodeURIComponent(flowType)}`
            : "";
        const rows = await request<TiktokAutomationRunRecord[]>(
          "GET",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/runs${query}`,
        );
        setTiktokAutomationRuns(Array.isArray(rows) ? rows : []);
      } catch (requestError) {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
          return;
        }
        setTiktokAutomationRuns([]);
        setError(extractRootError(requestError));
      }
      },
      { blocking: false },
    );
    },
    [
    assertTiktokAutomationSupported,
    handleTiktokAutomationUnsupported,
    canAccessBugIdeaProxy,
    isTiktokAutomationUnsupportedError,
    request,
    runWithLoading,
    runtime.baseUrl,
    runtime.token,
    selectedWorkspaceId,
    ],
  );

  const importTiktokAutomationAccounts = useCallback(
    async (input: ImportTiktokAutomationAccountsInput) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      assertTiktokAutomationSupported();
      return runWithLoading(async () => {
        setError(null);
        const rows = await request<TiktokAutomationAccountRecord[]>(
          "POST",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/import`,
          input,
        );
        const normalizedRows = Array.isArray(rows) ? rows : [];
        setTiktokAutomationAccounts(normalizedRows);
        return normalizedRows;
      }).catch((requestError) => {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
        }
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      assertTiktokAutomationSupported,
      handleTiktokAutomationUnsupported,
      canAccessBugIdeaProxy,
      isTiktokAutomationUnsupportedError,
      request,
      runWithLoading,
      selectedWorkspaceId,
    ],
  );

  const deleteTiktokAutomationAccount = useCallback(
    async (accountId: string) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      const normalizedAccountId = accountId.trim();
      if (!normalizedAccountId) {
        throw new Error("account_id_required");
      }
      assertTiktokAutomationSupported();
      return runWithLoading(async () => {
        setError(null);
        const rows = await request<TiktokAutomationAccountRecord[]>(
          "DELETE",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/accounts/${encodeURIComponent(
            normalizedAccountId,
          )}`,
        );
        const normalizedRows = Array.isArray(rows) ? rows : [];
        setTiktokAutomationAccounts(normalizedRows);
        return normalizedRows;
      }).catch((requestError) => {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
        }
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      assertTiktokAutomationSupported,
      handleTiktokAutomationUnsupported,
      canAccessBugIdeaProxy,
      isTiktokAutomationUnsupportedError,
      request,
      runWithLoading,
      selectedWorkspaceId,
    ],
  );

  const createTiktokAutomationRun = useCallback(
    async (input: CreateTiktokAutomationRunInput) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      assertTiktokAutomationSupported();
      return runWithLoading(async () => {
        setError(null);
        const payload = await request<{
          run: TiktokAutomationRunRecord;
          items: TiktokAutomationRunItemRecord[];
        }>(
          "POST",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/runs`,
          input,
        );
        await refreshTiktokAutomationRuns();
        return payload;
      }).catch((requestError) => {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
        }
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      assertTiktokAutomationSupported,
      handleTiktokAutomationUnsupported,
      canAccessBugIdeaProxy,
      isTiktokAutomationUnsupportedError,
      refreshTiktokAutomationRuns,
      request,
      runWithLoading,
      selectedWorkspaceId,
    ],
  );

  const getTiktokAutomationRun = useCallback(
    async (runId: string) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      assertTiktokAutomationSupported();
      return request<{
        run: TiktokAutomationRunRecord;
        items: TiktokAutomationRunItemRecord[];
      }>(
        "GET",
        `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/runs/${runId}`,
      );
    },
    [
      assertTiktokAutomationSupported,
      canAccessBugIdeaProxy,
      request,
      selectedWorkspaceId,
    ],
  );

  const updateTiktokAutomationRunStatus = useCallback(
    async (runId: string, action: "start" | "pause" | "resume" | "stop") => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      assertTiktokAutomationSupported();
      return runWithLoading(async () => {
        setError(null);
        const payload = await request<{
          run: TiktokAutomationRunRecord;
          items: TiktokAutomationRunItemRecord[];
        }>(
          "POST",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/runs/${runId}/${action}`,
        );
        await refreshTiktokAutomationRuns();
        return payload;
      }).catch((requestError) => {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
        }
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      assertTiktokAutomationSupported,
      handleTiktokAutomationUnsupported,
      canAccessBugIdeaProxy,
      isTiktokAutomationUnsupportedError,
      refreshTiktokAutomationRuns,
      request,
      runWithLoading,
      selectedWorkspaceId,
    ],
  );

  const startTiktokAutomationRun = useCallback(
    async (runId: string) =>
      updateTiktokAutomationRunStatus(runId, "start"),
    [updateTiktokAutomationRunStatus],
  );

  const pauseTiktokAutomationRun = useCallback(
    async (runId: string) =>
      updateTiktokAutomationRunStatus(runId, "pause"),
    [updateTiktokAutomationRunStatus],
  );

  const resumeTiktokAutomationRun = useCallback(
    async (runId: string) =>
      updateTiktokAutomationRunStatus(runId, "resume"),
    [updateTiktokAutomationRunStatus],
  );

  const stopTiktokAutomationRun = useCallback(
    async (runId: string) =>
      updateTiktokAutomationRunStatus(runId, "stop"),
    [updateTiktokAutomationRunStatus],
  );

  const updateTiktokAutomationRunItem = useCallback(
    async (
      runId: string,
      itemId: string,
      input: UpdateTiktokAutomationRunItemInput,
    ) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      assertTiktokAutomationSupported();
      return runWithLoading(async () => {
        setError(null);
        const payload = await request<{
          run: TiktokAutomationRunRecord;
          item: TiktokAutomationRunItemRecord;
          items: TiktokAutomationRunItemRecord[];
        }>(
          "PUT",
          `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/runs/${runId}/items/${itemId}`,
          input,
        );
        await refreshTiktokAutomationRuns();
        return payload;
      }).catch((requestError) => {
        if (isTiktokAutomationUnsupportedError(requestError)) {
          handleTiktokAutomationUnsupported();
        }
        setError(extractRootError(requestError));
        throw requestError;
      });
    },
    [
      assertTiktokAutomationSupported,
      handleTiktokAutomationUnsupported,
      canAccessBugIdeaProxy,
      isTiktokAutomationUnsupportedError,
      refreshTiktokAutomationRuns,
      request,
      runWithLoading,
      selectedWorkspaceId,
    ],
  );

  const pollTiktokAutomationRunEvents = useCallback(
    async (runId: string, since?: string | null) => {
      if (!canAccessBugIdeaProxy || !selectedWorkspaceId) {
        throw new Error("permission_denied");
      }
      assertTiktokAutomationSupported();
      const query =
        since && since.trim().length > 0
          ? `?since=${encodeURIComponent(since)}`
          : "";
      return request<{
        run: TiktokAutomationRunRecord;
        items: TiktokAutomationRunItemRecord[];
      }>(
        "GET",
        `/v1/control/workspaces/${selectedWorkspaceId}/admin/tiktok-automation/runs/${runId}/events${query}`,
      );
    },
    [
      assertTiktokAutomationSupported,
      canAccessBugIdeaProxy,
      request,
      selectedWorkspaceId,
    ],
  );

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  useEffect(() => {
    if (!runtime.baseUrl || !runtime.token) {
      return;
    }
    void refreshWorkspaceList();
    if (isPlatformAdmin) {
      if (includeAdminData) {
        void refreshAdminData();
      }
      if (includeServerConfigStatus) {
        void refreshServerConfigStatus();
      }
    }
  }, [
    includeAdminData,
    includeServerConfigStatus,
    isPlatformAdmin,
    refreshAdminData,
    refreshServerConfigStatus,
    refreshWorkspaceList,
    runtime.baseUrl,
    runtime.token,
  ]);

  useEffect(() => {
    if (!includeTiktokData) {
      return;
    }
    if (!canAccessBugIdeaProxy) {
      return;
    }
    if (!runtime.baseUrl || !runtime.token) {
      return;
    }
    if (!adminTiktokState?.bearerKey?.trim()) {
      return;
    }
    void refreshTiktokCookies();
  }, [
    adminTiktokState?.bearerKey,
    canAccessBugIdeaProxy,
    includeTiktokData,
    refreshTiktokCookies,
    runtime.baseUrl,
    runtime.token,
  ]);

  useEffect(() => {
    if (!selectedWorkspaceId) {
      tiktokBootstrapWorkspaceRef.current = null;
      setIsTiktokDataBootstrapping(false);
      setIsTiktokDataReady(false);
      setOverview(null);
      setMemberships([]);
      setInvites([]);
      setShareGrants([]);
      setAdminTiktokState(null);
      setTiktokCookieSources([]);
      setTiktokAutomationAccounts([]);
      setTiktokAutomationRuns([]);
      return;
    }
    if (includeWorkspaceDetails) {
      void refreshWorkspaceDetails(selectedWorkspaceId);
    } else {
      setOverview(null);
      setMemberships([]);
      setInvites([]);
      setShareGrants([]);
    }
    if (canAccessBugIdeaProxy && includeTiktokData) {
      if (tiktokBootstrapWorkspaceRef.current === selectedWorkspaceId) {
        return;
      }
      tiktokBootstrapWorkspaceRef.current = selectedWorkspaceId;
      setIsTiktokDataBootstrapping(true);
      setIsTiktokDataReady(false);
      let isCancelled = false;
      let backgroundTimer: ReturnType<typeof setTimeout> | null = null;
      void Promise.allSettled([
        refreshAdminTiktokState(),
        refreshTiktokAutomationRuns(),
      ]).finally(() => {
        if (isCancelled) {
          return;
        }
        setIsTiktokDataBootstrapping(false);
        setIsTiktokDataReady(true);
        backgroundTimer = setTimeout(() => {
          if (isCancelled) {
            return;
          }
          void Promise.allSettled([
            refreshTiktokCookieSources(),
            refreshTiktokAutomationAccounts(),
          ]);
        }, 750);
      });
      return () => {
        isCancelled = true;
        if (backgroundTimer) {
          clearTimeout(backgroundTimer);
        }
      };
    } else if (!includeTiktokData) {
      tiktokBootstrapWorkspaceRef.current = null;
      setIsTiktokDataBootstrapping(false);
      setIsTiktokDataReady(false);
      setAdminTiktokState(null);
      setTiktokCookieSources([]);
      setTiktokAutomationAccounts([]);
      setTiktokAutomationRuns([]);
      setTiktokCookies([]);
    }
  }, [
    includeTiktokData,
    includeWorkspaceDetails,
    canAccessBugIdeaProxy,
    refreshAdminTiktokState,
    refreshTiktokAutomationAccounts,
    refreshTiktokAutomationRuns,
    refreshTiktokCookieSources,
    refreshWorkspaceDetails,
    selectedWorkspaceId,
  ]);

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
    isTiktokDataBootstrapping,
    isTiktokDataReady,
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
    tiktokCookies,
    tiktokCookieSources,
    tiktokAutomationAccounts,
    tiktokAutomationRuns,
    auditLogs,
    adminOverview,
    adminWorkspaceHealth,
    serverConfigStatus,
    setSelectedWorkspaceId,
    refreshRuntime,
    refreshWorkspaceList,
    refreshWorkspaceDetails,
    refreshAdminData,
    refreshTiktokCookies,
    refreshTiktokCookieSources,
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
    createTiktokCookie,
    updateTiktokCookie,
    deleteTiktokCookie,
    testTiktokCookie,
    bulkCreateTiktokCookies,
    replaceTiktokCookieSources,
    refreshTiktokAutomationAccounts,
    refreshTiktokAutomationRuns,
    importTiktokAutomationAccounts,
    deleteTiktokAutomationAccount,
    createTiktokAutomationRun,
    getTiktokAutomationRun,
    startTiktokAutomationRun,
    pauseTiktokAutomationRun,
    resumeTiktokAutomationRun,
    stopTiktokAutomationRun,
    updateTiktokAutomationRunItem,
    pollTiktokAutomationRunEvents,
    adminTiktokState,
    refreshAdminTiktokState,
    saveAdminTiktokState,
  };
}
