import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import { invalidateInvokeCache, invokeCached } from "@/lib/ipc-query-cache";
import {
  applyScopedGroupCounts,
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { BrowserProfile, GroupWithCount } from "@/types";

const LIST_BROWSER_PROFILES_CACHE_KEY = "list_browser_profiles_light";
const GROUPS_WITH_COUNTS_CACHE_KEY = "get_groups_with_profile_counts";
const PROFILE_CACHE_TTL_MS = 3_000;

interface UseProfileEventsReturn {
  profiles: BrowserProfile[];
  groups: GroupWithCount[];
  runningProfiles: Set<string>;
  isLoading: boolean;
  error: string | null;
  loadProfiles: () => Promise<void>;
  loadGroups: () => Promise<void>;
  clearError: () => void;
}

interface UseProfileEventsOptions {
  enabled?: boolean;
  includeGroups?: boolean;
  includeRunningStateSync?: boolean;
}

/**
 * Custom hook to manage profile-related state and listen for backend events.
 * This hook eliminates the need for manual UI refreshes by automatically
 * updating state when the backend emits profile change events.
 */
export function useProfileEvents(
  options: UseProfileEventsOptions = {},
): UseProfileEventsReturn {
  const {
    enabled = true,
    includeGroups = true,
    includeRunningStateSync = true,
  } = options;
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [runningProfiles, setRunningProfiles] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const profilesRef = useRef<BrowserProfile[]>([]);
  const loadProfilesInFlightRef = useRef<Promise<void> | null>(null);
  const loadGroupsInFlightRef = useRef<Promise<void> | null>(null);
  const lastFullReloadAtRef = useRef(0);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  // Load profiles from backend
  const loadProfiles = useCallback(async () => {
    if (loadProfilesInFlightRef.current) {
      return loadProfilesInFlightRef.current;
    }
    const task = (async () => {
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
        profilesRef.current = scopedProfiles;
        setProfiles(scopedProfiles);
        setError(null);
      } catch (err: unknown) {
        console.error("Failed to load profiles:", err);
        setError(`Failed to load profiles: ${extractRootError(err)}`);
      } finally {
        loadProfilesInFlightRef.current = null;
      }
    })();
    loadProfilesInFlightRef.current = task;
    return task;
  }, []);

  // Load groups from backend
  const loadGroups = useCallback(async () => {
    if (!includeGroups) {
      setGroups([]);
      setError(null);
      return;
    }
    if (loadGroupsInFlightRef.current) {
      return loadGroupsInFlightRef.current;
    }
    const task = (async () => {
      try {
        const groupsWithCounts = await invokeCached<GroupWithCount[]>(
          "get_groups_with_profile_counts",
          undefined,
          {
            key: GROUPS_WITH_COUNTS_CACHE_KEY,
            ttlMs: PROFILE_CACHE_TTL_MS,
          },
        );
        const scope = getCurrentDataScope();
        let scopedProfiles = profilesRef.current;
        if (scopedProfiles.length === 0) {
          const profileList = await invokeCached<BrowserProfile[]>(
            "list_browser_profiles_light",
            undefined,
            {
              key: LIST_BROWSER_PROFILES_CACHE_KEY,
              ttlMs: PROFILE_CACHE_TTL_MS,
            },
          );
          scopedProfiles = scopeEntitiesForContext(
            "profiles",
            profileList,
            (profile) => profile.id,
            scope,
          );
          profilesRef.current = scopedProfiles;
          setProfiles(scopedProfiles);
        }
        const scopedGroups = scopeEntitiesForContext(
          "groups",
          groupsWithCounts,
          (group) => group.id,
          scope,
          { keepGlobalIds: ["default"] },
        );
        setGroups(
          applyScopedGroupCounts(scopedGroups, scopedProfiles, "Default"),
        );
        setError(null);
      } catch (err) {
        console.error("Failed to load groups with counts:", err);
        setGroups([]);
      } finally {
        loadGroupsInFlightRef.current = null;
      }
    })();
    loadGroupsInFlightRef.current = task;
    return task;
  }, [includeGroups]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load and event listeners setup
  useEffect(() => {
    if (!enabled) {
      profilesRef.current = [];
      setProfiles([]);
      setGroups([]);
      setRunningProfiles(new Set());
      setIsLoading(false);
      return;
    }

    let profilesUnlisten: (() => void) | undefined;
    let profileUpdatedUnlisten: (() => void) | undefined;
    let runningUnlisten: (() => void) | undefined;
    let profilesChangedTimer: ReturnType<typeof setTimeout> | null = null;
    setIsLoading(true);
    const runFullRefresh = async () => {
      invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
      invalidateInvokeCache(GROUPS_WITH_COUNTS_CACHE_KEY);
      lastFullReloadAtRef.current = Date.now();
      await loadProfiles();
      if (includeGroups) {
        await loadGroups();
      }
    };
    const scheduleFullRefresh = (delayMs = 800) => {
      if (profilesChangedTimer) {
        clearTimeout(profilesChangedTimer);
      }
      profilesChangedTimer = setTimeout(() => {
        profilesChangedTimer = null;
        const minReloadGapMs = 1500;
        const remainingGap =
          minReloadGapMs - (Date.now() - lastFullReloadAtRef.current);
        if (remainingGap > 0) {
          scheduleFullRefresh(remainingGap);
          return;
        }
        void runFullRefresh();
      }, delayMs);
    };
    const handleScopeChanged = () => {
      void runFullRefresh();
    };

    const setupListeners = async () => {
      try {
        profilesUnlisten = await listen("profiles-changed", () => {
          scheduleFullRefresh();
        });

        // Keep profile runtime/process fields fresh without full reload.
        profileUpdatedUnlisten = await listen<BrowserProfile>(
          "profile-updated",
          (event) => {
            invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
            const updated = event.payload;
            let shouldRefreshGroups = false;
            setProfiles((prev) => {
              const scope = getCurrentDataScope();
              const scopedUpdated = scopeEntitiesForContext(
                "profiles",
                [updated],
                (profile) => profile.id,
                scope,
              );
              if (scopedUpdated.length === 0) {
                shouldRefreshGroups =
                  includeGroups && prev.some((item) => item.id === updated.id);
                return prev.filter((item) => item.id !== updated.id);
              }

              const nextProfile = scopedUpdated[0];
              const index = prev.findIndex(
                (item) => item.id === nextProfile.id,
              );
              if (index === -1) {
                shouldRefreshGroups = includeGroups;
                return [...prev, nextProfile];
              }

              shouldRefreshGroups =
                includeGroups && prev[index]?.group_id !== nextProfile.group_id;
              const next = [...prev];
              next[index] = nextProfile;
              return next;
            });
            if (shouldRefreshGroups) {
              invalidateInvokeCache(GROUPS_WITH_COUNTS_CACHE_KEY);
              scheduleFullRefresh(400);
            }
          },
        );

        // Listen for profile running state changes
        runningUnlisten = await listen<{ id: string; is_running: boolean }>(
          "profile-running-changed",
          (event) => {
            const { id, is_running } = event.payload;
            const latestProfile = profilesRef.current.find((p) => p.id === id);
            const runtimeState = latestProfile?.runtime_state;
            const effectiveRunning =
              runtimeState === "Parked" ||
              runtimeState === "Stopped" ||
              runtimeState === "Crashed" ||
              runtimeState === "Terminating"
                ? false
                : is_running || runtimeState === "Running";
            setRunningProfiles((prev) => {
              const next = new Set(prev);
              if (effectiveRunning) {
                next.add(id);
              } else {
                next.delete(id);
              }
              return next;
            });
          },
        );

        window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);

        // Initial load runs after listeners are attached to avoid missing
        // early scope-change events during app bootstrap/workspace restore.
        await loadProfiles();
        if (includeGroups) {
          await loadGroups();
        }
        lastFullReloadAtRef.current = Date.now();
      } catch (err) {
        console.error("Failed to setup profile event listeners:", err);
        setError(
          `Failed to setup profile event listeners: ${extractRootError(err)}`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    void setupListeners();

    // Cleanup listeners on unmount
    return () => {
      if (profilesChangedTimer) clearTimeout(profilesChangedTimer);
      if (profilesUnlisten) profilesUnlisten();
      if (profileUpdatedUnlisten) profileUpdatedUnlisten();
      if (runningUnlisten) runningUnlisten();
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [enabled, includeGroups, loadProfiles, loadGroups]);

  // Sync profile running states periodically to ensure consistency
  useEffect(() => {
    if (!enabled || !includeRunningStateSync) {
      setRunningProfiles(new Set());
      return;
    }

    let isSyncingRunningStates = false;

    const syncRunningStates = async () => {
      if (profiles.length === 0 || isSyncingRunningStates) return;

      const candidateProfiles = profiles.filter((profile) => {
        const runtimeState = profile.runtime_state;
        return (
          runtimeState === "Running" ||
          runtimeState === "Terminating" ||
          Boolean(profile.process_id)
        );
      });

      if (candidateProfiles.length === 0) {
        setRunningProfiles((prev) => (prev.size === 0 ? prev : new Set()));
        return;
      }

      try {
        isSyncingRunningStates = true;
        // Single batch IPC call instead of N individual calls.
        const profileIds = candidateProfiles.map((p) => p.id);
        const statusMap = await invoke<Record<string, boolean>>(
          "check_browser_statuses_batch",
          { profileIds },
        );

        const statuses = candidateProfiles.map((profile) => {
          const backendRunning = statusMap[profile.id] ?? false;
          const runtimeState = profile.runtime_state;
          const isRunning =
            runtimeState === "Parked" ||
            runtimeState === "Stopped" ||
            runtimeState === "Crashed" ||
            runtimeState === "Terminating"
              ? false
              : backendRunning || runtimeState === "Running";
          return { id: profile.id, isRunning };
        });

        setRunningProfiles((prev) => {
          const next = new Set(prev);
          let hasChanges = false;

          statuses.forEach(({ id, isRunning }) => {
            if (isRunning && !prev.has(id)) {
              next.add(id);
              hasChanges = true;
            } else if (!isRunning && prev.has(id)) {
              next.delete(id);
              hasChanges = true;
            }
          });

          return hasChanges ? next : prev;
        });
      } catch (error) {
        console.error("Failed to sync profile running states:", error);
      } finally {
        isSyncingRunningStates = false;
      }
    };

    // Initial sync
    void syncRunningStates();

    // Sync every 30 seconds to catch any missed events
    const interval = setInterval(() => {
      void syncRunningStates();
    }, 30000);

    return () => clearInterval(interval);
  }, [enabled, includeRunningStateSync, profiles]);

  return {
    profiles,
    groups,
    runningProfiles,
    isLoading,
    error,
    loadProfiles,
    loadGroups,
    clearError,
  };
}
