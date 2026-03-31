import { useEffect, useRef } from "react";
import type { BaselineProfile } from "@/frontend-baseline/types/profile";
import { ScrollArea } from "@/frontend-baseline/shadcn/ui/scroll-area";
import { ProfileRow } from "@/frontend-baseline/components/profile-row";

type LegacyProfileListProps = {
  rows: BaselineProfile[];
  emptyLabel: string;
  compact?: boolean;
  viewportDataTestId?: string;
  onViewportReady?: (viewport: HTMLDivElement | null) => void;
};

export function LegacyProfileList({
  rows,
  emptyLabel,
  compact = false,
  viewportDataTestId,
  onViewportReady,
}: LegacyProfileListProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const viewport = rootRef.current?.querySelector(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLDivElement | null;
    if (viewport && viewportDataTestId) {
      viewport.dataset.testid = viewportDataTestId;
    }
    onViewportReady?.(viewport ?? null);
  }, [onViewportReady, rows.length, viewportDataTestId]);

  return (
    <ScrollArea ref={rootRef} className="h-full rounded-lg border border-border bg-card">
      {rows.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div>
          {rows.map((row) => (
            <ProfileRow key={row.id} profile={row} compact={compact} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
