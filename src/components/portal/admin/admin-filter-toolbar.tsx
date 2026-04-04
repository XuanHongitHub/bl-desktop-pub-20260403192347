import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminFilterToolbarProps = {
  searchSlot?: ReactNode;
  filtersSlot?: ReactNode;
  sortSlot?: ReactNode;
  refreshSlot?: ReactNode;
  className?: string;
};

export function AdminFilterToolbar({
  searchSlot,
  filtersSlot,
  sortSlot,
  refreshSlot,
  className,
}: AdminFilterToolbarProps) {
  return (
    <section
      className={cn(
        "grid gap-2 rounded-xl border border-border bg-card px-3 py-3",
        "md:grid-cols-[minmax(220px,1fr)_auto_auto_auto]",
        className,
      )}
    >
      <div className="min-w-0">{searchSlot}</div>
      <div className="flex flex-wrap items-center gap-2">{filtersSlot}</div>
      <div className="flex flex-wrap items-center gap-2">{sortSlot}</div>
      <div className="flex items-center justify-end gap-2">{refreshSlot}</div>
    </section>
  );
}
