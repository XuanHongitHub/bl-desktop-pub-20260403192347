import type { ReactNode } from "react";
import { PORTAL_CONTENT_WIDTH_CLASS } from "@/components/portal/portal-geometry";
import { cn } from "@/lib/utils";

interface PortalPageFrameProps {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  contentClassName?: string;
  contentVariant?: "surface" | "plain";
}

export function PortalPageFrame({
  title,
  description,
  eyebrow,
  actions,
  children,
  className,
  contentClassName,
  contentVariant = "surface",
}: PortalPageFrameProps) {
  return (
    <section className={cn("space-y-0", PORTAL_CONTENT_WIDTH_CLASS, className)}>
      <header className="border-b border-border/70 pb-8">
        <div className="space-y-3">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="max-w-5xl text-4xl font-semibold leading-[1.03] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            {description}
          </p>
        </div>
        {actions ? (
          <div className="mt-5 flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </header>

      {children ? (
        <div
          className={cn(
            contentVariant === "surface" ? "space-y-6 py-8" : null,
            contentClassName,
          )}
        >
          {children}
        </div>
      ) : null}
    </section>
  );
}
