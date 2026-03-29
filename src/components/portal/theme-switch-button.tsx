"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";

export function ThemeSwitchButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const isLight = resolvedTheme === "light";

  return (
    <button
      type="button"
      aria-label={
        isLight
          ? t("settings.appearance.dark")
          : t("settings.appearance.light")
      }
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
