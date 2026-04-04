"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/frontend-baseline/shadcn/ui/scroll-area";
import { ProfileRowV2 } from "@/frontend-v2/components/profile-row-v2";
import type { BrowserProfile } from "@/types";

type ProfileListV2Props = {
  visibleIds: string[];
  profilesById: Map<string, BrowserProfile>;
  runningIds: Set<string>;
  locksById: Set<string>;
  syncById: Record<string, { status: string; error?: string }>;
  launchingIds: Set<string>;
  stoppingIds: Set<string>;
  syncingIds: Set<string>;
  emptyLabel: string;
  onToggleRun: (profile: BrowserProfile) => void;
  onToggleSync: (profile: BrowserProfile) => void;
};

export function ProfileListV2({
  visibleIds,
  profilesById,
  runningIds,
  locksById,
  syncById,
  launchingIds,
  stoppingIds,
  syncingIds,
  emptyLabel,
  onToggleRun,
  onToggleSync,
}: ProfileListV2Props) {
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
  }, []);

  const virtualizer = useVirtualizer({
    count: visibleIds.length,
    getScrollElement: () => viewport,
    estimateSize: () => 64,
    overscan: 16,
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

      const syncEntry = syncById[profile.id];
      return (
        <div
          key={profile.id}
          className="absolute left-0 top-0 w-full"
          style={{
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          <ProfileRowV2
            profile={profile}
            isRunning={
              runningIds.has(profile.id) || profile.runtime_state === "Running"
            }
            isLocked={locksById.has(profile.id)}
            syncStatus={syncEntry?.status}
            isLaunching={launchingIds.has(profile.id)}
            isStopping={stoppingIds.has(profile.id)}
            isSyncing={syncingIds.has(profile.id)}
            onToggleRun={onToggleRun}
            onToggleSync={onToggleSync}
          />
        </div>
      );
    });
  }, [
    launchingIds,
    locksById,
    onToggleRun,
    onToggleSync,
    profilesById,
    runningIds,
    stoppingIds,
    syncById,
    syncingIds,
    virtualRows,
    visibleIds,
  ]);

  return (
    <ScrollArea
      ref={rootRef}
      className="h-full rounded-xl border border-border bg-card"
    >
      {visibleIds.length === 0 ? (
        <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div
          className="relative"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {renderedRows}
        </div>
      )}
    </ScrollArea>
  );
}
