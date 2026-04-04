import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/frontend-baseline/shadcn/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/12 text-primary",
        secondary: "border-border bg-muted text-muted-foreground",
        destructive: "border-destructive/30 bg-destructive/12 text-destructive",
        outline: "border-border bg-background text-foreground",
        success: "border-chart-2/30 bg-chart-2/12 text-chart-2",
        warning: "border-chart-4/30 bg-chart-4/12 text-chart-4",
        info: "border-chart-1/30 bg-chart-1/12 text-chart-1",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
