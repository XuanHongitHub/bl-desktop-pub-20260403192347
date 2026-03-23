"use client";

import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { TFunction } from "i18next";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoGlobe, GoPlus } from "react-icons/go";
import {
  LuClipboardPaste,
  LuDownload,
  LuPencil,
  LuTrash2,
  LuUpload,
} from "react-icons/lu";
import { DeleteConfirmationDialog } from "@/components/delete-confirmation-dialog";
import { ProxyExportDialog } from "@/components/proxy-export-dialog";
import { ProxyFormDialog } from "@/components/proxy-form-dialog";
import { ProxyImportDialog } from "@/components/proxy-import-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProxyEvents } from "@/hooks/use-proxy-events";
import { useVpnEvents } from "@/hooks/use-vpn-events";
import { formatLocaleDateTime } from "@/lib/locale-format";
import type { ProxyCheckFailureMeta } from "@/lib/proxy-check-error";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { cn } from "@/lib/utils";
import type { ProxyCheckResult, StoredProxy, VpnConfig } from "@/types";
import { FlagIcon } from "./flag-icon";
import { LocationProxyDialog } from "./location-proxy-dialog";
import { ProxyCheckButton } from "./proxy-check-button";
import { RippleButton } from "./ui/ripple";
import { VpnCheckButton } from "./vpn-check-button";
import { VpnFormDialog } from "./vpn-form-dialog";
import { VpnImportDialog } from "./vpn-import-dialog";
import { WorkspacePageShell } from "./workspace-page-shell";

type SyncStatus = "disabled" | "syncing" | "synced" | "error" | "waiting";

function getSyncStatusDot(
  t: TFunction,
  item: { sync_enabled?: boolean; last_sync?: number },
  liveStatus: SyncStatus | undefined,
): { color: string; tooltip: string; animate: boolean } {
  const status = liveStatus ?? (item.sync_enabled ? "synced" : "disabled");

  switch (status) {
    case "syncing":
      return {
        color: "bg-yellow-500",
        tooltip: t("common.status.syncing"),
        animate: true,
      };
    case "synced":
      return {
        color: "bg-green-500",
        tooltip: item.last_sync
          ? t("profiles.table.syncedAt", {
              time: formatLocaleDateTime(item.last_sync * 1000),
            })
          : t("common.status.synced"),
        animate: false,
      };
    case "waiting":
      return {
        color: "bg-yellow-500",
        tooltip: t("profiles.table.waitingToSync"),
        animate: false,
      };
    case "error":
      return {
        color: "bg-red-500",
        tooltip: t("profiles.table.syncError"),
        animate: false,
      };
    default:
      return {
        color: "bg-gray-400",
        tooltip: t("sync.mode.disabledDescription"),
        animate: false,
      };
  }
}

interface ProxyManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "dialog" | "page";
}

