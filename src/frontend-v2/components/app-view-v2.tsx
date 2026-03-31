"use client";

import { invoke } from "@tauri-apps/api/core";
import { Activity, Database, RefreshCcw, Search, Workflow } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ProfileListV2 } from "@/frontend-v2/components/profile-list-v2";
import { useProfilesRealtimeStore } from "@/frontend-v2/hooks/use-profiles-realtime-store";
import { Badge } from "@/frontend-baseline/shadcn/ui/badge";
import { Button } from "@/frontend-baseline/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend-baseline/shadcn/ui/card";
import { Input } from "@/frontend-baseline/shadcn/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend-baseline/shadcn/ui/tabs";
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { BrowserProfile } from "@/types";

function addToSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
  setter((prev) => {
    const next = new Set(prev);
    next.add(id);
    return next;
  });
}

function removeFromSet(setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
  setter((prev) => {
    if (!prev.has(id)) {
      return prev;
    }
    const next = new Set(prev);
    next.delete(id);
    return next;
  });
}

export function AppViewV2() {
  const { t } = useTranslation();
  const {
    order,
    byId,
    runningIds,
    syncById,
    locksById,
    isLoading,
    error,
    refreshProfiles,
    refreshLocks,
  } = useProfilesRealtimeStore(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [launchingIds, setLaunchingIds] = useState<Set<string>>(new Set());
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set());
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error || lastErrorRef.current === error) {
      return;
    }
    lastErrorRef.current = error;
    showErrorToast(t("frontendV2.toasts.loadFailed"), {
      description: error,
    });
  }, [error, t]);

  const lockIdSet = useMemo(() => {
    return new Set(Array.from(locksById.keys()));
  }, [locksById]);

  const visibleIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return order;
    }
    const next: string[] = [];
    for (const id of order) {
      const profile = byId.get(id);
      if (!profile) {
        continue;
      }
      if (
        profile.name.toLowerCase().includes(query) ||
        (profile.note ?? "").toLowerCase().includes(query) ||
        (profile.tags ?? []).some((tag) => tag.toLowerCase().includes(query))
      ) {
        next.push(id);
      }
    }
    return next;
  }, [byId, order, searchQuery]);

  const metrics = useMemo(() => {
    let syncing = 0;
    let regularSyncEnabled = 0;

    for (const id of order) {
      const profile = byId.get(id);
      if (!profile) continue;
      const syncStatus = syncById[id]?.status;
      if (syncStatus === "syncing") {
        syncing += 1;
      }
      if (profile.sync_mode && profile.sync_mode !== "Disabled") {
        regularSyncEnabled += 1;
      }
    }

    return {
      total: order.length,
      running: runningIds.size,
      locked: lockIdSet.size,
      syncing,
      syncEnabled: regularSyncEnabled,
      visible: visibleIds.length,
    };
  }, [byId, lockIdSet.size, order, runningIds.size, syncById, visibleIds.length]);

  const handleToggleRun = useCallback(
    async (profile: BrowserProfile) => {
      const isRunning = runningIds.has(profile.id) || profile.runtime_state === "Running";
      if (isRunning) {
        addToSet(setStoppingIds, profile.id);
        try {
          await invoke("kill_browser_profile", { profile });
          showSuccessToast(t("frontendV2.toasts.stopQueued"));
        } catch (invokeError) {
          showErrorToast(t("toasts.error.profileUpdateFailed"), {
            description: extractRootError(invokeError),
          });
        } finally {
          removeFromSet(setStoppingIds, profile.id);
        }
        return;
      }

      addToSet(setLaunchingIds, profile.id);
      try {
        await invoke("launch_browser_profile", { profile });
        showSuccessToast(t("toasts.success.profileLaunched"));
      } catch (invokeError) {
        showErrorToast(t("toasts.error.profileLaunchFailed"), {
          description: extractRootError(invokeError),
        });
      } finally {
        removeFromSet(setLaunchingIds, profile.id);
      }
    },
    [runningIds, t],
  );

  const handleToggleSync = useCallback(
    async (profile: BrowserProfile) => {
      addToSet(setSyncingIds, profile.id);
      try {
        const enabling = !profile.sync_mode || profile.sync_mode === "Disabled";
        await invoke("set_profile_sync_mode", {
          profileId: profile.id,
          syncMode: enabling ? "Regular" : "Disabled",
        });
        showSuccessToast(
          enabling
            ? t("profiles.syncToggle.enabledTitle")
            : t("profiles.syncToggle.disabledTitle"),
        );
      } catch (invokeError) {
        showErrorToast(t("profiles.syncToggle.updateFailed"), {
          description: extractRootError(invokeError),
        });
      } finally {
        removeFromSet(setSyncingIds, profile.id);
      }
    },
    [t],
  );

  return (
    <div className="flex h-[calc(100vh-var(--window-titlebar-height,0px))] min-h-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="border-b border-border bg-card/70 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold">{t("frontendV2.header.title")}</h1>
            <p className="text-xs text-muted-foreground">{t("frontendV2.header.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t("frontendV2.header.phase")}</Badge>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await Promise.all([refreshProfiles(), refreshLocks()]);
                showSuccessToast(t("frontendV2.toasts.refreshed"));
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {t("common.buttons.refresh")}
            </Button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 border-b border-border px-4 py-3 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {t("frontendV2.metrics.total")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-lg font-semibold">{metrics.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {t("frontendV2.metrics.visible")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-lg font-semibold">{metrics.visible}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {t("frontendV2.metrics.running")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-lg font-semibold">{metrics.running}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {t("frontendV2.metrics.syncing")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-lg font-semibold">{metrics.syncing}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {t("frontendV2.metrics.locked")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-lg font-semibold">{metrics.locked}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">
              {t("frontendV2.metrics.syncEnabled")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-lg font-semibold">{metrics.syncEnabled}</CardContent>
        </Card>
      </section>

      <main className="flex min-h-0 flex-1 flex-col p-4">
        <Tabs defaultValue="profiles" className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="profiles">
                <Database className="h-3.5 w-3.5" />
                {t("frontendV2.tabs.profiles")}
              </TabsTrigger>
              <TabsTrigger value="automation">
                <Workflow className="h-3.5 w-3.5" />
                {t("frontendV2.tabs.automation")}
              </TabsTrigger>
              <TabsTrigger value="runtime">
                <Activity className="h-3.5 w-3.5" />
                {t("frontendV2.tabs.runtime")}
              </TabsTrigger>
            </TabsList>

            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-8"
                placeholder={t("frontendV2.actions.searchPlaceholder")}
              />
            </div>
          </div>

          <TabsContent value="profiles" className="min-h-0 flex-1">
            <ProfileListV2
              visibleIds={visibleIds}
              profilesById={byId}
              runningIds={runningIds}
              locksById={lockIdSet}
              syncById={syncById}
              launchingIds={launchingIds}
              stoppingIds={stoppingIds}
              syncingIds={syncingIds}
              emptyLabel={
                isLoading ? t("common.buttons.loading") : t("frontendV2.labels.empty")
              }
              onToggleRun={handleToggleRun}
              onToggleSync={handleToggleSync}
            />
          </TabsContent>

          <TabsContent value="automation" className="min-h-0 flex-1">
            <Card className="h-full border-border bg-card">
              <CardHeader>
                <CardTitle className="text-sm">{t("frontendV2.automation.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{t("frontendV2.automation.description")}</p>
                <p>{t("frontendV2.automation.hint")}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runtime" className="min-h-0 flex-1">
            <Card className="h-full border-border bg-card">
              <CardHeader>
                <CardTitle className="text-sm">{t("frontendV2.runtime.title")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>{t("frontendV2.runtime.description")}</p>
                <ul className="space-y-1">
                  <li>{t("frontendV2.runtime.itemRunning", { value: metrics.running })}</li>
                  <li>{t("frontendV2.runtime.itemLocked", { value: metrics.locked })}</li>
                  <li>{t("frontendV2.runtime.itemSyncing", { value: metrics.syncing })}</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
