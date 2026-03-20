"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EntitlementSnapshot, RuntimeConfigStatus } from "@/types";

interface UseRuntimeAccessResult {
  entitlement: EntitlementSnapshot | null;
  runtimeConfig: RuntimeConfigStatus | null;
  isReadOnly: boolean;
  isLoading: boolean;
}

export function useRuntimeAccess(): UseRuntimeAccessResult {
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(
    null,
  );
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfigStatus | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [entitlementSnapshot, configStatus] = await Promise.all([
        invoke<EntitlementSnapshot>("get_entitlement_state"),
        invoke<RuntimeConfigStatus>("get_runtime_config_status"),
      ]);
      setEntitlement(entitlementSnapshot);
      setRuntimeConfig(configStatus);
    } catch {
      // Keep app usable on command failures and fallback to permissive defaults.
      setEntitlement(null);
      setRuntimeConfig(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const unlisten = listen<EntitlementSnapshot>(
      "entitlement-state-changed",
      (event) => {
        setEntitlement(event.payload);
      },
    );

    return () => {
      void unlisten.then((dispose) => {
        dispose();
      });
    };
  }, [refresh]);

  const isReadOnly = useMemo(
    () => entitlement?.state === "read_only",
    [entitlement],
  );

  return {
    entitlement,
    runtimeConfig,
    isReadOnly,
    isLoading,
  };
}
