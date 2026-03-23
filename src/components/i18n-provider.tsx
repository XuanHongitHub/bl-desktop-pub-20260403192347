"use client";

import { invoke } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { getLanguageWithFallback, SUPPORTED_LANGUAGES } from "@/i18n";
import {
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";

interface AppSettings {
  language?: string | null;
  [key: string]: unknown;
}

interface I18nProviderProps {
  children: React.ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    let isCancelled = false;

    const applyDocumentLanguage = (language: string) => {
      if (typeof document === "undefined") {
        return;
      }
      const html = document.documentElement;
      html.lang = language;
      html.setAttribute("data-language", language);
      html.dir = "ltr";
    };

    const applyLanguage = async (language: string) => {
      if (
        !SUPPORTED_LANGUAGES.some((lang) => lang.code === language) ||
        i18n.language === language
      ) {
        applyDocumentLanguage(language);
        return;
      }
      await i18n.changeLanguage(language);
      applyDocumentLanguage(language);
    };

    const initializeLanguage = async () => {
      try {
        const cachedLanguage = readAppSettingsCache()?.language;
        if (
          typeof cachedLanguage === "string" &&
          SUPPORTED_LANGUAGES.some((lang) => lang.code === cachedLanguage)
        ) {
          await applyLanguage(cachedLanguage);
        }

        const settings = await invoke<AppSettings>("get_app_settings");
        let language = settings.language;

        if (!language) {
          const systemLanguage = await invoke<string>("get_system_language");
          language = getLanguageWithFallback(systemLanguage);
        }

        const resolvedLanguage =
          language && SUPPORTED_LANGUAGES.some((lang) => lang.code === language)
            ? language
            : "vi";

        mergeAppSettingsCache({ language: resolvedLanguage });

        if (isCancelled) {
          return;
        }

        await applyLanguage(resolvedLanguage);
      } catch {
        if (isCancelled) {
          return;
        }
        mergeAppSettingsCache({ language: "vi" });
        await applyLanguage("vi");
      }
    };

    void initializeLanguage();

    const handleLanguageChanged = (language: string) => {
      const resolvedLanguage = getLanguageWithFallback(language);
      applyDocumentLanguage(resolvedLanguage);
    };
    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      isCancelled = true;
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
