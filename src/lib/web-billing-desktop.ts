import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { BillingCycle } from "@/lib/billing-plans";
import {
  buildWebBillingPortalUrl,
  resolveWebBillingPortalBaseUrl,
  type WebBillingPortalRoute,
} from "@/lib/web-billing-portal";
import type { CloudUser } from "@/types";

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

interface AppSettings {
  sync_server_url?: string;
  billing_portal_url?: string;
  stripe_billing_url?: string;
}

interface OpenWebBillingPortalInput {
  route: WebBillingPortalRoute;
  user: CloudUser;
  workspaceId?: string | null;
  workspaceName?: string | null;
  planId?: string | null;
  billingCycle?: BillingCycle | null;
}

function normalizeHttpBaseUrl(raw: unknown): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (!/^https?:$/i.test(parsed.protocol)) {
      return null;
    }
    const path = parsed.pathname.endsWith("/")
      ? parsed.pathname.slice(0, -1)
      : parsed.pathname;
    const normalizedPath = path === "/" ? "" : path;
    return `${parsed.protocol}//${parsed.host}${normalizedPath}`;
  } catch {
    return null;
  }
}

async function readSyncSettings(): Promise<SyncSettings | null> {
  try {
    return await invoke<SyncSettings>("get_sync_settings");
  } catch {
    return null;
  }
}

async function readAppSettings(): Promise<AppSettings | null> {
  try {
    return await invoke<AppSettings>("get_app_settings");
  } catch {
    return null;
  }
}

function resolveControlBaseUrl(
  syncSettings: SyncSettings | null,
  appSettings: AppSettings | null,
  portalBaseUrl: string | null,
): string | null {
  const configuredPortalBase = normalizeHttpBaseUrl(portalBaseUrl);
  const derivedFromPortalBase = (() => {
    if (!configuredPortalBase) {
      return null;
    }
    try {
      const parsed = new URL(configuredPortalBase);
      const hostname = parsed.hostname.trim().toLowerCase();
      if (!hostname) {
        return null;
      }
      if (hostname.startsWith("api.")) {
        return normalizeHttpBaseUrl(`${parsed.protocol}//${parsed.host}`);
      }
      if (hostname.includes(".")) {
        return normalizeHttpBaseUrl(
          `${parsed.protocol}//api.${hostname}${parsed.port ? `:${parsed.port}` : ""}`,
        );
      }
      return null;
    } catch {
      return null;
    }
  })();

  return (
    normalizeHttpBaseUrl(syncSettings?.sync_server_url) ??
    normalizeHttpBaseUrl(appSettings?.sync_server_url) ??
    normalizeHttpBaseUrl(process.env.NEXT_PUBLIC_SYNC_SERVER_URL) ??
    derivedFromPortalBase
  );
}

function resolveControlToken(syncSettings: SyncSettings | null): string | null {
  const fromSettings = syncSettings?.sync_token?.trim() ?? "";
  if (fromSettings) {
    return fromSettings;
  }
  const fromEnv = process.env.NEXT_PUBLIC_SYNC_TOKEN?.trim() ?? "";
  return fromEnv || null;
}

function resolvePortalBaseUrl(appSettings: AppSettings | null): string | null {
  return (
    resolveWebBillingPortalBaseUrl({
      billingPortalUrl: appSettings?.billing_portal_url,
      legacyStripeBillingUrl: appSettings?.stripe_billing_url,
    }) ??
    resolveWebBillingPortalBaseUrl({
      // Canonical env for web app base URL.
      billingPortalUrl: process.env.NEXT_PUBLIC_WEB_PORTAL_URL,
      legacyStripeBillingUrl: process.env.NEXT_PUBLIC_BILLING_PORTAL_URL,
    }) ??
    resolveWebBillingPortalBaseUrl({
      // Backward-compatible aliases kept for older self-host setups.
      billingPortalUrl: process.env.NEXT_PUBLIC_BILLING_PORTAL_URL,
      legacyStripeBillingUrl: process.env.NEXT_PUBLIC_STRIPE_BILLING_URL,
    })
  );
}

export async function resolveWebBillingPortalUrl(
  input: OpenWebBillingPortalInput,
): Promise<string> {
  const [initialSyncSettings, appSettings] = await Promise.all([
    readSyncSettings(),
    readAppSettings(),
  ]);
  const portalBaseUrl = resolvePortalBaseUrl(appSettings);
  if (!portalBaseUrl) {
    throw new Error("web_billing_portal_url_missing");
  }

  const readSyncContextWithRetry = async () => {
    let syncSettings = initialSyncSettings;
    let controlBaseUrl = resolveControlBaseUrl(
      syncSettings,
      appSettings,
      portalBaseUrl,
    );
    let controlToken = resolveControlToken(syncSettings);
    if (controlBaseUrl && controlToken) {
      return { controlBaseUrl, controlToken };
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      syncSettings = await readSyncSettings();
      controlBaseUrl = resolveControlBaseUrl(
        syncSettings,
        appSettings,
        portalBaseUrl,
      );
      controlToken = resolveControlToken(syncSettings);
      if (controlBaseUrl && controlToken) {
        break;
      }
    }
    return {
      controlBaseUrl,
      controlToken,
    };
  };

  const { controlBaseUrl, controlToken } = await readSyncContextWithRetry();
  const userId = input.user.id.trim();
  const userEmail = input.user.email.trim();
  const workspaceId = input.workspaceId?.trim() || null;
  const workspaceName = input.workspaceName?.trim() || null;
  const planId = input.planId?.trim() || null;
  const billingCycle = input.billingCycle ?? null;

  // If sync context is unavailable, still open the portal route without encoded context.
  // This avoids hard-blocking desktop users and lets the web portal auth flow continue.
  if (!controlBaseUrl || !controlToken || !userId || !userEmail) {
    return buildWebBillingPortalUrl({
      baseUrl: portalBaseUrl,
      route: input.route,
      query: {
        workspaceId,
        workspaceName,
        planId,
        billingCycle,
      },
    });
  }

  return buildWebBillingPortalUrl({
    baseUrl: portalBaseUrl,
    route: input.route,
    query: {
      workspaceId,
      workspaceName,
      planId,
      billingCycle,
    },
    context: {
      controlBaseUrl,
      controlToken,
      userId,
      userEmail,
      platformRole: input.user.platformRole ?? null,
      workspaceId,
      workspaceName,
    },
  });
}

export async function openWebBillingPortal(
  input: OpenWebBillingPortalInput,
): Promise<string> {
  const url = await resolveWebBillingPortalUrl(input);
  try {
    await openUrl(url);
    return url;
  } catch {
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
      return url;
    }
    throw new Error("web_billing_open_failed");
  }
}
