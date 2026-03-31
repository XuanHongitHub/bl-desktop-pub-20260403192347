"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface WorkspacePageShellProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  shellClassName?: string;
  headerClassName?: string;
  toolbarClassName?: string;
}

export function WorkspacePageShell({
  title,
  description,
  actions,
  toolbar,
  children,
  contentClassName,
  shellClassName,
  headerClassName,
  toolbarClassName,
}: WorkspacePageShellProps) {
  const hasHeaderContent = Boolean(title || description || actions || toolbar);
  const contentNode = (
    <div
      className={cn("w-full space-y-3 pr-2.5 pb-3 md:pr-3", contentClassName)}
    >
      {children}
    </div>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden",
        shellClassName,
      )}
    >
      {hasHeaderContent ? (
        <div
          className={cn(
            "app-shell-safe-header shrink-0 pr-2.5 md:pr-3",
            headerClassName,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {title ? (
                <h2 className="truncate text-base font-semibold leading-tight">
                  {title}
                </h2>
              ) : null}
              {description && (
                <p
                  className={cn(
                    "max-w-2xl text-xs text-muted-foreground",
                    title ? "mt-1" : "mt-0",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="shrink-0">{actions}</div>}
          </div>
          {toolbar && (
            <div className={cn("mt-2", toolbarClassName)}>{toolbar}</div>
          )}
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">{contentNode}</ScrollArea>
    </div>
  );
}
