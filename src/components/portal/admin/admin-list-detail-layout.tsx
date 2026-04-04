import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminListDetailLayoutProps = {
  list: ReactNode;
  detail: ReactNode;
  detailEmpty?: ReactNode;
  hasSelection?: boolean;
  className?: string;
  listClassName?: string;
  detailClassName?: string;
};

export function AdminListDetailLayout({
  list,
  detail,
  detailEmpty,
  hasSelection = true,
  className,
  listClassName,
  detailClassName,
}: AdminListDetailLayoutProps) {
  return (
    <section
      className={cn(
        "grid w-full gap-4 xl:grid-cols-[360px_minmax(0,1fr)]",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0 rounded-xl border border-border bg-card",
          listClassName,
        )}
      >
        {list}
      </div>
      <div
        className={cn(
          "min-w-0 rounded-xl border border-border bg-card",
          detailClassName,
        )}
      >
        {hasSelection ? detail : detailEmpty}
      </div>
    </section>
  );
}
