"use client";

import { useMemo, useState } from "react";

type UseAdminListStateInput = {
  initialQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  initialSort?: string;
  initialFilters?: Record<string, string>;
};

export function useAdminListState({
  initialQuery = "",
  initialPage = 1,
  initialPageSize = 50,
  initialSort = "updatedAt:desc",
  initialFilters = {},
}: UseAdminListStateInput = {}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [sort, setSort] = useState(initialSort);
  const [filters, setFilters] =
    useState<Record<string, string>>(initialFilters);
  const [refreshTick, setRefreshTick] = useState(0);

  const queryParams = useMemo(
    () => ({
      q: query.trim() || undefined,
      page,
      pageSize,
      sort,
      ...filters,
    }),
    [filters, page, pageSize, query, sort],
  );

  return {
    query,
    page,
    pageSize,
    sort,
    filters,
    refreshTick,
    queryParams,
    setQuery,
    setPage,
    setPageSize,
    setSort,
    setFilters,
    refresh: () => setRefreshTick((current) => current + 1),
    resetPage: () => setPage(1),
  };
}
