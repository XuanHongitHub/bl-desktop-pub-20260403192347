"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { BandwidthDataPoint } from "@/types";

interface BandwidthMiniChartProps {
  data: BandwidthDataPoint[];
  currentBandwidth?: number;
  onClick?: () => void;
  className?: string;
}

export function BandwidthMiniChart({
  data,
  currentBandwidth: externalBandwidth,
  onClick,
  className,
}: BandwidthMiniChartProps) {
  const chartData = React.useMemo(() => {
    if (data.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      return Array.from({ length: 60 }, (_, i) => ({
        time: now - (59 - i),
        bandwidth: 0,
      }));
    }

    const now = Math.floor(Date.now() / 1000);
    const result: { time: number; bandwidth: number }[] = [];

    // Get the last 60 seconds
    for (let i = 59; i >= 0; i--) {
      const targetTime = now - i;
      const point = data.find((d) => d.timestamp === targetTime);
      result.push({
        time: targetTime,
        bandwidth: point ? point.bytes_sent + point.bytes_received : 0,
      });
    }

    return result;
  }, [data]);

  const maxBandwidth = React.useMemo(() => {
    return Math.max(...chartData.map((d) => d.bandwidth), 1);
  }, [chartData]);

  const currentBandwidth =
    externalBandwidth ?? chartData[chartData.length - 1]?.bandwidth ?? 0;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B/s";
    if (bytes < 1024) return `${bytes} B/s`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB/s`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB/s`;
  };

  const pathData = React.useMemo(() => {
    if (chartData.length === 0) {
      return { line: "", area: "", lastY: 18 };
    }

    const points = chartData.map((point, index) => {
      const x =
        chartData.length === 1 ? 100 : (index / (chartData.length - 1)) * 100;
      const ratio = Math.min(1, Math.max(0, point.bandwidth / maxBandwidth));
      const y = 18 - ratio * 16;
      return { x, y };
    });

    const line = points
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
      )
      .join(" ");
    const area = `${line} L 100 20 L 0 20 Z`;
    const lastY = points[points.length - 1]?.y ?? 18;

    return { line, area, lastY };
  }, [chartData, maxBandwidth]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-1.5 px-2 rounded cursor-pointer hover:bg-accent/50 transition-colors min-w-[120px] border-none bg-transparent",
        className,
      )}
    >
      <div className="flex-1 h-3 pointer-events-none">
        <svg
          viewBox="0 0 100 20"
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          aria-hidden="true"
        >
          <path
            d="M 0 19 H 100"
            fill="none"
            stroke="var(--border)"
            strokeWidth="0.75"
            opacity="0.55"
          />
          <path d={pathData.area} fill="var(--chart-1)" opacity="0.18" />
          <path
            d={pathData.line}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle cx="100" cy={pathData.lastY} r="1.8" fill="var(--chart-1)" />
        </svg>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] text-right">
        {formatBytes(currentBandwidth)}
      </span>
    </button>
  );
}
