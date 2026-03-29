"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import {
  loadAppSettingsCache,
  mergeAppSettingsCache,
  readAppSettingsCache,
} from "@/lib/app-settings-cache";
import {
  applyThemeColors,
  getThemeAppearance,
  THEME_VARIABLES,
} from "@/lib/themes";

interface AppSettings {
  set_as_default_browser: boolean;
  theme: string;
  custom_theme?: Record<string, string>;
}

interface CustomThemeProviderProps {
  children: React.ReactNode;
}

export function CustomThemeProvider({ children }: CustomThemeProviderProps) {
  const cachedSettings = readAppSettingsCache();
  const cachedTheme = cachedSettings?.theme;
  const cachedCustomTheme = cachedSettings?.custom_theme;

  const [defaultTheme, setDefaultTheme] = useState<string>(() => {
    if (
      cachedTheme === "light" ||
      cachedTheme === "dark" ||
      cachedTheme === "system"
    ) {
      return cachedTheme;
    }
    if (
      cachedTheme === "custom" &&
      cachedCustomTheme &&
      Object.keys(cachedCustomTheme).length > 0
    ) {
      return getThemeAppearance(cachedCustomTheme);
    }
    return "system";
  });

  useEffect(() => {
    if (cachedTheme !== "custom" || !cachedCustomTheme) {
      return;
    }
    try {
      applyThemeColors(cachedCustomTheme);
    } catch {}
  }, [cachedCustomTheme, cachedTheme]);

  useEffect(() => {
    let isCancelled = false;

    const clearCustomThemeVariables = () => {
      const root = document.documentElement;
      for (const variable of THEME_VARIABLES) {
        root.style.removeProperty(variable.key as string);
      }
    };

    const loadTheme = async () => {
      try {
        const settings = (await loadAppSettingsCache()) as AppSettings | null;
        if (!settings) {
          if (!isCancelled) {
            clearCustomThemeVariables();
            setDefaultTheme("system");
          }
          return;
        }
        const themeValue = settings?.theme ?? "system";

        mergeAppSettingsCache(settings);
        if (isCancelled) {
          return;
        }
        if (
          themeValue === "light" ||
          themeValue === "dark" ||
          themeValue === "system"
        ) {
          clearCustomThemeVariables();
          setDefaultTheme(themeValue);
        } else if (themeValue === "custom") {
          if (
            settings.custom_theme &&
            Object.keys(settings.custom_theme).length > 0
          ) {
            setDefaultTheme(getThemeAppearance(settings.custom_theme));
            try {
              applyThemeColors(settings.custom_theme);
            } catch {}
          } else {
            clearCustomThemeVariables();
            setDefaultTheme("dark");
          }
        } else {
          clearCustomThemeVariables();
          setDefaultTheme("system");
        }
      } catch {
        if (isCancelled) {
          return;
        }
        setDefaultTheme("system");
      }
    };

    void loadTheme();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={true}
      disableTransitionOnChange={true}
    >
      {children}
    </ThemeProvider>
  );
}
