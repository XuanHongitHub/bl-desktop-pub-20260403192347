import { invoke } from "@tauri-apps/api/core";

interface CacheEntry<T> {
  value?: T;
  expiresAt: number;
  inFlight?: Promise<T>;
}

interface InvokeCachedOptions {
  key?: string;
  ttlMs?: number;
  force?: boolean;
}

const DEFAULT_TTL_MS = 2_500;
const queryCache = new Map<string, CacheEntry<unknown>>();

function resolveCacheKey(command: string, args: unknown, key?: string): string {
  if (key && key.trim().length > 0) {
    return key;
  }
  if (!args) {
    return command;
  }
  try {
    return `${command}:${JSON.stringify(args)}`;
  } catch {
    return command;
  }
}

export async function invokeCached<T>(
  command: string,
  args?: Record<string, unknown>,
  options: InvokeCachedOptions = {},
): Promise<T> {
  const ttlMs =
    typeof options.ttlMs === "number" && options.ttlMs > 0
      ? options.ttlMs
      : DEFAULT_TTL_MS;
  const cacheKey = resolveCacheKey(command, args, options.key);
  const now = Date.now();
  const existingEntry = queryCache.get(cacheKey) as CacheEntry<T> | undefined;

  if (!options.force && existingEntry?.inFlight) {
    return existingEntry.inFlight;
  }

  if (
    !options.force &&
    existingEntry &&
    typeof existingEntry.value !== "undefined" &&
    existingEntry.expiresAt > now
  ) {
    return existingEntry.value;
  }

  const nextEntry: CacheEntry<T> = {
    value: existingEntry?.value,
    expiresAt: existingEntry?.expiresAt ?? 0,
  };

  const inFlight = invoke<T>(command, args ?? {})
    .then((result) => {
      nextEntry.value = result;
      nextEntry.expiresAt = Date.now() + ttlMs;
      delete nextEntry.inFlight;
      queryCache.set(cacheKey, nextEntry as CacheEntry<unknown>);
      return result;
    })
    .catch((error) => {
      delete nextEntry.inFlight;
      if (
        typeof nextEntry.value !== "undefined" &&
        nextEntry.expiresAt > Date.now()
      ) {
        queryCache.set(cacheKey, nextEntry as CacheEntry<unknown>);
      } else {
        queryCache.delete(cacheKey);
      }
      throw error;
    });

  nextEntry.inFlight = inFlight;
  queryCache.set(cacheKey, nextEntry as CacheEntry<unknown>);

  return inFlight;
}

export function invalidateInvokeCache(key: string): void {
  if (!key.trim()) {
    return;
  }
  queryCache.delete(key);
}

export function invalidateInvokeCacheByPrefix(prefix: string): void {
  if (!prefix.trim()) {
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
    }
  }
}

export function clearInvokeCache(): void {
  queryCache.clear();
}
