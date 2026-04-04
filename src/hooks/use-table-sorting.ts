import type { SortingState } from "@tanstack/react-table";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import type { TableSortingSettings } from "@/types";

const TABLE_SORTING_STORAGE_KEY = "buglogin.profile-table.sorting.v1";

function getDefaultSortingSettings(): TableSortingSettings {
  return {
    column: "name",
    direction: "asc",
  };
}

function readStoredSortingSettings(): TableSortingSettings {
  if (typeof window === "undefined") {
    return getDefaultSortingSettings();
  }

  try {
    const raw = window.localStorage.getItem(TABLE_SORTING_STORAGE_KEY);
    if (!raw) {
      return getDefaultSortingSettings();
    }
    const parsed = JSON.parse(raw) as Partial<TableSortingSettings> | null;
    if (
      parsed &&
      typeof parsed.column === "string" &&
      (parsed.direction === "asc" || parsed.direction === "desc")
    ) {
      return {
        column: parsed.column,
        direction: parsed.direction,
      };
    }
  } catch {
    // Ignore invalid local cache and fall back to defaults.
  }

  return getDefaultSortingSettings();
}

function writeStoredSortingSettings(settings: TableSortingSettings) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      TABLE_SORTING_STORAGE_KEY,
      JSON.stringify(settings),
    );
  } catch {
    // Ignore local persistence failures.
  }
}

export function useTableSorting() {
  const [sortingSettings, setSortingSettings] = useState<TableSortingSettings>(
    readStoredSortingSettings,
  );
  const [isLoaded] = useState(true);

  // Save sorting settings to disk
  const saveSortingSettings = useCallback(
    async (settings: TableSortingSettings) => {
      setSortingSettings(settings);
      writeStoredSortingSettings(settings);
      try {
        await invoke("save_table_sorting_settings", { sorting: settings });
      } catch (error) {
        console.error("Failed to save table sorting settings:", error);
      }
    },
    [],
  );

  // Convert our settings to tanstack table sorting format
  const getTableSorting = useCallback((): SortingState => {
    if (!isLoaded) return [];

    return [
      {
        id: sortingSettings.column,
        desc: sortingSettings.direction === "desc",
      },
    ];
  }, [sortingSettings, isLoaded]);

  // Update sorting when table state changes
  const updateSorting = useCallback(
    (sorting: SortingState) => {
      if (!isLoaded) return;

      if (sorting.length > 0) {
        const newSettings: TableSortingSettings = {
          column: sorting[0].id,
          direction: sorting[0].desc ? "desc" : "asc",
        };
        void saveSortingSettings(newSettings);
      }
    },
    [saveSortingSettings, isLoaded],
  );

  return {
    sortingSettings,
    isLoaded,
    getTableSorting,
    updateSorting,
  };
}
