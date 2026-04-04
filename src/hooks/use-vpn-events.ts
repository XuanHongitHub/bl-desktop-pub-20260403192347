import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { invalidateInvokeCache, invokeCached } from "@/lib/ipc-query-cache";
import {
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { VpnConfig } from "@/types";

const LIST_BROWSER_PROFILES_CACHE_KEY = "list_browser_profiles_light";
const VPN_CONFIGS_CACHE_KEY = "list_vpn_configs";
const VPN_CACHE_TTL_MS = 3_000;

interface UseVpnEventsOptions {
  enabled?: boolean;
  includeUsage?: boolean;
}

/**
 * Custom hook to manage VPN-related state and listen for backend events.
 * This hook eliminates the need for manual UI refreshes by automatically
 * updating state when the backend emits VPN change events.
 */
export function useVpnEvents(options: UseVpnEventsOptions = {}) {
  const { enabled = true, includeUsage = true } = options;
  const [vpnConfigs, setVpnConfigs] = useState<VpnConfig[]>([]);
  const [vpnUsage, setVpnUsage] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const loadVpnUsageInFlightRef = useRef<Promise<void> | null>(null);
  const loadVpnConfigsInFlightRef = useRef<Promise<void> | null>(null);

  const loadVpnUsage = useCallback(async () => {
    if (!includeUsage) {
      setVpnUsage({});
      return;
    }
    if (loadVpnUsageInFlightRef.current) {
      return loadVpnUsageInFlightRef.current;
    }
    const task = (async () => {
      try {
        const profiles = await invokeCached<
          Array<{ id: string; vpn_id?: string }>
        >("list_browser_profiles_light", undefined, {
          key: LIST_BROWSER_PROFILES_CACHE_KEY,
          ttlMs: VPN_CACHE_TTL_MS,
        });
        const scope = getCurrentDataScope();
        const scopedProfiles = scopeEntitiesForContext(
          "profiles",
          profiles,
          (profile) => profile.id,
          scope,
        );
        const counts: Record<string, number> = {};
        for (const p of scopedProfiles) {
          if (p.vpn_id) counts[p.vpn_id] = (counts[p.vpn_id] ?? 0) + 1;
        }
        setVpnUsage(counts);
      } catch (err) {
        console.error("Failed to load VPN usage:", err);
      } finally {
        loadVpnUsageInFlightRef.current = null;
      }
    })();
    loadVpnUsageInFlightRef.current = task;
    return task;
  }, [includeUsage]);

  const loadVpnConfigs = useCallback(async () => {
    if (loadVpnConfigsInFlightRef.current) {
      return loadVpnConfigsInFlightRef.current;
    }
    const task = (async () => {
      try {
        const configs = await invokeCached<VpnConfig[]>(
          "list_vpn_configs",
          undefined,
          {
            key: VPN_CONFIGS_CACHE_KEY,
            ttlMs: VPN_CACHE_TTL_MS,
          },
        );
        const scope = getCurrentDataScope();
        const scopedConfigs = scopeEntitiesForContext(
          "vpns",
          configs,
          (config) => config.id,
          scope,
        );
        setVpnConfigs(scopedConfigs);
        if (includeUsage) {
          await loadVpnUsage();
        } else {
          setVpnUsage({});
        }
        setError(null);
      } catch (err: unknown) {
        console.error("Failed to load VPN configs:", err);
        setError(`Failed to load VPN configs: ${JSON.stringify(err)}`);
      } finally {
        loadVpnConfigsInFlightRef.current = null;
      }
    })();
    loadVpnConfigsInFlightRef.current = task;
    return task;
  }, [includeUsage, loadVpnUsage]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setVpnConfigs([]);
      setVpnUsage({});
      setIsLoading(false);
      return;
    }

    let vpnConfigsUnlisten: (() => void) | undefined;
    let profilesUnlisten: (() => void) | undefined;
    setIsLoading(true);
    const handleScopeChanged = () => {
      invalidateInvokeCache(VPN_CONFIGS_CACHE_KEY);
      invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
      void loadVpnConfigs();
    };

    const setupListeners = async () => {
      try {
        await loadVpnConfigs();

        vpnConfigsUnlisten = await listen("vpn-configs-changed", () => {
          invalidateInvokeCache(VPN_CONFIGS_CACHE_KEY);
          void loadVpnConfigs();
        });

        // Debounce to coalesce rapid profile-change events.
        if (includeUsage) {
          let vpnProfilesTimer: ReturnType<typeof setTimeout> | null = null;
          profilesUnlisten = await listen("profiles-changed", () => {
            if (vpnProfilesTimer) clearTimeout(vpnProfilesTimer);
            vpnProfilesTimer = setTimeout(() => {
              vpnProfilesTimer = null;
              invalidateInvokeCache(LIST_BROWSER_PROFILES_CACHE_KEY);
              void loadVpnUsage();
            }, 300);
          });
        }
      } catch (err) {
        console.error("Failed to setup VPN event listeners:", err);
        setError(`Failed to setup VPN event listeners: ${JSON.stringify(err)}`);
      } finally {
        setIsLoading(false);
      }
    };

    void setupListeners();
    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);

    return () => {
      if (vpnConfigsUnlisten) vpnConfigsUnlisten();
      if (profilesUnlisten) profilesUnlisten();
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [enabled, includeUsage, loadVpnConfigs, loadVpnUsage]);

  return {
    vpnConfigs,
    vpnUsage,
    isLoading,
    error,
    loadVpnConfigs,
    clearError,
  };
}
