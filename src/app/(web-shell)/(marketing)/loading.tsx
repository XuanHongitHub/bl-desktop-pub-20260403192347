import { MARKETING_RAIL_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { cn } from "@/lib/utils";

export default function MarketingLoading() {
  return (
    <section className={cn("space-y-4 py-8", MARKETING_RAIL_WIDTH_CLASS)}>
      <div className="h-10 w-56 animate-pulse rounded-md border border-border bg-muted/40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-xl border border-border bg-muted/35"
          />
        ))}
      </div>
    </section>
  );
}
