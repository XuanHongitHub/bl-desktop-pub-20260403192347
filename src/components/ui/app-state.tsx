"use client";

import { AlertTriangle, CircleAlert, Inbox, Info, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AppStateKind = "loading" | "empty" | "error" | "warning" | "info";

type AppStateProps = {
  kind?: AppStateKind;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  className?: string;
};

type AppStateSurfaceProps = AppStateProps & {
  className?: string;
};

type AppStateOverlayProps = AppStateSurfaceProps & {
  open: boolean;
  overlayClassName?: string;
  zIndexClassName?: string;
};

function resolveDefaultIcon(kind: AppStateKind): ReactNode {
  switch (kind) {
    case "loading":
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    case "empty":
      return <Inbox className="h-5 w-5 text-muted-foreground" />;
    case "error":
      return <CircleAlert className="h-5 w-5 text-destructive" />;
    case "warning":
      return <AlertTriangle className="h-5 w-5 text-chart-5" />;
    default:
      return <Info className="h-5 w-5 text-muted-foreground" />;
  }
}

export function AppState({
  kind = "loading",
  title,
  description,
  action,
  icon,
  compact = false,
  className,
}: AppStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center text-center",
        compact ? "gap-2" : "gap-2.5",
        className,
      )}
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted/60">
        {icon ?? resolveDefaultIcon(kind)}
      </div>
      <div className="space-y-1">
        <p
          className={cn(
            "font-semibold text-foreground",
            compact ? "text-sm" : "text-[15px]",
          )}
        >
          {title}
        </p>
        {description ? (
          <p className="max-w-[320px] text-xs text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function AppStateSurface({
  kind = "loading",
  title,
  description,
  action,
  icon,
  compact = false,
  className,
}: AppStateSurfaceProps) {
  return (
    <div
      className={cn(
        "flex min-w-[250px] flex-col items-center rounded-lg border border-border bg-card/95 px-5 py-4 shadow-sm animate-in fade-in zoom-in-95 duration-150",
        className,
      )}
    >
      <AppState
        kind={kind}
        title={title}
        description={description}
        action={action}
        icon={icon}
        compact={compact}
      />
    </div>
  );
}

export function AppStateOverlay({
  open,
  kind = "loading",
  title,
  description,
  action,
  icon,
  compact = false,
  className,
  overlayClassName,
  zIndexClassName = "z-[60010]",
}: AppStateOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background/95 backdrop-blur-[1px]",
        zIndexClassName,
        overlayClassName,
      )}
    >
      <AppStateSurface
        kind={kind}
        title={title}
        description={description}
        action={action}
        icon={icon}
        compact={compact}
        className={className}
      />
    </div>
  );
}
