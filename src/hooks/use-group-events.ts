import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import {
  applyScopedGroupCounts,
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { BrowserProfile, GroupWithCount } from "@/types";

/**
 * Custom hook to manage group-related state and listen for backend events.
 * This hook eliminates the need for manual UI refreshes by automatically
 * updating state when the backend emits group change events.
 */
export function useGroupEvents() {
  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: unknown) {
      console.error("Failed to load groups:", err);
      setError(`Failed to load groups: ${extractRootError(err)}`);
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load and event listeners setup
  useEffect(() => {
    let groupsUnlisten: (() => void) | undefined;
    let profilesUnlisten: (() => void) | undefined;
    const handleScopeChanged = () => {
      void loadGroups();
    };

    const setupListeners = async () => {
      try {
        // Initial load
        await loadGroups();

        // Listen for group changes (create, delete, rename, update, etc.)
        groupsUnlisten = await listen("groups-changed", () => {
          console.log("Received groups-changed event, reloading groups");
          void loadGroups();
        });

        // Also listen for profile changes since groups show profile counts
        profilesUnlisten = await listen("profiles-changed", () => {
          console.log(
            "Received profiles-changed event, reloading groups for updated counts",
          );
          void loadGroups();
        });

        console.log("Group event listeners set up successfully");
        window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
      } catch (err) {
        console.error("Failed to setup group event listeners:", err);
        setError(
          `Failed to setup group event listeners: ${extractRootError(err)}`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    void setupListeners();

    // Cleanup listeners on unmount
    return () => {
      if (groupsUnlisten) groupsUnlisten();
      if (profilesUnlisten) profilesUnlisten();
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [loadGroups]);

  return {
    groups,
    isLoading,
    error,
    loadGroups,
    clearError,
  };
}