export function ProxyManagementDialog({
  isOpen,
  onClose,
  mode = "dialog",
}: ProxyManagementDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"proxies" | "vpns">("proxies");
  // Proxy state
  const [showProxyForm, setShowProxyForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [editingProxy, setEditingProxy] = useState<StoredProxy | null>(null);
  const [proxyToDelete, setProxyToDelete] = useState<StoredProxy | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [checkingProxyId, setCheckingProxyId] = useState<string | null>(null);
  const [proxyCheckResults, setProxyCheckResults] = useState<
    Record<string, ProxyCheckResult>
  >({});
  const [proxyCheckFailures, setProxyCheckFailures] = useState<
    Record<string, ProxyCheckFailureMeta>
  >({});
  const [proxySyncStatus, setProxySyncStatus] = useState<
    Record<string, SyncStatus>
  >({});
  const [proxyInUse, setProxyInUse] = useState<Record<string, boolean>>({});
  const [isTogglingSync, setIsTogglingSync] = useState<Record<string, boolean>>(
    {},
  );

  // VPN state
  const [showVpnForm, setShowVpnForm] = useState(false);
  const [showVpnImportDialog, setShowVpnImportDialog] = useState(false);
  const [editingVpn, setEditingVpn] = useState<VpnConfig | null>(null);
  const [vpnToDelete, setVpnToDelete] = useState<VpnConfig | null>(null);
  const [isDeletingVpn, setIsDeletingVpn] = useState(false);
  const [checkingVpnId, setCheckingVpnId] = useState<string | null>(null);
  const [vpnSyncStatus, setVpnSyncStatus] = useState<
    Record<string, SyncStatus>
  >({});
  const [vpnInUse, setVpnInUse] = useState<Record<string, boolean>>({});
  const [isTogglingVpnSync, setIsTogglingVpnSync] = useState<
    Record<string, boolean>
  >({});

  const { storedProxies: rawProxies, proxyUsage, isLoading } = useProxyEvents();
  const { vpnConfigs, vpnUsage, isLoading: isLoadingVpns } = useVpnEvents();
  const isVisible = mode === "page" || isOpen;
  const tableHeightClass =
    mode === "page" ? "h-[clamp(22rem,calc(100vh-20rem),40rem)]" : "h-[240px]";
  const [cloudProxyUsage, setCloudProxyUsage] = useState<{
    used_mb: number;
    limit_mb: number;
  } | null>(null);

  // Sort cloud-managed proxies first
  const storedProxies = [...rawProxies].sort((a, b) => {
    if (a.is_cloud_managed && !b.is_cloud_managed) return -1;
    if (!a.is_cloud_managed && b.is_cloud_managed) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  // Fetch cloud proxy usage
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const usage = await invoke<{
          used_mb: number;
          limit_mb: number;
          remaining_mb: number;
        } | null>("cloud_get_proxy_usage");
        setCloudProxyUsage(usage);
      } catch {
        // ignore
      }
    };
    if (isVisible) {
      void fetchUsage();
    }
  }, [isVisible]);

  // Listen for proxy sync status events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<{ id: string; status: string }>(
        "proxy-sync-status",
        (event) => {
          const { id, status } = event.payload;
          setProxySyncStatus((prev) => ({
            ...prev,
            [id]: status as SyncStatus,
          }));
        },
      );
    };

    void setupListener();
    return () => {
      unlisten?.();
    };
  }, []);

  // Listen for VPN sync status events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<{ id: string; status: string }>(
        "vpn-sync-status",
        (event) => {
          const { id, status } = event.payload;
          setVpnSyncStatus((prev) => ({
            ...prev,
            [id]: status as SyncStatus,
          }));
        },
      );
    };

    void setupListener();
    return () => {
      unlisten?.();
    };
  }, []);

  // Load cached check results on mount and when proxies change
  useEffect(() => {
    const loadCachedResults = async () => {
      const results: Record<string, ProxyCheckResult> = {};
      const inUse: Record<string, boolean> = {};
      for (const proxy of storedProxies) {
        try {
          const cached = await invoke<ProxyCheckResult | null>(
            "get_cached_proxy_check",
            { proxyId: proxy.id },
          );
          if (cached) {
            results[proxy.id] = cached;
          }

          const inUseBySynced = await invoke<boolean>(
            "is_proxy_in_use_by_synced_profile",
            { proxyId: proxy.id },
          );
          inUse[proxy.id] = inUseBySynced;
        } catch (_error) {
          // Ignore errors
        }
      }
      setProxyCheckResults(results);
      setProxyInUse(inUse);
    };
    if (storedProxies.length > 0) {
      void loadCachedResults();
    }
  }, [storedProxies]);

  // Load VPN in-use status
  useEffect(() => {
    const loadVpnInUse = async () => {
      const inUse: Record<string, boolean> = {};
      for (const vpn of vpnConfigs) {
        try {
          const inUseBySynced = await invoke<boolean>(
            "is_vpn_in_use_by_synced_profile",
            { vpnId: vpn.id },
          );
          inUse[vpn.id] = inUseBySynced;
        } catch (_error) {
          // Ignore errors
        }
      }
      setVpnInUse(inUse);
    };
    if (vpnConfigs.length > 0) {
      void loadVpnInUse();
    }
  }, [vpnConfigs]);

  // Proxy handlers
  const handleDeleteProxy = useCallback((proxy: StoredProxy) => {
    setProxyToDelete(proxy);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!proxyToDelete) return;
    setIsDeleting(true);
    try {
      await invoke("delete_stored_proxy", { proxyId: proxyToDelete.id });
      showSuccessToast(t("toasts.success.proxyDeleted"));
      await emit("stored-proxies-changed");
    } catch (error) {
      console.error("Failed to delete proxy:", error);
      showErrorToast(t("toasts.error.proxyDeleteFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDeleting(false);
      setProxyToDelete(null);
    }
  }, [proxyToDelete, t]);

  const handleCreateProxy = useCallback(() => {
    setEditingProxy(null);
    setShowProxyForm(true);
  }, []);

  const handleEditProxy = useCallback((proxy: StoredProxy) => {
    setEditingProxy(proxy);
    setShowProxyForm(true);
  }, []);

  const handleProxyFormClose = useCallback(() => {
    setShowProxyForm(false);
    setEditingProxy(null);
  }, []);

  const handleToggleSync = useCallback(
    async (proxy: StoredProxy) => {
      setIsTogglingSync((prev) => ({ ...prev, [proxy.id]: true }));
      try {
        await invoke("set_proxy_sync_enabled", {
          proxyId: proxy.id,
          enabled: !proxy.sync_enabled,
        });
        showSuccessToast(
          proxy.sync_enabled
            ? t("proxyManagementDialog.toasts.syncDisabled")
            : t("proxyManagementDialog.toasts.syncEnabled"),
        );
        await emit("stored-proxies-changed");
      } catch (error) {
        console.error("Failed to toggle sync:", error);
        showErrorToast(
          error instanceof Error
            ? error.message
            : t("proxyManagementDialog.toasts.syncUpdateFailed"),
        );
      } finally {
        setIsTogglingSync((prev) => ({ ...prev, [proxy.id]: false }));
      }
    },
    [t],
  );

  // VPN handlers
  const handleDeleteVpn = useCallback((vpn: VpnConfig) => {
    setVpnToDelete(vpn);
  }, []);

  const handleConfirmDeleteVpn = useCallback(async () => {
    if (!vpnToDelete) return;
    setIsDeletingVpn(true);
    try {
      await invoke("delete_vpn_config", { vpnId: vpnToDelete.id });
      showSuccessToast(t("toasts.success.vpnDeleted"));
      await emit("vpn-configs-changed");
    } catch (error) {
      console.error("Failed to delete VPN:", error);
      showErrorToast(t("toasts.error.vpnDeleteFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsDeletingVpn(false);
      setVpnToDelete(null);
    }
  }, [t, vpnToDelete]);

  const handleCreateVpn = useCallback(() => {
    setEditingVpn(null);
    setShowVpnForm(true);
  }, []);

  const handleEditVpn = useCallback((vpn: VpnConfig) => {
    setEditingVpn(vpn);
    setShowVpnForm(true);
  }, []);

  const handleVpnFormClose = useCallback(() => {
    setShowVpnForm(false);
    setEditingVpn(null);
  }, []);

  const handleToggleVpnSync = useCallback(
    async (vpn: VpnConfig) => {
      setIsTogglingVpnSync((prev) => ({ ...prev, [vpn.id]: true }));
      try {
        await invoke("set_vpn_sync_enabled", {
          vpnId: vpn.id,
          enabled: !vpn.sync_enabled,
        });
        showSuccessToast(
          vpn.sync_enabled
            ? t("proxyManagementDialog.toasts.syncDisabled")
            : t("proxyManagementDialog.toasts.syncEnabled"),
        );
        await emit("vpn-configs-changed");
      } catch (error) {
        console.error("Failed to toggle VPN sync:", error);
        showErrorToast(
          error instanceof Error
            ? error.message
            : t("proxyManagementDialog.toasts.syncUpdateFailed"),
        );
      } finally {
        setIsTogglingVpnSync((prev) => ({ ...prev, [vpn.id]: false }));
      }
    },
    [t],
  );

  const proxyPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <RippleButton
            size="sm"
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="flex gap-2 items-center"
          >
            <LuUpload className="w-4 h-4" />
            {t("common.buttons.import")}
          </RippleButton>
          <RippleButton
            size="sm"
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            className="flex gap-2 items-center"
          >
            <LuClipboardPaste className="w-4 h-4" />
            {t("proxyManagementDialog.actions.quickPaste")}
          </RippleButton>
          <RippleButton
            size="sm"
            variant="outline"
            onClick={() => setShowExportDialog(true)}
            className="flex gap-2 items-center"
            disabled={storedProxies.length === 0}
          >
            <LuDownload className="w-4 h-4" />
            {t("common.buttons.export")}
          </RippleButton>
        </div>
        <div className="flex flex-wrap gap-2">
          {storedProxies.some((p) => p.is_cloud_managed) && (
            <RippleButton
              size="sm"
              variant="outline"
              onClick={() => setShowLocationDialog(true)}
              className="flex gap-2 items-center"
            >
              <GoGlobe className="w-4 h-4" />
              {t("proxyManagementDialog.actions.location")}
            </RippleButton>
          )}
          <RippleButton
            size="sm"
            onClick={handleCreateProxy}
            className="flex gap-2 items-center"
          >
            <GoPlus className="w-4 h-4" />
            {t("common.buttons.create")}
          </RippleButton>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">
          {t("proxyManagementDialog.loadingProxies")}
        </div>
      ) : storedProxies.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("proxyManagementDialog.emptyProxies")}
        </div>
      ) : (
        <div className="border rounded-md">
          <ScrollArea className={tableHeightClass}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.labels.name")}</TableHead>
                  <TableHead className="w-20">
                    {t("common.labels.usage")}
                  </TableHead>
                  <TableHead className="w-24">
                    {t("common.labels.sync")}
                  </TableHead>
                  <TableHead className="w-24">
                    {t("common.labels.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storedProxies.map((proxy) => {
                  const isCloud = proxy.is_cloud_managed === true;
                  const syncDot = getSyncStatusDot(
                    t,
                    proxy,
                    proxySyncStatus[proxy.id],
                  );
                  const isDerived = proxy.is_cloud_derived === true;
                  return (
                    <TableRow key={proxy.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            {isDerived && proxy.geo_country && (
                              <FlagIcon
                                countryCode={proxy.geo_country}
                                className="shrink-0"
                              />
                            )}
                            {!isCloud && !isDerived && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`w-2 h-2 rounded-full shrink-0 ${syncDot.color} ${
                                      syncDot.animate ? "animate-pulse" : ""
                                    }`}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{syncDot.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {proxy.name}
                          </div>
                          {isCloud && cloudProxyUsage && (
                            <span className="text-xs text-muted-foreground">
                              {cloudProxyUsage.used_mb} /{" "}
                              {cloudProxyUsage.limit_mb} MB used
                            </span>
                          )}
                          {proxyCheckResults[proxy.id] &&
                            !proxyCheckResults[proxy.id].is_valid && (
                              <span className="text-xs text-destructive">
                                {t("proxies.check.row.needsAttention")}
                              </span>
                            )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {proxyUsage[proxy.id] ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isCloud ? (
                          <Badge variant="outline">
                            {t("proxyManagementDialog.cloud")}
                          </Badge>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center">
                                <Checkbox
                                  checked={proxy.sync_enabled}
                                  onCheckedChange={() =>
                                    handleToggleSync(proxy)
                                  }
                                  disabled={
                                    isTogglingSync[proxy.id] ||
                                    proxyInUse[proxy.id]
                                  }
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {proxyInUse[proxy.id] ? (
                                <p>
                                  {t(
                                    "proxyManagementDialog.tooltips.syncDisableBlockedProxy",
                                  )}
                                </p>
                              ) : (
                                <p>
                                  {proxy.sync_enabled
                                    ? t(
                                        "proxyManagementDialog.tooltips.disableSync",
                                      )
                                    : t(
                                        "proxyManagementDialog.tooltips.enableSync",
                                      )}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <ProxyCheckButton
                            proxy={proxy}
                            profileId={proxy.id}
                            checkingProfileId={checkingProxyId}
                            cachedResult={proxyCheckResults[proxy.id]}
                            setCheckingProfileId={setCheckingProxyId}
                            onCheckComplete={(result) => {
                              setProxyCheckResults((prev) => ({
                                ...prev,
                                [proxy.id]: result,
                              }));
                              setProxyCheckFailures((prev) => {
                                const next = { ...prev };
                                delete next[proxy.id];
                                return next;
                              });
                            }}
                            onCheckFailed={(result, failure) => {
                              setProxyCheckResults((prev) => ({
                                ...prev,
                                [proxy.id]: result,
                              }));
                              setProxyCheckFailures((prev) => ({
                                ...prev,
                                [proxy.id]: failure,
                              }));
                            }}
                          />
                          {!isCloud && !isDerived && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditProxy(proxy)}
                                >
                                  <LuPencil className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {proxyCheckFailures[proxy.id]
                                    ? t(
                                        `proxies.check.failures.${proxyCheckFailures[proxy.id].category}`,
                                      )
                                    : t(
                                        "proxyManagementDialog.tooltips.editProxy",
                                      )}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {!isCloud && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteProxy(proxy)}
                                    disabled={(proxyUsage[proxy.id] ?? 0) > 0}
                                  >
                                    <LuTrash2 className="w-4 h-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {(proxyUsage[proxy.id] ?? 0) > 0 ? (
                                  <p>
                                    {t(
                                      "proxyManagementDialog.tooltips.deleteBlocked",
                                      {
                                        count: proxyUsage[proxy.id] ?? 0,
                                      },
                                    )}
                                  </p>
                                ) : (
                                  <p>
                                    {t(
                                      "proxyManagementDialog.tooltips.deleteProxy",
                                    )}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  const vpnPanel = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <RippleButton
            size="sm"
            variant="outline"
            onClick={() => setShowVpnImportDialog(true)}
            className="flex gap-2 items-center"
          >
            <LuUpload className="w-4 h-4" />
            {t("common.buttons.import")}
          </RippleButton>
        </div>
        <RippleButton
          size="sm"
          onClick={handleCreateVpn}
          className="flex gap-2 items-center"
        >
          <GoPlus className="w-4 h-4" />
          {t("common.buttons.create")}
        </RippleButton>
      </div>

      {isLoadingVpns ? (
        <div className="text-sm text-muted-foreground">
          {t("proxyManagementDialog.loadingVpns")}
        </div>
      ) : vpnConfigs.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("proxyManagementDialog.emptyVpns")}
        </div>
      ) : (
        <div className="border rounded-md">
          <ScrollArea className={tableHeightClass}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.labels.name")}</TableHead>
                  <TableHead className="w-16">
                    {t("common.labels.type")}
                  </TableHead>
                  <TableHead className="w-20">
                    {t("common.labels.usage")}
                  </TableHead>
                  <TableHead className="w-24">
                    {t("common.labels.sync")}
                  </TableHead>
                  <TableHead className="w-24">
                    {t("common.labels.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vpnConfigs.map((vpn) => {
                  const syncDot = getSyncStatusDot(
                    t,
                    vpn,
                    vpnSyncStatus[vpn.id],
                  );
                  return (
                    <TableRow key={vpn.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-2 h-2 rounded-full shrink-0 ${syncDot.color} ${
                                  syncDot.animate ? "animate-pulse" : ""
                                }`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{syncDot.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                          {vpn.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {vpn.vpn_type === "WireGuard" ? "WG" : "OVPN"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {vpnUsage[vpn.id] ?? 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center">
                              <Checkbox
                                checked={vpn.sync_enabled}
                                onCheckedChange={() => handleToggleVpnSync(vpn)}
                                disabled={
                                  isTogglingVpnSync[vpn.id] || vpnInUse[vpn.id]
                                }
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            {vpnInUse[vpn.id] ? (
                              <p>
                                {t(
                                  "proxyManagementDialog.tooltips.syncDisableBlockedVpn",
                                )}
                              </p>
                            ) : (
                              <p>
                                {vpn.sync_enabled
                                  ? t(
                                      "proxyManagementDialog.tooltips.disableSync",
                                    )
                                  : t(
                                      "proxyManagementDialog.tooltips.enableSync",
                                    )}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <VpnCheckButton
                            vpnId={vpn.id}
                            vpnName={vpn.name}
                            checkingVpnId={checkingVpnId}
                            setCheckingVpnId={setCheckingVpnId}
                          />
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditVpn(vpn)}
                              >
                                <LuPencil className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {t("proxyManagementDialog.tooltips.editVpn")}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteVpn(vpn)}
                                  disabled={(vpnUsage[vpn.id] ?? 0) > 0}
                                >
                                  <LuTrash2 className="w-4 h-4" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              {(vpnUsage[vpn.id] ?? 0) > 0 ? (
                                <p>
                                  {t(
                                    "proxyManagementDialog.tooltips.deleteBlocked",
                                    {
                                      count: vpnUsage[vpn.id] ?? 0,
                                    },
                                  )}
                                </p>
                              ) : (
                                <p>
                                  {t(
                                    "proxyManagementDialog.tooltips.deleteVpn",
                                  )}
                                </p>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      )}
    </div>
  );

  const managementTabs = (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setActiveTab(value as "proxies" | "vpns")}
      className="min-h-0"
    >
      <TabsList
        className={cn(
          "w-full rounded-xl bg-muted/60 p-1",
          mode === "dialog" && "bg-transparent p-0",
        )}
      >
        <TabsTrigger value="proxies" className="flex-1">
          {t("proxyManagementDialog.tabs.proxies")}
        </TabsTrigger>
        <TabsTrigger value="vpns" className="flex-1">
          {t("proxyManagementDialog.tabs.vpns")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="proxies" className="mt-4">
        {proxyPanel}
      </TabsContent>

      <TabsContent value="vpns" className="mt-4">
        {vpnPanel}
      </TabsContent>
    </Tabs>
  );

  const content = (
    <>
      <div className="app-shell-safe-header shrink-0 border-b px-5 py-4">
        <DialogHeader>
          <DialogTitle>{t("proxyManagementDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("proxyManagementDialog.description")}
          </DialogDescription>
        </DialogHeader>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-5 py-4">{managementTabs}</div>
      </ScrollArea>
      {mode === "dialog" && (
        <DialogFooter className="shrink-0 border-t px-5 py-4">
          <RippleButton variant="outline" onClick={onClose}>
            {t("common.buttons.close")}
          </RippleButton>
        </DialogFooter>
      )}
    </>
  );

  return (
    <>
      {mode === "page" ? (
        <WorkspacePageShell
          title={t("proxyManagementDialog.title")}
          description={t("proxyManagementDialog.description")}
          toolbar={
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab(value as "proxies" | "vpns")
              }
            >
              <TabsList className="grid w-[220px] grid-cols-2">
                <TabsTrigger value="proxies">
                  {t("proxyManagementDialog.tabs.proxies")}
                </TabsTrigger>
                <TabsTrigger value="vpns">
                  {t("proxyManagementDialog.tabs.vpns")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
          contentClassName="max-w-none"
        >
          {activeTab === "proxies" ? proxyPanel : vpnPanel}
        </WorkspacePageShell>
      ) : (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl p-0">{content}</DialogContent>
        </Dialog>
      )}

      <ProxyFormDialog
        isOpen={showProxyForm}
        onClose={handleProxyFormClose}
        editingProxy={editingProxy}
      />
      <DeleteConfirmationDialog
        isOpen={proxyToDelete !== null}
        onClose={() => setProxyToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t("proxyManagementDialog.deleteProxy.title")}
        description={t("proxyManagementDialog.deleteProxy.description", {
          name: proxyToDelete?.name ?? "",
        })}
        confirmButtonText={t("common.buttons.delete")}
        isLoading={isDeleting}
      />
      <ProxyImportDialog
        isOpen={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
      <ProxyExportDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />
      <LocationProxyDialog
        isOpen={showLocationDialog}
        onClose={() => setShowLocationDialog(false)}
      />

      <VpnFormDialog
        isOpen={showVpnForm}
        onClose={handleVpnFormClose}
        editingVpn={editingVpn}
      />
      <DeleteConfirmationDialog
        isOpen={vpnToDelete !== null}
        onClose={() => setVpnToDelete(null)}
        onConfirm={handleConfirmDeleteVpn}
        title={t("proxyManagementDialog.deleteVpn.title")}
        description={t("proxyManagementDialog.deleteVpn.description", {
          name: vpnToDelete?.name ?? "",
        })}
        confirmButtonText={t("common.buttons.delete")}
        isLoading={isDeletingVpn}
      />
      <VpnImportDialog
        isOpen={showVpnImportDialog}
        onClose={() => setShowVpnImportDialog(false)}
      />
    </>
  );
}
