"use client";

import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type BillingCycleValue = "monthly" | "yearly";

interface BillingCycleSwitchProps {
  value: BillingCycleValue;
  onValueChange: (value: BillingCycleValue) => void;
  monthlyLabel: string;
  yearlyLabel: string;
  yearlySaveLabel?: string;
  className?: string;
}

export function BillingCycleSwitch({
  value,
  onValueChange,
  monthlyLabel,
  yearlyLabel,
  yearlySaveLabel,
  className,
}: BillingCycleSwitchProps) {
  const isYearly = value === "yearly";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/20 px-2 py-1">
        <button
          type="button"
          onClick={() => onValueChange("monthly")}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            !isYearly
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {monthlyLabel}
        </button>
        <Switch
          checked={isYearly}
          onCheckedChange={(checked) =>
            onValueChange(checked ? "yearly" : "monthly")
          }
          className="data-[state=checked]:bg-chart-3"
          aria-label={`${monthlyLabel} / ${yearlyLabel}`}
        />
        <button
          type="button"
          onClick={() => onValueChange("yearly")}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            isYearly
              ? "bg-background text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {yearlyLabel}
        </button>
      </div>
      {yearlySaveLabel ? (
        <Badge
          variant="outline"
          className="min-h-7 rounded-full border-chart-3/30 bg-chart-3/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-chart-3 whitespace-nowrap"
        >
          {yearlySaveLabel}
        </Badge>
      ) : null}
    </div>
  );
}
