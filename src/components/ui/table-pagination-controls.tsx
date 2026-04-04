"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface TablePaginationControlsProps {
  totalRows: number;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  pageSizeOptions?: number[];
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onPageSizeChange: (nextPageSize: number) => void;
  summaryLabel: string;
  pageLabel: string;
  rowsPerPageLabel: string;
  previousLabel: string;
  nextLabel: string;
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function TablePaginationControls({
  totalRows,
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  canPreviousPage,
  canNextPage,
  onPreviousPage,
  onNextPage,
  onPageSizeChange,
  summaryLabel,
  pageLabel,
  rowsPerPageLabel,
  previousLabel,
  nextLabel,
  className,
}: TablePaginationControlsProps) {
  const safePageCount = Math.max(pageCount, 0);
  const safePageDisplay = safePageCount > 0 ? pageIndex + 1 : 0;

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-card px-3 py-2",
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">{summaryLabel}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {rowsPerPageLabel}
          </span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => {
              const parsed = Number(value);
              if (Number.isFinite(parsed) && parsed > 0) {
                onPageSizeChange(parsed);
              }
            }}
          >
            <SelectTrigger className="h-8 w-[92px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-xs text-muted-foreground">
          {pageLabel} {safePageDisplay}/{safePageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={onPreviousPage}
          disabled={!canPreviousPage || totalRows === 0}
        >
          {previousLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={onNextPage}
          disabled={!canNextPage || totalRows === 0}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
