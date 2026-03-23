export interface CachedAppSettings {
  set_as_default_browser?: boolean;
  theme?: string;
  custom_theme?: Record<string, string>;
  api_enabled?: boolean;
  api_port?: number;
  api_token?: string;
  language?: string | null;
  [key: string]: unknown;
}

const APP_SETTINGS_CACHE_KEY = "buglogin.appSettings.cache.v1";
export const APP_SETTINGS_CACHE_UPDATED_EVENT =
  "buglogin:app-settings-cache-updated";

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
  if (typeof raw.api_token === "string") {
    next.api_token = raw.api_token;
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
