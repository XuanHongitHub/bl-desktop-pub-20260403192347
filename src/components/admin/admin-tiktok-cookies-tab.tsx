"use client";

import { invoke } from "@tauri-apps/api/core";
import {
  ChevronsRight,
  Clock3,
  Copy,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  PlusCircle,
  RefreshCw,
  Save,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import {
  type ChangeEvent,
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import { LoadingButton } from "@/components/loading-button";
import { OperationProgressCard } from "@/components/ui/operation-progress-card";
import { usePersistentOperationProgress } from "@/hooks/use-persistent-operation-progress";
import { extractRootError } from "@/lib/error-utils";
import { formatLocaleDateTime } from "@/lib/locale-format";
import {
  applyWorkflowCookiePreviewRecords,
  selectWorkflowCookieProfilesForHydration,
} from "@/lib/tiktok-workflow-cookie-hydration";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import type {
  AdminTiktokAutoWorkflowRunState,
  AdminTiktokOperationProgressState,
  AdminTiktokState,
  AdminTiktokWorkflowRow,
  BrowserProfile,
  CookieReadResult,
  StoredProxy,
  TiktokAutomationAccountRecord,
  TiktokAutomationFlowType,
  TiktokAutomationItemStatus,
  TiktokAutomationRunItemRecord,
  TiktokAutomationRunMode,
  TiktokAutomationRunRecord,
  TiktokAutomationRunStatus,
  TiktokCookieRecord,
  TiktokCookieSourceRecord,
  UnifiedCookie,
} from "@/types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Spinner } from "../ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { TablePaginationControls } from "../ui/table-pagination-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Textarea } from "../ui/textarea";
import { RippleButton } from "../ui/ripple";

interface AdminTiktokCookiesTabProps {
  isPlatformAdmin: boolean;
  isBusy: boolean;
  isTiktokDataBootstrapping?: boolean;
  isTiktokDataReady?: boolean;
  workspaceId: string | null;
  adminTiktokState: AdminTiktokState | null;
  workspaceProfiles: BrowserProfile[];
  storedProxies: StoredProxy[];
  isWorkspaceProfilesLoading?: boolean;
  isStoredProxiesLoading?: boolean;
  refreshWorkspaceProfiles: () => Promise<void>;
  refreshStoredProxies: () => Promise<void>;
  tiktokCookies: TiktokCookieRecord[];
  tiktokCookieSources: TiktokCookieSourceRecord[];
  tiktokAutomationAccounts: TiktokAutomationAccountRecord[];
  tiktokAutomationRuns: TiktokAutomationRunRecord[];
  refreshTiktokCookies: () => Promise<void>;
  refreshTiktokCookieSources: () => Promise<void>;
  refreshTiktokAutomationAccounts: () => Promise<void>;
  refreshTiktokAutomationRuns: () => Promise<void>;
  refreshAdminTiktokState: () => Promise<void>;
  saveAdminTiktokState: (input: {
    bearerKey: string;
    workflowRows: AdminTiktokWorkflowRow[];
    rotationCursor: number;
    autoWorkflowRun?: AdminTiktokAutoWorkflowRunState | null;
    operationProgress?: AdminTiktokOperationProgressState | null;
  }) => Promise<AdminTiktokState>;
  createTiktokCookie: (input: {
    label: string;
    cookie: string;
    notes?: string;
  }, options?: { refresh?: boolean }) => Promise<TiktokCookieRecord>;
  updateTiktokCookie: (
    id: string,
    input: {
      label?: string;
      cookie?: string;
      status?: string;
      notes?: string;
    },
    options?: { refresh?: boolean },
  ) => Promise<TiktokCookieRecord>;
  deleteTiktokCookie: (id: string) => Promise<void>;
  testTiktokCookie: (id: string, options?: { refresh?: boolean }) => Promise<void>;
  bulkCreateTiktokCookies: (input: {
    cookies: string[];
    prefix?: string;
  }, options?: { refresh?: boolean }) => Promise<void>;
  replaceTiktokCookieSources: (
    rows: Array<{
      phone?: string;
      apiPhone?: string;
      cookie?: string;
    }>,
  ) => Promise<TiktokCookieSourceRecord[]>;
  importTiktokAutomationAccounts: (input: {
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
  }) => Promise<TiktokAutomationAccountRecord[]>;
  createTiktokAutomationRun: (input: {
    flowType: TiktokAutomationFlowType;
    mode: TiktokAutomationRunMode;
    accountIds?: string[];
  }) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
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
    input: {
      status?: TiktokAutomationItemStatus;
      step?: string;
      attempt?: number;
      profileId?: string | null;
      profileName?: string | null;
      cookiePreview?: string | null;
      errorCode?: string | null;
      errorMessage?: string | null;
    },
  ) => Promise<{
    run: TiktokAutomationRunRecord;
    item: TiktokAutomationRunItemRecord;
    items: TiktokAutomationRunItemRecord[];
  }>;
  pollTiktokAutomationRunEvents: (
    runId: string,
    since?: string | null,
  ) => Promise<{ run: TiktokAutomationRunRecord; items: TiktokAutomationRunItemRecord[] }>;
}

type BrowserTypeString =
  | "firefox"
  | "firefox-developer"
  | "chromium"
  | "brave"
  | "zen"
  | "camoufox"
  | "wayfern";

type WorkflowPhoneCountry = "US";
type WorkflowMode = "single" | "multi";
type WorkflowPhoneSource = "manual" | "list" | "file" | "api_phone";
type WorkflowConfigTab = "basic" | "advanced";
type WorkflowDataView = "results" | "queue" | "logs";
type WorkflowSyncStatus =
  | "needs_sync"
  | "synced"
  | "missing_cookie"
  | "conflict"
  | "sync_error";
type WorkflowStatusFilter = "all" | WorkflowSyncStatus;
type WorkflowLaunchIntent = "shop_refresh" | "relogin";
type SemiAutoTaskRow = AdminTiktokWorkflowRow & {
  browser: BrowserTypeString;
  localCookieSnapshot?: string | null;
};
type AutoWorkflowRunState = AdminTiktokAutoWorkflowRunState;
type ManualWorkflowWatchState = {
  profileId: string;
  observedRunning: boolean;
  processingClose: boolean;
};

interface TiktokAccountCookieSourceRow {
  phone: string;
  api_phone: string;
  cookie: string;
}

const BUGIDEA_AUTOMATION_PROFILE_TAGS = new Set([
  "bugidea-automation",
  "bugidea-sync",
]);
const COOKIE_TEST_FRESH_TTL_MS = 6 * 60 * 60 * 1000;
const WORKFLOW_SHOP_REFRESH_RUNTIME_MS = 10_000;
const WORKFLOW_COOKIE_HYDRATE_BATCH_SIZE = 4;
const workflowCookiePreviewCacheByWorkspace = new Map<
  string,
  Map<string, { preview: string; snapshot: string }>
>();

function getWorkflowCookiePreviewCache(
  workspaceId: string,
): Map<string, { preview: string; snapshot: string }> {
  const existing = workflowCookiePreviewCacheByWorkspace.get(workspaceId);
  if (existing) {
    return existing;
  }
  const next = new Map<string, { preview: string; snapshot: string }>();
  workflowCookiePreviewCacheByWorkspace.set(workspaceId, next);
  return next;
}

interface TiktokCookieExtractionResult {
  cookieHeader: string;
  matchedDomainCount: number;
  matchedCookieCount: number;
}

const BROWSER_OPTIONS: Array<{ value: BrowserTypeString; label: string }> = [
  { value: "chromium", label: "Chromium" },
  { value: "brave", label: "Brave" },
  { value: "firefox", label: "Firefox" },
  { value: "firefox-developer", label: "Firefox Developer" },
  { value: "zen", label: "Zen" },
  { value: "camoufox", label: "Camoufox" },
  { value: "wayfern", label: "Wayfern" },
];

const WORKFLOW_PHONE_COUNTRY_OPTIONS: Array<{
  value: WorkflowPhoneCountry;
  labelKey: string;
  dialCode: string;
}> = [
  {
    value: "US",
    labelKey: "adminWorkspace.tiktokCookies.workflow.phoneCountryUs",
    dialCode: "+1",
  },
];

function formatTimestamp(value?: string | null): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return formatLocaleDateTime(parsed);
}

function parseTimestampMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  const ms = parsed.getTime();
  if (Number.isNaN(ms)) {
    return null;
  }
  return ms;
}

function summarizeCookieValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `${trimmed.slice(0, 7)}...${trimmed.slice(-7)}`;
}

function toCookieImportContent(rawCookie: string): string {
  const trimmed = rawCookie.trim();
  if (!trimmed) {
    return trimmed;
  }

  const looksLikeJson =
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"));
  const looksLikeNetscape =
    trimmed.startsWith("# Netscape HTTP Cookie File") || trimmed.includes("\t");

  if (looksLikeJson || looksLikeNetscape) {
    return trimmed;
  }

  const pairs = trimmed
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf("=");
      if (idx <= 0) {
        return null;
      }
      const name = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      if (!name || !value) {
        return null;
      }
      return { name, value };
    })
    .filter((item): item is { name: string; value: string } => Boolean(item));

  if (pairs.length === 0) {
    return trimmed;
  }

  return JSON.stringify(
    pairs.map((pair) => ({
      name: pair.name,
      value: pair.value,
      domain: ".tiktok.com",
      path: "/",
      secure: true,
      httpOnly: false,
      sameSite: "no_restriction",
      session: true,
      hostOnly: false,
    })),
  );
}

function summarizeSecretValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "-";
  }
  if (trimmed.length <= 12) {
    return "••••••••";
  }
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function formatWorkflowPhoneValue(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.includes("://")) {
    return trimmed;
  }
  const digitsOnly = trimmed.replace(/\D/g, "");
  return digitsOnly || trimmed;
}

function formatApiPhoneCompact(value?: string | null): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "-";
  }
  try {
    const parsed = new URL(trimmed);
    const token = parsed.searchParams.get("token");
    const tokenLabel = token ? ` token=${summarizeSecretValue(token)}` : "";
    return `${parsed.hostname}${parsed.pathname}${tokenLabel}`;
  } catch {
    if (trimmed.length <= 34) {
      return trimmed;
    }
    return `${trimmed.slice(0, 18)}...${trimmed.slice(-12)}`;
  }
}

function formatWorkflowCookieCell(cookieHeader?: string | null): string {
  const trimmed = cookieHeader?.trim();
  if (!trimmed) {
    return "-";
  }
  if (trimmed.length <= 84) {
    return trimmed;
  }
  return `${trimmed.slice(0, 84)}...`;
}

function toWorkflowCookiePreview(cookieHeader?: string | null): string | null {
  const trimmed = cookieHeader?.trim();
  if (!trimmed) {
    return null;
  }

  const rawPairs = trimmed
    .split(";")
    .map((pair) => pair.trim())
    .filter(Boolean);
  if (rawPairs.length === 0) {
    return formatWorkflowCookieCell(trimmed);
  }

  const previewPairs = rawPairs.slice(0, 3).map((pair) => {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) {
      return formatWorkflowCookieCell(pair);
    }
    const name = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!name || !value) {
      return formatWorkflowCookieCell(pair);
    }
    return `${name}=${summarizeSecretValue(value)}`;
  });
  const remainingCount = rawPairs.length - previewPairs.length;
  const suffix = remainingCount > 0 ? ` +${remainingCount}` : "";
  return formatWorkflowCookieCell(`${previewPairs.join("; ")}${suffix}`);
}

function toWorkflowLocalCookieSnapshot(
  cookieHeader?: string | null,
): string | null {
  const trimmed = cookieHeader?.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.includes("••••") ||
    trimmed.includes("...") ||
    /\s\+\d+$/.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

function isFirefoxLockRaceErrorMessage(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("already running") ||
    lower.includes("not responding") ||
    lower.includes("close firefox") ||
    lower.includes("profile appears to be in use")
  );
}

function getWorkflowDisplayLabel(profileName: string): string {
  return profileName.replace(/^BugIdeaSync\s+/i, "").trim() || profileName;
}

function getCanonicalCookieLabel(value: string): string {
  return getWorkflowDisplayLabel(value).replace(/-shop$/i, "").trim();
}

function normalizeCookieLabelForMatch(value?: string | null): string {
  return getCanonicalCookieLabel(value ?? "").toLowerCase();
}

function normalizeWorkflowPhoneLookup(value?: string | null): string {
  if (!value) {
    return "";
  }
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    return digitsOnly.slice(1);
  }
  return digitsOnly;
}

function normalizeWorkflowTabUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const normalized = new URL(trimmed);
    if (normalized.protocol !== "http:" && normalized.protocol !== "https:") {
      return null;
    }
    return normalized.toString();
  } catch {
    return null;
  }
}

function getWorkflowTabKey(value?: string | null): string | null {
  const normalizedUrl = normalizeWorkflowTabUrl(value);
  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedUrl);
    if (isTiktokShopDomain(parsed.hostname)) {
      // Login/Shop URLs are considered one logical tab in this flow.
      return "tiktok-main";
    }

    const normalizedHost = normalizeDomain(parsed.hostname);
    const normalizedPath = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol}//${normalizedHost}${normalizedPath}`;
  } catch {
    return normalizedUrl;
  }
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function compactWorkflowRowsForPersistence(
  rows: SemiAutoTaskRow[],
): AdminTiktokWorkflowRow[] {
  return rows.map((row) => ({
    ...row,
    // Keep durable statuses across refresh.
    // Only transient runtime state ("started") is normalized on reload.
    status: row.status === "started" ? "created" : row.status,
    lastError: row.lastError ? truncateWorkflowError(row.lastError, 220) : null,
    cookiePreview: toWorkflowCookiePreview(row.cookiePreview),
  }));
}

function buildWorkflowRowsStableSnapshot(
  rows: Array<{
    profileId: string;
    phoneNumber?: string;
    apiPhone?: string;
    cookieRecordId?: string | null;
    cookiePreview?: string | null;
    isDisabled?: boolean;
  }>,
) {
  return rows.map((row) => ({
    profileId: row.profileId,
    phoneNumber: row.phoneNumber ?? "",
    apiPhone: row.apiPhone ?? "",
    cookieRecordId: row.cookieRecordId ?? null,
    cookiePreview: toWorkflowCookiePreview(row.cookiePreview),
    isDisabled: Boolean(row.isDisabled),
  }));
}

function compactOperationProgressForPersistence(
  progress: AdminTiktokOperationProgressState | null | undefined,
): AdminTiktokOperationProgressState | null {
  if (!progress) {
    return null;
  }
  if (progress.status !== "running") {
    return progress;
  }

  const bucketSize = progress.total >= 200 ? 10 : 5;
  const bucket = (value: number) =>
    Math.max(0, Math.floor(Math.max(0, value) / bucketSize) * bucketSize);

  return {
    ...progress,
    processed: bucket(progress.processed),
    success: bucket(progress.success),
    failed: bucket(progress.failed),
    skipped: bucket(progress.skipped),
  };
}

function compactAutoWorkflowRunForPersistence(
  run: AutoWorkflowRunState | null | undefined,
): AutoWorkflowRunState | null {
  if (!run) {
    return null;
  }
  return {
    queue: run.queue,
    currentIndex: run.currentIndex,
    activeProfileId: run.activeProfileId,
    // Transient flags are recomputed at runtime; do not persist every tick.
    launching: false,
    observedRunning: false,
    processingClose: false,
  };
}

function buildWorkflowNotes(
  row: SemiAutoTaskRow,
  extracted: TiktokCookieExtractionResult,
  rotationEveryMinutes: string,
  rotationLink: string,
): string {
  const proxyLabel = row.proxyName.trim().replace(/\s+/g, "_").slice(0, 42) || "-";
  const tokens = [
    "source=buglogin_semi_auto",
    `profile_id=${row.profileId}`,
    `browser=${row.browser}`,
    `proxy=${proxyLabel}`,
    `matched_cookies=${extracted.matchedCookieCount}`,
    `matched_domains=${extracted.matchedDomainCount}`,
    `rotation_every=${rotationEveryMinutes || "5"}`,
  ];
  if (row.phoneNumber && row.phoneCountry) {
    tokens.push(`phone_country=${row.phoneCountry}`);
    tokens.push(`phone=${row.phoneNumber}`);
  }
  if (rotationLink.trim()) {
    tokens.push("rotation_link_set=1");
  }
  return tokens.join(" ");
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^\./, "");
}

function isTiktokShopDomain(domain: string): boolean {
  const normalized = normalizeDomain(domain);
  if (normalized === "shop.tiktok.com") {
    return true;
  }
  if (normalized.endsWith(".shop.tiktok.com")) {
    return true;
  }
  if (normalized === "tiktok.com") {
    return true;
  }
  return normalized.endsWith(".tiktok.com");
}

