import { useCallback, useEffect, useMemo, useState } from "react";

export type PersistentOperationStatus =
  | "idle"
  | "running"
  | "success"
  | "partial"
  | "error"
  | "interrupted";

export interface PersistentOperationProgress {
  operationId: string;
  label: string;
  status: PersistentOperationStatus;
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  message?: string;
  startedAt: string;
  updatedAt: string;
}

interface UsePersistentOperationProgressOptions {
  storageKey?: string;
  staleAfterMs?: number;
  initialProgress?: PersistentOperationProgress | null;
}

const DEFAULT_STALE_AFTER_MS = 30_000;

function nowIso(): string {
  return new Date().toISOString();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseStoredProgress(
  rawValue: string | null,
): PersistentOperationProgress | null {
  if (!rawValue) {
    return null;
  }
  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistentOperationProgress>;
    if (
      !parsed ||
      typeof parsed.operationId !== "string" ||
      typeof parsed.label !== "string" ||
      typeof parsed.status !== "string" ||
      typeof parsed.total !== "number"
    ) {
      return null;
    }
    return {
      operationId: parsed.operationId,
      label: parsed.label,
      status: parsed.status as PersistentOperationStatus,
      total: Math.max(0, Math.round(parsed.total)),
      processed: Math.max(0, Math.round(parsed.processed ?? 0)),
      success: Math.max(0, Math.round(parsed.success ?? 0)),
      failed: Math.max(0, Math.round(parsed.failed ?? 0)),
      skipped: Math.max(0, Math.round(parsed.skipped ?? 0)),
      message: typeof parsed.message === "string" ? parsed.message : undefined,
      startedAt:
        typeof parsed.startedAt === "string" ? parsed.startedAt : nowIso(),
      updatedAt:
        typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
    };
  } catch {
    return null;
  }
}

export function usePersistentOperationProgress(
  options: UsePersistentOperationProgressOptions,
) {
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_STALE_AFTER_MS;

  const [progress, setProgress] = useState<PersistentOperationProgress | null>(
    () => {
      if (options.initialProgress) {
        return options.initialProgress;
      }
      if (typeof window === "undefined" || !options.storageKey?.trim()) {
        return null;
      }
      return parseStoredProgress(
        window.localStorage.getItem(options.storageKey),
      );
    },
  );

  useEffect(() => {
    if (typeof window === "undefined" || !options.storageKey?.trim()) {
      return;
    }
    const next = parseStoredProgress(
      window.localStorage.getItem(options.storageKey),
    );
    setProgress(next);
  }, [options.storageKey]);

  useEffect(() => {
    if (!options.initialProgress) {
      return;
    }
    setProgress((current) => {
      if (!current) {
        return options.initialProgress ?? null;
      }
      const currentUpdatedAt = Date.parse(current.updatedAt);
      const incomingUpdatedAt = Date.parse(
        options.initialProgress?.updatedAt ?? "",
      );
      if (
        Number.isFinite(currentUpdatedAt) &&
        Number.isFinite(incomingUpdatedAt) &&
        incomingUpdatedAt < currentUpdatedAt
      ) {
        return current;
      }
      return options.initialProgress ?? null;
    });
  }, [options.initialProgress]);

  useEffect(() => {
    if (typeof window === "undefined" || !options.storageKey?.trim()) {
      return;
    }
    if (!progress) {
      window.localStorage.removeItem(options.storageKey);
      return;
    }
    window.localStorage.setItem(options.storageKey, JSON.stringify(progress));
  }, [options.storageKey, progress]);

  useEffect(() => {
    if (!progress || progress.status !== "running") {
      return;
    }
    const updatedAtMs = Date.parse(progress.updatedAt);
    if (!Number.isFinite(updatedAtMs)) {
      return;
    }
    if (Date.now() - updatedAtMs <= staleAfterMs) {
      return;
    }
    setProgress((current) =>
      current && current.status === "running"
        ? {
            ...current,
            status: "interrupted",
            message: current.message || "interrupted",
            updatedAt: nowIso(),
          }
        : current,
    );
  }, [progress, staleAfterMs]);

  const begin = useCallback(
    (input: { label: string; total: number; message?: string }) => {
      const timestamp = nowIso();
      setProgress({
        operationId: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        label: input.label,
        status: "running",
        total: Math.max(0, Math.round(input.total)),
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        message: input.message,
        startedAt: timestamp,
        updatedAt: timestamp,
      });
    },
    [],
  );

  const patch = useCallback(
    (input: {
      processedDelta?: number;
      successDelta?: number;
      failedDelta?: number;
      skippedDelta?: number;
      message?: string;
      status?: PersistentOperationStatus;
    }) => {
      setProgress((current) => {
        if (!current) {
          return current;
        }
        const processed = clamp(
          current.processed +
            Math.max(0, Math.round(input.processedDelta ?? 0)),
          0,
          current.total,
        );
        return {
          ...current,
          processed,
          success: Math.max(
            0,
            current.success + Math.round(input.successDelta ?? 0),
          ),
          failed: Math.max(
            0,
            current.failed + Math.round(input.failedDelta ?? 0),
          ),
          skipped: Math.max(
            0,
            current.skipped + Math.round(input.skippedDelta ?? 0),
          ),
          message: input.message ?? current.message,
          status: input.status ?? current.status,
          updatedAt: nowIso(),
        };
      });
    },
    [],
  );

  const finish = useCallback(
    (input?: { status?: PersistentOperationStatus; message?: string }) => {
      setProgress((current) => {
        if (!current) {
          return current;
        }
        const status = input?.status
          ? input.status
          : current.failed > 0 || current.skipped > 0
            ? "partial"
            : "success";
        return {
          ...current,
          processed: current.total,
          status,
          message: input?.message ?? current.message,
          updatedAt: nowIso(),
        };
      });
    },
    [],
  );

  const clear = useCallback(() => {
    setProgress(null);
  }, []);

  const hydrate = useCallback((input: PersistentOperationProgress | null) => {
    setProgress((current) => {
      if (!input) {
        return current?.status === "running" ? current : null;
      }
      if (!current) {
        return input;
      }
      const currentUpdatedAt = Date.parse(current.updatedAt);
      const incomingUpdatedAt = Date.parse(input.updatedAt);
      if (
        Number.isFinite(currentUpdatedAt) &&
        Number.isFinite(incomingUpdatedAt) &&
        incomingUpdatedAt < currentUpdatedAt
      ) {
        return current;
      }
      return input;
    });
  }, []);

  const percent = useMemo(() => {
    if (!progress || progress.total <= 0) {
      return 0;
    }
    return Math.round((progress.processed / progress.total) * 100);
  }, [progress]);

  return {
    progress,
    percent,
    begin,
    patch,
    finish,
    clear,
    hydrate,
  };
}
