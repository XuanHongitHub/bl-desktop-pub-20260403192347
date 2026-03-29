"use client";

import { Moon, Sun } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import i18n, { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { mergeAppSettingsCache } from "@/lib/app-settings-cache";
import { cn } from "@/lib/utils";

export function PortalHeaderControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();

  const activeLanguage = useMemo<SupportedLanguage>(() => {
    const nextLanguage = i18n.resolvedLanguage || i18n.language || "vi";
    return nextLanguage === "en" ? "en" : "vi";
  }, [i18n.language, i18n.resolvedLanguage]);

  const isLight = resolvedTheme !== "dark";

  const handleLanguageChange = async (language: SupportedLanguage) => {
    if (activeLanguage === language) {
      return;
    }
    await i18n.changeLanguage(language);
    mergeAppSettingsCache({ language });
  };

  return (
    <div className="inline-flex h-8 min-w-[92px] items-center justify-end gap-1">
      <div className="inline-flex items-center gap-1">
        {SUPPORTED_LANGUAGES.map((language) => {
          const isActive = activeLanguage === language.code;
          return (
            <button
              key={language.code}
              type="button"
              aria-label={language.nativeName}
              title={language.nativeName}
              onClick={() =>
                void handleLanguageChange(language.code as SupportedLanguage)
              }
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {language.code.toUpperCase()}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        aria-label={
          isLight
            ? t("settings.appearance.dark")
            : t("settings.appearance.light")
        }
        title={
          isLight
            ? t("settings.appearance.dark")
            : t("settings.appearance.light")
        }
        onClick={() => setTheme(isLight ? "dark" : "light")}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
        suppressHydrationWarning
      >
        <Moon className="h-4 w-4 dark:hidden" />
        <Sun className="hidden h-4 w-4 dark:block" />
      </button>
    </div>
  );
}
