import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminStatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function AdminStatusBadge({ status, className }: AdminStatusBadgeProps) {
  if (!status) return null;

  const normalizedStatus = status.toLowerCase().trim();

  let colorClasses = "bg-muted text-muted-foreground";

  // Active / Verified
  if (["active", "verified", "success", "paid"].includes(normalizedStatus)) {
    colorClasses =
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  }
  // Pending / Warning
  else if (
    ["pending", "past_due", "warning", "grace_period"].includes(
      normalizedStatus,
    )
  ) {
    colorClasses =
      "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  }
  // Banned / Canceled / Danger
  else if (
    [
      "canceled",
      "banned",
      "suspended",
      "failed",
      "high_risk",
      "danger",
    ].includes(normalizedStatus)
  ) {
    colorClasses =
      "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  }
  // Neutral / Draft
  else if (["draft", "inactive", "all"].includes(normalizedStatus)) {
    colorClasses =
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  }

  // Display label mapping if needed
  const labelMap: Record<string, string> = {
    past_due: "Past Due",
    high_risk: "High Risk",
    grace_period: "Grace",
  };

  const displayLabel = labelMap[normalizedStatus] || status;

  return (
    <Badge
      variant="outline"
      className={cn("capitalize font-semibold", colorClasses, className)}
    >
      {displayLabel}
    </Badge>
  );
}
