"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ScrollArea } from "@/frontend-baseline/shadcn/ui/scroll-area";
import type { BaselineProfile } from "@/frontend-baseline/types/profile";
import { ProfileRow } from "@/frontend-baseline/components/profile-row";

type OptimizedProfileListProps = {
  visibleIds: string[];
  profilesById: Map<string, BaselineProfile>;
  rowHeight?: number;
  compact?: boolean;
  emptyLabel: string;
  viewportDataTestId?: string;
  onViewportReady?: (viewport: HTMLDivElement | null) => void;
};

export function OptimizedProfileList({
  visibleIds,
  profilesById,
  rowHeight = 56,
  compact = false,
  emptyLabel,
  viewportDataTestId,
  onViewportReady,
}: OptimizedProfileListProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) {
      setViewport(null);
      return;
    }
    const nextViewport = rootRef.current.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLDivElement | null;
    setViewport(nextViewport);
  }, [visibleIds.length]);

  useEffect(() => {
    if (viewport && viewportDataTestId) {
      viewport.dataset.testid = viewportDataTestId;
    }
    onViewportReady?.(viewport ?? null);
  }, [onViewportReady, viewport, viewportDataTestId]);

  const virtualizer = useVirtualizer({
    count: visibleIds.length,
    getScrollElement: () => viewport,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const virtualRows = virtualizer.getVirtualItems();

  const renderedRows = useMemo(() => {
    return virtualRows.map((virtualRow) => {
      const profileId = visibleIds[virtualRow.index];
      if (!profileId) {
        return null;
      }
      const profile = profilesById.get(profileId);
      if (!profile) {
        return null;
      }
      return (
        <div
          key={profile.id}
          className="absolute left-0 top-0 w-full"
          style={{
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <ProfileRow profile={profile} compact={compact} />
        </div>
      );
    });
  }, [compact, profilesById, virtualRows, visibleIds]);

  return (
    <ScrollArea ref={rootRef} className="h-full rounded-lg border border-border bg-card">
      {visibleIds.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div
          className="relative"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {renderedRows}
        </div>
      )}
    </ScrollArea>
  );
}
