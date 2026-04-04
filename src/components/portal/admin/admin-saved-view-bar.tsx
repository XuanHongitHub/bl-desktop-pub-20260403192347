import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AdminSavedView = {
  id: string;
  label: string;
  hint?: string;
};

type AdminSavedViewBarProps = {
  views: AdminSavedView[];
  activeViewId: string;
  onSelect: (viewId: string) => void;
  className?: string;
};

export function AdminSavedViewBar({
  views,
  activeViewId,
  onSelect,
  className,
}: AdminSavedViewBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {views.map((view) => {
        const active = view.id === activeViewId;
        return (
          <Button
            key={view.id}
            type="button"
            size="sm"
            variant={active ? "secondary" : "outline"}
            onClick={() => onSelect(view.id)}
            className="h-8"
          >
            {active ? <Check className="h-3.5 w-3.5" /> : null}
            {view.label}
          </Button>
        );
      })}
    </div>
  );
}
