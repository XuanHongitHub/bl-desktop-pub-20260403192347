"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/lib/toast-utils";
import type { AppUpdateInfo, AppUpdateProgress } from "@/types";

export function useAppUpdateNotifications() {
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] =
    useState<AppUpdateProgress | null>(null);
  const [updateReady, setUpdateReady] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);
  const autoDownloadedVersion = useRef<string | null>(null);
  const downloadInProgressVersion = useRef<string | null>(null);
  const checkInProgress = useRef(false);

  // Ensure we're on the client side to prevent hydration mismatches
  useEffect(() => {
    setIsClient(true);
  }, []);

  const downloadAndPrepareUpdate = useCallback(
    async (info: AppUpdateInfo) => {
      if (!isClient || info.manual_update_required) return;
      if (autoDownloadedVersion.current === info.new_version) return;
      if (downloadInProgressVersion.current === info.new_version) return;

      downloadInProgressVersion.current = info.new_version;
      setIsUpdating(true);
      setUpdateProgress({
        stage: "downloading",
        message: `Downloading ${info.new_version}`,
      });

      showToast({
        id: `app-update-download-${info.new_version}`,
        type: "loading",
        title: "App update found",
        description: `Downloading ${info.new_version} in background`,
        duration: 5000,
      });

      try {
        await invoke("download_and_prepare_app_update", { updateInfo: info });
        autoDownloadedVersion.current = info.new_version;
      } catch (error) {
        setIsUpdating(false);
        setUpdateProgress(null);
        showToast({
          id: `app-update-download-failed-${info.new_version}`,
          type: "error",
          title: "App update download failed",
          description: String(error),
          duration: 8000,
        });
      } finally {
        downloadInProgressVersion.current = null;
      }
    },
    [isClient],
  );

  const processUpdateInfo = useCallback(
    async (info: AppUpdateInfo | null, isManualCheck: boolean) => {
      if (!isClient) return;

      if (!info) {
        if (isManualCheck) {
          showToast({
            id: "app-update-none",
            type: "success",
            title: "No app updates available",
            description: "You are using the latest version.",
            duration: 3000,
          });
        }
        return;
      }

      if (dismissedVersion === info.new_version) {
        return;
      }

      setUpdateInfo(info);
      setUpdateReady(false);
      setUpdateProgress(null);

      if (info.manual_update_required) {
        showToast({
          id: `app-update-manual-${info.new_version}`,
          type: "success",
          title: "App update available",
          description: `${info.new_version} requires manual update from release page`,
          duration: 6000,
        });
        return;
      }

      showToast({
        id: `app-update-auto-${info.new_version}`,
        type: "loading",
        title: "App update available",
        description: `${info.current_version} -> ${info.new_version}`,
        duration: 5000,
      });

      await downloadAndPrepareUpdate(info);
    },
    [dismissedVersion, downloadAndPrepareUpdate, isClient],
  );

  const checkForAppUpdates = useCallback(async () => {
    if (!isClient || checkInProgress.current) return;
    checkInProgress.current = true;
    try {
      const info = await invoke<AppUpdateInfo | null>("check_for_app_updates");
      await processUpdateInfo(info, false);
    } catch {
      // Silent failure for background checks
    } finally {
      checkInProgress.current = false;
    }
  }, [isClient, processUpdateInfo]);

  const checkForAppUpdatesManual = useCallback(async () => {
    if (!isClient || checkInProgress.current) return;
    checkInProgress.current = true;
    autoDownloadedVersion.current = null;
    try {
      const info = await invoke<AppUpdateInfo | null>(
        "check_for_app_updates_manual",
      );
      await processUpdateInfo(info, true);
    } catch (error) {
      showToast({
        id: "app-update-manual-check-failed",
        type: "error",
        title: "Failed to check app updates",
        description: String(error),
        duration: 8000,
      });
    } finally {
      checkInProgress.current = false;
    }
  }, [isClient, processUpdateInfo]);

  const restartApplication = useCallback(async () => {
    if (!isClient || !updateReady) return;
    try {
      await invoke("restart_application");
    } catch (error) {
      showToast({
        id: "app-update-restart-failed",
        type: "error",
        title: "Failed to restart application",
        description: String(error),
        duration: 8000,
      });
    }
  }, [isClient, updateReady]);

  const dismissAppUpdate = useCallback(() => {
    if (!isClient) return;

    // Remember the dismissed version so we don't show it again
    if (updateInfo) {
      setDismissedVersion(updateInfo.new_version);
      console.log("Dismissed app update version:", updateInfo.new_version);
    }

    setUpdateInfo(null);
  }, [isClient, updateInfo]);

  // Auto-download update in background when found
  useEffect(() => {
    if (!isClient) return;

    let unlistenAvailable: (() => void) | undefined;
    let unlistenReady: (() => void) | undefined;

    const setupListeners = async () => {
      unlistenAvailable = await listen<AppUpdateInfo>(
        "app-update-available",
        (event) => {
          void processUpdateInfo(event.payload, false);
        },
      );

      unlistenReady = await listen<string>("app-update-ready", (event) => {
        const readyVersion = event.payload;
        if (dismissedVersion === readyVersion) {
          return;
        }
        setIsUpdating(false);
        setUpdateProgress({
          stage: "completed",
          message: `Update ${readyVersion} is ready`,
        });
        setUpdateReady(true);
        showToast({
          id: `app-update-ready-${readyVersion}`,
          type: "success",
          title: "App update is ready",
          description: `Version ${readyVersion} was prepared. Restart to apply.`,
          duration: 8000,
        });
      });
    };

    void setupListeners();

    return () => {
      if (unlistenAvailable) {
        unlistenAvailable();
      }
      if (unlistenReady) {
        unlistenReady();
      }
    };
  }, [dismissedVersion, isClient, processUpdateInfo]);

  // Check for app updates on startup
  useEffect(() => {
    if (!isClient) return;

    // Check for updates immediately on startup
    void checkForAppUpdates();
  }, [isClient, checkForAppUpdates]);

  return {
    updateInfo,
    isUpdating,
    updateProgress,
    updateReady,
    checkForAppUpdates,
    checkForAppUpdatesManual,
    dismissAppUpdate,
    restartApplication,
  };
}
