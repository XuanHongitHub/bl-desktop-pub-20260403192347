"use client";

import type * as React from "react";

import { cn } from "@/lib/utils";

function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-area"
      className={cn(
        "relative min-h-0 min-w-0 overflow-auto app-scroll-gutter",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { ScrollArea };
