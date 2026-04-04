import { X } from "lucide-react";
import type {
  PersistentOperationProgress,
  PersistentOperationStatus,
} from "@/hooks/use-persistent-operation-progress";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Progress } from "./progress";

interface OperationProgressCardProps {
  progress: PersistentOperationProgress;
  percent: number;
  statusLabel: string;
  summaryLabel: string;
  messageLabel?: string;
  onClear?: () => void;
}

function getStatusTone(status: PersistentOperationStatus): string {
  if (status === "success") {
    return "border-chart-2/40 bg-chart-2/15 text-chart-2";
  }
  if (status === "partial") {
    return "border-chart-4/40 bg-chart-4/15 text-chart-4";
  }
  if (status === "error" || status === "interrupted") {
    return "border-destructive/40 bg-destructive/10 text-destructive";
  }
  return "border-chart-1/40 bg-chart-1/10 text-chart-1";
}

export function OperationProgressCard(props: OperationProgressCardProps) {
  const { progress } = props;

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="line-clamp-1 text-xs font-medium text-foreground">
            {progress.label}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium",
                getStatusTone(progress.status),
              )}
            >
              {props.statusLabel}
            </Badge>
            <span className="text-[11px] text-muted-foreground">
              {props.summaryLabel}
            </span>
          </div>
        </div>
        {props.onClear ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={props.onClear}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="mt-2 space-y-1">
        <Progress value={props.percent} className="h-2" />
        {props.messageLabel ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {props.messageLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
