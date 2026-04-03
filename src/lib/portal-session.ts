import { resolveWebBillingPortalBaseUrl } from "./web-billing-portal";

export interface PortalSessionUser {
  id: string;
  email: string;
  platformRole?: string | null;
  name?: string | null;
  avatar?: string | null;
}

export interface PortalSessionConnection {
  controlBaseUrl: string;
  controlToken: string;
  userId: string;
  userEmail: string;
  platformRole?: string | null;
}

export interface PortalSessionCurrent {
  workspaceId: string;
  workspaceName?: string | null;
  planId?: string | null;
  planLabel?: string | null;
  billingCycle?: string | null;
  subscriptionStatus?: string | null;
}

export interface PortalSessionRecord {
  user: PortalSessionUser;
  connection: PortalSessionConnection;
  current?: PortalSessionCurrent | null;
  loggedInAt: string;
}

export const PORTAL_SESSION_STORAGE_KEY = "buglogin.portal.session.v1";
export const PORTAL_GOOGLE_STORAGE_KEY = "buglogin.portal.google-oauth.v1";
export const PORTAL_OAUTH_INTENT_STORAGE_KEY =
  "buglogin.portal.google-oauth-intent.v1";
export const PORTAL_SESSION_CHANGED_EVENT = "buglogin:portal-session-changed";

let portalSessionCacheRaw: string | null | undefined;
let portalSessionCacheParsed: PortalSessionRecord | null = null;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePortalSessionCurrent(
  value: unknown,
): PortalSessionCurrent | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<PortalSessionCurrent>;
  const workspaceId = normalizeString(candidate.workspaceId);
  if (!workspaceId) {
    return null;
  }

  return {
    workspaceId,
    workspaceName: normalizeString(candidate.workspaceName) || null,
    planId: normalizeString(candidate.planId) || null,
    planLabel: normalizeString(candidate.planLabel) || null,
    billingCycle: normalizeString(candidate.billingCycle) || null,
    subscriptionStatus: normalizeString(candidate.subscriptionStatus) || null,
  };
}

export function resolvePortalControlBaseUrl(value: unknown): string | null {
  return resolveWebBillingPortalBaseUrl({
    billingPortalUrl: value,
  });
}

export function resolvePortalCloudApiBaseUrl(value: unknown): string {
  const normalized = resolveWebBillingPortalBaseUrl({
    billingPortalUrl: value,
  });
  return normalized ?? "https://api.buglogin.com";
}

export function resolvePortalPostAuthPath(input: {
  platformRole?: string | null;
}): string {
  return input.platformRole === "platform_admin"
    ? "/admin/dashboard"
    : "/account/billing";
}

export function normalizePortalSessionRecord(
  value: unknown,
): PortalSessionRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as {
    user?: Partial<PortalSessionUser>;
    connection?: Partial<PortalSessionConnection>;
    current?: Partial<PortalSessionCurrent>;
    loggedInAt?: unknown;
  };

  const controlBaseUrl = resolvePortalControlBaseUrl(
    candidate.connection?.controlBaseUrl,
  );
  const controlToken = normalizeString(candidate.connection?.controlToken);
  const userId = normalizeString(candidate.connection?.userId);
  const userEmail = normalizeString(candidate.connection?.userEmail);
  const loggedInAt =
    normalizeString(candidate.loggedInAt) || new Date().toISOString();

  if (!controlBaseUrl || !controlToken || !userId || !userEmail) {
    return null;
  }

  return {
    user: {
      id: normalizeString(candidate.user?.id) || userId,
      email: normalizeString(candidate.user?.email) || userEmail,
      platformRole: normalizeString(candidate.user?.platformRole) || null,
      name: normalizeString(candidate.user?.name) || null,
      avatar: normalizeString(candidate.user?.avatar) || null,
    },
    connection: {
      controlBaseUrl,
      controlToken,
      userId,
      userEmail,
      platformRole:
        normalizeString(candidate.connection?.platformRole) ||
        normalizeString(candidate.user?.platformRole) ||
        null,
    },
    current: normalizePortalSessionCurrent(candidate.current),
    loggedInAt,
  };
}

export function createPortalSessionRecord(input: {
  user: PortalSessionUser;
  connection: PortalSessionConnection;
  current?: PortalSessionCurrent | null;
  loggedInAt?: string;
}): PortalSessionRecord {
  return {
    user: {
      id: normalizeString(input.user.id),
      email: normalizeString(input.user.email),
      platformRole: normalizeString(input.user.platformRole) || null,
      name: normalizeString(input.user.name) || null,
      avatar: normalizeString(input.user.avatar) || null,
    },
    connection: {
      controlBaseUrl:
        resolvePortalControlBaseUrl(input.connection.controlBaseUrl) ?? "",
      controlToken: normalizeString(input.connection.controlToken),
      userId: normalizeString(input.connection.userId),
      userEmail: normalizeString(input.connection.userEmail),
      platformRole: normalizeString(input.connection.platformRole) || null,
    },
    current: normalizePortalSessionCurrent(input.current),
    loggedInAt: normalizeString(input.loggedInAt) || new Date().toISOString(),
  };
}

export function parsePortalSession(
  raw: string | null,
): PortalSessionRecord | null {
  if (!raw) {
    return null;
  }

  try {
    return normalizePortalSessionRecord(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function readPortalSessionStorage(): PortalSessionRecord | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PORTAL_SESSION_STORAGE_KEY);
  if (raw === portalSessionCacheRaw) {
    return portalSessionCacheParsed;
  }

  portalSessionCacheRaw = raw;
  portalSessionCacheParsed = parsePortalSession(raw);
  return portalSessionCacheParsed;
}

export function writePortalSessionStorage(record: PortalSessionRecord | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (record) {
    const raw = JSON.stringify(record);
    if (raw === portalSessionCacheRaw) {
      return;
    }
    window.localStorage.setItem(PORTAL_SESSION_STORAGE_KEY, raw);
    portalSessionCacheRaw = raw;
    portalSessionCacheParsed = record;
  } else {
    if (portalSessionCacheRaw === null) {
      return;
    }
    window.localStorage.removeItem(PORTAL_SESSION_STORAGE_KEY);
    portalSessionCacheRaw = null;
    portalSessionCacheParsed = null;
  }

  dispatchPortalSessionChanged();
}

export function subscribePortalSession(onChange: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onChange);
  window.addEventListener(PORTAL_SESSION_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PORTAL_SESSION_CHANGED_EVENT, onChange);
  };
}

export function mergePortalSessionCurrent(
  record: PortalSessionRecord,
  current: Partial<PortalSessionCurrent> | null | undefined,
): PortalSessionRecord {
  const nextCurrent = normalizePortalSessionCurrent({
    ...(record.current ?? {}),
    ...(current ?? {}),
  });

  return {
    ...record,
    current: nextCurrent,
  };
}

export function dispatchPortalSessionChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(PORTAL_SESSION_CHANGED_EVENT));
}
