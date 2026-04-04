"use client";

import { invoke, isTauri } from "@tauri-apps/api/core";
import { useCallback, useMemo } from "react";
import { usePortalSessionStore } from "@/hooks/use-portal-session-store";
import {
  resolvePortalPostAuthPath,
  writePortalSessionStorage,
} from "@/lib/portal-session";

export function useWebPortalSession() {
  const session = usePortalSessionStore();

  const signOut = useCallback(async () => {
    if (isTauri()) {
      try {
        await invoke("cloud_logout");
      } catch {
        // Ignore desktop bridge failures and still clear web session state.
      }
    }

    writePortalSessionStorage(null);
  }, []);

  const dashboardHref = useMemo(
    () =>
      resolvePortalPostAuthPath({
        platformRole:
          session?.user.platformRole ??
          session?.connection.platformRole ??
          null,
      }),
    [session],
  );

  return {
    hydrated: true,
    session,
    isSignedIn: Boolean(session?.user.email),
    dashboardHref,
    identityLabel: session?.user.email ?? "",
    identityName: session?.user.name?.trim() || session?.user.email || "",
    identityAvatar: session?.user.avatar?.trim() || "",
    platformRole:
      session?.user.platformRole ?? session?.connection.platformRole ?? null,
    signOut,
  };
}
