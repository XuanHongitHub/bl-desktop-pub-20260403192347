"use client";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

type PageLoaderMode = "panel" | "fullscreen" | "inline";

type PageLoaderProps = {
  title?: ReactNode;
  description?: ReactNode;
  mode?: PageLoaderMode;
  className?: string;
};

type PageLoaderOverlayProps = Omit<PageLoaderProps, "mode"> & {
  open: boolean;
  overlayClassName?: string;
  zIndexClassName?: string;
};

export function PageLoader({
  title,
  description,
  mode = "panel",
  className,
}: PageLoaderProps) {
  const placementClassName =
    mode === "fullscreen"
      ? "flex min-h-screen items-center justify-center bg-background"
      : mode === "inline"
        ? "flex items-center justify-center"
        : "flex min-h-[220px] w-full items-center justify-center";

  return (
    <div className={cn(placementClassName, className)} aria-busy="true">
      <Spinner size="lg" />
      {(title || description) && (
        <span className="sr-only">
          {title ? String(title) : ""}
          {description ? ` ${String(description)}` : ""}
        </span>
      )}
    </div>
  );
}

export function PageLoaderOverlay({
  open,
  title,
  description,
  className,
  overlayClassName,
  zIndexClassName = "z-[60010]",
}: PageLoaderOverlayProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 flex items-center justify-center bg-background/45 backdrop-blur-[1px]",
        zIndexClassName,
        overlayClassName,
      )}
    >
      <PageLoader title={title} description={description} mode="inline" className={className} />
    </div>
  );
}
