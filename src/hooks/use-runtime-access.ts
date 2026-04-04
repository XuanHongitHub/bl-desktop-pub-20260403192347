"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EntitlementSnapshot,
  FeatureAccessSnapshot,
  RuntimeConfigStatus,
} from "@/types";

interface UseRuntimeAccessResult {
  entitlement: EntitlementSnapshot | null;
  runtimeConfig: RuntimeConfigStatus | null;
  featureAccess: FeatureAccessSnapshot | null;
  isReadOnly: boolean;
  isLoading: boolean;
}

interface UseRuntimeAccessOptions {
  enabled?: boolean;
}

const RUNTIME_ACCESS_STORAGE_KEY = "buglogin.runtime-access.v1";
const DEFAULT_FEATURE_ACCESS: FeatureAccessSnapshot = {
  pro_features: true,
  extension_management: true,
  cookie_management: true,
  fingerprint_editing: true,
  cross_os_spoofing: true,
  sync_encryption: true,
  read_only: false,
};

function readRuntimeAccessCache(): {
  entitlement: EntitlementSnapshot | null;
  runtimeConfig: RuntimeConfigStatus | null;
  featureAccess: FeatureAccessSnapshot | null;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(RUNTIME_ACCESS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as {
      entitlement: EntitlementSnapshot | null;
      runtimeConfig: RuntimeConfigStatus | null;
      featureAccess: FeatureAccessSnapshot | null;
    };
  } catch {
    return null;
  }
}

function writeRuntimeAccessCache(input: {
  entitlement: EntitlementSnapshot | null;
  runtimeConfig: RuntimeConfigStatus | null;
  featureAccess: FeatureAccessSnapshot | null;
}) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      RUNTIME_ACCESS_STORAGE_KEY,
      JSON.stringify(input),
    );
  } catch {
    // Ignore local persistence failures.
  }
}

export function useRuntimeAccess(
  options: UseRuntimeAccessOptions = {},
): UseRuntimeAccessResult {
  const { enabled = true } = options;
  const REFRESH_DEDUP_WINDOW_MS = 1_500;
  const cachedSnapshot = readRuntimeAccessCache();
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(
    () => cachedSnapshot?.entitlement ?? null,
  );
  const [runtimeConfig, setRuntimeConfig] =
    useState<RuntimeConfigStatus | null>(() => cachedSnapshot?.runtimeConfig ?? null);
  const [featureAccess, setFeatureAccess] =
    useState<FeatureAccessSnapshot | null>(
      () => cachedSnapshot?.featureAccess ?? DEFAULT_FEATURE_ACCESS,
    );
  const [isLoading, setIsLoading] = useState(enabled && !cachedSnapshot);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const now = Date.now();
    if (now - lastRefreshAtRef.current < REFRESH_DEDUP_WINDOW_MS) {
      return;
    }

    const task = (async () => {
      try {
        const [entitlementSnapshot, configStatus, accessSnapshot] =
          await Promise.all([
            invoke<EntitlementSnapshot>("get_entitlement_state"),
            invoke<RuntimeConfigStatus>("get_runtime_config_status"),
            invoke<FeatureAccessSnapshot>("get_feature_access_snapshot"),
          ]);
        setEntitlement(entitlementSnapshot);
        setRuntimeConfig(configStatus);
        setFeatureAccess(accessSnapshot);
        writeRuntimeAccessCache({
          entitlement: entitlementSnapshot,
          runtimeConfig: configStatus,
          featureAccess: accessSnapshot,
        });
      } catch {
        // Keep app usable in self-host mode if runtime commands fail temporarily.
        setEntitlement(null);
        setRuntimeConfig(null);
        setFeatureAccess(DEFAULT_FEATURE_ACCESS);
      } finally {
        lastRefreshAtRef.current = Date.now();
        setIsLoading(false);
      }
    })();

    refreshInFlightRef.current = task;
    try {
      await task;
    } finally {
      if (refreshInFlightRef.current === task) {
        refreshInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    void refresh();

    const unlisten = listen<EntitlementSnapshot>(
      "entitlement-state-changed",
      (event) => {
        setEntitlement(event.payload);
      },
    );
    const unlistenAuthChanged = listen("cloud-auth-changed", () => {
      void refresh();
    });
    const unlistenLocalSubscriptionChanged = listen(
      "local-subscription-state-changed",
      () => {
        void refresh();
      },
    );

    return () => {
      void unlisten.then((dispose) => {
        dispose();
      });
      void unlistenAuthChanged.then((dispose) => {
        dispose();
      });
      void unlistenLocalSubscriptionChanged.then((dispose) => {
        dispose();
      });
    };
  }, [enabled, refresh]);

  const isReadOnly = useMemo(
    () => featureAccess?.read_only || entitlement?.state === "read_only",
    [entitlement, featureAccess?.read_only],
  );

  return {
    entitlement,
    runtimeConfig,
    featureAccess,
    isReadOnly,
    isLoading,
  };
}
