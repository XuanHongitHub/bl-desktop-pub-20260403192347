"use client";

import { isTauri } from "@tauri-apps/api/core";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

export function WebRuntimeOnlyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDesktopRuntime = isTauri();

  useEffect(() => {
    if (!isDesktopRuntime) {
      return;
    }
    if (pathname.startsWith("/desktop")) {
      return;
    }
    router.replace("/desktop");
  }, [isDesktopRuntime, pathname, router]);

  if (isDesktopRuntime) {
    return null;
  }

  return <>{children}</>;
}

export function DesktopRuntimeOnlyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDesktopRuntime = isTauri();

  useEffect(() => {
    if (isDesktopRuntime) {
      return;
    }
    if (pathname === "/" || pathname.startsWith("/signin")) {
      return;
    }
    router.replace("/");
  }, [isDesktopRuntime, pathname, router]);

  if (!isDesktopRuntime) {
    return null;
  }

  return <>{children}</>;
}
