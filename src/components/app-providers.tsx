"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useEffect } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { CustomThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupLogging } from "@/lib/logger";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isTauri()) {
      return;
    }
    void setupLogging();
  }, []);

  return (
    <I18nProvider>
      <CustomThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </CustomThemeProvider>
    </I18nProvider>
  );
}
