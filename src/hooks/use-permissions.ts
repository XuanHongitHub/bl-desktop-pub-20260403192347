import { useCallback, useEffect, useState } from "react";

let macOSPermissions:
  | typeof import("tauri-plugin-macos-permissions-api")
  | null = null;

const PERMISSION_STATUS_POLL_MS = 30_000;
const REQUEST_STATUS_MAX_ATTEMPTS = 10;
const REQUEST_STATUS_RETRY_MS = 1_000;

type PlatformName = "macos" | "windows" | "linux" | "unknown";

type PermissionSnapshot = {
  currentPlatform: PlatformName | null;
  isMicrophoneAccessGranted: boolean;
  isCameraAccessGranted: boolean;
  isInitialized: boolean;
};

const DEFAULT_PERMISSION_SNAPSHOT: PermissionSnapshot = {
  currentPlatform: null,
  isMicrophoneAccessGranted: false,
  isCameraAccessGranted: false,
  isInitialized: false,
};

let permissionSnapshot: PermissionSnapshot = DEFAULT_PERMISSION_SNAPSHOT;
let platformPromise: Promise<PlatformName> | null = null;
let refreshPermissionsInFlight: Promise<void> | null = null;
let sharedWatcherInterval: number | null = null;
let activeHookCount = 0;

const permissionListeners = new Set<(snapshot: PermissionSnapshot) => void>();

const emitPermissionSnapshot = () => {
  permissionListeners.forEach((listener) => listener(permissionSnapshot));
};

const updatePermissionSnapshot = (nextSnapshot: PermissionSnapshot) => {
  const didChange =
    permissionSnapshot.currentPlatform !== nextSnapshot.currentPlatform ||
    permissionSnapshot.isMicrophoneAccessGranted !==
      nextSnapshot.isMicrophoneAccessGranted ||
    permissionSnapshot.isCameraAccessGranted !==
      nextSnapshot.isCameraAccessGranted ||
    permissionSnapshot.isInitialized !== nextSnapshot.isInitialized;

  if (!didChange) {
    return;
  }

  permissionSnapshot = nextSnapshot;
  emitPermissionSnapshot();
};

const loadMacOSPermissions = async () => {
  if (macOSPermissions) return macOSPermissions;

  try {
    macOSPermissions = await import("tauri-plugin-macos-permissions-api");
    return macOSPermissions;
  } catch (error) {
    console.warn("Failed to load macOS permissions API:", error);
    return null;
  }
};

const detectPlatform = async (): Promise<PlatformName> => {
  if (platformPromise) {
    return platformPromise;
  }

  platformPromise = Promise.resolve().then(() => {
    try {
      const userAgent = navigator.userAgent;
      if (userAgent.includes("Mac")) {
        return "macos";
      }
      if (userAgent.includes("Win")) {
        return "windows";
      }
      if (userAgent.includes("Linux")) {
        return "linux";
      }
      return "unknown";
    } catch (error) {
      console.error("Failed to detect platform:", error);
      return "unknown";
    }
  });

  return platformPromise;
};

const refreshPermissions = async () => {
  if (refreshPermissionsInFlight) {
    return refreshPermissionsInFlight;
  }

  refreshPermissionsInFlight = (async () => {
    const currentPlatform = await detectPlatform();

    if (currentPlatform !== "macos") {
      updatePermissionSnapshot({
        currentPlatform,
        isMicrophoneAccessGranted: true,
        isCameraAccessGranted: true,
        isInitialized: true,
      });
      return;
    }

    try {
      const permissions = await loadMacOSPermissions();
      if (!permissions) {
        updatePermissionSnapshot({
          currentPlatform,
          isMicrophoneAccessGranted: false,
          isCameraAccessGranted: false,
          isInitialized: true,
        });
        return;
      }

      const [micGranted, camGranted] = await Promise.all([
        permissions.checkMicrophonePermission(),
        permissions.checkCameraPermission(),
      ]);

      updatePermissionSnapshot({
        currentPlatform,
        isMicrophoneAccessGranted: micGranted,
        isCameraAccessGranted: camGranted,
        isInitialized: true,
      });
    } catch (error) {
      console.error("Failed to check permissions on macOS:", error);
      updatePermissionSnapshot({
        currentPlatform,
        isMicrophoneAccessGranted: permissionSnapshot.isMicrophoneAccessGranted,
        isCameraAccessGranted: permissionSnapshot.isCameraAccessGranted,
        isInitialized: true,
      });
    }
  })().finally(() => {
    refreshPermissionsInFlight = null;
  });

  return refreshPermissionsInFlight;
};

