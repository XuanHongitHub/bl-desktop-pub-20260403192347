export interface CachedAppSettings {
  set_as_default_browser?: boolean;
  theme?: string;
  custom_theme?: Record<string, string>;
  api_enabled?: boolean;
  api_port?: number;
  api_token?: string | null;
  language?: string | null;
  sync_server_url?: string | null;
  mcp_enabled?: boolean;
  mcp_port?: number | null;
  mcp_token?: string | null;
  stripe_publishable_key?: string | null;
  stripe_billing_url?: string | null;
  [key: string]: unknown;
}

const APP_SETTINGS_CACHE_KEY = "buglogin.appSettings.cache.v1";
export const APP_SETTINGS_CACHE_UPDATED_EVENT =
  "buglogin:app-settings-cache-updated";
let appSettingsLoadInFlight: Promise<CachedAppSettings | null> | null = null;

function canUseStorage(): boolean {
  return (
    typeof window !== "undefined" && typeof window.localStorage !== "undefined"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeCustomTheme(raw: unknown): Record<string, string> | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!key.startsWith("--") || typeof value !== "string") {
      continue;
    }
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    next[key] = normalized;
  }
  if (Object.keys(next).length === 0) {
    return undefined;
  }
  return next;
}

function sanitizeSettings(raw: unknown): CachedAppSettings | null {
  if (!isRecord(raw)) {
    return null;
  }
  const next: CachedAppSettings = {};

  if (typeof raw.theme === "string") {
    next.theme = raw.theme;
  }
  if (typeof raw.language === "string" || raw.language === null) {
    next.language = raw.language;
  }
  if (typeof raw.set_as_default_browser === "boolean") {
    next.set_as_default_browser = raw.set_as_default_browser;
  }
  if (typeof raw.api_enabled === "boolean") {
    next.api_enabled = raw.api_enabled;
  }
  if (typeof raw.api_port === "number") {
    next.api_port = raw.api_port;
  }
  if (typeof raw.api_token === "string" || raw.api_token === null) {
    next.api_token = raw.api_token;
  }
  if (typeof raw.sync_server_url === "string" || raw.sync_server_url === null) {
    next.sync_server_url = raw.sync_server_url;
  }
  if (typeof raw.mcp_enabled === "boolean") {
    next.mcp_enabled = raw.mcp_enabled;
  }
  if (typeof raw.mcp_port === "number" || raw.mcp_port === null) {
    next.mcp_port = raw.mcp_port;
  }
  if (typeof raw.mcp_token === "string" || raw.mcp_token === null) {
    next.mcp_token = raw.mcp_token;
  }
  if (
    typeof raw.stripe_publishable_key === "string" ||
    raw.stripe_publishable_key === null
  ) {
    next.stripe_publishable_key = raw.stripe_publishable_key;
  }
  if (
    typeof raw.stripe_billing_url === "string" ||
    raw.stripe_billing_url === null
  ) {
    next.stripe_billing_url = raw.stripe_billing_url;
  }
  const customTheme = sanitizeCustomTheme(raw.custom_theme);
  if (customTheme) {
    next.custom_theme = customTheme;
  }

  return next;
}

function emitAppSettingsCacheUpdated(settings: CachedAppSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<CachedAppSettings>(APP_SETTINGS_CACHE_UPDATED_EVENT, {
      detail: settings,
    }),
  );
}

export function readAppSettingsCache(): CachedAppSettings | null {
  if (!canUseStorage()) {
    return null;
  }
  const raw = window.localStorage.getItem(APP_SETTINGS_CACHE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeAppSettingsCache(settings: CachedAppSettings): void {
  if (!canUseStorage()) {
    return;
  }
  const sanitized = sanitizeSettings(settings);
  if (!sanitized) {
    return;
  }
  window.localStorage.setItem(
    APP_SETTINGS_CACHE_KEY,
    JSON.stringify(sanitized),
  );
  emitAppSettingsCacheUpdated(sanitized);
}

export function mergeAppSettingsCache(
  patch: unknown,
): CachedAppSettings | null {
  if (!canUseStorage()) {
    return null;
  }
  const normalizedPatch = sanitizeSettings(patch);
  if (!normalizedPatch) {
    return readAppSettingsCache();
  }
  const current = readAppSettingsCache() ?? {};
  const merged: CachedAppSettings = {
    ...current,
    ...normalizedPatch,
  };

  if (normalizedPatch.custom_theme !== undefined) {
    const customTheme = sanitizeCustomTheme(normalizedPatch.custom_theme);
    if (customTheme) {
      merged.custom_theme = customTheme;
    } else {
      delete merged.custom_theme;
    }
  }

  writeAppSettingsCache(merged);
  return merged;
}

export async function loadAppSettingsCache(): Promise<CachedAppSettings | null> {
  const cached = readAppSettingsCache();
  if (cached) {
    return cached;
  }

  if (appSettingsLoadInFlight) {
    return appSettingsLoadInFlight;
  }

  appSettingsLoadInFlight = (async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const loaded = await invoke<CachedAppSettings>("get_app_settings");
      return mergeAppSettingsCache(loaded);
    } catch {
      return readAppSettingsCache();
    } finally {
      appSettingsLoadInFlight = null;
    }
  })();

  return appSettingsLoadInFlight;
}
