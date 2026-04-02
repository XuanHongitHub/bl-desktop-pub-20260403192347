"use client";

import { isTauri } from "@tauri-apps/api/core";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  type RuntimeSurface,
  resolveRuntimeSurface,
  shouldRedirectDesktopGuard,
  shouldRedirectWebGuard,
  shouldRenderDesktopGuardChildren,
  shouldRenderWebGuardChildren,
} from "@/lib/runtime-surface-guard";

export function WebRuntimeOnlyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [runtimeSurface, setRuntimeSurface] =
    useState<RuntimeSurface>("unknown");

  useEffect(() => {
    setRuntimeSurface(resolveRuntimeSurface(isTauri()));
  }, []);

  useEffect(() => {
    if (!shouldRedirectWebGuard(runtimeSurface, pathname)) {
      return;
    }
    router.replace("/desktop");
  }, [runtimeSurface, pathname, router]);

  if (!shouldRenderWebGuardChildren(runtimeSurface)) {
    return null;
  }

  return <>{children}</>;
}

export function DesktopRuntimeOnlyGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [runtimeSurface, setRuntimeSurface] =
    useState<RuntimeSurface>("unknown");

  useEffect(() => {
    setRuntimeSurface(resolveRuntimeSurface(isTauri()));
  }, []);

  useEffect(() => {
    if (!shouldRedirectDesktopGuard(runtimeSurface, pathname)) {
      return;
    }
    router.replace("/");
  }, [runtimeSurface, pathname, router]);

  if (!shouldRenderDesktopGuardChildren(runtimeSurface)) {
    return null;
  }

  return <>{children}</>;
}
