"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

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
