import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import vi from "./locales/vi.json";

export const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "en", name: "English", nativeName: "English" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const LANGUAGE_FALLBACKS: Record<string, string[]> = {
  "vi-VN": ["vi", "en"],
  vi: ["vi", "en"],
};

export function getLanguageWithFallback(systemLocale: string): string {
  const normalizedLocale = (systemLocale || "").trim();
  if (!normalizedLocale) {
    return "vi";
  }

  if (SUPPORTED_LANGUAGES.some((lang) => lang.code === normalizedLocale)) {
    return normalizedLocale;
  }

  const baseLanguage = normalizedLocale.split(/[-_]/)[0].toLowerCase();

  if (baseLanguage === "vi") {
    return "vi";
  }
  if (baseLanguage === "en") {
    return "en";
  }

  if (LANGUAGE_FALLBACKS[normalizedLocale]) {
    return LANGUAGE_FALLBACKS[normalizedLocale][0];
  }

  if (LANGUAGE_FALLBACKS[baseLanguage]) {
    return LANGUAGE_FALLBACKS[baseLanguage][0];
  }

  return "vi";
}

const resources = {
  vi: { translation: vi },
  en: { translation: en },
};

function resolveInitialLanguage(): string {
  // Keep SSR and first client render deterministic to avoid hydration mismatch.
  return "vi";
}

i18n.use(initReactI18next).init({
  resources,
  lng: resolveInitialLanguage(),
  fallbackLng: ["vi", "en"],
  debug: false,
  showSupportNotice: false,
  initImmediate: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
