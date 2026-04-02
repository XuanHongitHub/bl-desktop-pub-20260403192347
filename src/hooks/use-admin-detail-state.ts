"use client";

import { useMemo, useState } from "react";

export function useAdminDetailState<T extends { id: string }>(
  items: T[],
  initialSelectedId = "",
) {
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [stale, setStale] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId],
  );

  return {
    selectedId,
    selectedItem,
    stale,
    setSelectedId,
    markStale: () => setStale(true),
    clearStale: () => setStale(false),
  };
}
