import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getUnifiedPlanLabel, resolveUnifiedPlanId } from "@/lib/plan-display";

interface AdminPlanBadgeProps {
  planId?: string | null;
  planLabel?: string | null;
  className?: string;
}

export function AdminPlanBadge({ planId, planLabel, className }: AdminPlanBadgeProps) {
  const unifiedPlan = resolveUnifiedPlanId({ planId, planLabel });
  const displayLabel = getUnifiedPlanLabel({ planId: unifiedPlan });

  let colorClasses = "bg-muted text-muted-foreground";

  // Using beautiful, premium modern colors
  switch (unifiedPlan) {
    case "free":
      colorClasses = "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
      break;
    case "starter":
      colorClasses = "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
      break;
    case "team":
      colorClasses = "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
      break;
    case "scale":
      colorClasses = "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400 border-fuchsia-500/20";
      break;
    case "enterprise":
      colorClasses = "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20 bg-gradient-to-r from-red-500/10 to-orange-500/10";
      break;
  }

  return (
    <Badge
      variant="outline"
      className={cn("font-bold tracking-tight", colorClasses, className)}
    >
      {displayLabel}
    </Badge>
  );
}
