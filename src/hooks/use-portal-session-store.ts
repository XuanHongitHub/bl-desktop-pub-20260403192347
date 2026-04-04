"use client";

import { useSyncExternalStore } from "react";
import {
  type PortalSessionRecord,
  readPortalSessionStorage,
  subscribePortalSession,
} from "@/lib/portal-session";

function getServerSnapshot(): PortalSessionRecord | null {
  return null;
}

export function usePortalSessionStore(): PortalSessionRecord | null {
  return useSyncExternalStore(
    subscribePortalSession,
    readPortalSessionStorage,
    getServerSnapshot,
  );
}
