import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getLanguageWithFallback,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "@/i18n";
import {
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import { writeLanguageCookie } from "@/lib/language-cookie";

interface AppSettings {
  language?: string | null;
  [key: string]: unknown;
}

export function useLanguage() {
  const { i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<string>(() => {
    const cachedLanguage = readAppSettingsCache()?.language;
    if (
      typeof cachedLanguage === "string" &&
      SUPPORTED_LANGUAGES.some((lang) => lang.code === cachedLanguage)
    ) {
      return cachedLanguage;
    }
    const resolved = i18n.resolvedLanguage || i18n.language || "vi";
    const fallback = getLanguageWithFallback(resolved);
    return SUPPORTED_LANGUAGES.some((lang) => lang.code === fallback)
      ? fallback
      : "vi";
  });

  const changeLanguage = useCallback(
    async (language: SupportedLanguage | null) => {
      try {
        setIsLoading(true);
        const settings = await invoke<AppSettings>("get_app_settings");
        const updatedSettings = {
          ...settings,
          language,
        };
        await invoke("save_app_settings", { settings: updatedSettings });

        let nextLanguage: string;
        if (language) {
          nextLanguage = language;
        } else {
          const systemLanguage = await invoke<string>("get_system_language");
          nextLanguage = getLanguageWithFallback(systemLanguage);
          if (!SUPPORTED_LANGUAGES.some((lang) => lang.code === nextLanguage)) {
            nextLanguage = "vi";
          }
        }
        await i18n.changeLanguage(nextLanguage);
        writeLanguageCookie(nextLanguage);
        setCurrentLanguage(nextLanguage);
        mergeAppSettingsCache({
          language: language ?? nextLanguage,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [i18n],
  );

  useEffect(() => {
    const handleLanguageChanged = (language: string) => {
      const normalized = getLanguageWithFallback(language);
      if (SUPPORTED_LANGUAGES.some((lang) => lang.code === normalized)) {
        setCurrentLanguage(normalized);
      }
    };

    i18n.on("languageChanged", handleLanguageChanged);
    return () => {
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  return {
    currentLanguage,
    changeLanguage,
    isLoading,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
