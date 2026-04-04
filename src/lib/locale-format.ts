import i18n, {
  getLanguageWithFallback,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";

const LANGUAGE_TO_LOCALE: Record<SupportedLanguage, string> = {
  vi: "vi-VN",
  en: "en-US",
};

function resolveAppLanguage(): SupportedLanguage {
  const language = getLanguageWithFallback(
    i18n.resolvedLanguage || i18n.language || "vi",
  );
  if (SUPPORTED_LANGUAGES.some((item) => item.code === language)) {
    return language as SupportedLanguage;
  }
  return "vi";
}

export function getAppLocale(): string {
  return LANGUAGE_TO_LOCALE[resolveAppLanguage()] ?? "vi-VN";
}

function toDate(value: Date | number | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatLocaleDateTime(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }
  const locale = getAppLocale();
  if (options) {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
  return date.toLocaleString(locale);
}

export function formatLocaleDate(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }
  const locale = getAppLocale();
  if (options) {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
  return date.toLocaleDateString(locale);
}

export function formatLocaleTime(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toDate(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }
  const locale = getAppLocale();
  if (options) {
    return new Intl.DateTimeFormat(locale, options).format(date);
  }
  return date.toLocaleTimeString(locale);
}

export function formatLocaleNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const normalized = Number.isFinite(value) ? value : 0;
  const locale = getAppLocale();
  if (options) {
    return new Intl.NumberFormat(locale, options).format(normalized);
  }
  return normalized.toLocaleString(locale);
}
