"use client";

import type { ReactNode } from "react";
import { useWebsiteShellVariant } from "@/components/website/website-shell-context";
import { cn } from "@/lib/utils";

export function PortalLayout({ children }: { children: ReactNode }) {
  const variant = useWebsiteShellVariant();

  return (
    <div
      data-web-portal=""
      data-web-variant={variant}
      className="min-h-screen bg-background text-foreground"
    >
      {variant === "marketing" ? (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div
            className={cn(
              "absolute inset-x-0 top-0 border-b border-border/70 bg-gradient-to-b to-transparent",
              "h-44 from-muted/50",
            )}
          />
          <div
            className={cn(
              "absolute -left-24 rounded-full blur-3xl",
              "top-20 h-72 w-72 bg-muted/45",
            )}
          />
          <div
            className={cn(
              "absolute -right-24 rounded-full blur-3xl",
              "top-24 h-80 w-80 bg-card/70",
            )}
          />
        </div>
      ) : null}
      <div className="relative flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
