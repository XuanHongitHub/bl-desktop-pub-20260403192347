import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import vi from "./locales/vi.json";

export const SUPPORTED_LANGUAGES = [
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "en", name: "English", nativeName: "English" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]["code"];

export const LANGUAGE_FALLBACKS: Record<string, string[]> = {
  "vi-VN": ["vi", "en"],
  vi: ["vi", "en"],
};

export function getLanguageWithFallback(systemLocale: string): string {
  const baseLanguage = systemLocale.split(/[-_]/)[0].toLowerCase();

  if (baseLanguage === "vi") {
    return "vi";
  }

  if (LANGUAGE_FALLBACKS[systemLocale]) {
    return LANGUAGE_FALLBACKS[systemLocale][0];
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

i18n.use(initReactI18next).init({
  resources,
  lng: "vi",
  fallbackLng: ["vi", "en"],
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
