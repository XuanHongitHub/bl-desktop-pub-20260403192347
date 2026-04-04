"use client";

import { isTauri } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { I18nProvider } from "@/components/i18n-provider";
import { CustomThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setupLogging } from "@/lib/logger";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isTauri()) {
      return;
    }
    void setupLogging();
  }, []);

  return (
    <I18nProvider>
      <CustomThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
        {mounted ? <Toaster /> : null}
      </CustomThemeProvider>
    </I18nProvider>
  );
}
