import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import {
  applyScopedGroupCounts,
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { BrowserProfile, GroupWithCount } from "@/types";

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

/**
 * Custom hook to manage profile-related state and listen for backend events.
 * This hook eliminates the need for manual UI refreshes by automatically
 * updating state when the backend emits profile change events.
 */
export function useProfileEvents(): UseProfileEventsReturn {
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [runningProfiles, setRunningProfiles] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profilesRef = useRef<BrowserProfile[]>([]);

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  // Load profiles from backend
  const loadProfiles = useCallback(async () => {
    try {
      const profileList = await invoke<BrowserProfile[]>(
        "list_browser_profiles",
      );
      const scope = getCurrentDataScope();
      const scopedProfiles = scopeEntitiesForContext(
        "profiles",
        profileList,
        (profile) => profile.id,
        scope,
      );
      setProfiles(scopedProfiles);
      setError(null);
    } catch (err: unknown) {
      console.error("Failed to load profiles:", err);
      setError(`Failed to load profiles: ${extractRootError(err)}`);
    }
  }, []);

  // Load groups from backend
  const loadGroups = useCallback(async () => {
    try {
      const [groupsWithCounts, profileList] = await Promise.all([
        invoke<GroupWithCount[]>("get_groups_with_profile_counts"),
        invoke<BrowserProfile[]>("list_browser_profiles"),
      ]);
      const scope = getCurrentDataScope();
      const scopedProfiles = scopeEntitiesForContext(
        "profiles",
        profileList,
        (profile) => profile.id,
        scope,
      );
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
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load and event listeners setup
  useEffect(() => {
    let profilesUnlisten: (() => void) | undefined;
    let profileUpdatedUnlisten: (() => void) | undefined;
    let runningUnlisten: (() => void) | undefined;
    const handleScopeChanged = () => {
      void loadProfiles();
      void loadGroups();
    };

    const setupListeners = async () => {
      try {
        // Listen for profile changes (create, delete, rename, update, etc.)
        profilesUnlisten = await listen("profiles-changed", () => {
          console.log(
            "Received profiles-changed event, reloading profiles and groups",
          );
          void loadProfiles();
          void loadGroups();
        });

        // Keep profile runtime/process fields fresh without full reload.
        profileUpdatedUnlisten = await listen<BrowserProfile>(
          "profile-updated",
          (event) => {
            const updated = event.payload;
            setProfiles((prev) => {
              const scope = getCurrentDataScope();
              const scopedUpdated = scopeEntitiesForContext(
                "profiles",
                [updated],
                (profile) => profile.id,
                scope,
              );
              if (scopedUpdated.length === 0) {
                return prev.filter((item) => item.id !== updated.id);
              }

              const nextProfile = scopedUpdated[0];
              const index = prev.findIndex(
                (item) => item.id === nextProfile.id,
              );
              if (index === -1) {
                return [...prev, nextProfile];
              }

              const next = [...prev];
              next[index] = nextProfile;
              return next;
            });
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

        console.log("Profile event listeners set up successfully");
        window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);

        // Initial load runs after listeners are attached to avoid missing
        // early scope-change events during app bootstrap/workspace restore.
        await Promise.all([loadProfiles(), loadGroups()]);
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
      if (profilesUnlisten) profilesUnlisten();
      if (profileUpdatedUnlisten) profileUpdatedUnlisten();
      if (runningUnlisten) runningUnlisten();
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [loadProfiles, loadGroups]);

  // Sync profile running states periodically to ensure consistency
  useEffect(() => {
    const syncRunningStates = async () => {
      if (profiles.length === 0) return;

      try {
        const statusChecks = profiles.map(async (profile) => {
          try {
            const backendRunning = await invoke<boolean>(
              "check_browser_status",
              {
                profile,
              },
            );
            const runtimeState = profile.runtime_state;
            const isRunning =
              runtimeState === "Parked" ||
              runtimeState === "Stopped" ||
              runtimeState === "Crashed" ||
              runtimeState === "Terminating"
                ? false
                : backendRunning || runtimeState === "Running";
            return { id: profile.id, isRunning };
          } catch (error) {
            console.error(
              `Failed to check status for profile ${profile.name}:`,
              error,
            );
            return { id: profile.id, isRunning: false };
          }
        });

        const statuses = await Promise.all(statusChecks);

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
      }
    };

    // Initial sync
    void syncRunningStates();

    // Sync every 30 seconds to catch any missed events
    const interval = setInterval(() => {
      void syncRunningStates();
    }, 30000);

    return () => clearInterval(interval);
  }, [profiles]);

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
