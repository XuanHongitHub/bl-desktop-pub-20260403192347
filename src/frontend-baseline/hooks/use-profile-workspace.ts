"use client";

import { useCallback, useMemo, useReducer } from "react";
import {
  createBaselineProfiles,
  patchProfile,
  pickPatchTargets,
} from "@/frontend-baseline/data/profile-generator";
import type { BaselineProfile } from "@/frontend-baseline/types/profile";

type OptimizedState = {
  order: string[];
  byId: Map<string, BaselineProfile>;
  searchQuery: string;
};

type Action =
  | { type: "seed"; payload: BaselineProfile[] }
  | { type: "search"; payload: string }
  | { type: "patchMany"; payload: string[] };

function toState(rows: BaselineProfile[]): OptimizedState {
  return {
    order: rows.map((row) => row.id),
    byId: new Map(rows.map((row) => [row.id, row])),
    searchQuery: "",
  };
}

function reducer(state: OptimizedState, action: Action): OptimizedState {
  switch (action.type) {
    case "seed":
      return toState(action.payload);
    case "search":
      return {
        ...state,
        searchQuery: action.payload,
      };
    case "patchMany": {
      if (action.payload.length === 0) {
        return state;
      }
      const now = Date.now();
      const nextById = new Map(state.byId);
      for (const id of action.payload) {
        const current = nextById.get(id);
        if (!current) {
          continue;
        }
        nextById.set(id, patchProfile(current, now));
      }

      return {
        ...state,
        byId: nextById,
      };
    }
    default:
      return state;
  }
}

const STATUS_SORT: Record<BaselineProfile["status"], number> = {
  running: 0,
  syncing: 1,
  stopped: 2,
  locked: 3,
};

export function useOptimizedProfileWorkspace(size: number) {
  const [state, dispatch] = useReducer(
    reducer,
    createBaselineProfiles(size),
    toState,
  );

  const visibleIds = useMemo(() => {
    const query = state.searchQuery.trim().toLowerCase();
    const ids: string[] = [];

    for (const id of state.order) {
      const profile = state.byId.get(id);
      if (!profile) {
        continue;
      }

      if (!query) {
        ids.push(profile.id);
        continue;
      }

      if (
        profile.name.toLowerCase().includes(query) ||
        profile.note.toLowerCase().includes(query) ||
        profile.tags.some((tag) => tag.includes(query))
      ) {
        ids.push(profile.id);
      }
    }
    return ids;
  }, [state.byId, state.order, state.searchQuery]);

  const patchTargets = useMemo(() => pickPatchTargets(size), [size]);

  const setSearchQuery = useCallback(
    (query: string) => dispatch({ type: "search", payload: query }),
    [],
  );

  const reseed = useCallback(
    (nextSize: number) =>
      dispatch({ type: "seed", payload: createBaselineProfiles(nextSize) }),
    [],
  );

  const applyPatchBurst = useCallback(
    () => dispatch({ type: "patchMany", payload: patchTargets }),
    [patchTargets],
  );

  return {
    state,
    visibleIds,
    setSearchQuery,
    reseed,
    applyPatchBurst,
  };
}

export function applyLegacyPatchBurst(
  rows: BaselineProfile[],
  patchIds: string[],
): BaselineProfile[] {
  if (patchIds.length === 0) {
    return rows;
  }
  const targetSet = new Set(patchIds);
  const now = Date.now();

  return rows.map((row) => {
    if (!targetSet.has(row.id)) {
      return row;
    }
    return patchProfile(row, now);
  });
}

export function computeLegacyVisibleRows(
  rows: BaselineProfile[],
  searchQuery: string,
): BaselineProfile[] {
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? rows.filter(
        (profile) =>
          profile.name.toLowerCase().includes(query) ||
          profile.note.toLowerCase().includes(query) ||
          profile.tags.some((tag) => tag.includes(query)),
      )
    : rows;

  return [...filtered].sort((left, right) => {
    const statusDelta = STATUS_SORT[left.status] - STATUS_SORT[right.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return left.name.localeCompare(right.name);
  });
}
