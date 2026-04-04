"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function PortalHomeRuntime() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const theme = resolvedTheme === "light" ? "light" : "dark";

    const pages = document.querySelectorAll(".portal-source-page");
    for (const page of pages) {
      page.setAttribute("data-theme", theme);
    }
  }, [resolvedTheme]);

  return null;
}
