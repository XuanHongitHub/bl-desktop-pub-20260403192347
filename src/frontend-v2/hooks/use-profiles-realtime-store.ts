"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import { invalidateInvokeCache, invokeCached } from "@/lib/ipc-query-cache";
import {
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { BrowserProfile, ProfileLockInfo } from "@/types";

const LIST_BROWSER_PROFILES_CACHE_KEY = "list_browser_profiles_light";
const PROFILE_CACHE_TTL_MS = 3_000;

type SyncStatusEntry = {
  status: string;
  error?: string;
};

type ProfilesRealtimeStore = {
  order: string[];
  byId: Map<string, BrowserProfile>;
  runningIds: Set<string>;
  syncById: Record<string, SyncStatusEntry>;
  locksById: Map<string, ProfileLockInfo>;
  isLoading: boolean;
  error: string | null;
};

const INITIAL_STORE: ProfilesRealtimeStore = {
  order: [],
  byId: new Map(),
  runningIds: new Set(),
  syncById: {},
  locksById: new Map(),
  isLoading: true,
  error: null,
};

function isProfileRuntimeRunning(profile: BrowserProfile | undefined): boolean {
  if (!profile) {
    return false;
  }
  return (
    profile.runtime_state === "Running" ||
    profile.runtime_state === "Terminating"
  );
}

function buildProfileStoreFromRows(rows: BrowserProfile[]): {
  order: string[];
  byId: Map<string, BrowserProfile>;
  runningIds: Set<string>;
} {
  const order: string[] = [];
  const byId = new Map<string, BrowserProfile>();
  const runningIds = new Set<string>();

  for (const profile of rows) {
    order.push(profile.id);
    byId.set(profile.id, profile);
    if (isProfileRuntimeRunning(profile)) {
      runningIds.add(profile.id);
    }
  }

  return { order, byId, runningIds };
}

export function useProfilesRealtimeStore(enabled = true) {
  const [store, setStore] = useState<ProfilesRealtimeStore>(INITIAL_STORE);
  const storeRef = useRef(store);
  storeRef.current = store;

  const fetchLocks = useCallback(async () => {
    try {
      const locks = await invoke<ProfileLockInfo[]>("get_team_locks");
      const nextLocksById = new Map<string, ProfileLockInfo>();
      for (const lock of locks) {
        nextLocksById.set(lock.profileId, lock);
      }
      setStore((prev) => ({ ...prev, locksById: nextLocksById }));
    } catch {
      setStore((prev) => ({ ...prev, locksById: new Map() }));
    }
  }, []);

  const refreshProfiles = useCallback(async () => {
    try {
      const profileList = await invokeCached<BrowserProfile[]>(
        "list_browser_profiles_light",
        undefined,
        {
          key: LIST_BROWSER_PROFILES_CACHE_KEY,
          ttlMs: PROFILE_CACHE_TTL_MS,
        },
      );
      const scope = getCurrentDataScope();
      const scopedProfiles = scopeEntitiesForContext(
        "profiles",
        profileList,
        (profile) => profile.id,
        scope,
      );
      const nextProfileStore = buildProfileStoreFromRows(scopedProfiles);
      setStore((prev) => ({
        ...prev,
        ...nextProfileStore,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setStore((prev) => ({
        ...prev,
        isLoading: false,
        error: extractRootError(error),
      }));
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStore((prev) => ({ ...prev, ...INITIAL_STORE, isLoading: false }));
      return;
    }

    let profileChangedTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const queueFullRefresh = (delayMs = 500) => {
      if (profileChangedTimer) {
        clearTimeout(profileChangedTimer);
      }
      profileChangedTimer = setTimeout(() => {
        profileChangedTimer = null;
        invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
        void refreshProfiles();
      }, delayMs);
    };

    const initialize = async () => {
      setStore((prev) => ({ ...prev, isLoading: true, error: null }));
      await refreshProfiles();
      await fetchLocks();
    };

    void initialize();

    let unlistenProfilesChanged: (() => void) | undefined;
    let unlistenProfileUpdated: (() => void) | undefined;
    let unlistenRunningChanged: (() => void) | undefined;
    let unlistenSyncStatus: (() => void) | undefined;
    let unlistenTeamLockAcquired: (() => void) | undefined;
    let unlistenTeamLockReleased: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        unlistenProfilesChanged = await listen("profiles-changed", () => {
          queueFullRefresh(650);
        });

        unlistenProfileUpdated = await listen<BrowserProfile>(
          "profile-updated",
          (event) => {
            const updatedProfile = event.payload;
            const scope = getCurrentDataScope();
            const scopedRows = scopeEntitiesForContext(
              "profiles",
              [updatedProfile],
              (profile) => profile.id,
              scope,
            );

            setStore((prev) => {
              if (scopedRows.length === 0) {
                if (!prev.byId.has(updatedProfile.id)) {
                  return prev;
                }
                const nextById = new Map(prev.byId);
                nextById.delete(updatedProfile.id);
                const nextOrder = prev.order.filter(
                  (id) => id !== updatedProfile.id,
                );
                const nextRunning = new Set(prev.runningIds);
                nextRunning.delete(updatedProfile.id);
                return {
                  ...prev,
                  byId: nextById,
                  order: nextOrder,
                  runningIds: nextRunning,
                };
              }

              const nextProfile = scopedRows[0];
              const nextById = new Map(prev.byId);
              const nextOrder = prev.order.includes(nextProfile.id)
                ? prev.order
                : [...prev.order, nextProfile.id];
              nextById.set(nextProfile.id, nextProfile);

              const nextRunning = new Set(prev.runningIds);
              if (isProfileRuntimeRunning(nextProfile)) {
                nextRunning.add(nextProfile.id);
              } else {
                nextRunning.delete(nextProfile.id);
              }

              return {
                ...prev,
                byId: nextById,
                order: nextOrder,
                runningIds: nextRunning,
              };
            });
          },
        );

        unlistenRunningChanged = await listen<{
          id: string;
          is_running: boolean;
        }>("profile-running-changed", (event) => {
          setStore((prev) => {
            const nextRunning = new Set(prev.runningIds);
            const profile = prev.byId.get(event.payload.id);
            const shouldRun =
              event.payload.is_running && profile?.runtime_state !== "Stopped";
            if (shouldRun) {
              nextRunning.add(event.payload.id);
            } else {
              nextRunning.delete(event.payload.id);
            }
            return { ...prev, runningIds: nextRunning };
          });
        });

        unlistenSyncStatus = await listen<{
          profile_id: string;
          status: string;
          error?: string;
        }>("profile-sync-status", (event) => {
          const { profile_id, status, error } = event.payload;
          setStore((prev) => ({
            ...prev,
            syncById: {
              ...prev.syncById,
              [profile_id]: { status, error },
            },
          }));
        });

        unlistenTeamLockAcquired = await listen("team-lock-acquired", () => {
          void fetchLocks();
        });

        unlistenTeamLockReleased = await listen("team-lock-released", () => {
          void fetchLocks();
        });
      } catch (error) {
        setStore((prev) => ({
          ...prev,
          error: extractRootError(error),
        }));
      }
    };

    void setupListeners();

    const onScopeChange = () => {
      invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
      void refreshProfiles();
      void fetchLocks();
    };
    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, onScopeChange);

    return () => {
      disposed = true;
      if (profileChangedTimer) {
        clearTimeout(profileChangedTimer);
      }
      if (unlistenProfilesChanged) unlistenProfilesChanged();
      if (unlistenProfileUpdated) unlistenProfileUpdated();
      if (unlistenRunningChanged) unlistenRunningChanged();
      if (unlistenSyncStatus) unlistenSyncStatus();
      if (unlistenTeamLockAcquired) unlistenTeamLockAcquired();
      if (unlistenTeamLockReleased) unlistenTeamLockReleased();
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, onScopeChange);
      if (disposed) {
        // no-op guard to satisfy strict cleanup intent
      }
    };
  }, [enabled, fetchLocks, refreshProfiles]);

  const api = useMemo(
    () => ({
      refreshProfiles,
      refreshLocks: fetchLocks,
    }),
    [fetchLocks, refreshProfiles],
  );

  return {
    ...store,
    ...api,
  };
}
