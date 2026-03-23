"use client";

import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type SwitchProps = Omit<
  React.ComponentProps<"button">,
  "onChange" | "onClick"
> & {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

function Switch({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  className,
  ...props
}: SwitchProps) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked);

  useEffect(() => {
    if (typeof checked === "boolean") {
      return;
    }
    setInternalChecked(defaultChecked);
  }, [checked, defaultChecked]);

  const isChecked = useMemo(
    () => (typeof checked === "boolean" ? checked : internalChecked),
    [checked, internalChecked],
  );

  const toggle = () => {
    if (disabled) {
      return;
    }
    const nextValue = !isChecked;
    if (typeof checked !== "boolean") {
      setInternalChecked(nextValue);
    }
    onCheckedChange?.(nextValue);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      data-state={isChecked ? "checked" : "unchecked"}
      disabled={disabled}
      onClick={toggle}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-muted p-0.5 transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        isChecked && "bg-primary",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-sm transition-transform",
          isChecked ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

export { Switch };
