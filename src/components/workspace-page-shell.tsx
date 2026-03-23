"use client";

import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface WorkspacePageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  contentClassName?: string;
}

export function WorkspacePageShell({
  title,
  description,
  actions,
  toolbar,
  children,
  contentClassName,
}: WorkspacePageShellProps) {
  const contentNode = (
    <div className={cn("w-full space-y-6 pr-4 pb-8 md:pr-6", contentClassName)}>
      {children}
    </div>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="app-shell-safe-header shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold leading-none">
              {title}
            </h2>
            {description && (
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        {toolbar && <div className="mt-4">{toolbar}</div>}
      </div>

      <ScrollArea className="min-h-0 flex-1">{contentNode}</ScrollArea>
    </div>
  );
}
