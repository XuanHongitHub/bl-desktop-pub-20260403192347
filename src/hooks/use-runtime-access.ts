"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useState } from "react";
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

export function useRuntimeAccess(): UseRuntimeAccessResult {
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(
    null,
  );
  const [runtimeConfig, setRuntimeConfig] =
    useState<RuntimeConfigStatus | null>(null);
  const [featureAccess, setFeatureAccess] =
    useState<FeatureAccessSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
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
    } catch {
      // Keep app usable in self-host mode if runtime commands fail temporarily.
      setEntitlement(null);
      setRuntimeConfig(null);
      setFeatureAccess({
        pro_features: true,
        extension_management: true,
        cookie_management: true,
        fingerprint_editing: true,
        cross_os_spoofing: true,
        sync_encryption: true,
        read_only: false,
      });
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
  }, [refresh]);

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
