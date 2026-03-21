"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LuEye, LuEyeOff } from "react-icons/lu";
import { LoadingButton } from "@/components/loading-button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { SyncSettings } from "@/types";

interface SyncConfigDialogProps {
  isOpen: boolean;
  onClose: (loginOccurred?: boolean) => void;
}

export function SyncConfigDialog({ isOpen, onClose }: SyncConfigDialogProps) {
  const { t } = useTranslation();
  const [serverUrl, setServerUrl] = useState("");
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "unknown" | "testing" | "connected" | "error"
  >("unknown");

  const connectionStatusLabel =
    connectionStatus === "connected"
      ? t("sync.status.connected")
      : connectionStatus === "testing"
        ? t("sync.status.syncing")
        : connectionStatus === "error"
          ? t("sync.status.disconnected")
          : t("sync.statusUnknown");

  const connectionStatusVariant =
    connectionStatus === "connected"
      ? "default"
      : connectionStatus === "error"
        ? "destructive"
        : connectionStatus === "testing"
          ? "secondary"
          : "outline";

  const testConnection = useCallback(async (url: string) => {
    setConnectionStatus("testing");
    try {
      const healthUrl = `${url.replace(/\/$/, "")}/health`;
      const response = await fetch(healthUrl);
      setConnectionStatus(response.ok ? "connected" : "error");
    } catch {
      setConnectionStatus("error");
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const settings = await invoke<SyncSettings>("get_sync_settings");
      setServerUrl(settings.sync_server_url || "");
      setToken(settings.sync_token || "");
      if (settings.sync_server_url && settings.sync_token) {
        void testConnection(settings.sync_server_url);
      }
    } catch (error) {
      showErrorToast(t("sync.loadSettingsFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [t, testConnection]);

  useEffect(() => {
    if (!isOpen) return;
    setConnectionStatus("unknown");
    void loadSettings();
  }, [isOpen, loadSettings]);

  const handleTestConnection = useCallback(async () => {
    if (!serverUrl) {
      showErrorToast(t("sync.serverUrlRequired"));
      return;
    }

    setIsTesting(true);
    setConnectionStatus("testing");
    try {
      const healthUrl = `${serverUrl.replace(/\/$/, "")}/health`;
      const response = await fetch(healthUrl);
      if (response.ok) {
        setConnectionStatus("connected");
        showSuccessToast(t("sync.connectionSuccess"));
      } else {
        setConnectionStatus("error");
        showErrorToast(t("sync.connectionErrorStatus"));
      }
    } catch {
      setConnectionStatus("error");
      showErrorToast(t("sync.connectionFailed"));
    } finally {
      setIsTesting(false);
    }
  }, [serverUrl, t]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await invoke<SyncSettings>("save_sync_settings", {
        syncServerUrl: serverUrl || null,
        syncToken: token || null,
      });
      try {
        await invoke("restart_sync_service");
      } catch (error) {
        showErrorToast(t("sync.restartFailed"), {
          description: extractRootError(error),
        });
      }
      showSuccessToast(t("sync.settingsSaved"));
      onClose();
    } catch (error) {
      showErrorToast(t("sync.settingsSaveFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSaving(false);
    }
  }, [onClose, serverUrl, t, token]);

  const handleDisconnect = useCallback(async () => {
    setIsSaving(true);
    try {
      await invoke<SyncSettings>("save_sync_settings", {
        syncServerUrl: null,
        syncToken: null,
      });
      try {
        await invoke("restart_sync_service");
      } catch (error) {
        showErrorToast(t("sync.restartFailed"), {
          description: extractRootError(error),
        });
      }
      setServerUrl("");
      setToken("");
      setConnectionStatus("unknown");
      showSuccessToast(t("sync.disconnectSuccess"));
    } catch (error) {
      showErrorToast(t("sync.disconnectFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSaving(false);
    }
  }, [t]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sync.title")}</DialogTitle>
          <DialogDescription>
            {t("sync.selfHostedDescription")}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 rounded-full border-2 border-current animate-spin border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between rounded-md border border-border bg-muted px-3 py-2">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {t("sync.statusTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("sync.statusHint")}
                  </p>
                </div>
                <Badge variant={connectionStatusVariant}>{connectionStatusLabel}</Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync-server-url">{t("sync.serverUrl")}</Label>
                <Input
                  id="sync-server-url"
                  placeholder={t("sync.serverUrlPlaceholder")}
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {t("sync.serverUrlHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sync-token">{t("sync.token")}</Label>
                <div className="relative">
                  <Input
                    id="sync-token"
                    type={showToken ? "text" : "password"}
                    placeholder={t("sync.tokenPlaceholder")}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-10"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 p-1 rounded-sm transition-colors transform -translate-y-1/2 hover:bg-accent"
                        aria-label={
                          showToken ? t("sync.hideToken") : t("sync.showToken")
                        }
                      >
                        {showToken ? (
                          <LuEyeOff className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        ) : (
                          <LuEye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {showToken ? t("sync.hideToken") : t("sync.showToken")}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("sync.tokenHint")}
                </p>
              </div>

              {connectionStatus === "testing" && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <div className="w-4 h-4 rounded-full border-2 border-current animate-spin border-t-transparent" />
                  {t("sync.status.syncing")}
                </div>
              )}
              {connectionStatus === "connected" && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full border border-border bg-muted" />
                  {t("sync.status.connected")}
                </div>
              )}
              {connectionStatus === "error" && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full border border-border bg-muted" />
                  {t("sync.status.disconnected")}
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 justify-between">
              <div className="flex gap-2">
                <LoadingButton
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                  disabled={!serverUrl}
                  variant="outline"
                >
                  {isTesting ? t("sync.testing") : t("sync.test")}
                </LoadingButton>
                {(serverUrl || token) && (
                  <LoadingButton
                    variant="outline"
                    onClick={handleDisconnect}
                    isLoading={isSaving}
                  >
                    {t("sync.disconnect")}
                  </LoadingButton>
                )}
              </div>
              <LoadingButton onClick={handleSave} isLoading={isSaving}>
                {t("common.buttons.save")}
              </LoadingButton>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