const handleWindowFocus = () => {
  void refreshPermissions();
};

const handleVisibilityChange = () => {
  if (document.visibilityState !== "visible") {
    return;
  }
  void refreshPermissions();
};

const startSharedWatcher = async () => {
  if (typeof window === "undefined") {
    return;
  }

  const platform = await detectPlatform();
  if (activeHookCount <= 0) {
    return;
  }

  window.addEventListener("focus", handleWindowFocus);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (platform === "macos" && sharedWatcherInterval === null) {
    sharedWatcherInterval = window.setInterval(() => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void refreshPermissions();
    }, PERMISSION_STATUS_POLL_MS);
  }
};

const stopSharedWatcher = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.removeEventListener("focus", handleWindowFocus);
  document.removeEventListener("visibilitychange", handleVisibilityChange);

  if (sharedWatcherInterval) {
    clearInterval(sharedWatcherInterval);
    sharedWatcherInterval = null;
  }
};

export type PermissionType = "microphone" | "camera";

interface UsePermissionsReturn {
  requestPermission: (type: PermissionType) => Promise<void>;
  isMicrophoneAccessGranted: boolean;
  isCameraAccessGranted: boolean;
  isInitialized: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const [snapshot, setSnapshot] = useState<PermissionSnapshot>(permissionSnapshot);

  useEffect(() => {
    const handleSnapshotChange = (nextSnapshot: PermissionSnapshot) => {
      setSnapshot(nextSnapshot);
    };

    permissionListeners.add(handleSnapshotChange);
    activeHookCount += 1;
    handleSnapshotChange(permissionSnapshot);
    void refreshPermissions();

    if (activeHookCount === 1) {
      void startSharedWatcher();
    }

    return () => {
      permissionListeners.delete(handleSnapshotChange);
      activeHookCount = Math.max(0, activeHookCount - 1);
      if (activeHookCount === 0) {
        stopSharedWatcher();
      }
    };
  }, []);

  const requestPermission = useCallback(
    async (type: PermissionType): Promise<void> => {
      const currentPlatform = await detectPlatform();
      if (currentPlatform !== "macos") {
        return;
      }

      try {
        const permissions = await loadMacOSPermissions();
        if (!permissions) {
          return;
        }

        if (type === "microphone") {
          await permissions.requestMicrophonePermission();
        } else {
          await permissions.requestCameraPermission();
        }

        for (let attempt = 0; attempt < REQUEST_STATUS_MAX_ATTEMPTS; attempt += 1) {
          await refreshPermissions();
          const isGranted =
            type === "microphone"
              ? permissionSnapshot.isMicrophoneAccessGranted
              : permissionSnapshot.isCameraAccessGranted;
          if (isGranted) {
            return;
          }
          await new Promise((resolve) =>
            window.setTimeout(resolve, REQUEST_STATUS_RETRY_MS),
          );
        }
      } catch (error) {
        console.error(`Failed to request ${type} permission on macOS:`, error);
      }
    },
    [],
  );

  return {
    requestPermission,
    isMicrophoneAccessGranted: snapshot.isMicrophoneAccessGranted,
    isCameraAccessGranted: snapshot.isCameraAccessGranted,
    isInitialized: snapshot.isInitialized,
  };
}
