import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AdminHeaderMetric = {
  key: string;
  label: string;
  value: string | number;
  variant?:
    | "outline"
    | "secondary"
    | "default"
    | "success"
    | "warning"
    | "info";
};

type AdminShellPageHeaderProps = {
  title: string;
  description?: string;
  metrics?: AdminHeaderMetric[];
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  className?: string;
};

export function AdminShellPageHeader({
  title,
  description,
  metrics,
  primaryAction,
  secondaryActions,
  className,
}: AdminShellPageHeaderProps) {
  return (
    <header className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="type-section text-foreground">{title}</h1>
          {description ? (
            <p className="type-ui-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {primaryAction ? <div className="shrink-0">{primaryAction}</div> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(metrics ?? []).map((metric) => (
          <Badge key={metric.key} variant={metric.variant ?? "outline"}>
            {metric.label}: {metric.value}
          </Badge>
        ))}
        {secondaryActions ? (
          <div className="ml-auto">{secondaryActions}</div>
        ) : null}
      </div>
    </header>
  );
}