function extractTiktokCookiePayload(
  cookieData: CookieReadResult,
): TiktokCookieExtractionResult {
  const matchedDomains = cookieData.domains.filter((domain) =>
    isTiktokShopDomain(domain.domain),
  );

  if (matchedDomains.length === 0) {
    return {
      cookieHeader: "",
      matchedDomainCount: 0,
      matchedCookieCount: 0,
    };
  }

  const rawCookies = matchedDomains.flatMap((domain) => domain.cookies);
  const sortedCookies = [...rawCookies].sort((left, right) => {
    const leftDomain = normalizeDomain(left.domain);
    const rightDomain = normalizeDomain(right.domain);
    const leftIsShop = leftDomain.includes("shop.tiktok.com");
    const rightIsShop = rightDomain.includes("shop.tiktok.com");
    if (leftIsShop !== rightIsShop) {
      return leftIsShop ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  const seenCookieNames = new Set<string>();
  const uniqueCookies: UnifiedCookie[] = [];

  for (const cookie of sortedCookies) {
    const normalizedName = cookie.name.trim().toLowerCase();
    if (!normalizedName || seenCookieNames.has(normalizedName)) {
      continue;
    }
    if (!cookie.value.trim()) {
      continue;
    }
    seenCookieNames.add(normalizedName);
    uniqueCookies.push(cookie);
  }

  const cookieHeader = uniqueCookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  return {
    cookieHeader,
    matchedDomainCount: matchedDomains.length,
    matchedCookieCount: uniqueCookies.length,
  };
}

function buildBatchStamp(): string {
  return new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
}

function appendCookieLog(
  existingNotes: string | null | undefined,
  logEntry: string,
): string {
  const trimmedNotes = existingNotes?.trim();
  if (!trimmedNotes) {
    return logEntry;
  }
  return `${trimmedNotes} | ${logEntry}`;
}

function parseWorkflowProfileNote(note?: string | null): {
  phoneNumber?: string;
  apiPhone?: string;
} {
  const normalized = note?.trim();
  if (!normalized) {
    return {};
  }

  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const valueByKey = new Map<string, string>();
  for (const line of lines) {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      continue;
    }
    valueByKey.set(key, value);
  }

  return {
    phoneNumber: valueByKey.get("phone"),
    apiPhone: valueByKey.get("api_phone"),
  };
}

function normalizeWorkflowPhoneNumber(
  phoneNumber: string,
  country: WorkflowPhoneCountry,
): string {
  const digitsOnly = phoneNumber.replace(/\D/g, "");
  if (country === "US") {
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      return digitsOnly.slice(1);
    }
    return digitsOnly;
  }
  return digitsOnly;
}

function parsePhoneCandidates(raw: string): string[] {
  return raw
    .split(/\r?\n|,|;|\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toWorkflowCredentialPhone(value?: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

function deriveWorkflowCredentialsFromPhone(phone?: string | null): {
  username: string;
  password: string;
} | null {
  const normalizedPhone = toWorkflowCredentialPhone(phone);
  if (!normalizedPhone) {
    return null;
  }
  return {
    username: `${normalizedPhone}.bug`,
    password: `${normalizedPhone}bug!`,
  };
}

function extractWorkflowOtpCode(payload: unknown): string | null {
  const candidates: string[] = [];
  if (typeof payload === "string") {
    candidates.push(payload);
  } else if (payload && typeof payload === "object") {
    const value = payload as {
      msg?: unknown;
      message?: unknown;
      data?: { msg?: unknown; message?: unknown; code?: unknown };
      code?: unknown;
    };
    if (typeof value.msg === "string") {
      candidates.push(value.msg);
    }
    if (typeof value.message === "string") {
      candidates.push(value.message);
    }
    if (value.data && typeof value.data === "object") {
      if (typeof value.data.msg === "string") {
        candidates.push(value.data.msg);
      }
      if (typeof value.data.message === "string") {
        candidates.push(value.data.message);
      }
      if (typeof value.data.code === "string") {
        candidates.push(value.data.code);
      }
    }
    if (typeof value.code === "string") {
      candidates.push(value.code);
    }
  }

  for (const candidate of candidates) {
    const tiktokMatch = candidate.match(/\[tiktok\]\s*(\d{6})/i);
    if (tiktokMatch?.[1]) {
      return tiktokMatch[1];
    }
    const genericMatch = candidate.match(/\b(\d{6})\b/);
    if (genericMatch?.[1]) {
      return genericMatch[1];
    }
  }
  return null;
}

async function fetchWorkflowOtpCodeFromApi(endpoint: string): Promise<string | null> {
  const response = await fetch(endpoint, { method: "GET" });
  if (!response.ok) {
    return null;
  }

  const rawText = await response.text();
  if (!rawText.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawText) as unknown;
    return extractWorkflowOtpCode(parsed);
  } catch {
    return extractWorkflowOtpCode(rawText);
  }
}

function toWorkflowPhoneE164(
  phoneNumber: string,
  country: WorkflowPhoneCountry,
): string {
  const normalized = normalizeWorkflowPhoneNumber(phoneNumber, country);
  if (!normalized) {
    return "";
  }
  if (country === "US") {
    return `+1${normalized}`;
  }
  return normalized;
}

function normalizeWorkflowBrowser(value: string | undefined): BrowserTypeString {
  const normalized = value?.trim().toLowerCase() ?? "";
  const matched = BROWSER_OPTIONS.find((option) => option.value === normalized);
  return matched?.value ?? "chromium";
}

function mapAutomationItemStatusToWorkflowStatus(
  status: TiktokAutomationItemStatus,
): AdminTiktokWorkflowRow["status"] {
  switch (status) {
    case "running":
      return "started";
    case "done":
      return "cookie_ready";
    case "blocked":
    case "step_failed":
    case "cancelled":
      return "push_failed";
    default:
      return "created";
  }
}

function getWorkflowStatusTone(status: AdminTiktokWorkflowRow["status"]): string {
  switch (status) {
    case "cookie_ready":
    case "done":
      return "border-chart-2/45 bg-chart-2/15 text-chart-2";
    case "started":
      return "border-chart-1/45 bg-chart-1/15 text-chart-1";
    case "created":
      return "border-chart-3/45 bg-chart-3/15 text-chart-3";
    case "cookie_missing":
      return "border-chart-4/45 bg-chart-4/15 text-chart-4";
    case "push_failed":
      return "border-destructive/35 bg-destructive/15 text-destructive";
    default:
      return "border-border bg-muted/70 text-muted-foreground";
  }
}

function getWorkflowSyncStatusTone(status: WorkflowSyncStatus): string {
  switch (status) {
    case "synced":
      return "border-chart-2/45 bg-chart-2/15 text-chart-2";
    case "needs_sync":
      return "border-chart-1/45 bg-chart-1/15 text-chart-1";
    case "missing_cookie":
      return "border-chart-4/45 bg-chart-4/15 text-chart-4";
    case "conflict":
      return "border-chart-3/45 bg-chart-3/15 text-chart-3";
    case "sync_error":
      return "border-destructive/35 bg-destructive/15 text-destructive";
    default:
      return "border-border bg-muted/70 text-muted-foreground";
  }
}

function getWorkflowSyncStatusFilterTone(status: WorkflowSyncStatus): string {
  switch (status) {
    case "synced":
      return "bg-chart-2/20 text-chart-2";
    case "needs_sync":
      return "bg-chart-1/20 text-chart-1";
    case "missing_cookie":
      return "bg-chart-4/20 text-chart-4";
    case "conflict":
      return "bg-chart-3/20 text-chart-3";
    case "sync_error":
      return "bg-destructive/20 text-destructive";
    default:
      return "bg-muted text-foreground";
  }
}

function normalizeCookieSnapshotForCompare(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncateWorkflowError(value: string, max = 160): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= max) {
    return normalized;
  }
  return `${normalized.slice(0, max - 3)}...`;
}

function classifyWorkflowIssueCode(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("503")) {
    return "http_503";
  }
  if (normalized.includes("timeout") || normalized.includes("timed out")) {
    return "timeout";
  }
  if (normalized.includes("banned") || normalized.includes("suspended")) {
    return "account_banned";
  }
  if (
    normalized.includes("unauthorized") ||
    normalized.includes("invalid_control_token")
  ) {
    return "unauthorized";
  }
  if (normalized.includes("no fingerprint provided")) {
    return "fingerprint_missing";
  }
  if (
    normalized.includes("captcha") ||
    normalized.includes("verify it's really you")
  ) {
    return "captcha_or_verify";
  }
  return "runtime_error";
}

function formatWorkflowIssueLog(error: unknown): string {
  const message = extractRootError(error).trim() || "unknown";
  const code = classifyWorkflowIssueCode(message);
  return `[${new Date().toISOString()}][${code}] ${truncateWorkflowError(message, 220)}`;
}

function resolveWorkflowSyncStatus(input: {
  internalStatus: AdminTiktokWorkflowRow["status"];
  localCookie: string;
  remoteCookie: string;
}): WorkflowSyncStatus {
  if (input.internalStatus === "push_failed") {
    return "sync_error";
  }

  const localCookie = normalizeCookieSnapshotForCompare(input.localCookie);
  const remoteCookie = normalizeCookieSnapshotForCompare(input.remoteCookie);
  const hasLocalCookie = localCookie.length > 0;
  const hasRemoteCookie = remoteCookie.length > 0;

  if (!hasLocalCookie && !hasRemoteCookie) {
    return "missing_cookie";
  }

  if (hasLocalCookie && hasRemoteCookie) {
    if (localCookie === remoteCookie) {
      return "synced";
    }
    return "needs_sync";
  }

  return "needs_sync";
}

function mapRemoteCookieStatusToWorkflowSyncStatus(
  status: string | null | undefined,
): WorkflowSyncStatus | null {
  const normalized = status?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (
    normalized === "synced" ||
    normalized === "done" ||
    normalized === "ok" ||
    normalized === "active"
  ) {
    return "synced";
  }
  if (
    normalized === "missing_cookie" ||
    normalized === "cookie_missing" ||
    normalized === "empty"
  ) {
    return "missing_cookie";
  }
  if (
    normalized === "error" ||
    normalized === "sync_error" ||
    normalized === "failed"
  ) {
    return "sync_error";
  }
  return "needs_sync";
}

function getWorkflowRuntimeBadgeClassName(input: {
  isRunning: boolean;
  isParked: boolean;
  isLaunching: boolean;
  isStopping: boolean;
}): string {
  if (input.isStopping) {
    return "gap-1 border-destructive/20 bg-destructive/10 text-destructive";
  }
  if (input.isRunning || input.isLaunching) {
    return "gap-1 border-primary/20 bg-primary/10 text-primary";
  }
  if (input.isParked) {
    return "gap-1 border-border/60 bg-secondary text-secondary-foreground";
  }
  return "gap-1 border-border/60 bg-muted text-muted-foreground";
}

function getWorkflowRunActionButtonClassName(): string {
  return "min-w-[96px] h-7 shadow-xs";
}

function getRunStatusTone(status: TiktokAutomationRunStatus | null | undefined): string {
  switch (status) {
    case "running":
      return "border-chart-1/45 bg-chart-1/15 text-chart-1";
    case "completed":
      return "border-chart-2/45 bg-chart-2/15 text-chart-2";
    case "failed":
      return "border-destructive/35 bg-destructive/15 text-destructive";
    case "paused":
      return "border-chart-4/45 bg-chart-4/15 text-chart-4";
    case "queued":
      return "border-border bg-muted/80 text-foreground";
    case "stopped":
    default:
      return "border-border bg-muted/70 text-muted-foreground";
  }
}

function isBugIdeaAutomationProfile(profile: BrowserProfile): boolean {
  const tags = Array.isArray(profile.tags) ? profile.tags : [];
  if (
    tags.some((tag) =>
      BUGIDEA_AUTOMATION_PROFILE_TAGS.has(tag.trim().toLowerCase()),
    )
  ) {
    return true;
  }

  return profile.name.trim().startsWith("BugIdeaSync ");
}

export function AdminTiktokCookiesTab(props: AdminTiktokCookiesTabProps) {
  const { t } = useTranslation();
  const [createLabel, setCreateLabel] = useState("");
  const [createCookie, setCreateCookie] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCookie, setEditCookie] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [workflowRows, setWorkflowRows] = useState<SemiAutoTaskRow[]>(() =>
    ((props.adminTiktokState?.workflowRows as SemiAutoTaskRow[]) ?? []).map((row) => ({
      ...row,
      cookiePreview: toWorkflowCookiePreview(row.cookiePreview),
      localCookieSnapshot: toWorkflowLocalCookieSnapshot(row.cookiePreview),
    })),
  );
  const [rotationCursor, setRotationCursor] = useState(
    () => props.adminTiktokState?.rotationCursor ?? 0,
  );
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("multi");
  const [workflowConfigTab, setWorkflowConfigTab] =
    useState<WorkflowConfigTab>("basic");
  const [showWorkflowConfig, setShowWorkflowConfig] = useState(false);
  const [workflowPhoneSource, setWorkflowPhoneSource] =
    useState<WorkflowPhoneSource>("manual");
  const [workflowStatusFilter, setWorkflowStatusFilter] =
    useState<WorkflowStatusFilter>("all");
  const [workflowSearchQuery, setWorkflowSearchQuery] = useState("");
  const [cookieSourceRows, setCookieSourceRows] = useState<
    TiktokAccountCookieSourceRow[]
  >(
    () =>
      props.tiktokCookieSources.map((row) => ({
        phone: row.phone,
        api_phone: row.apiPhone,
        cookie: row.cookie,
      })),
  );
  const [profilePrefix, setProfilePrefix] = useState("ttshop");
  const [phoneListInput, setPhoneListInput] = useState("");
  const [uploadedPhoneList, setUploadedPhoneList] = useState<string[]>([]);
  const [apiPhoneEndpoint, setApiPhoneEndpoint] = useState("");
  const [proxyCandidateInput, setProxyCandidateInput] = useState("");
  const [proxyKeyword, setProxyKeyword] = useState("5p");
  const [rotationLink, setRotationLink] = useState("");
  const [rotationEveryMinutes, setRotationEveryMinutes] = useState("5");
  const [workflowPhoneCountry, setWorkflowPhoneCountry] =
    useState<WorkflowPhoneCountry>("US");
  const [workflowPhoneNumber, setWorkflowPhoneNumber] = useState("");
  const [selectedBrowser, setSelectedBrowser] =
    useState<BrowserTypeString>("chromium");
  const [bugIdeaBearerKey, setBugIdeaBearerKey] = useState(
    () => props.adminTiktokState?.bearerKey ?? "",
  );
  const storedProxies = props.storedProxies;
  const workspaceProfiles = props.workspaceProfiles;
  const isLoadingProfiles = props.isWorkspaceProfilesLoading ?? false;
  const isLoadingProxies = props.isStoredProxiesLoading ?? false;
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [isLoadingApiPhones, setIsLoadingApiPhones] = useState(false);
  const [activeWorkflowProfileId, setActiveWorkflowProfileId] = useState<
    string | null
  >(null);
  const [manualWorkflowWatch, setManualWorkflowWatch] =
    useState<ManualWorkflowWatchState | null>(null);
  const [syncingProfileId, setSyncingProfileId] = useState<string | null>(
    null,
  );
  const [stoppingWorkflowProfileId, setStoppingWorkflowProfileId] = useState<
    string | null
  >(null);
  const [autoWorkflowRun, setAutoWorkflowRun] =
    useState<AutoWorkflowRunState | null>(null);
  const [automationFlowType, setAutomationFlowType] =
    useState<TiktokAutomationFlowType>("update_cookie");
  const [automationRunMode, setAutomationRunMode] =
    useState<TiktokAutomationRunMode>("semi");
  const [activeAutomationRunId, setActiveAutomationRunId] = useState<
    string | null
  >(null);
  const [activeAutomationRun, setActiveAutomationRun] =
    useState<TiktokAutomationRunRecord | null>(null);
  const [activeAutomationRunItems, setActiveAutomationRunItems] = useState<
    TiktokAutomationRunItemRecord[]
  >([]);
  const [isSyncAllSyncing, setIsSyncAllSyncing] = useState(false);
  const [isAutomationRunningAction, setIsAutomationRunningAction] = useState(false);
  const [workflowMonitorNow, setWorkflowMonitorNow] = useState<number>(() =>
    Date.now(),
  );
  const [selectedWorkflowProfileIds, setSelectedWorkflowProfileIds] = useState<
    string[]
  >([]);
  const [workflowPageIndex, setWorkflowPageIndex] = useState(0);
  const [workflowPageSize, setWorkflowPageSize] = useState(25);
  const [isActionBarMounted, setIsActionBarMounted] = useState(false);
  const skipNextAdminSaveRef = useRef(false);
  const lastPersistedAdminStateRef = useRef("");
  const lastHydratedWorkspaceIdRef = useRef<string | null>(null);
  const hydratedAdminStateWorkspaceRef = useRef<string | null>(null);
  const sortedWorkflowRowsRef = useRef<SemiAutoTaskRow[]>([]);
  const workspaceProfilesRef = useRef<BrowserProfile[]>([]);
  const lazyWorkspaceDataHydrationRef = useRef<string | null>(null);
  const autoWorkflowCloseGuardRef = useRef<string | null>(null);
  const manualWorkflowCloseGuardRef = useRef<string | null>(null);
  const openedWorkflowTabsRef = useRef<Map<string, Set<string>>>(new Map());
  const openingWorkflowProfileIdsRef = useRef<Set<string>>(new Set());
  const workflowLaunchTimestampRef = useRef<Map<string, number>>(new Map());
  const autoWorkflowLaunchIntentRef = useRef<Map<string, WorkflowLaunchIntent>>(
    new Map(),
  );
  const autoWorkflowStopRequestedRef = useRef(false);
  const hydratedCookiePreviewIdsRef = useRef<Set<string>>(new Set());
  const autoWorkflowStatusCheckInFlightRef = useRef(false);
  const manualWorkflowStatusCheckInFlightRef = useRef(false);
  const workflowHeartbeatAtRef = useRef<number>(Date.now());
  const workflowOtpFetchInFlightRef = useRef<Set<string>>(new Set());
  const workflowLastOtpCodeRef = useRef<Map<string, string>>(new Map());
  const automationPollInFlightRef = useRef(false);
  const adminStateSaveInFlightRef = useRef<Promise<void> | null>(null);
  const automationEventsSinceRef = useRef<string | null>(null);
  const lastAutomationListsRefreshAtRef = useRef(0);
  const initialOperationProgress = useMemo(
    () => props.adminTiktokState?.operationProgress ?? null,
    [props.adminTiktokState?.operationProgress],
  );
  const operationProgress = usePersistentOperationProgress({
    storageKey: undefined,
    staleAfterMs: 45_000,
    initialProgress: initialOperationProgress,
  });
  const operationProgressForPersistence = useMemo(
    () => compactOperationProgressForPersistence(operationProgress.progress),
    [operationProgress.progress],
  );
  const isTiktokHydrating =
    Boolean(props.isTiktokDataBootstrapping) ||
    !props.isTiktokDataReady ||
    !props.adminTiktokState ||
    isLoadingProfiles ||
    isLoadingProxies;

  const workspaceProfileById = useMemo(() => {
    const map = new Map<string, BrowserProfile>();
    for (const profile of workspaceProfiles) {
      map.set(profile.id, profile);
    }
    return map;
  }, [workspaceProfiles]);

  const sortedWorkflowRows = useMemo(() => {
    if (isTiktokHydrating) {
      return [];
    }
    const profileMap = new Map(
      workspaceProfiles.map((profile) => [profile.id, profile] as const),
    );
    const proxyNameMap = new Map(
      storedProxies.map((proxy) => [proxy.id, proxy.name] as const),
    );

    const rows: SemiAutoTaskRow[] = workflowRows.map((trackedRow) => {
      const profile = profileMap.get(trackedRow.profileId);
      const noteValues = parseWorkflowProfileNote(profile?.note);
      const proxyId = profile?.proxy_id ?? trackedRow.proxyId ?? "";
      const proxyName = proxyId
        ? proxyNameMap.get(proxyId) ?? trackedRow.proxyName ?? proxyId
        : trackedRow.proxyName ?? "-";

      return {
        ...trackedRow,
        batchId: trackedRow.batchId ?? "existing",
        isDisabled: Boolean(trackedRow.isDisabled),
        profileId: trackedRow.profileId,
        profileName: profile?.name ?? trackedRow.profileName,
        browser: normalizeWorkflowBrowser(
          trackedRow.browser || profile?.browser || "chromium",
        ),
        proxyId,
        proxyName,
        phoneNumber: trackedRow.phoneNumber ?? noteValues.phoneNumber,
        apiPhone: trackedRow.apiPhone ?? noteValues.apiPhone,
      };
    });

    const trackedProfileIds = new Set(rows.map((row) => row.profileId));
    const derivedRows: SemiAutoTaskRow[] = workspaceProfiles
      .filter(
        (profile) =>
          isBugIdeaAutomationProfile(profile) && !trackedProfileIds.has(profile.id),
      )
      .map((profile) => {
        const noteValues = parseWorkflowProfileNote(profile.note);
        const proxyId = profile.proxy_id ?? "";
        const proxyName = proxyId
          ? proxyNameMap.get(proxyId) ?? proxyId
          : "-";
        const profileTimestamp = profile.last_launch
          ? new Date(profile.last_launch * 1000).toISOString()
          : "1970-01-01T00:00:00.000Z";

        return {
          batchId: "imported",
          isDisabled: false,
          profileId: profile.id,
          profileName: profile.name,
          browser: normalizeWorkflowBrowser(profile.browser),
          proxyId,
          proxyName,
          phoneNumber: noteValues.phoneNumber,
          apiPhone: noteValues.apiPhone,
          status: "created",
          cookieRecordId: null,
          lastError: null,
          createdAt: profileTimestamp,
          updatedAt: profileTimestamp,
        };
      });

    rows.push(...derivedRows);

    rows.sort((left, right) => {
      const updatedDiff = right.updatedAt.localeCompare(left.updatedAt);
      if (updatedDiff !== 0) {
        return updatedDiff;
      }
      return left.profileName.localeCompare(right.profileName);
    });

    return rows;
  }, [isTiktokHydrating, storedProxies, workflowRows, workspaceProfiles]);

  const eligibleProxies = useMemo(() => {
    const normalizedKeyword = proxyKeyword.trim().toLowerCase();
    const explicitCandidates = parsePhoneCandidates(proxyCandidateInput).map(
      (entry) => entry.toLowerCase(),
    );
    const rows = [...storedProxies].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    let filtered = rows;
    if (explicitCandidates.length > 0) {
      filtered = filtered.filter((proxy) => {
        const proxyId = proxy.id.toLowerCase();
        const proxyName = proxy.name.toLowerCase();
        return explicitCandidates.some(
          (candidate) =>
            proxyId.includes(candidate) || proxyName.includes(candidate),
        );
      });
    }
    if (!normalizedKeyword) {
      return filtered;
    }
    return filtered.filter((proxy) => {
      const name = proxy.name.toLowerCase();
      const type = proxy.proxy_settings.proxy_type.toLowerCase();
      return name.includes(normalizedKeyword) || type.includes(normalizedKeyword);
    });
  }, [proxyCandidateInput, proxyKeyword, storedProxies]);

  const activeRotationProxy = useMemo(() => {
    if (eligibleProxies.length === 0) {
      return null;
    }
    return eligibleProxies[rotationCursor % eligibleProxies.length] ?? null;
  }, [eligibleProxies, rotationCursor]);

  useEffect(() => {
    sortedWorkflowRowsRef.current = sortedWorkflowRows;
  }, [sortedWorkflowRows]);

  useEffect(() => {
    workspaceProfilesRef.current = workspaceProfiles;
  }, [workspaceProfiles]);

  useEffect(() => {
    lazyWorkspaceDataHydrationRef.current = null;
  }, [props.workspaceId]);

  useEffect(() => {
    if (!props.workspaceId || !props.isTiktokDataReady) {
      return;
    }
    if (lazyWorkspaceDataHydrationRef.current === props.workspaceId) {
      return;
    }
    if (workspaceProfiles.length > 0 || storedProxies.length > 0) {
      return;
    }
    if (isLoadingProfiles || isLoadingProxies) {
      return;
    }

    lazyWorkspaceDataHydrationRef.current = props.workspaceId;
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        props.refreshStoredProxies(),
        props.refreshWorkspaceProfiles(),
      ]);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [
    isLoadingProfiles,
    isLoadingProxies,
    props.isTiktokDataReady,
    props.refreshStoredProxies,
    props.refreshWorkspaceProfiles,
    props.workspaceId,
    storedProxies.length,
    workspaceProfiles.length,
  ]);

  useEffect(() => {
    if (!autoWorkflowRun?.activeProfileId) {
      autoWorkflowCloseGuardRef.current = null;
    }
  }, [autoWorkflowRun?.activeProfileId]);

  useEffect(() => {
    if (!manualWorkflowWatch?.profileId) {
      manualWorkflowCloseGuardRef.current = null;
    }
  }, [manualWorkflowWatch?.profileId]);

  useEffect(() => {
    setIsActionBarMounted(true);
  }, []);

  const stableWorkflowRowsSnapshot = useMemo(
    () => buildWorkflowRowsStableSnapshot(workflowRows),
    [workflowRows],
  );
  const persistedAdminStateSnapshot = useMemo(
    () =>
      JSON.stringify({
        bearerKey: bugIdeaBearerKey.trim(),
        workflowRows: stableWorkflowRowsSnapshot,
        rotationCursor,
      }),
    [bugIdeaBearerKey, rotationCursor, stableWorkflowRowsSnapshot],
  );

  const isWorkflowBusy =
    props.isBusy ||
    isCreatingBatch ||
    activeWorkflowProfileId !== null ||
    syncingProfileId !== null ||
    autoWorkflowRun !== null;

  useEffect(() => {
    if (!props.workspaceId) {
      hydratedAdminStateWorkspaceRef.current = null;
      return;
    }
    const isWorkspaceChanged = lastHydratedWorkspaceIdRef.current !== props.workspaceId;
    if (isWorkspaceChanged) {
      lastHydratedWorkspaceIdRef.current = props.workspaceId;
      hydratedAdminStateWorkspaceRef.current = null;
      lastPersistedAdminStateRef.current = "";
      skipNextAdminSaveRef.current = true;
      hydratedCookiePreviewIdsRef.current.clear();
      openedWorkflowTabsRef.current.clear();
      openingWorkflowProfileIdsRef.current.clear();
      workflowLaunchTimestampRef.current.clear();
      setManualWorkflowWatch(null);
    }

    if (!props.adminTiktokState) {
      return;
    }

    const incomingWorkflowRows = (
      (props.adminTiktokState?.workflowRows as SemiAutoTaskRow[]) ?? []
    ).map((row) => ({
      ...row,
      cookiePreview: toWorkflowCookiePreview(row.cookiePreview),
      localCookieSnapshot: toWorkflowLocalCookieSnapshot(row.cookiePreview),
    }));
    const incomingSnapshot = JSON.stringify({
      bearerKey: props.adminTiktokState?.bearerKey ?? "",
      workflowRows: buildWorkflowRowsStableSnapshot(incomingWorkflowRows),
      rotationCursor: props.adminTiktokState?.rotationCursor ?? 0,
    });
    if (incomingSnapshot === lastPersistedAdminStateRef.current) {
      hydratedAdminStateWorkspaceRef.current = props.workspaceId;
      return;
    }

    skipNextAdminSaveRef.current = true;
    const nextBearerKey = props.adminTiktokState.bearerKey ?? "";
    setWorkflowRows(incomingWorkflowRows);
    setRotationCursor(props.adminTiktokState.rotationCursor ?? 0);
    setBugIdeaBearerKey(nextBearerKey);
    setAutoWorkflowRun(
      props.adminTiktokState.autoWorkflowRun
        ? {
            ...props.adminTiktokState.autoWorkflowRun,
            launching: false,
            processingClose: false,
            observedRunning:
              props.adminTiktokState.autoWorkflowRun.activeProfileId !== null
                ? true
                : props.adminTiktokState.autoWorkflowRun.observedRunning,
          }
        : null,
    );
    lastPersistedAdminStateRef.current = incomingSnapshot;
    hydratedAdminStateWorkspaceRef.current = props.workspaceId;
  }, [props.adminTiktokState, props.workspaceId]);

  useEffect(() => {
    if (!props.workspaceId) {
      return;
    }
    if (hydratedAdminStateWorkspaceRef.current !== props.workspaceId) {
      return;
    }
    if (skipNextAdminSaveRef.current) {
      skipNextAdminSaveRef.current = false;
      return;
    }
    if (
      isWorkflowBusy ||
      isAutomationRunningAction ||
      operationProgressForPersistence?.status === "running"
    ) {
      return;
    }
    if (persistedAdminStateSnapshot === lastPersistedAdminStateRef.current) {
      return;
    }
    const handle = window.setTimeout(() => {
      if (adminStateSaveInFlightRef.current) {
        return;
      }
      const compactWorkflowRows = compactWorkflowRowsForPersistence(workflowRows);
      const task = (async () => {
        const savedState = await props.saveAdminTiktokState({
          bearerKey: bugIdeaBearerKey.trim(),
          workflowRows: compactWorkflowRows,
          rotationCursor,
          autoWorkflowRun: null,
          operationProgress: null,
        });
        lastPersistedAdminStateRef.current = JSON.stringify({
          bearerKey: savedState.bearerKey,
          workflowRows: buildWorkflowRowsStableSnapshot(
            (savedState.workflowRows as SemiAutoTaskRow[]) ?? [],
          ),
          rotationCursor: savedState.rotationCursor,
        });
      })();
      adminStateSaveInFlightRef.current = task;
      void task.finally(() => {
        if (adminStateSaveInFlightRef.current === task) {
          adminStateSaveInFlightRef.current = null;
        }
      });
    }, 1200);
    return () => window.clearTimeout(handle);
  }, [
    isAutomationRunningAction,
    isWorkflowBusy,
    bugIdeaBearerKey,
    operationProgressForPersistence?.status,
    props.saveAdminTiktokState,
    props.workspaceId,
    persistedAdminStateSnapshot,
    rotationCursor,
    workflowRows,
  ]);

  useEffect(() => {
    if (!props.isPlatformAdmin) {
      setCookieSourceRows([]);
      return;
    }
    setCookieSourceRows(
      props.tiktokCookieSources.map((row) => ({
        phone: row.phone,
        api_phone: row.apiPhone,
        cookie: row.cookie,
      })),
    );
  }, [props.isPlatformAdmin, props.tiktokCookieSources]);

  const cookieSourceByPhone = useMemo(() => {
    const map = new Map<string, TiktokAccountCookieSourceRow>();
    for (const row of cookieSourceRows) {
      const key = normalizeWorkflowPhoneLookup(row.phone);
      if (key && !map.has(key)) {
        map.set(key, row);
      }
    }
    return map;
  }, [cookieSourceRows]);

  const cookieSourceByApiPhone = useMemo(() => {
    const map = new Map<string, TiktokAccountCookieSourceRow>();
    for (const row of cookieSourceRows) {
      const key = row.api_phone.trim();
      if (key && !map.has(key)) {
        map.set(key, row);
      }
    }
    return map;
  }, [cookieSourceRows]);

  const automationAccountByProfileId = useMemo(() => {
    const map = new Map<string, TiktokAutomationAccountRecord>();
    for (const row of props.tiktokAutomationAccounts) {
      if (row.profileId?.trim() && !map.has(row.profileId)) {
        map.set(row.profileId, row);
      }
    }
    return map;
  }, [props.tiktokAutomationAccounts]);

  const automationAccountByApiPhone = useMemo(() => {
    const map = new Map<string, TiktokAutomationAccountRecord>();
    for (const row of props.tiktokAutomationAccounts) {
      const key = row.apiPhone.trim();
      if (key && !map.has(key)) {
        map.set(key, row);
      }
    }
    return map;
  }, [props.tiktokAutomationAccounts]);

  const automationAccountByPhone = useMemo(() => {
    const map = new Map<string, TiktokAutomationAccountRecord>();
    for (const row of props.tiktokAutomationAccounts) {
      const key = normalizeWorkflowPhoneLookup(row.phone);
      if (key && !map.has(key)) {
        map.set(key, row);
      }
    }
    return map;
  }, [props.tiktokAutomationAccounts]);

  const resolveCookieSourceRowForWorkflow = useCallback(
    (row: SemiAutoTaskRow) => {
      const normalizedApiPhone = row.apiPhone?.trim() ?? "";
      if (normalizedApiPhone) {
        const matchedByApiPhone = cookieSourceByApiPhone.get(normalizedApiPhone);
        if (matchedByApiPhone) {
          return matchedByApiPhone;
        }
      }

      const normalizedPhone = normalizeWorkflowPhoneLookup(row.phoneNumber);
      if (!normalizedPhone) {
        return null;
      }
      return cookieSourceByPhone.get(normalizedPhone) ?? null;
    },
    [cookieSourceByApiPhone, cookieSourceByPhone],
  );

  const resolveAutomationAccountForWorkflow = useCallback(
    (row: SemiAutoTaskRow) => {
      if (row.profileId) {
        const byProfileId = automationAccountByProfileId.get(row.profileId);
        if (byProfileId) {
          return byProfileId;
        }
      }
      const normalizedApiPhone = row.apiPhone?.trim() ?? "";
      if (normalizedApiPhone) {
        const byApiPhone = automationAccountByApiPhone.get(normalizedApiPhone);
        if (byApiPhone) {
          return byApiPhone;
        }
      }
      const normalizedPhone = normalizeWorkflowPhoneLookup(row.phoneNumber);
      if (normalizedPhone) {
        return automationAccountByPhone.get(normalizedPhone) ?? null;
      }
      return null;
    },
    [automationAccountByApiPhone, automationAccountByPhone, automationAccountByProfileId],
  );

  const remoteCookieById = useMemo(() => {
    const map = new Map<string, TiktokCookieRecord>();
    for (const record of props.tiktokCookies) {
      if (!record.id || map.has(record.id)) {
        continue;
      }
      map.set(record.id, record);
    }
    return map;
  }, [props.tiktokCookies]);

  const remoteCookiePreviewById = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of props.tiktokCookies) {
      if (!record.id || map.has(record.id)) {
        continue;
      }
      const preview = toWorkflowCookiePreview(record.cookie);
      if (!preview) {
        continue;
      }
      map.set(record.id, preview);
    }
    return map;
  }, [props.tiktokCookies]);

  const remoteCookieByCanonicalLabel = useMemo(() => {
    const map = new Map<string, TiktokCookieRecord>();
    for (const record of props.tiktokCookies) {
      const key = normalizeCookieLabelForMatch(record.label);
      if (!key || map.has(key)) {
        continue;
      }
      map.set(key, record);
    }
    return map;
  }, [props.tiktokCookies]);

  const resolveRemoteCookieRecordForWorkflow = useCallback(
    (row: SemiAutoTaskRow) => {
      if (row.cookieRecordId) {
        const matchedById = remoteCookieById.get(row.cookieRecordId);
        if (matchedById) {
          return matchedById;
        }
      }
      const canonicalLabel = normalizeCookieLabelForMatch(row.profileName);
      if (!canonicalLabel) {
        return null;
      }
      return remoteCookieByCanonicalLabel.get(canonicalLabel) ?? null;
    },
    [remoteCookieByCanonicalLabel, remoteCookieById],
  );

  const resolveWorkflowLocalCookieSnapshot = useCallback(
    (row: SemiAutoTaskRow) =>
      row.localCookieSnapshot?.trim() ||
      toWorkflowLocalCookieSnapshot(row.cookiePreview)?.trim() ||
      "",
    [],
  );

  const resolveWorkflowSyncStatusForRow = useCallback(
    (row: SemiAutoTaskRow): WorkflowSyncStatus => {
      const remoteRecord = resolveRemoteCookieRecordForWorkflow(row);
      const remoteStatus = mapRemoteCookieStatusToWorkflowSyncStatus(
        remoteRecord?.status,
      );
      const localCookie = resolveWorkflowLocalCookieSnapshot(row);
      const remoteCookie = remoteRecord?.cookie?.trim() || "";
      const sameCookie =
        localCookie.length > 0 &&
        remoteCookie.length > 0 &&
        normalizeCookieSnapshotForCompare(localCookie) ===
          normalizeCookieSnapshotForCompare(remoteCookie);
      const testedAtMs = parseTimestampMs(remoteRecord?.testedAt);
      const isTestFresh =
        testedAtMs !== null &&
        Date.now() - testedAtMs <= COOKIE_TEST_FRESH_TTL_MS;
      if (sameCookie && isTestFresh) {
        return "synced";
      }
      if (remoteStatus) {
        // Keep special remote statuses, but "synced" without fresh test is treated as needs_sync.
        if (remoteStatus === "synced" && !isTestFresh) {
          return "needs_sync";
        }
        return remoteStatus;
      }
      return resolveWorkflowSyncStatus({
        internalStatus: row.status,
        localCookie,
        remoteCookie,
      });
    },
    [resolveRemoteCookieRecordForWorkflow, resolveWorkflowLocalCookieSnapshot],
  );

  const resolveWorkflowLaunchIntent = useCallback(
    (row: SemiAutoTaskRow): WorkflowLaunchIntent => {
      if (automationFlowType === "signup") {
        return "relogin";
      }
      const syncStatus = resolveWorkflowSyncStatusForRow(row);
      return syncStatus === "synced" ? "shop_refresh" : "relogin";
    },
    [automationFlowType, resolveWorkflowSyncStatusForRow],
  );

  const workflowDerivedByProfileId = useMemo(() => {
    const map = new Map<
      string,
      {
        automationAccount: TiktokAutomationAccountRecord | null;
        remoteCookieRecord: TiktokCookieRecord | null;
        remoteCookiePreview: string;
        localCookiePreview: string;
        workflowSyncStatus: WorkflowSyncStatus;
        searchBlob: string;
      }
    >();

    for (const row of sortedWorkflowRows) {
      const automationAccount = resolveAutomationAccountForWorkflow(row);
      const remoteCookieRecord = resolveRemoteCookieRecordForWorkflow(row);
      const remoteCookiePreview = remoteCookieRecord?.id
        ? remoteCookiePreviewById.get(remoteCookieRecord.id) ||
          toWorkflowCookiePreview(remoteCookieRecord.cookie) ||
          ""
        : "";
      const localCookieSnapshot = resolveWorkflowLocalCookieSnapshot(row);
      const localCookiePreview = toWorkflowCookiePreview(localCookieSnapshot) ?? "";
      const remoteCookie = remoteCookieRecord?.cookie?.trim() || "";
      const isRuntimeRunning =
        row.status === "started" ||
        automationAccount?.status === "running" ||
        automationAccount?.status === "manual_pending";
      const remoteSyncStatus = mapRemoteCookieStatusToWorkflowSyncStatus(
        remoteCookieRecord?.status,
      );
      const workflowSyncStatus = isRuntimeRunning
        ? "needs_sync"
        : remoteSyncStatus ??
          resolveWorkflowSyncStatus({
            internalStatus: row.status,
            localCookie: localCookieSnapshot,
            remoteCookie,
          });
      const searchBlob = [
        row.profileName,
        row.profileId,
        row.phoneNumber,
        row.apiPhone,
        row.status,
        workflowSyncStatus,
        row.browser,
        row.proxyName,
        automationAccount?.username,
        automationAccount?.phone,
        automationAccount?.apiPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      map.set(row.profileId, {
        automationAccount,
        remoteCookieRecord,
        remoteCookiePreview,
        localCookiePreview,
        workflowSyncStatus,
        searchBlob,
      });
    }

    return map;
  }, [
    resolveAutomationAccountForWorkflow,
    resolveCookieSourceRowForWorkflow,
    resolveRemoteCookieRecordForWorkflow,
    resolveWorkflowLocalCookieSnapshot,
    remoteCookiePreviewById,
    sortedWorkflowRows,
  ]);

  useEffect(() => {
    if (!props.workspaceId) {
      return;
    }
    const pageStart = workflowPageIndex * workflowPageSize;
    const pageRows = sortedWorkflowRows.slice(
      pageStart,
      pageStart + workflowPageSize,
    );
    const workspaceCache = getWorkflowCookiePreviewCache(props.workspaceId);

    if (workspaceCache.size > 0) {
      setWorkflowRows((current) =>
        applyWorkflowCookiePreviewRecords(current, workspaceCache),
      );
    }

    const profileIds = selectWorkflowCookieProfilesForHydration(pageRows, {
      hydratedProfileIds: hydratedCookiePreviewIdsRef.current,
      cachedProfileIds: new Set(workspaceCache.keys()),
      limit: WORKFLOW_COOKIE_HYDRATE_BATCH_SIZE,
    });
    if (profileIds.length === 0) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      profileIds.forEach((profileId) =>
        hydratedCookiePreviewIdsRef.current.add(profileId),
      );
      const cookieRows = await invoke<Record<string, string>>(
        "read_profile_tiktok_cookie_headers_bulk",
        {
          profileIds,
        },
      ).catch((): Record<string, string> => ({}));
      if (isCancelled) {
        return;
      }

      const cookieSnapshotByProfileId = new Map<
        string,
        { preview: string; snapshot: string }
      >();
      for (const profileId of profileIds) {
        const cookieHeader = cookieRows?.[profileId]?.trim();
        if (!cookieHeader) {
          continue;
        }
        const nextPreview = toWorkflowCookiePreview(cookieHeader);
        if (!nextPreview) {
          continue;
        }
        cookieSnapshotByProfileId.set(profileId, {
          preview: nextPreview,
          snapshot: cookieHeader,
        });
      }

      if (cookieSnapshotByProfileId.size === 0) {
        return;
      }

      cookieSnapshotByProfileId.forEach((value, profileId) => {
        workspaceCache.set(profileId, value);
      });

      setWorkflowRows((current) => {
        const next = applyWorkflowCookiePreviewRecords(
          current,
          cookieSnapshotByProfileId,
        );
        const changed = next !== current;
        if (changed) {
          skipNextAdminSaveRef.current = true;
        }
        return next;
      });
    })();

    return () => {
      isCancelled = true;
    };
  }, [props.workspaceId, sortedWorkflowRows, workflowPageIndex, workflowPageSize]);

  useEffect(() => {
    const sortedProfileIdSet = new Set(
      sortedWorkflowRows.map((row) => row.profileId),
    );
    setSelectedWorkflowProfileIds((current) =>
      current.filter((profileId) =>
        sortedProfileIdSet.has(profileId),
      ),
    );
  }, [sortedWorkflowRows]);

  useEffect(() => {
    if (props.tiktokAutomationAccounts.length === 0) {
      return;
    }
    setWorkflowRows((current) => {
      let changed = false;
      const next = current.map((row) => {
        const account = resolveAutomationAccountForWorkflow(row);
        if (!account) {
          return row;
        }

        const nextPhoneNumber =
          row.phoneNumber && row.phoneNumber.trim().length > 0
            ? row.phoneNumber
            : account.phone;
        const nextApiPhone =
          row.apiPhone && row.apiPhone.trim().length > 0
            ? row.apiPhone
            : account.apiPhone;
        const nextStatus =
          row.status === "created"
            ? mapAutomationItemStatusToWorkflowStatus(account.status)
            : row.status;
        const nextUpdatedAt =
          row.updatedAt.localeCompare(account.updatedAt) >= 0
            ? row.updatedAt
            : account.updatedAt;

        if (
          row.phoneNumber === nextPhoneNumber &&
          row.apiPhone === nextApiPhone &&
          row.status === nextStatus &&
          row.updatedAt === nextUpdatedAt
        ) {
          return row;
        }
        changed = true;
        return {
          ...row,
          phoneNumber: nextPhoneNumber,
          apiPhone: nextApiPhone,
          status: nextStatus,
          updatedAt: nextUpdatedAt,
        };
      });
      if (changed) {
        skipNextAdminSaveRef.current = true;
      }
      return changed ? next : current;
    });
  }, [props.tiktokAutomationAccounts, resolveAutomationAccountForWorkflow]);

  const updateWorkflowRow = (
    profileId: string,
    patch: Partial<SemiAutoTaskRow>,
  ) => {
    const normalizedPatch: Partial<SemiAutoTaskRow> = { ...patch };
    if (patch.cookiePreview !== undefined) {
      normalizedPatch.cookiePreview = toWorkflowCookiePreview(patch.cookiePreview);
    }
    if (patch.localCookieSnapshot !== undefined) {
      normalizedPatch.localCookieSnapshot = toWorkflowLocalCookieSnapshot(
        patch.localCookieSnapshot,
      );
    }
    setWorkflowRows((current) => {
      const now = new Date().toISOString();
      const matchedIndex = current.findIndex((row) => row.profileId === profileId);

      if (matchedIndex >= 0) {
        return current.map((row, index) =>
          index === matchedIndex
            ? {
                ...row,
                ...normalizedPatch,
                updatedAt: now,
              }
            : row,
        );
      }

      const baseRow =
        sortedWorkflowRows.find((row) => row.profileId === profileId) ??
        ({
          batchId: "existing",
          profileId,
          profileName: profileId,
          browser: "chromium",
          proxyId: "",
          proxyName: "-",
          status: "created",
          isDisabled: false,
          cookieRecordId: null,
          cookiePreview: null,
          localCookieSnapshot: null,
          lastError: null,
          createdAt: now,
          updatedAt: now,
        } satisfies SemiAutoTaskRow);

      return [
        {
          ...baseRow,
          ...normalizedPatch,
          createdAt: baseRow.createdAt || now,
          updatedAt: now,
        },
        ...current,
      ];
    });
  };

  const persistBearerKey = () => {
    const normalized = bugIdeaBearerKey.trim();
    if (!normalized) {
      showErrorToast(t("adminWorkspace.tiktokCookies.bearerRequired"));
      return false;
    }
    showSuccessToast(t("adminWorkspace.tiktokCookies.bearerSaved"));
    return true;
  };

  const ensureBearerKeyReady = (): string | null => {
    const normalized = bugIdeaBearerKey.trim();
    if (!normalized) {
      showErrorToast(t("adminWorkspace.tiktokCookies.bearerRequired"));
      return null;
    }
    return normalized;
  };

  const toggleWorkflowRowSelection = (profileId: string, checked: boolean) => {
    setSelectedWorkflowProfileIds((current) => {
      if (checked) {
        if (current.includes(profileId)) {
          return current;
        }
        return [...current, profileId];
      }
      return current.filter((value) => value !== profileId);
    });
  };

  const handleToggleSelectAllWorkflowRows = (checked: boolean) => {
    const visibleIds = filteredWorkflowRows
      .filter((row) => !row.isDisabled)
      .map((row) => row.profileId);
    setSelectedWorkflowProfileIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...visibleIds]));
      }
      const visibleIdSet = new Set(visibleIds);
      return current.filter((profileId) => !visibleIdSet.has(profileId));
    });
  };

  const selectedWorkflowRows = useMemo(
    () => {
      const selectedProfileIdSet = new Set(selectedWorkflowProfileIds);
      return sortedWorkflowRows.filter((row) =>
        selectedProfileIdSet.has(row.profileId),
      );
    },
    [selectedWorkflowProfileIds, sortedWorkflowRows],
  );
  const runnableSelectedWorkflowRows = useMemo(
    () => selectedWorkflowRows.filter((row) => !row.isDisabled),
    [selectedWorkflowRows],
  );
  const selectedWorkflowProfileIdSet = useMemo(
    () => new Set(selectedWorkflowProfileIds),
    [selectedWorkflowProfileIds],
  );

  const deferredWorkflowSearchQuery = useDeferredValue(workflowSearchQuery);
  const normalizedWorkflowSearchQuery = deferredWorkflowSearchQuery
    .trim()
    .toLowerCase();
  const filteredWorkflowRows = useMemo(
    () => {
      let rows =
        workflowStatusFilter === "all"
          ? sortedWorkflowRows
          : sortedWorkflowRows.filter(
              (row) =>
                (workflowDerivedByProfileId.get(row.profileId)?.workflowSyncStatus ??
                  resolveWorkflowSyncStatusForRow(row)) === workflowStatusFilter,
            );

      if (!normalizedWorkflowSearchQuery) {
        return rows;
      }

      rows = rows.filter((row) =>
        (
          workflowDerivedByProfileId.get(row.profileId)?.searchBlob ?? ""
        ).includes(normalizedWorkflowSearchQuery),
      );

      return rows;
    },
    [
      normalizedWorkflowSearchQuery,
      resolveWorkflowSyncStatusForRow,
      sortedWorkflowRows,
      workflowDerivedByProfileId,
      workflowStatusFilter,
    ],
  );
  const workflowTotalRows = filteredWorkflowRows.length;
  const workflowPageCount = Math.ceil(workflowTotalRows / workflowPageSize);
  const workflowPageRows = useMemo(() => {
    const start = workflowPageIndex * workflowPageSize;
    return filteredWorkflowRows.slice(start, start + workflowPageSize);
  }, [filteredWorkflowRows, workflowPageIndex, workflowPageSize]);
  const workflowPageStart =
    workflowTotalRows === 0 ? 0 : workflowPageIndex * workflowPageSize + 1;
  const workflowPageEnd = Math.min(
    workflowPageIndex * workflowPageSize + workflowPageRows.length,
    workflowTotalRows,
  );

  const activeRunItemByAccountId = useMemo(() => {
    const map = new Map<string, TiktokAutomationRunItemRecord>();
    for (const item of activeAutomationRunItems) {
      if (!item.accountId.trim() || map.has(item.accountId)) {
        continue;
      }
      map.set(item.accountId, item);
    }
    return map;
  }, [activeAutomationRunItems]);

  const signupRows = useMemo(
    () =>
      [...props.tiktokAutomationAccounts]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((account) => {
          const matchedRunItem = activeRunItemByAccountId.get(account.id) ?? null;
          return {
            account,
            matchedRunItem,
            status: matchedRunItem?.status ?? account.status,
            step: matchedRunItem?.step ?? account.lastStep ?? "-",
            lastError:
              matchedRunItem?.errorMessage ??
              matchedRunItem?.errorCode ??
              account.lastError ??
              null,
            cookiePreview:
              toWorkflowCookiePreview(matchedRunItem?.cookiePreview) ||
              toWorkflowCookiePreview(account.cookie) ||
              null,
          };
        }),
    [activeRunItemByAccountId, props.tiktokAutomationAccounts],
  );

  const filteredSignupRows = useMemo(() => {
    if (!normalizedWorkflowSearchQuery) {
      return signupRows;
    }
    return signupRows.filter((row) => {
      const joined = [
        row.account.phone,
        row.account.apiPhone,
        row.account.username,
        row.account.password,
        row.account.profileName ?? "",
        row.account.profileId ?? "",
        row.status,
        row.step,
        row.cookiePreview,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return joined.includes(normalizedWorkflowSearchQuery);
    });
  }, [normalizedWorkflowSearchQuery, signupRows]);

  const signupTotalRows = filteredSignupRows.length;
  const signupPageCount = Math.ceil(signupTotalRows / workflowPageSize);
  const signupPageRows = useMemo(() => {
    const start = workflowPageIndex * workflowPageSize;
    return filteredSignupRows.slice(start, start + workflowPageSize);
  }, [filteredSignupRows, workflowPageIndex, workflowPageSize]);
  const signupPageStart =
    signupTotalRows === 0 ? 0 : workflowPageIndex * workflowPageSize + 1;
  const signupPageEnd = Math.min(
    workflowPageIndex * workflowPageSize + signupPageRows.length,
    signupTotalRows,
  );

  const isSignupFlow = automationFlowType === "signup";
  const activeTotalRows = isSignupFlow ? signupTotalRows : workflowTotalRows;
  const activePageCount = isSignupFlow ? signupPageCount : workflowPageCount;
  const activePageStart = isSignupFlow ? signupPageStart : workflowPageStart;
  const activePageEnd = isSignupFlow ? signupPageEnd : workflowPageEnd;
  const isWorkflowActionBarVisible =
    !isSignupFlow && (selectedWorkflowRows.length > 0 || autoWorkflowRun !== null);
  const operationStatusLabel = operationProgress.progress
    ? t(
        `adminWorkspace.tiktokCookies.workflow.progress.status.${operationProgress.progress.status}`,
      )
    : "";
  const operationSummaryLabel = operationProgress.progress
    ? t("adminWorkspace.tiktokCookies.workflow.progress.summary", {
        processed: operationProgress.progress.processed,
        total: operationProgress.progress.total,
        success: operationProgress.progress.success,
        failed: operationProgress.progress.failed,
        skipped: operationProgress.progress.skipped,
      })
    : "";
  const actionBarPortalContainer = isActionBarMounted
    ? globalThis.document?.body ?? null
    : null;

  useEffect(() => {
    if (activePageCount === 0) {
      if (workflowPageIndex !== 0) {
        setWorkflowPageIndex(0);
      }
      return;
    }
    if (workflowPageIndex > activePageCount - 1) {
      setWorkflowPageIndex(activePageCount - 1);
    }
  }, [activePageCount, workflowPageIndex]);

  useEffect(() => {
    setWorkflowPageIndex(0);
    if (automationFlowType === "signup") {
      setSelectedWorkflowProfileIds([]);
    }
    workflowLastOtpCodeRef.current.clear();
  }, [automationFlowType]);

  const copyWorkflowValue = useCallback(
    async (value: string, successMessage: string) => {
      const normalized = value.trim();
      if (!normalized) {
        return;
      }
      try {
        await navigator.clipboard.writeText(normalized);
        showSuccessToast(successMessage);
      } catch (error) {
        showErrorToast(t("errors.unknownError"), {
          description: extractRootError(error),
        });
      }
    },
    [t],
  );

  const formatSyncAgeLabel = useCallback(
    (testedAt?: string | null): string | null => {
      const testedAtMs = parseTimestampMs(testedAt);
      if (testedAtMs === null) {
        return null;
      }
      const diffMs = Math.max(0, Date.now() - testedAtMs);
      const minuteMs = 60_000;
      const hourMs = 60 * minuteMs;
      const dayMs = 24 * hourMs;
      if (diffMs < hourMs) {
        return t("adminWorkspace.tiktokCookies.workflow.syncAgeMinutes", {
          value: Math.max(1, Math.floor(diffMs / minuteMs)),
        });
      }
      if (diffMs < dayMs) {
        return t("adminWorkspace.tiktokCookies.workflow.syncAgeHours", {
          value: Math.max(1, Math.floor(diffMs / hourMs)),
        });
      }
      return t("adminWorkspace.tiktokCookies.workflow.syncAgeDays", {
        value: Math.max(1, Math.floor(diffMs / dayMs)),
      });
    },
    [t],
  );

  const markWorkflowHeartbeat = useCallback(() => {
    const now = Date.now();
    workflowHeartbeatAtRef.current = now;
    setWorkflowMonitorNow(now);
  }, []);

  const maybeAssistWorkflowOtp = useCallback(
    async (row: SemiAutoTaskRow, options?: { forceToast?: boolean }) => {
      if (automationFlowType !== "signup") {
        return null;
      }
      const endpoint = normalizeWorkflowTabUrl(row.apiPhone);
      if (!endpoint) {
        return null;
      }
      if (workflowOtpFetchInFlightRef.current.has(row.profileId)) {
        return null;
      }

      workflowOtpFetchInFlightRef.current.add(row.profileId);
      try {
        const otpCode = await fetchWorkflowOtpCodeFromApi(endpoint);
        if (!otpCode) {
          return null;
        }
        const lastOtp = workflowLastOtpCodeRef.current.get(row.profileId);
        const isFreshOtp = lastOtp !== otpCode;
        if (!isFreshOtp && !options?.forceToast) {
          return otpCode;
        }

        workflowLastOtpCodeRef.current.set(row.profileId, otpCode);
        try {
          await navigator.clipboard.writeText(otpCode);
          showSuccessToast(
            t("adminWorkspace.tiktokCookies.workflow.otpDetectedCopied", {
              profile: row.profileName,
              code: otpCode,
            }),
            {
              id: `workflow-otp-${row.profileId}`,
            },
          );
        } catch (clipboardError) {
          if (options?.forceToast) {
            showErrorToast(t("errors.unknownError"), {
              description: extractRootError(clipboardError),
            });
          }
        }
        return otpCode;
      } finally {
        workflowOtpFetchInFlightRef.current.delete(row.profileId);
      }
    },
    [automationFlowType, t],
  );

  const resolveWorkflowCredentials = useCallback(
    (row: SemiAutoTaskRow) => {
      const account = resolveAutomationAccountForWorkflow(row);
      const derivedCredentials = deriveWorkflowCredentialsFromPhone(
        account?.phone || row.phoneNumber,
      );
      const username = account?.username || derivedCredentials?.username || "";
      const password = account?.password || derivedCredentials?.password || "";
      return {
        username,
        password,
      };
    },
    [resolveAutomationAccountForWorkflow],
  );

  const copyWorkflowCookieByRow = async (
    row: SemiAutoTaskRow,
    remoteCookieRecord: TiktokCookieRecord | null,
  ) => {
    let cookieToCopy = remoteCookieRecord?.cookie?.trim() ?? "";

    if (!cookieToCopy) {
      const sourceRow = resolveCookieSourceRowForWorkflow(row);
      cookieToCopy = sourceRow?.cookie?.trim() ?? "";
    }

    if (!cookieToCopy) {
      try {
        const cookieData = await invoke<CookieReadResult>("read_profile_cookies", {
          profileId: row.profileId,
        });
        const extracted = extractTiktokCookiePayload(cookieData);
        cookieToCopy = extracted.cookieHeader.trim();
        if (cookieToCopy) {
          updateWorkflowRow(row.profileId, {
            status: "cookie_ready",
            cookiePreview: cookieToCopy,
            localCookieSnapshot: cookieToCopy,
            lastError: null,
          });
        }
      } catch {
        // Keep missing-cookie UX below.
      }
    }

    if (!cookieToCopy) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.cookieMissing"));
      return;
    }

    await copyWorkflowValue(
      cookieToCopy,
      t("adminWorkspace.tiktokCookies.workflow.cookieCopied"),
    );
  };

  const summarizeWorkflowError = useCallback(
    (value: string | null | undefined) => {
      const normalized = value?.trim();
      if (!normalized) {
        return "";
      }

      const lower = normalized.toLowerCase();
      if (lower.includes("no valid cookies found in the file")) {
        return t("adminWorkspace.tiktokCookies.workflow.cookieMissing");
      }
      if (
        lower.includes("ssl_connect") ||
        lower.includes("ssl_error_syscall") ||
        lower.includes("curl error 35")
      ) {
        return t("adminWorkspace.tiktokCookies.workflow.syncNetworkWarning");
      }
      if (lower.includes("timeout") || lower.includes("timed out")) {
        return t("adminWorkspace.tiktokCookies.workflow.syncTimeoutWarning");
      }

      return truncateWorkflowError(normalized);
    },
    [t],
  );

  const upsertWorkflowCookie = useCallback(
    async (row: SemiAutoTaskRow, extracted: TiktokCookieExtractionResult) => {
      const canonicalLabel = getCanonicalCookieLabel(row.profileName);
      const notes = buildWorkflowNotes(
        row,
        extracted,
        rotationEveryMinutes,
        rotationLink,
      );
      const existingRecord = resolveRemoteCookieRecordForWorkflow(row);
      if (existingRecord) {
        const updatedRecord = await props.updateTiktokCookie(existingRecord.id, {
          label: existingRecord.label || canonicalLabel,
          cookie: extracted.cookieHeader,
          notes,
        }, { refresh: false });
        return updatedRecord;
      }
      const createdRecord = await props.createTiktokCookie({
        label: canonicalLabel,
        cookie: extracted.cookieHeader,
        notes,
      }, { refresh: false });
      return createdRecord;
    },
    [
      props,
      resolveRemoteCookieRecordForWorkflow,
      rotationEveryMinutes,
      rotationLink,
    ],
  );

  const openWorkflowProfileTabs = useCallback(
    async (
      row: SemiAutoTaskRow,
      options?: {
        target?: "primary" | "api_phone";
        launchIntent?: WorkflowLaunchIntent;
      },
    ) => {
      if (openingWorkflowProfileIdsRef.current.has(row.profileId)) {
        return;
      }
      openingWorkflowProfileIdsRef.current.add(row.profileId);
      try {
        const stopSignal = "__auto_workflow_stop__";
        const landingUrl = "https://www.tiktok.com/";
        const shopUrl = "https://shop.tiktok.com/";
        const loginUrl = "https://www.tiktok.com/login/phone-or-email/email";
        const normalizedLandingUrl = normalizeWorkflowTabUrl(landingUrl) ?? landingUrl;
        const normalizedShopUrl = normalizeWorkflowTabUrl(shopUrl) ?? shopUrl;
        const normalizedLoginUrl = normalizeWorkflowTabUrl(loginUrl) ?? loginUrl;
        const apiPhoneUrl = normalizeWorkflowTabUrl(row.apiPhone);
        const openedTabs = openedWorkflowTabsRef.current.get(row.profileId) ?? new Set<string>();
        const profile = workspaceProfilesRef.current.find(
          (item) => item.id === row.profileId,
        );

        const launchIntent = options?.launchIntent ?? "relogin";
        let targetUrl = normalizedLoginUrl;
        if (options?.target === "api_phone") {
          if (!apiPhoneUrl) {
            throw new Error(t("adminWorkspace.tiktokCookies.workflow.apiPhoneMissing"));
          }
          targetUrl = apiPhoneUrl;
        } else {
          targetUrl = launchIntent === "shop_refresh" ? normalizedShopUrl : normalizedLoginUrl;
        }

        const openTabWithRetry = async (url: string, tabKey: string) => {
          let lastError: unknown = null;
          let didForceKill = false;

          for (let attempt = 0; attempt < 3; attempt += 1) {
            if (autoWorkflowStopRequestedRef.current) {
              openedWorkflowTabsRef.current.set(row.profileId, openedTabs);
              throw new Error(stopSignal);
            }

            try {
              await invoke("open_url_with_profile", {
                profileId: row.profileId,
                url,
              });
              openedTabs.add(tabKey);
              return;
            } catch (error) {
              lastError = error;
              const message = extractRootError(error);
              const lockRace = isFirefoxLockRaceErrorMessage(message);

              if (lockRace && profile && !didForceKill) {
                didForceKill = true;
                try {
                  await invoke("kill_browser_profile", {
                    profile,
                  });
                  // eslint-disable-next-line no-await-in-loop
                  await waitMs(650);
                  continue;
                } catch {
                  // Fall through to regular retry logic.
                }
              }

              const shouldRetry =
                lockRace ||
                message.toLowerCase().includes("failed to open url with profile");
              if (!shouldRetry || attempt >= 2) {
                break;
              }
              // eslint-disable-next-line no-await-in-loop
              await waitMs(500);
            }
          }

        if (lastError) {
            throw lastError;
          }
        };

        if (options?.target === "api_phone") {
          const apiTabKey = getWorkflowTabKey(targetUrl) ?? targetUrl;
          await openTabWithRetry(targetUrl, apiTabKey);
        } else {
          // Warm up main domain first; direct deep-link login can trigger TikTok TLB 503.
          await openTabWithRetry(normalizedLandingUrl, "tiktok-landing");
          if (launchIntent === "shop_refresh") {
            await waitMs(900);
            await openTabWithRetry(normalizedShopUrl, "tiktok-shop");
          } else if (automationFlowType === "signup" || launchIntent === "relogin") {
            await waitMs(900);
            await openTabWithRetry(normalizedLoginUrl, "tiktok-login");
          }
        }
        openedWorkflowTabsRef.current.set(row.profileId, openedTabs);
      } catch (error) {
        if (extractRootError(error) === "__auto_workflow_stop__") {
          return;
        }
        throw error;
      } finally {
        openingWorkflowProfileIdsRef.current.delete(row.profileId);
      }
    },
    [automationFlowType, t],
  );

  const applyAutomationRunPayload = useCallback(
    (payload: {
      run: TiktokAutomationRunRecord;
      items: TiktokAutomationRunItemRecord[];
    }) => {
      setActiveAutomationRun(payload.run);
      setActiveAutomationRunItems(payload.items);
      automationEventsSinceRef.current = payload.run.updatedAt ?? new Date().toISOString();

      if (payload.items.length === 0) {
        return;
      }

      setWorkflowRows((current) => {
        let changed = false;
        const next = [...current];

        const resolveRowIndexForItem = (item: TiktokAutomationRunItemRecord) => {
          if (item.profileId) {
            const byProfileId = next.findIndex((row) => row.profileId === item.profileId);
            if (byProfileId >= 0) {
              return byProfileId;
            }
          }
          const byApiPhone = next.findIndex(
            (row) => row.apiPhone?.trim() && row.apiPhone.trim() === item.apiPhone.trim(),
          );
          if (byApiPhone >= 0) {
            return byApiPhone;
          }
          const normalizedItemPhone = normalizeWorkflowPhoneLookup(item.phone);
          if (!normalizedItemPhone) {
            return -1;
          }
          return next.findIndex(
            (row) =>
              normalizeWorkflowPhoneLookup(row.phoneNumber) === normalizedItemPhone,
          );
        };

        for (const item of payload.items) {
          const rowIndex = resolveRowIndexForItem(item);
          if (rowIndex < 0) {
            continue;
          }
          const row = next[rowIndex];
          const nextStatus = mapAutomationItemStatusToWorkflowStatus(item.status);
          const nextCookiePreview =
            toWorkflowCookiePreview(item.cookiePreview) || row.cookiePreview || null;
          const nextError = item.errorMessage?.trim() || item.errorCode || row.lastError || null;
          const nextUpdatedAt = item.updatedAt || row.updatedAt;
          const nextPhoneNumber =
            row.phoneNumber && row.phoneNumber.trim().length > 0
              ? row.phoneNumber
              : item.phone || row.phoneNumber;
          const nextApiPhone =
            row.apiPhone && row.apiPhone.trim().length > 0
              ? row.apiPhone
              : item.apiPhone || row.apiPhone;

          if (
            row.status === nextStatus &&
            (row.cookiePreview || null) === nextCookiePreview &&
            (row.lastError || null) === nextError &&
            row.updatedAt === nextUpdatedAt &&
            row.phoneNumber === nextPhoneNumber &&
            row.apiPhone === nextApiPhone
          ) {
            continue;
          }

          next[rowIndex] = {
            ...row,
            status: nextStatus,
            cookiePreview: nextCookiePreview,
            localCookieSnapshot:
              row.localCookieSnapshot ??
              toWorkflowLocalCookieSnapshot(nextCookiePreview),
            lastError: nextError,
            updatedAt: nextUpdatedAt,
            phoneNumber: nextPhoneNumber,
            apiPhone: nextApiPhone,
          };
          changed = true;
        }

        return changed ? next : current;
      });
    },
    [],
  );

  const handleLoadAutomationRun = useCallback(
    async (runId: string) => {
      if (!runId.trim()) {
        setActiveAutomationRunId(null);
        setActiveAutomationRun(null);
        setActiveAutomationRunItems([]);
        automationEventsSinceRef.current = null;
        return;
      }
      try {
        const payload = await props.getTiktokAutomationRun(runId);
        setActiveAutomationRunId(runId);
        applyAutomationRunPayload(payload);
      } catch (error) {
        showErrorToast(t("errors.unknownError"), {
          description: extractRootError(error),
        });
      }
    },
    [applyAutomationRunPayload, props.getTiktokAutomationRun, t],
  );

  const runAutomationAction = useCallback(
    async (
      action: "start" | "pause" | "resume" | "stop",
      runId: string,
    ) => {
      if (!runId.trim()) {
        return;
      }
      setIsAutomationRunningAction(true);
      try {
        const payload =
          action === "start"
            ? await props.startTiktokAutomationRun(runId)
            : action === "pause"
              ? await props.pauseTiktokAutomationRun(runId)
              : action === "resume"
                ? await props.resumeTiktokAutomationRun(runId)
                : await props.stopTiktokAutomationRun(runId);
        applyAutomationRunPayload(payload);
        if (action === "start" || action === "resume") {
          const queueProfileIds = payload.items
            .map((item) => item.profileId?.trim() ?? "")
            .filter(Boolean);
          const activeItem = payload.run.activeItemId
            ? payload.items.find((item) => item.id === payload.run.activeItemId) || null
            : null;
          if (queueProfileIds.length > 0) {
            setAutoWorkflowRun({
              queue: queueProfileIds,
              currentIndex: Math.max(0, payload.run.currentIndex),
              activeProfileId: activeItem?.profileId ?? null,
              launching: false,
              observedRunning: Boolean(activeItem),
              processingClose: false,
            });
          }
        }
        if (action === "pause" || action === "stop") {
          setAutoWorkflowRun(null);
        }
        await props.refreshTiktokAutomationRuns();
      } catch (error) {
        showErrorToast(t("errors.unknownError"), {
          description: extractRootError(error),
        });
      } finally {
        setIsAutomationRunningAction(false);
      }
    },
    [
      applyAutomationRunPayload,
      props.pauseTiktokAutomationRun,
      props.refreshTiktokAutomationRuns,
      props.resumeTiktokAutomationRun,
      props.startTiktokAutomationRun,
      props.stopTiktokAutomationRun,
      t,
    ],
  );

  const mergeCookieSourceRows = useCallback(
    (
      existingRows: TiktokAccountCookieSourceRow[],
      incomingRows: TiktokAccountCookieSourceRow[],
    ): TiktokAccountCookieSourceRow[] => {
      const map = new Map<string, TiktokAccountCookieSourceRow>();
      const rowKey = (row: TiktokAccountCookieSourceRow): string => {
        const apiPhone = row.api_phone.trim();
        if (apiPhone) {
          return `api:${apiPhone}`;
        }
        const normalizedPhone = normalizeWorkflowPhoneLookup(row.phone);
        if (normalizedPhone) {
          return `phone:${normalizedPhone}`;
        }
        return `cookie:${row.cookie.slice(0, 64)}`;
      };

      for (const row of existingRows) {
        const normalized: TiktokAccountCookieSourceRow = {
          phone: row.phone?.trim() ?? "",
          api_phone: row.api_phone?.trim() ?? "",
          cookie: row.cookie?.trim() ?? "",
        };
        if (!normalized.phone && !normalized.api_phone && !normalized.cookie) {
          continue;
        }
        map.set(rowKey(normalized), normalized);
      }

      for (const row of incomingRows) {
        const normalized: TiktokAccountCookieSourceRow = {
          phone: row.phone?.trim() ?? "",
          api_phone: row.api_phone?.trim() ?? "",
          cookie: row.cookie?.trim() ?? "",
        };
        if (!normalized.phone && !normalized.api_phone && !normalized.cookie) {
          continue;
        }
        map.set(rowKey(normalized), normalized);
      }

      return Array.from(map.values());
    },
    [],
  );

  const buildAutomationImportRowsFromSources = useCallback(
    (sourceRows: TiktokAccountCookieSourceRow[]) =>
      sourceRows
        .map((sourceRow) => {
          const normalizedPhone = normalizeWorkflowPhoneLookup(sourceRow.phone);
          const matchedWorkflowRow = sortedWorkflowRows.find((workflowRow) => {
            const rowPhone = normalizeWorkflowPhoneLookup(workflowRow.phoneNumber);
            if (
              sourceRow.api_phone.trim() &&
              workflowRow.apiPhone?.trim() === sourceRow.api_phone.trim()
            ) {
              return true;
            }
            return Boolean(normalizedPhone && rowPhone === normalizedPhone);
          });

          const credentialPhoneSource =
            sourceRow.phone || matchedWorkflowRow?.phoneNumber || "";
          const derivedCredentials = deriveWorkflowCredentialsFromPhone(
            credentialPhoneSource,
          );

          return {
            phone: sourceRow.phone,
            apiPhone: sourceRow.api_phone,
            cookie: sourceRow.cookie,
            username: derivedCredentials?.username,
            password: derivedCredentials?.password,
            profileId: matchedWorkflowRow?.profileId ?? null,
            profileName: matchedWorkflowRow?.profileName ?? null,
            source: "bugidea_pull" as const,
          };
        })
        .filter(
          (row) =>
            row.phone?.trim() ||
            row.apiPhone?.trim() ||
            row.cookie?.trim(),
        ),
    [sortedWorkflowRows],
  );

  const handleSyncAllWorkflowProfiles = useCallback(async () => {
    if (!ensureBearerKeyReady()) {
      return;
    }
    if (sortedWorkflowRows.length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneListEmpty"));
      return;
    }

    setIsSyncAllSyncing(true);
    operationProgress.begin({
      label: t("adminWorkspace.tiktokCookies.workflow.runCenter.syncAll"),
      total: sortedWorkflowRows.length,
    });
    let syncedCount = 0;
    let missingCount = 0;
    let failedCount = 0;
    const mergedSourceRows: TiktokAccountCookieSourceRow[] = [];

    try {
      for (const row of sortedWorkflowRows) {
        try {
          // Prefer local cookie => push to BugIdea; fallback to pull from BugIdea when local is missing.
          // eslint-disable-next-line no-await-in-loop
          const cookieData = await invoke<CookieReadResult>("read_profile_cookies", {
            profileId: row.profileId,
          });
          const extracted = extractTiktokCookiePayload(cookieData);

          if (extracted.cookieHeader?.trim()) {
            // eslint-disable-next-line no-await-in-loop
            const record = await upsertWorkflowCookie(row, extracted);
            try {
              // eslint-disable-next-line no-await-in-loop
              await props.testTiktokCookie(record.id, { refresh: false });
              // eslint-disable-next-line no-await-in-loop
              await props.updateTiktokCookie(
                record.id,
                { status: "active" },
                { refresh: false },
              );
            } catch {
              try {
                // eslint-disable-next-line no-await-in-loop
                await props.updateTiktokCookie(
                  record.id,
                  { status: "error" },
                  { refresh: false },
                );
              } catch {
                // Keep sync flow resilient.
              }
            }
            syncedCount += 1;
            operationProgress.patch({
              processedDelta: 1,
              successDelta: 1,
            });
            updateWorkflowRow(row.profileId, {
              status: "done",
              cookieRecordId: record.id,
              cookiePreview: extracted.cookieHeader,
              localCookieSnapshot: extracted.cookieHeader,
              lastError: null,
            });
            mergedSourceRows.push({
              phone: row.phoneNumber || "",
              api_phone: row.apiPhone || "",
              cookie: extracted.cookieHeader,
            });
            continue;
          }

          const remoteRecord = resolveRemoteCookieRecordForWorkflow(row);
          const remoteCookie = remoteRecord?.cookie?.trim() ?? "";
          if (!remoteCookie) {
            missingCount += 1;
            operationProgress.patch({
              processedDelta: 1,
              skippedDelta: 1,
              message: t("adminWorkspace.tiktokCookies.workflow.cookieMissing"),
            });
            updateWorkflowRow(row.profileId, {
              status: "cookie_missing",
              localCookieSnapshot: null,
              lastError: t("adminWorkspace.tiktokCookies.workflow.cookieMissing"),
            });
            continue;
          }

          // eslint-disable-next-line no-await-in-loop
          await invoke("import_cookies_from_file", {
            profileId: row.profileId,
            content: toCookieImportContent(remoteCookie),
          });
          syncedCount += 1;
          operationProgress.patch({
            processedDelta: 1,
            successDelta: 1,
          });
          updateWorkflowRow(row.profileId, {
            status: "done",
            cookieRecordId: remoteRecord?.id ?? row.cookieRecordId,
            cookiePreview: remoteCookie,
            localCookieSnapshot: remoteCookie,
            lastError: null,
          });
          mergedSourceRows.push({
            phone: row.phoneNumber || "",
            api_phone: row.apiPhone || "",
            cookie: remoteCookie,
          });
        } catch (error) {
          failedCount += 1;
          const issueLog = formatWorkflowIssueLog(error);
          operationProgress.patch({
            processedDelta: 1,
            failedDelta: 1,
            message: issueLog,
          });
          updateWorkflowRow(row.profileId, {
            status: "push_failed",
            lastError: issueLog,
          });
        }
      }

      if (mergedSourceRows.length > 0) {
        const mergedRows = mergeCookieSourceRows(cookieSourceRows, mergedSourceRows);
        await props.replaceTiktokCookieSources(
          mergedRows.map((row) => ({
            phone: row.phone,
            apiPhone: row.api_phone,
            cookie: row.cookie,
          })),
        );
        setCookieSourceRows(mergedRows);

        const importRows = buildAutomationImportRowsFromSources(mergedRows);
        if (importRows.length > 0) {
          await props.importTiktokAutomationAccounts({
            rows: importRows,
            force: true,
          });
        }
        await Promise.all([
          props.refreshTiktokCookieSources(),
          props.refreshTiktokAutomationAccounts(),
        ]);
      }
      await props.refreshTiktokCookies();

      if (failedCount === 0 && missingCount === 0) {
        operationProgress.finish({
          status: "success",
        });
        showSuccessToast(
          t("adminWorkspace.tiktokCookies.workflow.syncAllSuccess", {
            count: syncedCount,
          }),
        );
      } else {
        operationProgress.finish({
          status: "partial",
        });
        showSuccessToast(
          t("adminWorkspace.tiktokCookies.workflow.syncAllPartial", {
            synced: syncedCount,
            missing: missingCount,
            failed: failedCount,
          }),
        );
      }
    } catch (error) {
      operationProgress.finish({
        status: "error",
        message: extractRootError(error),
      });
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.syncAllFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSyncAllSyncing(false);
    }
  }, [
    buildAutomationImportRowsFromSources,
    cookieSourceRows,
    mergeCookieSourceRows,
    operationProgress,
    props.importTiktokAutomationAccounts,
    props.refreshTiktokCookies,
    props.refreshTiktokAutomationAccounts,
    props.refreshTiktokCookieSources,
    props.testTiktokCookie,
    props.updateTiktokCookie,
    props.replaceTiktokCookieSources,
    resolveRemoteCookieRecordForWorkflow,
    sortedWorkflowRows,
    t,
    upsertWorkflowCookie,
  ]);

  const handleCreateAutomationRun = useCallback(async () => {
    const hasSelection = selectedWorkflowRows.length > 0;
    const selectedAccountIds = Array.from(
      new Set(
        runnableSelectedWorkflowRows
          .map((row) => resolveAutomationAccountForWorkflow(row)?.id ?? "")
          .filter(Boolean),
      ),
    );
    if (hasSelection && selectedAccountIds.length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.bulkNoRunnable"));
      return;
    }
    if (props.tiktokAutomationAccounts.length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneListEmpty"));
      return;
    }

    setIsAutomationRunningAction(true);
    autoWorkflowStopRequestedRef.current = false;
    try {
      const createdPayload = await props.createTiktokAutomationRun({
        flowType: automationFlowType,
        mode: automationRunMode,
        accountIds: hasSelection ? selectedAccountIds : undefined,
      });
      setActiveAutomationRunId(createdPayload.run.id);
      applyAutomationRunPayload(createdPayload);
      const startedPayload = await props.startTiktokAutomationRun(createdPayload.run.id);
      applyAutomationRunPayload(startedPayload);
      const queueProfileIds = startedPayload.items
        .map((item) => item.profileId?.trim() ?? "")
        .filter(Boolean);
      if (queueProfileIds.length > 0) {
        setAutoWorkflowRun({
          queue: queueProfileIds,
          currentIndex: 0,
          activeProfileId: null,
          launching: false,
          observedRunning: false,
          processingClose: false,
        });
      }
      await props.refreshTiktokAutomationRuns();
      await props.refreshTiktokAutomationAccounts();
      showSuccessToast(
        t("adminWorkspace.tiktokCookies.workflow.autoRunStarted", {
          count: startedPayload.run.totalCount,
        }),
      );
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.startProfileFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsAutomationRunningAction(false);
    }
  }, [
    applyAutomationRunPayload,
    automationFlowType,
    automationRunMode,
    props.createTiktokAutomationRun,
    props.refreshTiktokAutomationAccounts,
    props.refreshTiktokAutomationRuns,
    props.startTiktokAutomationRun,
    props.tiktokAutomationAccounts.length,
    resolveAutomationAccountForWorkflow,
    runnableSelectedWorkflowRows,
    selectedWorkflowRows,
    t,
  ]);

  useEffect(() => {
    if (!props.workspaceId || props.tiktokAutomationRuns.length === 0) {
      if (activeAutomationRunId) {
        setActiveAutomationRunId(null);
        setActiveAutomationRun(null);
        setActiveAutomationRunItems([]);
        automationEventsSinceRef.current = null;
      }
      return;
    }

    if (
      activeAutomationRunId &&
      props.tiktokAutomationRuns.some((run) => run.id === activeAutomationRunId)
    ) {
      return;
    }

    const latestLiveRun = props.tiktokAutomationRuns.find(
      (run) =>
        run.status === "running" ||
        run.status === "queued" ||
        run.status === "paused",
    );
    if (!latestLiveRun) {
      return;
    }
    setActiveAutomationRunId(latestLiveRun.id);
  }, [activeAutomationRunId, props.tiktokAutomationRuns, props.workspaceId]);

  useEffect(() => {
    if (!activeAutomationRunId) {
      return;
    }
    void handleLoadAutomationRun(activeAutomationRunId);
  }, [activeAutomationRunId, handleLoadAutomationRun]);

  useEffect(() => {
    if (!activeAutomationRunId || !activeAutomationRun) {
      return;
    }
    if (
      activeAutomationRun.status !== "running" &&
      activeAutomationRun.status !== "queued"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        if (document.visibilityState !== "visible") {
          return;
        }
        if (automationPollInFlightRef.current) {
          return;
        }
        automationPollInFlightRef.current = true;
        try {
          const payload = await props.pollTiktokAutomationRunEvents(
            activeAutomationRunId,
            automationEventsSinceRef.current,
          );
          applyAutomationRunPayload(payload);
          if (payload.items.length > 0 || payload.run.status !== activeAutomationRun.status) {
            const now = Date.now();
            const statusChanged = payload.run.status !== activeAutomationRun.status;
            if (
              statusChanged ||
              now - lastAutomationListsRefreshAtRef.current >= 15000
            ) {
              lastAutomationListsRefreshAtRef.current = now;
              await props.refreshTiktokAutomationAccounts();
              await props.refreshTiktokAutomationRuns();
            }
          }
        } catch {
          // Silent polling failure; next interval retries.
        } finally {
          automationPollInFlightRef.current = false;
        }
      })();
    }, 8000);

    return () => window.clearInterval(interval);
  }, [
    activeAutomationRun,
    activeAutomationRunId,
    applyAutomationRunPayload,
    props.pollTiktokAutomationRunEvents,
    props.refreshTiktokAutomationAccounts,
    props.refreshTiktokAutomationRuns,
  ]);

  const handleRefresh = () => {
    void Promise.all([
      props.refreshTiktokCookies(),
      props.refreshTiktokAutomationAccounts(),
      props.refreshTiktokAutomationRuns(),
    ]);
  };

  const handleCreate = async () => {
    const bearer = ensureBearerKeyReady();
    if (!bearer) {
      return;
    }
    const label = createLabel.trim();
    const cookie = createCookie.trim();
    if (!label || !cookie) {
      showErrorToast(t("adminWorkspace.tiktokCookies.createFieldsRequired"));
      return;
    }
    try {
      await props.createTiktokCookie({
        label,
        cookie,
        notes:
          `${createNotes.trim()} bearer_set=${Boolean(bearer)}`.trim() ||
          undefined,
      });
      setCreateLabel("");
      setCreateCookie("");
      setCreateNotes("");
      showSuccessToast(t("adminWorkspace.tiktokCookies.createSuccess"));
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.createFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const startEditing = (row: TiktokCookieRecord) => {
    setEditingId(row.id);
    setEditLabel(row.label ?? "");
    setEditCookie(row.cookie ?? "");
    setEditStatus(row.status ?? "");
    setEditNotes(row.notes ?? "");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditLabel("");
    setEditCookie("");
    setEditStatus("");
    setEditNotes("");
  };

  const handleUpdate = async () => {
    if (!editingId) {
      return;
    }
    const updateInput: {
      label?: string;
      cookie?: string;
      status?: string;
      notes?: string;
    } = {};

    if (editLabel.trim().length > 0) {
      updateInput.label = editLabel.trim();
    }
    if (editCookie.trim().length > 0) {
      updateInput.cookie = editCookie.trim();
    }
    if (editStatus.trim().length > 0) {
      updateInput.status = editStatus.trim();
    }
    if (editNotes.trim().length > 0) {
      updateInput.notes = editNotes.trim();
    }

    if (Object.keys(updateInput).length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.updateFieldsRequired"));
      return;
    }

    try {
      await props.updateTiktokCookie(editingId, updateInput);
      cancelEditing();
      showSuccessToast(t("adminWorkspace.tiktokCookies.updateSuccess"));
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.updateFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await props.deleteTiktokCookie(id);
      if (editingId === id) {
        cancelEditing();
      }
      showSuccessToast(t("adminWorkspace.tiktokCookies.deleteSuccess"));
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.deleteFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleTest = async (id: string) => {
    if (!ensureBearerKeyReady()) {
      return;
    }
    try {
      await props.testTiktokCookie(id);
      showSuccessToast(t("adminWorkspace.tiktokCookies.testSuccess"));
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.testFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleBulkCreate = async () => {
    if (!ensureBearerKeyReady()) {
      return;
    }
    const cookies = bulkInput
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    if (cookies.length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.bulkFieldsRequired"));
      return;
    }
    try {
      await props.bulkCreateTiktokCookies({
        cookies,
        prefix: bulkPrefix.trim() || undefined,
      });
      setBulkInput("");
      showSuccessToast(
        t("adminWorkspace.tiktokCookies.bulkSuccess", {
          count: cookies.length,
        }),
      );
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.bulkFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleImportPhoneFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const normalizedName = file.name.trim().toLowerCase();
    if (normalizedName.endsWith(".xlsx") || normalizedName.endsWith(".xls")) {
      showErrorToast(
        t("adminWorkspace.tiktokCookies.workflow.phoneFileExcelUnsupported"),
      );
      event.target.value = "";
      return;
    }
    try {
      const raw = await file.text();
      const parsed = parsePhoneCandidates(raw);
      if (parsed.length === 0) {
        showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneListEmpty"));
        return;
      }
      setUploadedPhoneList(parsed);
      showSuccessToast(
        t("adminWorkspace.tiktokCookies.workflow.phoneFileImported", {
          count: parsed.length,
        }),
      );
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneFileFailed"), {
        description: extractRootError(error),
      });
    } finally {
      event.target.value = "";
    }
  };

  const fetchPhonesFromApi = async (): Promise<string[]> => {
    const endpoint = apiPhoneEndpoint.trim();
    if (!endpoint) {
      showErrorToast(
        t("adminWorkspace.tiktokCookies.workflow.apiPhoneEndpointRequired"),
      );
      return [];
    }
    try {
      setIsLoadingApiPhones(true);
      const response = await fetch(endpoint, {
        method: "GET",
      });
      if (!response.ok) {
        showErrorToast(t("adminWorkspace.tiktokCookies.workflow.apiPhoneFailed"), {
          description: `${response.status}`,
        });
        return [];
      }
      const payload = (await response.json()) as
        | string[]
        | { phones?: string[]; data?: { phones?: string[] } };
      const phones = Array.isArray(payload)
        ? payload
        : payload.phones ??
          payload.data?.phones ??
          [];
      const normalizedPhones = phones
        .map((value) => `${value}`)
        .filter((value) => value.trim().length > 0);
      if (normalizedPhones.length === 0) {
        showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneListEmpty"));
        return [];
      }
      return normalizedPhones;
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.apiPhoneFailed"), {
        description: extractRootError(error),
      });
      return [];
    } finally {
      setIsLoadingApiPhones(false);
    }
  };

  const handleCreateWorkflowBatch = async () => {
    const normalizedPrefix = profilePrefix.trim();
    if (!normalizedPrefix) {
      showErrorToast(
        t("adminWorkspace.tiktokCookies.workflow.profilePrefixRequired"),
      );
      return;
    }

    const normalizedRotationInput = rotationEveryMinutes.trim();
    const rotationMinutes =
      normalizedRotationInput.length > 0
        ? Number.parseInt(normalizedRotationInput, 10)
        : 5;
    if (!Number.isFinite(rotationMinutes) || rotationMinutes <= 0) {
      showErrorToast(
        t("adminWorkspace.tiktokCookies.workflow.rotationIntervalInvalid"),
      );
      return;
    }

    let phoneCandidates: string[] = [];
    if (workflowPhoneSource === "manual") {
      phoneCandidates = [workflowPhoneNumber];
    } else if (workflowPhoneSource === "list") {
      phoneCandidates = parsePhoneCandidates(phoneListInput);
    } else if (workflowPhoneSource === "file") {
      phoneCandidates = uploadedPhoneList;
    } else {
      phoneCandidates = await fetchPhonesFromApi();
    }

    const normalizedPhones = phoneCandidates
      .map((value) =>
        normalizeWorkflowPhoneNumber(`${value}`, workflowPhoneCountry),
      )
      .filter(Boolean);

    if (normalizedPhones.length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneRequired"));
      return;
    }
    if (
      workflowPhoneCountry === "US" &&
      normalizedPhones.some((phone) => phone.length !== 10)
    ) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.phoneInvalidUs"));
      return;
    }

    const targetBatchSize =
      workflowMode === "single"
        ? 1
        : Math.min(50, Math.max(normalizedPhones.length, 1));

    if (!activeRotationProxy) {
      showErrorToast(
        t("adminWorkspace.tiktokCookies.workflow.proxyNotAvailable"),
      );
      return;
    }

    setIsCreatingBatch(true);
    try {
      const downloadedVersions = await invoke<string[]>(
        "get_downloaded_browser_versions",
        {
          browserStr: selectedBrowser,
        },
      );

      const targetVersion = downloadedVersions[0];
      if (!targetVersion) {
        throw new Error(
          t("adminWorkspace.tiktokCookies.workflow.browserVersionRequired"),
        );
      }

      const releaseType =
        selectedBrowser === "firefox-developer" ? "nightly" : "stable";
      const batchId = buildBatchStamp();
      const now = new Date().toISOString();
      const createdRows: SemiAutoTaskRow[] = [];
      const matchedPhones: string[] = [];

      for (let index = 1; index <= targetBatchSize; index += 1) {
        const profileName = `${normalizedPrefix}-${batchId}-${index}`;
        const targetPhoneRaw =
          normalizedPhones[index - 1] ??
          normalizedPhones[normalizedPhones.length - 1] ??
          "";
        const targetPhone = toWorkflowPhoneE164(
          targetPhoneRaw,
          workflowPhoneCountry,
        );
        matchedPhones.push(targetPhone);
        const createdProfile = await invoke<BrowserProfile>(
          "create_browser_profile_new",
          {
            name: profileName,
            browserStr: selectedBrowser,
            version: targetVersion,
            releaseType,
            proxyId: activeRotationProxy.id,
          },
        );

        createdRows.push({
          batchId,
          profileId: createdProfile.id,
          profileName: createdProfile.name,
          browser: selectedBrowser,
          proxyId: activeRotationProxy.id,
          proxyName: activeRotationProxy.name,
          phoneCountry: workflowPhoneCountry,
          phoneNumber: targetPhone,
          status: "created",
          cookieRecordId: null,
          lastError:
            rotationLink.trim().length > 0
              ? `rotation_link=${rotationLink.trim()} every=${rotationMinutes}m`
              : null,
          createdAt: now,
          updatedAt: now,
        });
      }

      setWorkflowRows((current) => [...createdRows, ...current]);
      setRotationCursor((current) => current + 1);
      await props.refreshWorkspaceProfiles().catch(() => null);

      showSuccessToast(
        t("adminWorkspace.tiktokCookies.workflow.createBatchSuccess", {
          count: createdRows.length,
          proxy: activeRotationProxy.name,
          phones: matchedPhones.length,
        }),
      );
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.createBatchFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const handleStartWorkflowProfile = async (row: SemiAutoTaskRow) => {
    if (row.isDisabled) {
      return;
    }
    autoWorkflowStopRequestedRef.current = false;
    workflowLaunchTimestampRef.current.set(row.profileId, Date.now());
    markWorkflowHeartbeat();
    setActiveWorkflowProfileId(row.profileId);
    try {
      const launchIntent = resolveWorkflowLaunchIntent(row);
      autoWorkflowLaunchIntentRef.current.set(row.profileId, launchIntent);
      await openWorkflowProfileTabs(row, { launchIntent });
      markWorkflowHeartbeat();
      updateWorkflowRow(row.profileId, {
        status: "started",
        lastError: null,
      });
      setManualWorkflowWatch({
        profileId: row.profileId,
        observedRunning: false,
        processingClose: false,
      });
      showSuccessToast(
        t("adminWorkspace.tiktokCookies.workflow.startProfileSuccess", {
          profile: row.profileName,
        }),
      );
      if (automationFlowType === "signup") {
        const credentials = resolveWorkflowCredentials(row);
        if (credentials.username && credentials.password) {
          showSuccessToast(
            t("adminWorkspace.tiktokCookies.workflow.signupCredentialReady", {
              profile: row.profileName,
              username: credentials.username,
              password: credentials.password,
            }),
            {
              id: `workflow-credential-${row.profileId}`,
            },
          );
        }
      }
    } catch (error) {
      const issueLog = formatWorkflowIssueLog(error);
      updateWorkflowRow(row.profileId, {
        status: "push_failed",
        lastError: issueLog,
      });
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.startProfileFailed"), {
        description: summarizeWorkflowError(issueLog),
      });
      workflowLaunchTimestampRef.current.delete(row.profileId);
      autoWorkflowLaunchIntentRef.current.delete(row.profileId);
    } finally {
      setActiveWorkflowProfileId((current) =>
        current === row.profileId ? null : current,
      );
    }
  };

  const handleStopWorkflowProfile = async (row: SemiAutoTaskRow) => {
    if (row.isDisabled) {
      return;
    }
    const profile = workspaceProfilesRef.current.find(
      (item) => item.id === row.profileId,
    );
    if (!profile) {
      return;
    }

    setStoppingWorkflowProfileId(row.profileId);
    try {
      await invoke("kill_browser_profile", { profile });
      updateWorkflowRow(row.profileId, {
        lastError: null,
      });
    } catch (error) {
      showErrorToast(t("toasts.error.profileUpdateFailed"), {
        description: extractRootError(error),
      });
    } finally {
      autoWorkflowLaunchIntentRef.current.delete(row.profileId);
      setStoppingWorkflowProfileId((current) =>
        current === row.profileId ? null : current,
      );
    }
  };

  const captureWorkflowProfileCookie = useCallback(
    async (row: SemiAutoTaskRow) => {
      const cookieData = await invoke<CookieReadResult>("read_profile_cookies", {
        profileId: row.profileId,
      });
      const extracted = extractTiktokCookiePayload(cookieData);

      const resolveRunItemForProfile = () => {
        if (!activeAutomationRun) {
          return null;
        }
        const activeItem = activeAutomationRun.activeItemId
          ? activeAutomationRunItems.find(
              (item) => item.id === activeAutomationRun.activeItemId,
            ) || null
          : null;
        if (
          activeItem &&
          (activeItem.profileId === row.profileId ||
            normalizeWorkflowPhoneLookup(activeItem.phone) ===
              normalizeWorkflowPhoneLookup(row.phoneNumber))
        ) {
          return activeItem;
        }
        return (
          activeAutomationRunItems.find(
            (item) =>
              item.profileId === row.profileId ||
              normalizeWorkflowPhoneLookup(item.phone) ===
                normalizeWorkflowPhoneLookup(row.phoneNumber),
          ) || null
        );
      };

      if (!extracted.cookieHeader) {
        updateWorkflowRow(row.profileId, {
          status: "cookie_missing",
          cookiePreview: null,
          localCookieSnapshot: null,
          lastError: t("adminWorkspace.tiktokCookies.workflow.cookieMissing"),
        });
        const runItem = resolveRunItemForProfile();
        if (activeAutomationRun && runItem) {
          try {
            const payload = await props.updateTiktokAutomationRunItem(
              activeAutomationRun.id,
              runItem.id,
              {
                status: "blocked",
                step: "cookie_missing",
                errorCode: "cookie_missing",
                errorMessage: t("adminWorkspace.tiktokCookies.workflow.cookieMissing"),
              },
            );
            applyAutomationRunPayload({
              run: payload.run,
              items: payload.items,
            });
          } catch {
            // Keep local state even if run-item sync fails.
          }
        }
        return false;
      }

      updateWorkflowRow(row.profileId, {
        status: "cookie_ready",
        cookiePreview: extracted.cookieHeader,
        localCookieSnapshot: extracted.cookieHeader,
        lastError: null,
      });
      let cookieRecordId: string | null = null;
      let verifyWarning: string | null = null;
      try {
        const record = await upsertWorkflowCookie(row, extracted);
        cookieRecordId = record.id;
        try {
          await props.testTiktokCookie(record.id, { refresh: false });
          await props.updateTiktokCookie(
            record.id,
            { status: "active" },
            { refresh: false },
          );
        } catch (verifyError) {
          verifyWarning = formatWorkflowIssueLog(verifyError);
          try {
            await props.updateTiktokCookie(
              record.id,
              { status: "error" },
              { refresh: false },
            );
          } catch {
            // Keep local flow resilient when remote status update fails.
          }
        }
      } catch (syncError) {
        verifyWarning = formatWorkflowIssueLog(syncError);
      }
      const runItem = resolveRunItemForProfile();
      if (activeAutomationRun && runItem) {
        try {
          const payload = await props.updateTiktokAutomationRunItem(
            activeAutomationRun.id,
            runItem.id,
              {
                status: "done",
                step: "cookie_updated",
                cookiePreview: toWorkflowCookiePreview(extracted.cookieHeader),
                errorCode: verifyWarning ? "sync_warning" : null,
                errorMessage: verifyWarning,
              },
          );
          applyAutomationRunPayload({
            run: payload.run,
            items: payload.items,
          });
        } catch {
          // Keep local state even if run-item sync fails.
        }
      }
      updateWorkflowRow(row.profileId, {
        cookieRecordId: cookieRecordId ?? row.cookieRecordId,
        lastError: verifyWarning,
      });
      return true;
    },
    [
      activeAutomationRun,
      activeAutomationRunItems,
      applyAutomationRunPayload,
      props.testTiktokCookie,
      props.updateTiktokCookie,
      props.updateTiktokAutomationRunItem,
      t,
      upsertWorkflowCookie,
    ],
  );

  const handleOpenWorkflowProfile = async (row: SemiAutoTaskRow) => {
    if (row.isDisabled) {
      return;
    }
    autoWorkflowStopRequestedRef.current = false;
    try {
      const launchIntent = resolveWorkflowLaunchIntent(row);
      autoWorkflowLaunchIntentRef.current.set(row.profileId, launchIntent);
      await openWorkflowProfileTabs(row, { launchIntent });
      updateWorkflowRow(row.profileId, {
        lastError: null,
      });
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.startProfileFailed"), {
        description: summarizeWorkflowError(formatWorkflowIssueLog(error)),
      });
    }
  };

  const handleOpenWorkflowApiPhone = async (row: SemiAutoTaskRow) => {
    if (row.isDisabled) {
      return;
    }
    try {
      await openWorkflowProfileTabs(row, {
        target: "api_phone",
      });
      showSuccessToast(
        t("adminWorkspace.tiktokCookies.workflow.openApiPhoneSuccess", {
          profile: row.profileName,
        }),
      );
    } catch (error) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.openApiPhoneFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleFetchWorkflowOtpCode = async (row: SemiAutoTaskRow) => {
    const otpCode = await maybeAssistWorkflowOtp(row, { forceToast: true });
    if (otpCode) {
      return;
    }
    showErrorToast(t("adminWorkspace.tiktokCookies.workflow.otpNotFound"), {
      description: t("adminWorkspace.tiktokCookies.workflow.otpNotFoundDescription"),
    });
  };

  const handleSetWorkflowRowBrowser = (
    row: SemiAutoTaskRow,
    browser: BrowserTypeString,
  ) => {
    if (row.browser === browser) {
      return;
    }
    updateWorkflowRow(row.profileId, {
      browser,
      lastError: null,
    });
    const browserLabel =
      BROWSER_OPTIONS.find((option) => option.value === browser)?.label ?? browser;
    showSuccessToast(
      t("adminWorkspace.tiktokCookies.workflow.browserUpdated", {
        profile: row.profileName,
        browser: browserLabel,
      }),
    );
  };

  const handleSyncWorkflowProfile = async (row: SemiAutoTaskRow) => {
    if (row.isDisabled) {
      return;
    }
    if (!ensureBearerKeyReady()) {
      return;
    }
    setSyncingProfileId(row.profileId);

    try {
      const cookieData = await invoke<CookieReadResult>("read_profile_cookies", {
        profileId: row.profileId,
      });
      const extracted = extractTiktokCookiePayload(cookieData);

      if (extracted.cookieHeader) {
        const createdOrUpdated = await upsertWorkflowCookie(row, extracted);
        let verifyWarning: string | null = null;
        try {
          await props.testTiktokCookie(createdOrUpdated.id, { refresh: false });
        } catch (verifyError) {
          // Non-blocking verify step (Postman-style request chain): keep sync result.
          verifyWarning = extractRootError(verifyError);
        }
        try {
          await props.updateTiktokCookie(
            createdOrUpdated.id,
            { status: verifyWarning ? "error" : "active" },
            { refresh: false },
          );
        } catch {
          // Do not block local sync flow on remote status write failures.
        }
        await props.refreshTiktokCookies().catch(() => null);
        updateWorkflowRow(row.profileId, {
          status: "done",
          cookieRecordId: createdOrUpdated.id,
          cookiePreview: extracted.cookieHeader,
          localCookieSnapshot: extracted.cookieHeader,
          lastError: verifyWarning,
        });
        showSuccessToast(
          t("adminWorkspace.tiktokCookies.workflow.syncSuccess", {
            profile: row.profileName,
          }),
          verifyWarning
            ? {
                description: summarizeWorkflowError(verifyWarning),
              }
            : undefined,
        );
        return;
      }

      updateWorkflowRow(row.profileId, {
        status: "cookie_missing",
        localCookieSnapshot: null,
        lastError: t("adminWorkspace.tiktokCookies.workflow.cookieMissing"),
      });
      const existingRecord = resolveRemoteCookieRecordForWorkflow(row);
      if (existingRecord?.id) {
        try {
          await props.updateTiktokCookie(
            existingRecord.id,
            { status: "missing_cookie" },
            { refresh: false },
          );
        } catch {
          // Ignore remote status write errors.
        }
      }
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.cookieMissing"));
    } catch (error) {
      const issueLog = formatWorkflowIssueLog(error);
      const errorMessage = extractRootError(error);
      const normalizedError = errorMessage.toLowerCase();
      const isMissingCookieError = normalizedError.includes(
        "no valid cookies found in the file",
      );
      updateWorkflowRow(row.profileId, {
        status: isMissingCookieError ? "cookie_missing" : "push_failed",
        lastError: isMissingCookieError
          ? t("adminWorkspace.tiktokCookies.workflow.cookieMissing")
          : issueLog,
      });
      if (isMissingCookieError) {
        showErrorToast(t("adminWorkspace.tiktokCookies.workflow.cookieMissing"));
      } else {
        showErrorToast(t("adminWorkspace.tiktokCookies.workflow.syncFailed"), {
          description: summarizeWorkflowError(issueLog),
        });
      }
    } finally {
      setSyncingProfileId(null);
    }
  };

  const handleRemoveWorkflowRow = (profileId: string) => {
    setWorkflowRows((current) =>
      current.filter((row) => row.profileId !== profileId),
    );
    openedWorkflowTabsRef.current.delete(profileId);
    openingWorkflowProfileIdsRef.current.delete(profileId);
    workflowLaunchTimestampRef.current.delete(profileId);
    autoWorkflowLaunchIntentRef.current.delete(profileId);
    setManualWorkflowWatch((current) =>
      current && current.profileId === profileId ? null : current,
    );
    setSelectedWorkflowProfileIds((current) =>
      current.filter((value) => value !== profileId),
    );
  };

  const handleToggleWorkflowRowDisabled = (
    profileId: string,
    nextDisabled: boolean,
  ) => {
    updateWorkflowRow(profileId, {
      isDisabled: nextDisabled,
      lastError: nextDisabled ? null : undefined,
    });
    if (nextDisabled) {
      setSelectedWorkflowProfileIds((current) =>
        current.filter((value) => value !== profileId),
      );
    }
  };

  const handleBulkStartWorkflowProfiles = async () => {
    const queue = Array.from(
      new Set(
        runnableSelectedWorkflowRows.map((row) => row.profileId).filter(Boolean),
      ),
    );
    if (queue.length === 0) {
      showErrorToast(t("adminWorkspace.tiktokCookies.workflow.bulkNoRunnable"));
      return;
    }

    autoWorkflowStopRequestedRef.current = false;
    setManualWorkflowWatch(null);
    setAutoWorkflowRun({
      queue,
      currentIndex: 0,
      activeProfileId: null,
      launching: false,
      observedRunning: false,
      processingClose: false,
    });
    showSuccessToast(
      t("adminWorkspace.tiktokCookies.workflow.autoRunStarted", {
        count: queue.length,
      }),
    );
  };

  const handleBulkSyncWorkflowProfiles = async () => {
    for (const row of runnableSelectedWorkflowRows) {
      // eslint-disable-next-line no-await-in-loop
      await handleSyncWorkflowProfile(row);
    }
  };

  const handleBulkRemoveWorkflowProfiles = () => {
    const selectedIds = new Set(selectedWorkflowProfileIds);
    for (const profileId of selectedIds) {
      openedWorkflowTabsRef.current.delete(profileId);
      openingWorkflowProfileIdsRef.current.delete(profileId);
      workflowLaunchTimestampRef.current.delete(profileId);
      autoWorkflowLaunchIntentRef.current.delete(profileId);
    }
    setWorkflowRows((current) =>
      current.filter((row) => !selectedIds.has(row.profileId)),
    );
    setManualWorkflowWatch((current) =>
      current && selectedIds.has(current.profileId) ? null : current,
    );
    setSelectedWorkflowProfileIds([]);
  };

  const handleStopAutoWorkflowRun = useCallback(() => {
    autoWorkflowStopRequestedRef.current = true;
    workflowLaunchTimestampRef.current.clear();
    autoWorkflowLaunchIntentRef.current.clear();
    setAutoWorkflowRun(null);
    markWorkflowHeartbeat();
    showSuccessToast(t("adminWorkspace.tiktokCookies.workflow.autoRunStopped"));
  }, [markWorkflowHeartbeat, t]);

  useEffect(() => {
    if (!autoWorkflowRun) {
      return;
    }
    if (autoWorkflowStopRequestedRef.current) {
      return;
    }

    if (
      autoWorkflowRun.activeProfileId !== null ||
      autoWorkflowRun.launching ||
      autoWorkflowRun.processingClose
    ) {
      return;
    }

    const nextProfileId = autoWorkflowRun.queue[autoWorkflowRun.currentIndex];
    if (!nextProfileId) {
      showSuccessToast(
        t("adminWorkspace.tiktokCookies.workflow.autoRunFinished", {
          count: autoWorkflowRun.queue.length,
        }),
      );
      setAutoWorkflowRun(null);
      return;
    }

    const nextRow = sortedWorkflowRowsRef.current.find(
      (row) => row.profileId === nextProfileId,
    );
    if (!nextRow) {
      setAutoWorkflowRun((current) =>
        current
          ? {
              ...current,
              currentIndex: current.currentIndex + 1,
            }
          : current,
      );
      return;
    }

    setAutoWorkflowRun((current) =>
      current
        ? {
            ...current,
            launching: true,
          }
        : current,
    );

    void (async () => {
      try {
        if (autoWorkflowStopRequestedRef.current) {
          return;
        }
        markWorkflowHeartbeat();
        const launchIntent = resolveWorkflowLaunchIntent(nextRow);
        autoWorkflowLaunchIntentRef.current.set(nextRow.profileId, launchIntent);
        await openWorkflowProfileTabs(nextRow, { launchIntent });
        if (autoWorkflowStopRequestedRef.current) {
          return;
        }
        markWorkflowHeartbeat();
        workflowLaunchTimestampRef.current.set(nextRow.profileId, Date.now());
        updateWorkflowRow(nextRow.profileId, {
          status: "started",
          lastError: null,
        });
        if (automationFlowType === "signup") {
          const credentials = resolveWorkflowCredentials(nextRow);
          if (credentials.username && credentials.password) {
            showSuccessToast(
              t("adminWorkspace.tiktokCookies.workflow.signupCredentialReady", {
                profile: nextRow.profileName,
                username: credentials.username,
                password: credentials.password,
              }),
              {
                id: `workflow-credential-${nextRow.profileId}`,
              },
            );
          }
        }
        setAutoWorkflowRun((current) =>
          current
            ? {
                ...current,
                activeProfileId: nextRow.profileId,
                launching: false,
                observedRunning: false,
              }
            : current,
        );
      } catch (error) {
        const issueLog = formatWorkflowIssueLog(error);
        updateWorkflowRow(nextRow.profileId, {
          lastError: issueLog,
          status: "push_failed",
        });
        workflowLaunchTimestampRef.current.delete(nextRow.profileId);
        autoWorkflowLaunchIntentRef.current.delete(nextRow.profileId);
        setAutoWorkflowRun(null);
        showErrorToast(
          t("adminWorkspace.tiktokCookies.workflow.startProfileFailed"),
          {
            description: summarizeWorkflowError(issueLog),
          },
        );
      }
    })();
  }, [
    autoWorkflowRun,
    automationFlowType,
    markWorkflowHeartbeat,
    openWorkflowProfileTabs,
    resolveWorkflowLaunchIntent,
    resolveWorkflowCredentials,
    t,
  ]);

  useEffect(() => {
    if (!autoWorkflowRun?.activeProfileId) {
      autoWorkflowStatusCheckInFlightRef.current = false;
      return;
    }
    if (autoWorkflowStopRequestedRef.current) {
      autoWorkflowStatusCheckInFlightRef.current = false;
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        if (autoWorkflowStopRequestedRef.current) {
          return;
        }
        if (document.visibilityState !== "visible") {
          return;
        }
        if (autoWorkflowStatusCheckInFlightRef.current) {
          return;
        }
        const profile = workspaceProfilesRef.current.find(
          (item) => item.id === autoWorkflowRun.activeProfileId,
        );
        if (!profile) {
          return;
        }

        try {
          autoWorkflowStatusCheckInFlightRef.current = true;
          const isRunning = await invoke<boolean>("check_browser_status", {
            profile,
          });
          if (autoWorkflowStopRequestedRef.current) {
            return;
          }

          if (isRunning) {
            markWorkflowHeartbeat();
            const runningRow = sortedWorkflowRowsRef.current.find(
              (item) => item.profileId === profile.id,
            );
            if (runningRow) {
              void maybeAssistWorkflowOtp(runningRow);
            }
            const launchIntent =
              autoWorkflowLaunchIntentRef.current.get(profile.id) ?? "relogin";
            const launchedAt = workflowLaunchTimestampRef.current.get(profile.id) ?? 0;
            const shouldCloseAfterShopRefresh =
              launchIntent === "shop_refresh" &&
              launchedAt > 0 &&
              Date.now() - launchedAt >= WORKFLOW_SHOP_REFRESH_RUNTIME_MS;
            if (shouldCloseAfterShopRefresh) {
              try {
                await invoke("kill_browser_profile", { profile });
              } catch (closeError) {
                const issueLog = formatWorkflowIssueLog(closeError);
                updateWorkflowRow(profile.id, {
                  status: "push_failed",
                  lastError: issueLog,
                });
                workflowLaunchTimestampRef.current.delete(profile.id);
                autoWorkflowLaunchIntentRef.current.delete(profile.id);
                setAutoWorkflowRun(null);
                showErrorToast(t("adminWorkspace.tiktokCookies.workflow.syncFailed"), {
                  description: summarizeWorkflowError(issueLog),
                });
              }
              return;
            }
            if (!autoWorkflowRun.observedRunning) {
              setAutoWorkflowRun((current) =>
                current && current.activeProfileId === profile.id
                  ? {
                      ...current,
                      observedRunning: true,
                    }
                  : current,
              );
            }
            return;
          }

          if (autoWorkflowRun.processingClose) {
            return;
          }

          const launchedAt =
            workflowLaunchTimestampRef.current.get(profile.id) ?? 0;
          const isGraceWindowElapsed =
            launchedAt > 0 && Date.now() - launchedAt >= 4000;

          if (!autoWorkflowRun.observedRunning && !isGraceWindowElapsed) {
            return;
          }

          if (autoWorkflowCloseGuardRef.current === profile.id) {
            return;
          }
          autoWorkflowCloseGuardRef.current = profile.id;

          setAutoWorkflowRun((current) =>
            current && current.activeProfileId === profile.id
              ? {
                  ...current,
                  processingClose: true,
                }
              : current,
          );

          const row = sortedWorkflowRowsRef.current.find(
            (item) => item.profileId === profile.id,
          );
          if (!row) {
            setAutoWorkflowRun(null);
            return;
          }

          const hasFreshCookie = await captureWorkflowProfileCookie(row);
          markWorkflowHeartbeat();
          if (autoWorkflowStopRequestedRef.current) {
            return;
          }
          autoWorkflowLaunchIntentRef.current.delete(profile.id);
          if (!hasFreshCookie) {
            workflowLaunchTimestampRef.current.delete(profile.id);
            setAutoWorkflowRun(null);
            showErrorToast(
              t("adminWorkspace.tiktokCookies.workflow.autoRunStoppedNoCookie", {
                profile: row.profileName,
              }),
              {
                id: `workflow-autostop-${row.profileId}`,
              },
            );
            return;
          }

          showSuccessToast(
            t("adminWorkspace.tiktokCookies.workflow.autoRunCookieReady", {
              profile: row.profileName,
            }),
            {
              id: `workflow-cookie-ready-${row.profileId}`,
            },
          );

          setAutoWorkflowRun((current) => {
            if (!current || current.activeProfileId !== profile.id) {
              return current;
            }

            const nextIndex = current.currentIndex + 1;
            if (nextIndex >= current.queue.length) {
              workflowLaunchTimestampRef.current.delete(profile.id);
              autoWorkflowLaunchIntentRef.current.delete(profile.id);
              showSuccessToast(
                t("adminWorkspace.tiktokCookies.workflow.autoRunFinished", {
                  count: current.queue.length,
                }),
              );
              return null;
            }

            workflowLaunchTimestampRef.current.delete(profile.id);
            return {
              ...current,
              currentIndex: nextIndex,
              activeProfileId: null,
              observedRunning: false,
              processingClose: false,
            };
          });
        } catch (error) {
          const issueLog = formatWorkflowIssueLog(error);
          setAutoWorkflowRun(null);
          autoWorkflowLaunchIntentRef.current.clear();
          showErrorToast(
            t("adminWorkspace.tiktokCookies.workflow.syncFailed"),
            {
              description: summarizeWorkflowError(issueLog),
            },
          );
        } finally {
          autoWorkflowStatusCheckInFlightRef.current = false;
        }
      })();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [
    autoWorkflowRun,
    captureWorkflowProfileCookie,
    markWorkflowHeartbeat,
    maybeAssistWorkflowOtp,
    t,
  ]);

  useEffect(() => {
    if (!manualWorkflowWatch?.profileId) {
      manualWorkflowStatusCheckInFlightRef.current = false;
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        if (document.visibilityState !== "visible") {
          return;
        }
        if (manualWorkflowStatusCheckInFlightRef.current) {
          return;
        }

        const profile = workspaceProfilesRef.current.find(
          (item) => item.id === manualWorkflowWatch.profileId,
        );
        if (!profile) {
          workflowLaunchTimestampRef.current.delete(manualWorkflowWatch.profileId);
          autoWorkflowLaunchIntentRef.current.delete(manualWorkflowWatch.profileId);
          setManualWorkflowWatch(null);
          return;
        }

        try {
          manualWorkflowStatusCheckInFlightRef.current = true;
          const isRunning = await invoke<boolean>("check_browser_status", {
            profile,
          });

          if (isRunning) {
            markWorkflowHeartbeat();
            const runningRow = sortedWorkflowRowsRef.current.find(
              (item) => item.profileId === profile.id,
            );
            if (runningRow) {
              void maybeAssistWorkflowOtp(runningRow);
            }
            if (!manualWorkflowWatch.observedRunning) {
              setManualWorkflowWatch((current) =>
                current && current.profileId === profile.id
                  ? {
                      ...current,
                      observedRunning: true,
                    }
                  : current,
              );
            }
            return;
          }

          if (manualWorkflowWatch.processingClose) {
            return;
          }

          const launchedAt =
            workflowLaunchTimestampRef.current.get(profile.id) ?? 0;
          const isGraceWindowElapsed =
            launchedAt > 0 && Date.now() - launchedAt >= 4000;

          if (!manualWorkflowWatch.observedRunning && !isGraceWindowElapsed) {
            return;
          }

          if (manualWorkflowCloseGuardRef.current === profile.id) {
            return;
          }
          manualWorkflowCloseGuardRef.current = profile.id;

          setManualWorkflowWatch((current) =>
            current && current.profileId === profile.id
              ? {
                  ...current,
                  processingClose: true,
                }
              : current,
          );

          const row = sortedWorkflowRowsRef.current.find(
            (item) => item.profileId === profile.id,
          );
          if (!row) {
            setManualWorkflowWatch(null);
            return;
          }

          const hasFreshCookie = await captureWorkflowProfileCookie(row);
          markWorkflowHeartbeat();
          if (hasFreshCookie) {
            showSuccessToast(
              t("adminWorkspace.tiktokCookies.workflow.autoRunCookieReady", {
                profile: row.profileName,
              }),
              {
                id: `workflow-manual-cookie-ready-${row.profileId}`,
              },
            );
          } else {
            showErrorToast(
              t("adminWorkspace.tiktokCookies.workflow.autoRunStoppedNoCookie", {
                profile: row.profileName,
              }),
              {
                id: `workflow-manual-cookie-missing-${row.profileId}`,
              },
            );
          }
          workflowLaunchTimestampRef.current.delete(profile.id);
          autoWorkflowLaunchIntentRef.current.delete(profile.id);
          setManualWorkflowWatch(null);
        } catch (error) {
          workflowLaunchTimestampRef.current.delete(profile.id);
          autoWorkflowLaunchIntentRef.current.delete(profile.id);
          setManualWorkflowWatch(null);
          showErrorToast(t("adminWorkspace.tiktokCookies.workflow.syncFailed"), {
            description: extractRootError(error),
          });
        } finally {
          manualWorkflowStatusCheckInFlightRef.current = false;
        }
      })();
    }, 3500);

    return () => window.clearInterval(interval);
  }, [
    captureWorkflowProfileCookie,
    manualWorkflowWatch,
    markWorkflowHeartbeat,
    maybeAssistWorkflowOtp,
    t,
  ]);

  const selectableWorkflowRows = filteredWorkflowRows.filter(
    (row) => !row.isDisabled,
  );
  const allWorkflowRowsSelected =
    selectableWorkflowRows.length > 0 &&
    selectableWorkflowRows.every((row) =>
      selectedWorkflowProfileIdSet.has(row.profileId),
    );
  const activeAutomationRunCompletedCount = activeAutomationRun
    ? activeAutomationRun.doneCount +
      activeAutomationRun.failedCount +
      activeAutomationRun.blockedCount
    : 0;
  const activeAutomationRunTotalCount = activeAutomationRun?.totalCount ?? 0;
  const activeRunStatusTone = getRunStatusTone(activeAutomationRun?.status ?? null);
  const normalizedBearerKey = bugIdeaBearerKey.trim();
  const hasBearerKey = normalizedBearerKey.length > 0;
  const accountDoneCount = props.tiktokAutomationAccounts.filter(
    (account) => account.status === "done",
  ).length;
  const accountFailedCount = props.tiktokAutomationAccounts.filter(
    (account) =>
      account.status === "blocked" ||
      account.status === "step_failed" ||
      account.status === "cancelled",
  ).length;
  const accountRunningCount = props.tiktokAutomationAccounts.filter(
    (account) => account.status === "running" || account.status === "manual_pending",
  ).length;
  const latestRunStatus = activeAutomationRun?.status ?? "-";
  const activeRunProgressPercent =
    activeAutomationRunTotalCount > 0
      ? Math.round((activeAutomationRunCompletedCount / activeAutomationRunTotalCount) * 100)
      : 0;
  const autoWorkflowActiveRow = useMemo(
    () =>
      autoWorkflowRun?.activeProfileId
        ? sortedWorkflowRows.find(
            (row) => row.profileId === autoWorkflowRun.activeProfileId,
          ) || null
        : null,
    [autoWorkflowRun?.activeProfileId, sortedWorkflowRows],
  );
  const autoWorkflowPhaseLabel = autoWorkflowRun
    ? autoWorkflowRun.processingClose
      ? t("adminWorkspace.tiktokCookies.workflow.autoRunCapturingCookie")
      : autoWorkflowRun.activeProfileId && !autoWorkflowRun.observedRunning
        ? t("adminWorkspace.tiktokCookies.workflow.autoRunOpeningProfile")
        : autoWorkflowRun.activeProfileId
          ? t("adminWorkspace.tiktokCookies.workflow.autoRunWaiting")
          : t("adminWorkspace.tiktokCookies.workflow.autoRunLaunching")
    : "";
  const autoWorkflowDetailLabel =
    autoWorkflowRun && autoWorkflowActiveRow
      ? `${t("adminWorkspace.tiktokCookies.workflow.autoRunCurrent", {
          profile: autoWorkflowActiveRow.profileName,
        })} · ${autoWorkflowPhaseLabel}`
      : autoWorkflowPhaseLabel;
  const monitoredProfileId =
    autoWorkflowRun?.activeProfileId ??
    manualWorkflowWatch?.profileId ??
    activeWorkflowProfileId;
  const monitoredWorkflowRow = monitoredProfileId
    ? sortedWorkflowRows.find((row) => row.profileId === monitoredProfileId) ?? null
    : null;
  const monitoredLastLaunchAt = monitoredProfileId
    ? workflowLaunchTimestampRef.current.get(monitoredProfileId) ?? null
    : null;
  const workflowHeartbeatAgeSeconds = Math.max(
    0,
    Math.floor((workflowMonitorNow - workflowHeartbeatAtRef.current) / 1000),
  );
  const workflowRunAgeSeconds = monitoredLastLaunchAt
    ? Math.max(0, Math.floor((workflowMonitorNow - monitoredLastLaunchAt) / 1000))
    : null;
  const isWorkflowLikelyStalled =
    Boolean(monitoredProfileId) &&
    (workflowHeartbeatAgeSeconds >= 18 ||
      (workflowRunAgeSeconds !== null && workflowRunAgeSeconds >= 45));
  const outcomeTotal = props.tiktokAutomationAccounts.length;
  const processedTotal = accountDoneCount + accountFailedCount;
  const successRatePercent =
    processedTotal > 0 ? Math.round((accountDoneCount / processedTotal) * 100) : 0;

  useEffect(() => {
    if (!monitoredProfileId) {
      return;
    }
    const timer = window.setInterval(() => {
      setWorkflowMonitorNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [monitoredProfileId]);

  if (!props.isPlatformAdmin) {
    return (
      <div className="rounded-md border border-dashed border-border bg-muted/20 p-5 text-[13px] text-muted-foreground">
        {t("adminWorkspace.noAccessDescription")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 border-y border-border/50 bg-card">
        <div className="space-y-2 border-b border-border/50 bg-card px-2.5 py-2">
          <div className="flex flex-wrap items-end gap-4 border-b border-border/50 px-1 pb-2">
            <div className="min-w-[270px] border-r border-border/50 pr-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsOutcome")}
              </p>
              <div className="mt-1 flex items-end gap-4">
                <div>
                  <p className="text-2xl font-semibold leading-tight text-foreground tabular-nums">
                    {outcomeTotal}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsAccounts")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight text-chart-2 tabular-nums">
                    {accountDoneCount}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsDone")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight text-destructive tabular-nums">
                    {accountFailedCount}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsFailed")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight text-chart-1 tabular-nums">
                    {accountRunningCount}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsStarted")}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-[260px]">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsPerformance")}
              </p>
              <div className="mt-1 flex items-end gap-4">
                <div>
                  <p className="text-lg font-semibold leading-tight text-foreground tabular-nums">
                    {successRatePercent}%
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsSuccessRate")}
                  </p>
                </div>
                <div>
                  <p className="text-lg font-semibold leading-tight text-foreground tabular-nums">
                    {props.tiktokAutomationRuns.length}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsRuns")}
                  </p>
                </div>
                <div>
                  <p
                    className={cn(
                      "text-lg font-semibold leading-tight tabular-nums",
                      latestRunStatus === "failed"
                        ? "text-destructive"
                        : latestRunStatus === "completed"
                          ? "text-chart-2"
                          : latestRunStatus === "running"
                            ? "text-chart-1"
                            : "text-foreground",
                    )}
                  >
                    {latestRunStatus}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsLatestStatus")}
                  </p>
                </div>
                {activeAutomationRun ? (
                  <div>
                    <p className="text-lg font-semibold leading-tight text-foreground tabular-nums">
                      {activeRunProgressPercent}%
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {t("adminWorkspace.tiktokCookies.workflow.runCenter.statsRunProgress")}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="ml-auto">
              <Badge
                variant="outline"
                className={cn(
                  "h-7 px-2.5 text-[11px] font-medium",
                  hasBearerKey
                    ? "border-chart-2/45 bg-chart-2/15 text-chart-2"
                    : "border-border bg-muted/70 text-muted-foreground",
                )}
              >
                {t("adminWorkspace.tiktokCookies.bearerTitle")}:{" "}
                {hasBearerKey ? t("common.status.active") : t("common.status.inactive")}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
              <Tabs
                value={automationFlowType}
                onValueChange={(value) =>
                  setAutomationFlowType(value as TiktokAutomationFlowType)
                }
              >
                <TabsList className="grid h-8 w-[206px] grid-cols-2 rounded-lg bg-muted/50 p-0.5">
                  <TabsTrigger
                    value="signup"
                    className="text-[11px]"
                    disabled={isWorkflowBusy || isAutomationRunningAction}
                  >
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.flowSignup")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="update_cookie"
                    className="text-[11px]"
                    disabled={isWorkflowBusy || isAutomationRunningAction}
                  >
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.flowUpdateCookie")}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Select
                value={automationRunMode}
                onValueChange={(value) =>
                  setAutomationRunMode(value as TiktokAutomationRunMode)
                }
                disabled={isWorkflowBusy || isAutomationRunningAction}
              >
                <SelectTrigger className="h-8 w-[94px]">
                  <SelectValue placeholder={t("adminWorkspace.tiktokCookies.workflow.runCenter.mode")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semi">semi</SelectItem>
                  <SelectItem value="auto">auto</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="password"
                className="h-8 w-[220px]"
                value={bugIdeaBearerKey}
                onChange={(event) => setBugIdeaBearerKey(event.target.value)}
                placeholder={t("adminWorkspace.tiktokCookies.bearerPlaceholder")}
                disabled={isWorkflowBusy}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-2.5"
                onClick={persistBearerKey}
                disabled={isWorkflowBusy}
                title={t("adminWorkspace.tiktokCookies.bearerSave")}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {t("adminWorkspace.tiktokCookies.bearerSave")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                onClick={() => {
                  void Promise.all([
                    props.refreshTiktokAutomationAccounts(),
                    props.refreshTiktokAutomationRuns(),
                  ]);
                }}
                disabled={isWorkflowBusy}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("adminWorkspace.controlPlane.refresh")}
              </Button>
              <LoadingButton
                variant="outline"
                size="sm"
                className="h-8 px-2.5"
                onClick={() => void handleSyncAllWorkflowProfiles()}
                isLoading={isSyncAllSyncing}
                disabled={isWorkflowBusy}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {t("adminWorkspace.tiktokCookies.workflow.runCenter.syncAll")}
              </LoadingButton>
              <LoadingButton
                variant="secondary"
                size="sm"
                className="h-8 px-2.5"
                onClick={() => void handleCreateAutomationRun()}
                isLoading={isAutomationRunningAction}
                disabled={isWorkflowBusy || props.tiktokAutomationAccounts.length === 0}
              >
                <Play className="mr-1.5 h-3.5 w-3.5" />
                {t("adminWorkspace.tiktokCookies.workflow.runCenter.runNow")}
              </LoadingButton>
              <Select
                value={activeAutomationRunId ?? "__none__"}
                onValueChange={(value) =>
                  void handleLoadAutomationRun(value === "__none__" ? "" : value)
                }
                disabled={isWorkflowBusy || props.tiktokAutomationRuns.length === 0}
              >
                <SelectTrigger className="h-8 w-[190px]">
                  <SelectValue
                    placeholder={t(
                      "adminWorkspace.tiktokCookies.workflow.runCenter.noRunSelected",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("adminWorkspace.tiktokCookies.workflow.runCenter.noRunSelected")}
                  </SelectItem>
                  {props.tiktokAutomationRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.flowType}:{run.status}:{run.totalCount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeAutomationRun ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("h-8 px-2.5", activeRunStatusTone)}
                      disabled={isWorkflowBusy || isAutomationRunningAction}
                    >
                      <MoreHorizontal className="mr-1.5 h-3.5 w-3.5" />
                      {activeAutomationRun.status}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-[220px]">
                    <DropdownMenuLabel>
                      {t("adminWorkspace.tiktokCookies.workflow.runCenter.activeRun")}
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onSelect={() => void runAutomationAction("start", activeAutomationRun.id)}
                      disabled={activeAutomationRun.status === "running"}
                    >
                      {t("common.buttons.start")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void runAutomationAction("pause", activeAutomationRun.id)}
                      disabled={activeAutomationRun.status !== "running"}
                    >
                      {t("adminWorkspace.tiktokCookies.workflow.runCenter.pause")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void runAutomationAction("resume", activeAutomationRun.id)}
                      disabled={activeAutomationRun.status !== "paused"}
                    >
                      {t("adminWorkspace.tiktokCookies.workflow.runCenter.resume")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => void runAutomationAction("stop", activeAutomationRun.id)}
                      disabled={
                        activeAutomationRun.status !== "running" &&
                        activeAutomationRun.status !== "queued" &&
                        activeAutomationRun.status !== "paused"
                      }
                    >
                      {t("common.buttons.stop")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5"
                    disabled={isWorkflowBusy}
                  >
                    <MoreHorizontal className="mr-1.5 h-3.5 w-3.5" />
                    {t("adminWorkspace.tiktokCookies.workflow.columns.more")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[250px]">
                  <DropdownMenuLabel>
                    {t("adminWorkspace.tiktokCookies.workflow.columns.more")}
                  </DropdownMenuLabel>
                  {!isSignupFlow ? (
                    <>
                      <DropdownMenuItem
                        onSelect={() => {
                          void Promise.all([
                            props.refreshStoredProxies(),
                            props.refreshWorkspaceProfiles(),
                          ]);
                        }}
                        disabled={isLoadingProxies || isLoadingProfiles}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        {t("adminWorkspace.tiktokCookies.workflow.refreshProxy")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={handleCreateWorkflowBatch}
                        disabled={!activeRotationProxy}
                      >
                        <PlusCircle className="h-3.5 w-3.5" />
                        {t("adminWorkspace.tiktokCookies.workflow.createBatch")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  ) : null}
                  <DropdownMenuItem
                    onSelect={() => setShowWorkflowConfig((current) => !current)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {showWorkflowConfig
                      ? t("common.buttons.close")
                      : t("common.buttons.edit")}
                  </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
          </div>
        </div>

        <div className="space-y-3 p-2.5">
          {!isSignupFlow && showWorkflowConfig ? (
            <div className="rounded-md border border-border/60 bg-background p-3">
              <Tabs
                value={workflowConfigTab}
                onValueChange={(value) =>
                  setWorkflowConfigTab(value as WorkflowConfigTab)
                }
                className="space-y-3"
              >
                <TabsList className="grid h-9 w-full max-w-[280px] grid-cols-2 rounded-lg bg-muted/40 p-1">
                  <TabsTrigger value="basic" className="text-[12px]">
                    {t("adminWorkspace.tiktokCookies.workflow.basicConfig")}
                  </TabsTrigger>
                  <TabsTrigger value="advanced" className="text-[12px]">
                    {t("adminWorkspace.tiktokCookies.workflow.advancedConfig")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="mt-0">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.flowMode")}</Label>
                      <Select
                        value={workflowMode}
                        onValueChange={(value) => setWorkflowMode(value as WorkflowMode)}
                        disabled={isWorkflowBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="single">
                            {t("adminWorkspace.tiktokCookies.workflow.flowSingle")}
                          </SelectItem>
                          <SelectItem value="multi">
                            {t("adminWorkspace.tiktokCookies.workflow.flowMulti")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.profilePrefix")}</Label>
                      <Input
                        value={profilePrefix}
                        onChange={(event) => setProfilePrefix(event.target.value)}
                        placeholder={t(
                          "adminWorkspace.tiktokCookies.workflow.profilePrefixPlaceholder",
                        )}
                        disabled={isWorkflowBusy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.browser")}</Label>
                      <Select
                        value={selectedBrowser}
                        onValueChange={(value) =>
                          setSelectedBrowser(value as BrowserTypeString)
                        }
                        disabled={isWorkflowBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BROWSER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.phoneSource")}</Label>
                      <Select
                        value={workflowPhoneSource}
                        onValueChange={(value) =>
                          setWorkflowPhoneSource(value as WorkflowPhoneSource)
                        }
                        disabled={isWorkflowBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">
                            {t("adminWorkspace.tiktokCookies.workflow.phoneSourceManual")}
                          </SelectItem>
                          <SelectItem value="list">
                            {t("adminWorkspace.tiktokCookies.workflow.phoneSourceList")}
                          </SelectItem>
                          <SelectItem value="file">
                            {t("adminWorkspace.tiktokCookies.workflow.phoneSourceFile")}
                          </SelectItem>
                          <SelectItem value="api_phone">
                            {t("adminWorkspace.tiktokCookies.workflow.phoneSourceApi")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {workflowPhoneSource === "manual" ? (
                      <div className="space-y-2">
                        <Label>{t("adminWorkspace.tiktokCookies.workflow.phoneNumber")}</Label>
                        <Input
                          value={workflowPhoneNumber}
                          onChange={(event) => setWorkflowPhoneNumber(event.target.value)}
                          placeholder={t(
                            "adminWorkspace.tiktokCookies.workflow.phoneNumberPlaceholder",
                          )}
                          disabled={isWorkflowBusy}
                          inputMode="tel"
                          autoComplete="tel-national"
                        />
                      </div>
                    ) : null}

                    {workflowPhoneSource === "list" ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>{t("adminWorkspace.tiktokCookies.workflow.phoneListTitle")}</Label>
                        <Textarea
                          value={phoneListInput}
                          onChange={(event) => setPhoneListInput(event.target.value)}
                          placeholder={t(
                            "adminWorkspace.tiktokCookies.workflow.phoneListPlaceholder",
                          )}
                          disabled={isWorkflowBusy}
                          className="min-h-[96px]"
                        />
                      </div>
                    ) : null}

                    {workflowPhoneSource === "file" ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>{t("adminWorkspace.tiktokCookies.workflow.phoneFileTitle")}</Label>
                        <Input
                          type="file"
                          accept=".csv,.tsv,.txt"
                          onChange={(event) => void handleImportPhoneFile(event)}
                          disabled={isWorkflowBusy}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.phoneFileHint", {
                            count: uploadedPhoneList.length,
                          })}
                        </p>
                      </div>
                    ) : null}

                    {workflowPhoneSource === "api_phone" ? (
                      <div className="space-y-2 md:col-span-2">
                        <Label>
                          {t("adminWorkspace.tiktokCookies.workflow.apiPhoneEndpoint")}
                        </Label>
                        <Input
                          value={apiPhoneEndpoint}
                          onChange={(event) => setApiPhoneEndpoint(event.target.value)}
                          placeholder={t(
                            "adminWorkspace.tiktokCookies.workflow.apiPhoneEndpointPlaceholder",
                          )}
                          disabled={isWorkflowBusy || isLoadingApiPhones}
                        />
                      </div>
                    ) : null}
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="mt-0">
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.phoneCountry")}</Label>
                      <Select
                        value={workflowPhoneCountry}
                        onValueChange={(value) =>
                          setWorkflowPhoneCountry(value as WorkflowPhoneCountry)
                        }
                        disabled={isWorkflowBusy}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WORKFLOW_PHONE_COUNTRY_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)} ({option.dialCode})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.proxyKeyword")}</Label>
                      <Input
                        value={proxyKeyword}
                        onChange={(event) => setProxyKeyword(event.target.value)}
                        placeholder={t(
                          "adminWorkspace.tiktokCookies.workflow.proxyKeywordPlaceholder",
                        )}
                        disabled={isWorkflowBusy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.rotationLink")}</Label>
                      <Input
                        value={rotationLink}
                        onChange={(event) => setRotationLink(event.target.value)}
                        placeholder={t(
                          "adminWorkspace.tiktokCookies.workflow.rotationLinkPlaceholder",
                        )}
                        disabled={isWorkflowBusy}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("adminWorkspace.tiktokCookies.workflow.rotationInterval")}</Label>
                      <Input
                        value={rotationEveryMinutes}
                        onChange={(event) => setRotationEveryMinutes(event.target.value)}
                        inputMode="numeric"
                        placeholder="5"
                        disabled={isWorkflowBusy}
                      />
                    </div>
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.instructions")}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          ) : null}

          {operationProgress.progress ? (
            <OperationProgressCard
              progress={operationProgress.progress}
              percent={operationProgress.percent}
              statusLabel={operationStatusLabel}
              summaryLabel={operationSummaryLabel}
              messageLabel={operationProgress.progress.message}
              onClear={operationProgress.clear}
            />
          ) : null}
          {monitoredProfileId ? (
            <div
              className={cn(
                "flex flex-wrap items-center gap-2 rounded-md border px-2.5 py-2 text-[12px]",
                isWorkflowLikelyStalled
                  ? "border-destructive/35 bg-destructive/10"
                  : "border-primary/25 bg-primary/5",
              )}
            >
              <Badge
                variant="outline"
                className={cn(
                  "h-6 px-2 text-[11px] font-medium",
                  isWorkflowLikelyStalled
                    ? "border-destructive/35 bg-destructive/10 text-destructive"
                    : "border-primary/25 bg-primary/10 text-primary",
                )}
              >
                <Clock3 className="mr-1 h-3.5 w-3.5" />
                {isWorkflowLikelyStalled
                  ? t("adminWorkspace.tiktokCookies.workflow.monitorStalled")
                  : t("adminWorkspace.tiktokCookies.workflow.monitorRunning")}
              </Badge>
              <span className="font-medium text-foreground">
                {t("adminWorkspace.tiktokCookies.workflow.monitorProfile", {
                  profile: monitoredWorkflowRow?.profileName ?? monitoredProfileId,
                })}
              </span>
              <span className="text-muted-foreground">
                {t("adminWorkspace.tiktokCookies.workflow.monitorHeartbeat", {
                  seconds: workflowHeartbeatAgeSeconds,
                })}
              </span>
              {workflowRunAgeSeconds !== null ? (
                <span className="text-muted-foreground">
                  {t("adminWorkspace.tiktokCookies.workflow.monitorRuntime", {
                    seconds: workflowRunAgeSeconds,
                  })}
                </span>
              ) : null}
              <span className="text-muted-foreground">
                {autoWorkflowDetailLabel ||
                  t("adminWorkspace.tiktokCookies.workflow.autoRunOpeningProfile")}
              </span>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2 border border-border/70 bg-muted/25 px-2 py-1.5">
              {!isSignupFlow ? (
                <>
                  <Checkbox
                    checked={allWorkflowRowsSelected}
                    onCheckedChange={(checked) =>
                      handleToggleSelectAllWorkflowRows(Boolean(checked))
                    }
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {t("adminWorkspace.tiktokCookies.workflow.bulkSelected", {
                      count: selectedWorkflowProfileIds.length,
                    })}
                  </span>
                </>
              ) : null}
              <Input
                value={workflowSearchQuery}
                onChange={(event) => {
                  setWorkflowSearchQuery(event.target.value);
                  setWorkflowPageIndex(0);
                }}
                placeholder={t("adminWorkspace.tiktokCookies.workflow.searchPlaceholder")}
                className="h-8 w-[250px]"
              />
              {!isSignupFlow ? (
                <div className="flex items-center gap-1 rounded-md border border-border/70 bg-background p-0.5">
                  {(
                    [
                      "all",
                      "needs_sync",
                      "synced",
                      "missing_cookie",
                      "sync_error",
                    ] as WorkflowStatusFilter[]
                  ).map((statusValue) => {
                    const isActive = workflowStatusFilter === statusValue;
                    return (
                      <button
                        key={statusValue}
                        type="button"
                        onClick={() => setWorkflowStatusFilter(statusValue)}
                        className={cn(
                          "h-7 rounded-sm px-2.5 text-xs font-medium transition-colors",
                          isActive
                            ? statusValue === "all"
                              ? "bg-muted text-foreground"
                              : getWorkflowSyncStatusFilterTone(statusValue)
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {statusValue === "all"
                          ? t("adminWorkspace.tiktokCookies.workflow.filters.allStatuses")
                          : t(`adminWorkspace.tiktokCookies.workflow.syncStatus.${statusValue}`)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <Badge variant="outline" className="text-[11px] font-medium">
                {isSignupFlow
                  ? `${filteredSignupRows.length}/${signupRows.length}`
                  : `${filteredWorkflowRows.length}/${sortedWorkflowRows.length}`}
              </Badge>
              {activeAutomationRun ? (
                <Badge
                  variant="outline"
                  className={cn("text-[11px] font-medium", activeRunStatusTone)}
                >
                  {activeAutomationRun.status}
                </Badge>
              ) : null}
              {autoWorkflowRun ? (
                <Badge
                  variant="outline"
                  className="text-[11px] border-chart-1/35 bg-chart-1/15 text-chart-1"
                >
                  {t("adminWorkspace.tiktokCookies.workflow.autoRunProgress", {
                    current:
                      autoWorkflowRun.activeProfileId === null
                        ? Math.min(
                            autoWorkflowRun.currentIndex,
                            autoWorkflowRun.queue.length,
                          )
                        : Math.min(
                            autoWorkflowRun.currentIndex + 1,
                            autoWorkflowRun.queue.length,
                          ),
                    total: autoWorkflowRun.queue.length,
                  })}
                </Badge>
              ) : null}
            </div>
          </div>

          <div>
            {isSignupFlow ? (
              filteredSignupRows.length === 0 ? (
                <div className="px-4 py-6 text-[12px] text-muted-foreground">
                  {t("adminWorkspace.tiktokCookies.workflow.filters.empty")}
                </div>
              ) : (
                <ScrollArea className="max-h-[58vh] min-h-[340px] w-full border border-border/70 bg-background">
                  <Table className="min-w-[1320px] table-fixed bg-background">
                    <TableHeader className="sticky top-0 z-10 bg-muted/85 backdrop-blur">
                      <TableRow>
                        <TableHead className="h-8 w-[210px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.phone")}
                        </TableHead>
                        <TableHead className="h-8 w-[210px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.credentials")}
                        </TableHead>
                        <TableHead className="h-8 w-[250px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.profile")}
                        </TableHead>
                        <TableHead className="h-8 w-[120px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.status")}
                        </TableHead>
                        <TableHead className="h-8 w-[220px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.stepError")}
                        </TableHead>
                        <TableHead className="h-8 w-[170px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.cookie")}
                        </TableHead>
                        <TableHead className="h-8 w-[120px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t("adminWorkspace.tiktokCookies.workflow.columns.updated")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signupPageRows.map((row) => {
                        const mappedStatus = mapAutomationItemStatusToWorkflowStatus(
                          row.status,
                        );
                        const statusTone = getWorkflowStatusTone(mappedStatus);
                        const compactApiPhone = formatApiPhoneCompact(row.account.apiPhone);
                        const derivedCredentials = deriveWorkflowCredentialsFromPhone(
                          row.account.phone,
                        );
                        const displayUsername =
                          row.account.username || derivedCredentials?.username || "";
                        const displayPassword =
                          row.account.password || derivedCredentials?.password || "";
                        return (
                          <TableRow key={row.account.id} className="group/row hover:bg-muted/35">
                            <TableCell className="align-top text-[12px]">
                              <div className="space-y-1">
                                <div className="group/phone flex items-center justify-between gap-1">
                                  <p className="font-mono text-[11px] text-foreground">
                                    {row.account.phone}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                      void copyWorkflowValue(
                                        row.account.phone,
                                        t("adminWorkspace.tiktokCookies.workflow.phoneCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="group/api flex items-center justify-between gap-1">
                                  <p
                                    className="line-clamp-1 text-[11px] text-muted-foreground"
                                    title={row.account.apiPhone}
                                  >
                                    {compactApiPhone}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                      void copyWorkflowValue(
                                        row.account.apiPhone,
                                        t("adminWorkspace.tiktokCookies.workflow.apiPhoneCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top text-[12px]">
                              <div className="space-y-1">
                                <div className="group/user flex items-center justify-between gap-1">
                                  <p className="font-mono text-[11px] text-foreground">
                                    {displayUsername || "-"}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 transition-opacity group-hover/user:opacity-100"
                                    disabled={!displayUsername}
                                    onClick={() =>
                                      void copyWorkflowValue(
                                        displayUsername,
                                        t("adminWorkspace.tiktokCookies.workflow.usernameCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                                <div className="group/pass flex items-center justify-between gap-1">
                                  <p className="font-mono text-[11px] text-muted-foreground">
                                    {displayPassword || "-"}
                                  </p>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 transition-opacity group-hover/pass:opacity-100"
                                    disabled={!displayPassword}
                                    onClick={() =>
                                      void copyWorkflowValue(
                                        displayPassword,
                                        t("adminWorkspace.tiktokCookies.workflow.passwordCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="align-top text-[12px]">
                              <div className="space-y-1">
                                <p className="line-clamp-1 text-foreground">
                                  {row.account.profileName || "-"}
                                </p>
                                <p className="line-clamp-1 font-mono text-[11px] text-muted-foreground">
                                  {row.account.profileId || "-"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <Badge
                                variant="outline"
                                className={cn("text-[11px] font-medium", statusTone)}
                              >
                                {t(
                                  `adminWorkspace.tiktokCookies.workflow.status.${mappedStatus}`,
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top text-[12px] text-muted-foreground">
                              <div className="space-y-1">
                                <p className="line-clamp-1">{row.step || "-"}</p>
                              {row.lastError ? (
                                <p
                                  className="line-clamp-2 break-all text-[11px] text-destructive"
                                  title={row.lastError}
                                >
                                  {summarizeWorkflowError(row.lastError)}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                            <TableCell className="align-top text-[12px] font-mono text-muted-foreground">
                              <div className="group/cookie flex items-start justify-between gap-1">
                                <p className="line-clamp-2 break-all">
                                  {formatWorkflowCookieCell(row.cookiePreview)}
                                </p>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 transition-opacity group-hover/cookie:opacity-100"
                                  disabled={!row.cookiePreview}
                                  onClick={() =>
                                    void copyWorkflowValue(
                                      row.cookiePreview || "",
                                      t("adminWorkspace.tiktokCookies.workflow.cookieCopied"),
                                    )
                                  }
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="align-top text-[12px] text-muted-foreground">
                              {formatTimestamp(row.account.updatedAt)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )
            ) : isTiktokHydrating ? (
              <div className="flex min-h-[340px] items-center justify-center border border-border/70 bg-background px-4 py-6">
                <Spinner size="md" />
              </div>
            ) : filteredWorkflowRows.length === 0 ? (
              <div className="px-4 py-6 text-[12px] text-muted-foreground">
                {isLoadingProfiles
                  ? "—"
                  : sortedWorkflowRows.length === 0
                    ? t("adminWorkspace.tiktokCookies.workflow.empty")
                    : t("adminWorkspace.tiktokCookies.workflow.filters.empty")}
              </div>
            ) : (
              <ScrollArea className="max-h-[58vh] min-h-[340px] w-full border border-border/70 bg-background">
                <Table className="w-full table-fixed bg-background">
                  <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allWorkflowRowsSelected}
                          onCheckedChange={(checked) =>
                            handleToggleSelectAllWorkflowRows(Boolean(checked))
                          }
                        />
                      </TableHead>
                      <TableHead className="h-8 w-[200px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminWorkspace.tiktokCookies.workflow.columns.profile")}
                      </TableHead>
                      <TableHead className="h-8 w-[220px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminWorkspace.tiktokCookies.workflow.columns.phone")}
                      </TableHead>
                      <TableHead className="h-8 w-[160px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminWorkspace.tiktokCookies.workflow.columns.status")}
                      </TableHead>
                      <TableHead className="h-8 w-[230px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminWorkspace.tiktokCookies.workflow.columns.cookie")}
                      </TableHead>
                      <TableHead className="h-8 w-[140px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminWorkspace.tiktokCookies.workflow.columns.updated")}
                      </TableHead>
                      <TableHead className="h-8 w-[220px] text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t("adminWorkspace.columns.action")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflowPageRows.map((row) => {
                      const derivedRow =
                        workflowDerivedByProfileId.get(row.profileId) ?? null;
                      const runtimeProfile =
                        workspaceProfileById.get(row.profileId) ?? null;
                      const isAutoWorkflowActive =
                        autoWorkflowRun?.activeProfileId === row.profileId;
                      const isQueuedInAutoWorkflow = Boolean(
                        autoWorkflowRun && autoWorkflowRun.queue.includes(row.profileId),
                      );
                      const displayLabel = getWorkflowDisplayLabel(row.profileName);
                      const localCookiePreview =
                        derivedRow?.localCookiePreview ??
                        toWorkflowCookiePreview(resolveWorkflowLocalCookieSnapshot(row)) ??
                        "";
                      const remoteCookieRecord =
                        derivedRow?.remoteCookieRecord ??
                        resolveRemoteCookieRecordForWorkflow(row);
                      const fallbackCookieSource =
                        resolveCookieSourceRowForWorkflow(row);
                      const displayCookie =
                        localCookiePreview ||
                        derivedRow?.remoteCookiePreview ||
                        toWorkflowCookiePreview(remoteCookieRecord?.cookie) ||
                        "";
                      const hasCopyableCookie = Boolean(
                        remoteCookieRecord?.cookie?.trim() ||
                          fallbackCookieSource?.cookie?.trim() ||
                          displayCookie,
                      );
                      const displayPhone = formatWorkflowPhoneValue(row.phoneNumber);
                      const displayApiPhone = formatWorkflowPhoneValue(row.apiPhone);
                      const compactApiPhone = formatApiPhoneCompact(displayApiPhone);
                      const workflowSyncStatus =
                        props.isTiktokDataBootstrapping && !isAutoWorkflowActive
                          ? "needs_sync"
                          : isQueuedInAutoWorkflow
                            ? "needs_sync"
                          : (derivedRow?.workflowSyncStatus ??
                            resolveWorkflowSyncStatusForRow(row));
                      const isWorkflowRowDisabled = Boolean(row.isDisabled);
                      const isRowLaunching = activeWorkflowProfileId === row.profileId;
                      const isRowManualWatchActive =
                        manualWorkflowWatch?.profileId === row.profileId;
                      const isRowSyncing = syncingProfileId === row.profileId;
                      const isRowStopping =
                        stoppingWorkflowProfileId === row.profileId;
                      const runtimeState = runtimeProfile?.runtime_state ?? "";
                      const hasRuntimeProcess =
                        runtimeState === "Running" ||
                        Boolean(runtimeProfile?.process_id);
                      const isRuntimeRunning =
                        hasRuntimeProcess ||
                        isAutoWorkflowActive ||
                        Boolean(
                          isRowManualWatchActive &&
                            manualWorkflowWatch?.observedRunning &&
                            !manualWorkflowWatch?.processingClose,
                        );
                      const isRuntimeParked = runtimeState === "Parked";
                      const runtimeStatusTone = getWorkflowRuntimeBadgeClassName({
                        isRunning: isRuntimeRunning,
                        isParked: isRuntimeParked,
                        isLaunching: isRowLaunching,
                        isStopping: isRowStopping,
                      });
                      const runtimeStatusLabel = isRowLaunching
                        ? t("profiles.actions.launch")
                        : isRowStopping
                          ? t("profiles.actions.stop")
                          : isRuntimeRunning
                            ? t("common.status.running")
                            : isRuntimeParked
                              ? t("profiles.actions.resume")
                              : t("common.status.stopped");
                      const syncStatusTone = isRowSyncing
                        ? "border-primary/20 bg-primary/10 text-primary"
                        : isWorkflowRowDisabled
                          ? "border-border bg-muted/80 text-muted-foreground"
                          : getWorkflowSyncStatusTone(workflowSyncStatus);
                      const rowAccentClass =
                        isRowLaunching || isRowStopping || isRuntimeRunning
                          ? "border-l-chart-1/45"
                        : isWorkflowRowDisabled
                          ? "border-l-border/50"
                        : workflowSyncStatus === "synced"
                          ? "border-l-chart-2/45"
                          : workflowSyncStatus === "sync_error"
                            ? "border-l-destructive/45"
                            : workflowSyncStatus === "missing_cookie"
                            ? "border-l-chart-4/45"
                              : workflowSyncStatus === "conflict"
                                ? "border-l-chart-3/45"
                                : "border-l-chart-1/45";
                      const syncStatusLabel = isRowSyncing
                        ? t("adminWorkspace.tiktokCookies.workflow.rowState.syncing")
                        : isWorkflowRowDisabled
                          ? t("adminWorkspace.tiktokCookies.workflow.syncStatus.disabled")
                          : workflowSyncStatus === "synced"
                            ? t("adminWorkspace.tiktokCookies.workflow.syncStatusWithAge", {
                                status: t(
                                  "adminWorkspace.tiktokCookies.workflow.syncStatus.synced",
                                ),
                                age:
                                  formatSyncAgeLabel(remoteCookieRecord?.testedAt) ??
                                  t("adminWorkspace.tiktokCookies.workflow.syncAgeUnknown"),
                              })
                            : t(
                                `adminWorkspace.tiktokCookies.workflow.syncStatus.${workflowSyncStatus}`,
                              );
                      const runButtonLabel = isRuntimeRunning
                        ? t("profiles.actions.stop")
                        : isRuntimeParked
                          ? t("profiles.actions.resume")
                          : t("profiles.actions.launch");
                      const runButtonTitle = isRuntimeRunning
                        ? t("profiles.actions.stop")
                        : isRuntimeParked
                          ? t("profiles.actions.resume")
                          : t("profiles.actions.launch");
                      const isRunButtonLoading = isRowLaunching || isRowStopping;
                      const isRunButtonDisabled =
                        isWorkflowRowDisabled ||
                        isRowSyncing ||
                        (isWorkflowBusy && !isRunButtonLoading);

                      return (
                        <TableRow
                          key={row.profileId}
                          className={cn(
                            "group/row border-l-2 hover:bg-muted/35",
                            rowAccentClass,
                            isAutoWorkflowActive && "bg-muted/30",
                            isWorkflowRowDisabled && "opacity-70",
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedWorkflowProfileIdSet.has(row.profileId)}
                              disabled={isWorkflowRowDisabled}
                              onCheckedChange={(checked) =>
                                toggleWorkflowRowSelection(row.profileId, Boolean(checked))
                              }
                            />
                          </TableCell>
                          <TableCell className="text-[12px] font-medium whitespace-normal align-top">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="line-clamp-1 font-medium text-foreground">
                                  {displayLabel}
                                </p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "gap-1 px-2 py-0 text-[10px] shadow-none",
                                    runtimeStatusTone,
                                  )}
                                >
                                  {isRunButtonLoading ? (
                                    <Spinner size="sm" className="h-3 w-3" />
                                  ) : isRuntimeRunning ? (
                                    <Play className="h-3 w-3" />
                                  ) : isRuntimeParked ? (
                                    <Pause className="h-3 w-3" />
                                  ) : (
                                    <Clock3 className="h-3 w-3" />
                                  )}
                                  <span>{runtimeStatusLabel}</span>
                                </Badge>
                              </div>
                              <p className="line-clamp-1 min-w-0 font-mono text-[11px] text-muted-foreground">
                                {summarizeCookieValue(row.profileId)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground align-top">
                            <div className="space-y-1.5">
                              <div className="group/phone flex items-center justify-between gap-1">
                                <div className="min-w-0">
                                  <p
                                    className="line-clamp-1 font-mono text-[11px] text-foreground"
                                    title={displayPhone || undefined}
                                  >
                                    {displayPhone || "-"}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                  disabled={!displayPhone}
                                  onClick={() =>
                                    void copyWorkflowValue(
                                      displayPhone,
                                      t("adminWorkspace.tiktokCookies.workflow.phoneCopied"),
                                    )
                                  }
                                  title={t("common.buttons.copy")}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <div className="group/api flex items-center justify-between gap-1">
                                <div className="min-w-0">
                                  <p
                                    className="line-clamp-1 font-mono text-[11px] text-muted-foreground"
                                    title={displayApiPhone ? compactApiPhone : undefined}
                                  >
                                    {displayApiPhone ? compactApiPhone : "-"}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                  disabled={!displayApiPhone}
                                  onClick={() =>
                                    void copyWorkflowValue(
                                      displayApiPhone,
                                      t("adminWorkspace.tiktokCookies.workflow.apiPhoneCopied"),
                                    )
                                  }
                                  title={t("common.buttons.copy")}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex flex-col items-start gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "max-w-[140px] truncate text-[11px] font-medium",
                                  syncStatusTone,
                                )}
                                title={row.lastError ? summarizeWorkflowError(row.lastError) : undefined}
                              >
                                {syncStatusLabel}
                              </Badge>
                              {isAutoWorkflowActive ? (
                                <Badge
                                  variant="outline"
                                  className="border-primary/20 bg-primary/10 text-[10px] text-primary"
                                >
                                  {t("adminWorkspace.tiktokCookies.workflow.autoRunActiveRow")}
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-[12px] font-mono text-muted-foreground whitespace-normal align-top">
                            <button
                              type="button"
                              className={cn(
                                "group/cookie flex w-full items-start justify-between gap-1 rounded-sm border border-transparent p-0 text-left transition-colors",
                                hasCopyableCookie
                                  ? "cursor-pointer hover:border-border/60"
                                  : "cursor-default",
                              )}
                              disabled={!hasCopyableCookie}
                              onClick={() =>
                                void copyWorkflowCookieByRow(row, remoteCookieRecord)
                              }
                              title={
                                hasCopyableCookie
                                  ? t("adminWorkspace.tiktokCookies.workflow.cookieCopied")
                                  : undefined
                              }
                            >
                              <div className="min-w-0 space-y-1">
                                <p className="line-clamp-2 break-all text-left text-foreground">
                                  {formatWorkflowCookieCell(displayCookie)}
                                </p>
                                {remoteCookieRecord ? (
                                  <p className="text-[11px] text-muted-foreground">
                                    ID: {summarizeCookieValue(remoteCookieRecord.id)}
                                  </p>
                                ) : null}
                              </div>
                              <Copy
                                className={cn(
                                  "mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/cookie:opacity-100",
                                  !hasCopyableCookie && "hidden",
                                )}
                              />
                            </button>
                          </TableCell>
                          <TableCell className="text-[12px] text-muted-foreground whitespace-normal">
                            <div className="space-y-1">
                              <p>{formatTimestamp(row.updatedAt)}</p>
                              <p className="line-clamp-1">
                                {t("adminWorkspace.tiktokCookies.workflow.more.browser", {
                                  value: row.browser,
                                })}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-2">
                              <RippleButton
                                variant={isRuntimeRunning ? "destructive" : "default"}
                                size="sm"
                                disabled={isRunButtonDisabled}
                                className={cn(
                                  getWorkflowRunActionButtonClassName(),
                                  !isRunButtonDisabled && "cursor-pointer",
                                  isRunButtonDisabled && "opacity-50",
                                )}
                                onClick={() =>
                                  void (isRuntimeRunning
                                    ? handleStopWorkflowProfile(row)
                                    : handleStartWorkflowProfile(row))
                                }
                                title={runButtonTitle}
                                aria-label={runButtonTitle}
                              >
                                {isRunButtonLoading ? (
                                  <div className="flex items-center justify-center">
                                    <Spinner size="sm" className="text-current" />
                                  </div>
                                ) : isRuntimeRunning ? (
                                  <div className="flex items-center gap-1">
                                    <Square className="h-3.5 w-3.5 shrink-0" />
                                    <span>{runButtonLabel}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Play className="h-3.5 w-3.5 shrink-0" />
                                    <span>{runButtonLabel}</span>
                                  </div>
                                )}
                              </RippleButton>
                              <LoadingButton
                                variant="outline"
                                size="icon"
                                className="h-8 w-8"
                                isLoading={isRowSyncing}
                                disabled={
                                  isWorkflowRowDisabled ||
                                  (isWorkflowBusy && !isRowSyncing)
                                }
                                onClick={() => void handleSyncWorkflowProfile(row)}
                                title={t("adminWorkspace.tiktokCookies.workflow.actions.sync")}
                                aria-label={t("adminWorkspace.tiktokCookies.workflow.actions.sync")}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </LoadingButton>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[280px]">
                                  <DropdownMenuLabel>{displayLabel}</DropdownMenuLabel>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      void copyWorkflowValue(
                                        row.profileId,
                                        t("adminWorkspace.tiktokCookies.workflow.profileIdCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.profileIdCopied")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!displayPhone}
                                    onSelect={() =>
                                      void copyWorkflowValue(
                                        displayPhone,
                                        t("adminWorkspace.tiktokCookies.workflow.phoneCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.phoneCopied")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!displayApiPhone}
                                    onSelect={() =>
                                      void copyWorkflowValue(
                                        displayApiPhone,
                                        t("adminWorkspace.tiktokCookies.workflow.apiPhoneCopied"),
                                      )
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.apiPhoneCopied")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!hasCopyableCookie}
                                    onSelect={() =>
                                      void copyWorkflowCookieByRow(row, remoteCookieRecord)
                                    }
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.cookieCopied")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onSelect={() => void handleOpenWorkflowProfile(row)}
                                    disabled={isWorkflowRowDisabled}
                                  >
                                    <ChevronsRight className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.actions.open")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      <Pencil className="h-3.5 w-3.5" />
                                      {t("adminWorkspace.tiktokCookies.workflow.actions.editBrowser")}
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="w-[210px]">
                                      <DropdownMenuRadioGroup
                                        value={row.browser}
                                        onValueChange={(value) =>
                                          handleSetWorkflowRowBrowser(
                                            row,
                                            value as BrowserTypeString,
                                          )
                                        }
                                      >
                                        {BROWSER_OPTIONS.map((option) => (
                                          <DropdownMenuRadioItem
                                            key={option.value}
                                            value={option.value}
                                          >
                                            {option.label}
                                          </DropdownMenuRadioItem>
                                        ))}
                                      </DropdownMenuRadioGroup>
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuItem
                                    disabled={!displayApiPhone}
                                    onSelect={() => void handleOpenWorkflowApiPhone(row)}
                                  >
                                    <ChevronsRight className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.actions.openApiPhone")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!displayApiPhone}
                                    onSelect={() => void handleFetchWorkflowOtpCode(row)}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.actions.fetchOtp")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onSelect={() =>
                                      handleToggleWorkflowRowDisabled(
                                        row.profileId,
                                        !isWorkflowRowDisabled,
                                      )
                                    }
                                    disabled={isWorkflowBusy}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    {isWorkflowRowDisabled
                                      ? t("adminWorkspace.tiktokCookies.workflow.actions.enable")
                                      : t("adminWorkspace.tiktokCookies.workflow.actions.disable")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={() => handleRemoveWorkflowRow(row.profileId)}
                                    disabled={isWorkflowBusy}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {t("adminWorkspace.tiktokCookies.workflow.actions.remove")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>
          {!isSignupFlow && actionBarPortalContainer
            ? ReactDOM.createPortal(
                <AnimatePresence>
                  {isWorkflowActionBarVisible ? (
                    <motion.div
                      key="workflow-action-bar"
                      role="toolbar"
                      aria-orientation="horizontal"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="fixed right-6 bottom-6 z-50 flex max-w-[calc(100%-3rem)] flex-wrap items-center justify-end gap-2 rounded-md border border-border bg-background/95 p-2 shadow-sm backdrop-blur"
                    >
                      <div className="flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground">
                        {t("adminWorkspace.tiktokCookies.workflow.bulkSelected", {
                          count: selectedWorkflowRows.length,
                        })}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-1 h-6 w-6"
                          onClick={() => setSelectedWorkflowProfileIds([])}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {autoWorkflowRun ? (
                        <div className="max-w-[380px] rounded-md border border-chart-1/35 bg-chart-1/10 px-2.5 py-1">
                          <p className="text-[11px] font-medium text-chart-1">
                            {t("adminWorkspace.tiktokCookies.workflow.autoRunProgress", {
                              current:
                                autoWorkflowRun.activeProfileId === null
                                  ? Math.min(
                                      autoWorkflowRun.currentIndex,
                                      autoWorkflowRun.queue.length,
                                    )
                                  : Math.min(
                                      autoWorkflowRun.currentIndex + 1,
                                      autoWorkflowRun.queue.length,
                                    ),
                              total: autoWorkflowRun.queue.length,
                            })}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-muted-foreground">
                            {autoWorkflowDetailLabel}
                          </p>
                        </div>
                      ) : null}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5"
                        disabled={
                          autoWorkflowRun === null &&
                          (runnableSelectedWorkflowRows.length === 0 || isWorkflowBusy)
                        }
                        onClick={() => {
                          if (autoWorkflowRun) {
                            handleStopAutoWorkflowRun();
                            return;
                          }
                          void handleBulkStartWorkflowProfiles();
                        }}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        {autoWorkflowRun
                          ? t("adminWorkspace.tiktokCookies.workflow.bulkStop")
                          : t("adminWorkspace.tiktokCookies.workflow.bulkStart")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5"
                        disabled={runnableSelectedWorkflowRows.length === 0 || isWorkflowBusy}
                        onClick={() => void handleBulkSyncWorkflowProfiles()}
                      >
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                        {t("adminWorkspace.tiktokCookies.workflow.bulkSync")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5"
                        disabled={selectedWorkflowRows.length === 0 || isWorkflowBusy}
                        onClick={handleBulkRemoveWorkflowProfiles}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        {t("adminWorkspace.tiktokCookies.workflow.bulkRemove")}
                      </Button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>,
                actionBarPortalContainer,
              )
            : null}
          <TablePaginationControls
            totalRows={activeTotalRows}
            pageIndex={workflowPageIndex}
            pageCount={activePageCount}
            pageSize={workflowPageSize}
            pageSizeOptions={[25, 50, 100, 200]}
            canPreviousPage={workflowPageIndex > 0}
            canNextPage={workflowPageIndex + 1 < activePageCount}
            onPreviousPage={() =>
              setWorkflowPageIndex((current) => Math.max(0, current - 1))
            }
            onNextPage={() =>
              setWorkflowPageIndex((current) =>
                Math.min(Math.max(activePageCount - 1, 0), current + 1),
              )
            }
            onPageSizeChange={(nextPageSize) => {
              setWorkflowPageSize(nextPageSize);
              setWorkflowPageIndex(0);
            }}
            summaryLabel={t("adminWorkspace.tiktokCookies.workflow.paginationSummary", {
              from: activePageStart,
              to: activePageEnd,
              total: activeTotalRows,
            })}
            pageLabel={t("common.pagination.page")}
            rowsPerPageLabel={t("common.pagination.rowsPerPage")}
            previousLabel={t("common.pagination.previous")}
            nextLabel={t("common.pagination.next")}
          />
        </div>
      </div>
    </div>
  );
}
