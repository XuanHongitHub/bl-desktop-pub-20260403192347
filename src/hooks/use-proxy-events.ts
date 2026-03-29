import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractRootError } from "@/lib/error-utils";
import { invalidateInvokeCache, invokeCached } from "@/lib/ipc-query-cache";
import {
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { StoredProxy } from "@/types";

const LIST_BROWSER_PROFILES_CACHE_KEY = "list_browser_profiles_light";
const STORED_PROXIES_CACHE_KEY = "get_stored_proxies";
const PROXY_CACHE_TTL_MS = 3_000;

interface UseProxyEventsOptions {
  enabled?: boolean;
  includeUsage?: boolean;
}

/**
 * Custom hook to manage proxy-related state and listen for backend events.
 * This hook eliminates the need for manual UI refreshes by automatically
 * updating state when the backend emits proxy change events.
 */
export function useProxyEvents(options: UseProxyEventsOptions = {}) {
  const { enabled = true, includeUsage = true } = options;
  const [storedProxies, setStoredProxies] = useState<StoredProxy[]>([]);
  const [proxyUsage, setProxyUsage] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const loadProxyUsageInFlightRef = useRef<Promise<void> | null>(null);
  const loadProxiesInFlightRef = useRef<Promise<void> | null>(null);

  // Load proxy usage (how many profiles are using each proxy)
  const loadProxyUsage = useCallback(async () => {
    if (!includeUsage) {
      setProxyUsage({});
      return;
    }
    if (loadProxyUsageInFlightRef.current) {
      return loadProxyUsageInFlightRef.current;
    }
    const task = (async () => {
      try {
        const profiles = await invokeCached<
          Array<{ id: string; proxy_id?: string }>
        >(
          "list_browser_profiles_light",
          undefined,
          {
            key: LIST_BROWSER_PROFILES_CACHE_KEY,
            ttlMs: PROXY_CACHE_TTL_MS,
          },
        );
        const scope = getCurrentDataScope();
        const scopedProfiles = scopeEntitiesForContext(
          "profiles",
          profiles,
          (profile) => profile.id,
          scope,
        );
        const counts: Record<string, number> = {};
        for (const p of scopedProfiles) {
          if (p.proxy_id) counts[p.proxy_id] = (counts[p.proxy_id] ?? 0) + 1;
        }
        setProxyUsage(counts);
      } catch (err) {
        console.error("Failed to load proxy usage:", err);
        // Don't set error for non-critical proxy usage
      } finally {
        loadProxyUsageInFlightRef.current = null;
      }
    })();
    loadProxyUsageInFlightRef.current = task;
    return task;
  }, [includeUsage]);

  // Load proxies from backend
  const loadProxies = useCallback(async () => {
    if (loadProxiesInFlightRef.current) {
      return loadProxiesInFlightRef.current;
    }
    const task = (async () => {
      try {
        const stored = await invokeCached<StoredProxy[]>(
          "get_stored_proxies",
          undefined,
          {
            key: STORED_PROXIES_CACHE_KEY,
            ttlMs: PROXY_CACHE_TTL_MS,
          },
        );
        const scope = getCurrentDataScope();
        const scopedProxies = scopeEntitiesForContext(
          "proxies",
          stored,
          (proxy) => proxy.id,
          scope,
        );
        setStoredProxies(scopedProxies);
        if (includeUsage) {
          await loadProxyUsage();
        } else {
          setProxyUsage({});
        }
        setError(null);
      } catch (err: unknown) {
        console.error("Failed to load proxies:", err);
        setError(`Failed to load proxies: ${extractRootError(err)}`);
      } finally {
        loadProxiesInFlightRef.current = null;
      }
    })();
    loadProxiesInFlightRef.current = task;
    return task;
  }, [includeUsage, loadProxyUsage]);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Initial load and event listeners setup
  useEffect(() => {
    if (!enabled) {
      setStoredProxies([]);
      setProxyUsage({});
      setIsLoading(false);
      return;
    }

    let proxiesUnlisten: (() => void) | undefined;
    let profilesUnlisten: (() => void) | undefined;
    let storedProxiesUnlisten: (() => void) | undefined;
    setIsLoading(true);
    const handleScopeChanged = () => {
      invalidateInvokeCache(STORED_PROXIES_CACHE_KEY);
      invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
      void loadProxies();
    };

    const setupListeners = async () => {
      try {
        // Initial load
        await loadProxies();

        // Listen for proxy changes (create, delete, update, start, stop, etc.)
        proxiesUnlisten = await listen("proxies-changed", () => {
          console.log("Received proxies-changed event, reloading proxies");
          invalidateInvokeCache(STORED_PROXIES_CACHE_KEY);
          void loadProxies();
        });

        // Listen for profile changes to update proxy usage counts.
        // Debounce to coalesce rapid events.
        if (includeUsage) {
          let proxyProfilesTimer: ReturnType<typeof setTimeout> | null = null;
          profilesUnlisten = await listen("profiles-changed", () => {
            if (proxyProfilesTimer) clearTimeout(proxyProfilesTimer);
            proxyProfilesTimer = setTimeout(() => {
              proxyProfilesTimer = null;
              invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
              void loadProxyUsage();
            }, 300);
          });
        }

        // Listen for profile updates to update proxy usage counts
        storedProxiesUnlisten = await listen("stored-proxies-changed", () => {
          console.log(
            "Received stored-proxies-changed event, reloading proxies",
          );
          invalidateInvokeCache(STORED_PROXIES_CACHE_KEY);
          void loadProxies();
        });

        console.log("Proxy event listeners set up successfully");
        window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
      } catch (err) {
        console.error("Failed to setup proxy event listeners:", err);
        setError(
          `Failed to setup proxy event listeners: ${extractRootError(err)}`,
        );
      } finally {
        setIsLoading(false);
      }
    };

    void setupListeners();

    // Cleanup listeners on unmount
    return () => {
      if (proxiesUnlisten) proxiesUnlisten();
      if (profilesUnlisten) profilesUnlisten();
      if (storedProxiesUnlisten) storedProxiesUnlisten();
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [enabled, includeUsage, loadProxies, loadProxyUsage]);

  return {
    storedProxies,
    proxyUsage,
    isLoading,
    error,
    loadProxies,
    clearError,
  };
}
