"use client";

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { TFunction } from "i18next";
import { MoreHorizontal } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { GoPlus } from "react-icons/go";
import { LuPencil, LuTrash2 } from "react-icons/lu";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { DeleteGroupDialog } from "@/components/delete-group-dialog";
import { EditGroupDialog } from "@/components/edit-group-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePaginationControls } from "@/components/ui/table-pagination-controls";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProxyEvents } from "@/hooks/use-proxy-events";
import { useRuntimeAccess } from "@/hooks/use-runtime-access";
import { useVpnEvents } from "@/hooks/use-vpn-events";
import {
  DEFAULT_GROUP_COLOR,
  GROUP_APPEARANCE_STORAGE_KEY,
  readGroupAppearanceMap,
  sanitizeGroupColor,
  writeGroupAppearanceMap,
} from "@/lib/group-appearance-store";
import { formatLocaleDateTime } from "@/lib/locale-format";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import {
  applyScopedGroupCounts,
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type {
  BrowserProfile,
  GroupWithCount,
  ProfileGroup,
  StoredProxy,
  VpnConfig,
} from "@/types";
import { RippleButton } from "./ui/ripple";

type SyncStatus = "disabled" | "syncing" | "synced" | "error" | "waiting";
type GroupSortValue =
  | "name-asc"
  | "name-desc"
  | "profiles-desc"
  | "profiles-asc";
type GroupDetailTab = "members" | "policies" | "sync" | "activity";

type GroupActivityEntry = {
  id: string;
  groupId: string;
  message: string;
  createdAt: number;
};

type GroupColorLabel = string;
type GroupShareMode = "private" | "team" | "public";
type GroupMemberAccess = "owner_admin" | "all_members";

function getSyncStatusDot(
  t: TFunction,
  group: GroupWithCount,
  liveStatus: SyncStatus | undefined,
): { color: string; tooltip: string; animate: boolean; label: string } {
  const status = liveStatus ?? (group.sync_enabled ? "synced" : "disabled");

  switch (status) {
    case "syncing":
      return {
        color: "bg-primary/70",
        tooltip: t("common.status.syncing"),
        animate: true,
        label: t("common.status.syncing"),
      };
    case "synced":
      return {
        color: "bg-primary",
        tooltip: group.last_sync
          ? t("profiles.table.syncedAt", {
              time: formatLocaleDateTime(group.last_sync * 1000),
            })
          : t("common.status.synced"),
        animate: false,
        label: t("common.status.synced"),
      };
    case "waiting":
      return {
        color: "bg-primary/70",
        tooltip: t("profiles.table.waitingToSync"),
        animate: false,
        label: t("profiles.table.waitingToSync"),
      };
    case "error":
      return {
        color: "bg-destructive",
        tooltip: t("profiles.table.syncError"),
        animate: false,
        label: t("profiles.table.syncError"),
      };
    default:
      return {
        color: "bg-muted-foreground/60",
        tooltip: t("sync.mode.disabledDescription"),
        animate: false,
        label: t("sync.mode.disabled"),
      };
  }
}

interface GroupManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupManagementComplete: () => void;
  initialAction?: "manage" | "edit" | "delete";
  initialGroupId?: string | null;
  mode?: "dialog" | "page" | "embedded";
  selectedGroupId?: string | null;
  onSelectedGroupChange?: (groupId: string) => void;
  workspaceRole?: TeamRole | null;
  fallbackTeamRole?: TeamRole | null;
  onShareGroupInvite?: (input: {
    groupId: string;
    recipientEmail: string;
  }) => Promise<void>;
}

export function GroupManagementDialog({
  isOpen,
  onClose,
  onGroupManagementComplete,
  initialAction = "manage",
  initialGroupId = null,
  mode = "dialog",
  selectedGroupId: _selectedGroupId,
  onSelectedGroupChange: _onSelectedGroupChange,
  workspaceRole: _workspaceRole = null,
  fallbackTeamRole: _fallbackTeamRole = null,
  onShareGroupInvite: _onShareGroupInvite,
}: GroupManagementDialogProps) {
  const { t } = useTranslation();
  const isEmbeddedMode = mode === "embedded";
  const { isReadOnly } = useRuntimeAccess({
    enabled: mode === "page" || isEmbeddedMode || isOpen,
  });
  const isVisible = mode === "page" || isEmbeddedMode ? true : isOpen;
  const isPageMode = mode === "page";

  const [groups, setGroups] = useState<GroupWithCount[]>([]);
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithCount | null>(
    null,
  );

  const [groupSyncStatus, setGroupSyncStatus] = useState<
    Record<string, SyncStatus>
  >({});
  const [groupInUse, setGroupInUse] = useState<Record<string, boolean>>({});
  const [isTogglingSync, setIsTogglingSync] = useState<Record<string, boolean>>(
    {},
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [syncFilter, setSyncFilter] = useState<"all" | "enabled" | "disabled">(
    "all",
  );
  const [sortValue, setSortValue] = useState<GroupSortValue>("name-asc");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [profilesPageIndex, setProfilesPageIndex] = useState(0);
  const [profilesPageSize, setProfilesPageSize] = useState(10);
  const [profilesStatusFilter, setProfilesStatusFilter] = useState<
    "all" | "running" | "stopped"
  >("all");

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<GroupDetailTab>("members");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [selectedMemberProfileIds, setSelectedMemberProfileIds] = useState<
    string[]
  >([]);
  const [selectedCandidateProfileIds, setSelectedCandidateProfileIds] =
    useState<string[]>([]);
  const [moveTargetGroupId, setMoveTargetGroupId] = useState<string>("none");
  const [isMemberActionLoading, setIsMemberActionLoading] = useState(false);

  const [activityEntries, setActivityEntries] = useState<GroupActivityEntry[]>(
    [],
  );
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false);
  const [groupColorById, setGroupColorById] = useState<
    Record<string, GroupColorLabel>
  >({});
  const [groupShareById, setGroupShareById] = useState<
    Record<string, GroupShareMode>
  >({});
  const [groupAccessById, setGroupAccessById] = useState<
    Record<string, GroupMemberAccess>
  >({});
  const [appearanceLoaded, setAppearanceLoaded] = useState(false);
  const { storedProxies } = useProxyEvents({
    enabled: isPageMode,
    includeUsage: false,
  });
  const { vpnConfigs } = useVpnEvents({
    enabled: isPageMode,
    includeUsage: false,
  });

  const handledInitialIntentRef = useRef<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredMemberSearchQuery = useDeferredValue(memberSearchQuery);

  const appendActivity = useCallback((groupId: string, message: string) => {
    setActivityEntries((prev) => [
      {
        id: `${groupId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`,
        groupId,
        message,
        createdAt: Date.now(),
      },
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const applyAppearance = () => {
      const appearance = readGroupAppearanceMap();
      const colorById: Record<string, GroupColorLabel> = {};
      const shareById: Record<string, GroupShareMode> = {};
      const accessById: Record<string, GroupMemberAccess> = {};

      for (const [groupId, config] of Object.entries(appearance)) {
        if (config?.color) {
          colorById[groupId] = sanitizeGroupColor(config.color);
        }
        if (
          config?.share === "private" ||
          config?.share === "team" ||
          config?.share === "public"
        ) {
          shareById[groupId] = config.share;
        }
        if (
          config?.access === "owner_admin" ||
          config?.access === "all_members"
        ) {
          accessById[groupId] = config.access;
        }
      }

      setGroupColorById(colorById);
      setGroupShareById(shareById);
      setGroupAccessById(accessById);
      setAppearanceLoaded(true);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === GROUP_APPEARANCE_STORAGE_KEY) {
        applyAppearance();
      }
    };

    applyAppearance();
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible || !appearanceLoaded) {
      return;
    }
    const merged: Record<
      string,
      { color?: string; share?: GroupShareMode; access?: GroupMemberAccess }
    > = {};
    const ids = new Set([
      ...Object.keys(groupColorById),
      ...Object.keys(groupShareById),
      ...Object.keys(groupAccessById),
    ]);
    for (const id of ids) {
      merged[id] = {
        color: groupColorById[id]
          ? sanitizeGroupColor(groupColorById[id])
          : undefined,
        share: groupShareById[id],
        access: groupAccessById[id],
      };
    }
    writeGroupAppearanceMap(merged);
  }, [
    appearanceLoaded,
    groupAccessById,
    groupColorById,
    groupShareById,
    isVisible,
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<{ id: string; status: string }>(
        "group-sync-status",
        (event) => {
          const { id, status } = event.payload;
          setGroupSyncStatus((prev) => ({
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

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupList, profileList] = await Promise.all([
        invoke<GroupWithCount[]>("get_groups_with_profile_counts"),
        invoke<BrowserProfile[]>("list_browser_profiles"),
      ]);
      const scope = getCurrentDataScope();
      const scopedProfiles = scopeEntitiesForContext(
        "profiles",
        profileList,
        (profile) => profile.id,
        scope,
      );
      const scopedGroups = scopeEntitiesForContext(
        "groups",
        groupList,
        (group) => group.id,
        scope,
      );
      const mergedGroups = applyScopedGroupCounts(
        scopedGroups,
        scopedProfiles,
        "Default",
      );
      const userGroups = mergedGroups.filter((group) => group.id !== "default");
      setGroups(userGroups);
      setProfiles(scopedProfiles);

      const inUse: Record<string, boolean> = {};
      const groupIds = userGroups.map((group) => group.id);
      if (groupIds.length > 0) {
        try {
          const inUseRows = await invoke<Record<string, boolean>>(
            "get_groups_in_use_by_synced_profiles",
            { groupIds },
          );
          for (const groupId of groupIds) {
            inUse[groupId] = Boolean(inUseRows?.[groupId]);
          }
        } catch {
          // Ignore this non-critical check.
        }
      }
      setGroupInUse(inUse);
      setSelectedGroupIds((prev) =>
        prev.filter((id) => userGroups.some((group) => group.id === id)),
      );
      setActiveGroupId((prev) => {
        if (prev && userGroups.some((group) => group.id === prev)) {
          return prev;
        }
        return userGroups[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGroupCreated = useCallback(
    (newGroup: ProfileGroup) => {
      appendActivity(
        newGroup.id,
        t("groupManagementDialog.activity.groupCreated", {
          name: newGroup.name,
        }),
      );
      void loadGroups();
      onGroupManagementComplete();
    },
    [appendActivity, loadGroups, onGroupManagementComplete, t],
  );

  const handleGroupUpdated = useCallback(
    (updatedGroup: ProfileGroup) => {
      appendActivity(
        updatedGroup.id,
        t("groupManagementDialog.activity.groupUpdated", {
          name: updatedGroup.name,
        }),
      );
      void loadGroups();
      onGroupManagementComplete();
    },
    [appendActivity, loadGroups, onGroupManagementComplete, t],
  );

  const handleGroupDeleted = useCallback(() => {
    if (selectedGroup) {
      appendActivity(
        selectedGroup.id,
        t("groupManagementDialog.activity.groupDeleted", {
          name: selectedGroup.name,
        }),
      );
    }
    void loadGroups();
    onGroupManagementComplete();
  }, [appendActivity, loadGroups, onGroupManagementComplete, selectedGroup, t]);

  const handleEditGroup = useCallback((group: GroupWithCount) => {
    setSelectedGroup(group);
    setEditDialogOpen(true);
  }, []);

  const handleDeleteGroup = useCallback((group: GroupWithCount) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  }, []);

  const handleToggleSync = useCallback(
    async (group: GroupWithCount) => {
      if (isReadOnly) {
        showErrorToast(t("entitlement.readOnlyDenied"), {
          description: t("entitlement.readOnlyDescription"),
        });
        return;
      }
      setIsTogglingSync((prev) => ({ ...prev, [group.id]: true }));
      const nextEnabled = !group.sync_enabled;
      try {
        await invoke("set_group_sync_enabled", {
          groupId: group.id,
          enabled: nextEnabled,
        });
        showSuccessToast(
          nextEnabled
            ? t("groupManagementDialog.toast.syncEnabled")
            : t("groupManagementDialog.toast.syncDisabled"),
        );
        appendActivity(
          group.id,
          nextEnabled
            ? t("groupManagementDialog.activity.syncEnabled", {
                name: group.name,
              })
            : t("groupManagementDialog.activity.syncDisabled", {
                name: group.name,
              }),
        );
        await loadGroups();
      } catch (toggleError) {
        showErrorToast(
          toggleError instanceof Error
            ? toggleError.message
            : t("groupManagementDialog.toast.syncUpdateFailed"),
        );
      } finally {
        setIsTogglingSync((prev) => ({ ...prev, [group.id]: false }));
      }
    },
    [appendActivity, isReadOnly, loadGroups, t],
  );

  const handleBulkSync = useCallback(
    async (enabled: boolean) => {
      if (isReadOnly) {
        showErrorToast(t("entitlement.readOnlyDenied"), {
          description: t("entitlement.readOnlyDescription"),
        });
        return;
      }
      const targetGroups = groups.filter((group) =>
        selectedGroupIds.includes(group.id),
      );
      if (targetGroups.length === 0) {
        showErrorToast(t("groupManagementDialog.toast.noRowsSelected"));
        return;
      }

      const eligibleGroups = targetGroups.filter((group) => {
        if (!enabled && groupInUse[group.id]) {
          return false;
        }
        return true;
      });
      if (eligibleGroups.length === 0) {
        showErrorToast(t("groupManagementDialog.toast.noEligibleRows"));
        return;
      }

      const results = await Promise.allSettled(
        eligibleGroups.map((group) =>
          invoke("set_group_sync_enabled", {
            groupId: group.id,
            enabled,
          }),
        ),
      );

      const successCount = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failedCount = results.length - successCount;
      if (successCount > 0) {
        showSuccessToast(
          enabled
            ? t("groupManagementDialog.toast.bulkSyncEnabled", {
                count: successCount,
              })
            : t("groupManagementDialog.toast.bulkSyncDisabled", {
                count: successCount,
              }),
        );
        for (const group of eligibleGroups) {
          appendActivity(
            group.id,
            enabled
              ? t("groupManagementDialog.activity.syncEnabled", {
                  name: group.name,
                })
              : t("groupManagementDialog.activity.syncDisabled", {
                  name: group.name,
                }),
          );
        }
      }
      if (failedCount > 0) {
        showErrorToast(
          t("groupManagementDialog.toast.bulkSyncPartial", {
            count: failedCount,
          }),
        );
      }

      await loadGroups();
    },
    [
      appendActivity,
      groupInUse,
      groups,
      isReadOnly,
      loadGroups,
      selectedGroupIds,
      t,
    ],
  );

  useEffect(() => {
    if (isVisible) {
      void loadGroups();
    }
  }, [isVisible, loadGroups]);

  useEffect(() => {
    if (!isVisible) {
      handledInitialIntentRef.current = null;
      return;
    }
    if (initialAction === "manage" || !initialGroupId) {
      return;
    }
    const intentKey = `${initialAction}:${initialGroupId}`;
    if (handledInitialIntentRef.current === intentKey) {
      return;
    }
    const targetGroup = groups.find((group) => group.id === initialGroupId);
    if (!targetGroup) {
      return;
    }

    setSelectedGroup(targetGroup);
    setActiveGroupId(targetGroup.id);
    if (initialAction === "edit") {
      setEditDialogOpen(true);
    } else if (initialAction === "delete") {
      setDeleteDialogOpen(true);
    }
    handledInitialIntentRef.current = intentKey;
  }, [groups, initialAction, initialGroupId, isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const handleScopeChanged = () => {
      void loadGroups();
    };
    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    return () => {
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [isVisible, loadGroups]);

  const filteredGroups = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const filtered = groups.filter((group) => {
      const matchesQuery = !query || group.name.toLowerCase().includes(query);
      const matchesSync =
        syncFilter === "all"
          ? true
          : syncFilter === "enabled"
            ? group.sync_enabled
            : !group.sync_enabled;
      return matchesQuery && matchesSync;
    });

    filtered.sort((left, right) => {
      switch (sortValue) {
        case "name-desc":
          return right.name.localeCompare(left.name);
        case "profiles-desc":
          return (right.count ?? 0) - (left.count ?? 0);
        case "profiles-asc":
          return (left.count ?? 0) - (right.count ?? 0);
        default:
          return left.name.localeCompare(right.name);
      }
    });

    return filtered;
  }, [deferredSearchQuery, groups, sortValue, syncFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pagedGroups = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, pageSize, safePageIndex]);

  const summaryFrom =
    filteredGroups.length === 0 ? 0 : safePageIndex * pageSize + 1;
  const summaryTo =
    filteredGroups.length === 0
      ? 0
      : Math.min(filteredGroups.length, (safePageIndex + 1) * pageSize);

  const selectedGroupSet = useMemo(
    () => new Set(selectedGroupIds),
    [selectedGroupIds],
  );

  const currentGroupsPageIds = useMemo(
    () => pagedGroups.map((group) => group.id),
    [pagedGroups],
  );

  const allCurrentPageSelected =
    currentGroupsPageIds.length > 0 &&
    currentGroupsPageIds.every((groupId) => selectedGroupSet.has(groupId));

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );

  const membersInActiveGroup = useMemo(() => {
    if (!activeGroupId) {
      return [];
    }
    const normalizedQuery = deferredMemberSearchQuery.trim().toLowerCase();
    return profiles
      .filter((profile) => profile.group_id === activeGroupId)
      .filter((profile) => {
        if (!normalizedQuery) {
          return true;
        }
        return profile.name.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [activeGroupId, deferredMemberSearchQuery, profiles]);

  const candidatesForActiveGroup = useMemo(() => {
    if (!activeGroupId) {
      return [];
    }
    const normalizedQuery = candidateSearchQuery.trim().toLowerCase();
    return profiles
      .filter((profile) => profile.group_id !== activeGroupId)
      .filter((profile) => {
        if (!normalizedQuery) {
          return true;
        }
        return profile.name.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [activeGroupId, candidateSearchQuery, profiles]);

  const activityForActiveGroup = useMemo(() => {
    if (!activeGroup) {
      return [];
    }
    const generated: GroupActivityEntry[] = [];
    if (activeGroup.last_sync) {
      generated.push({
        id: `last-sync:${activeGroup.id}`,
        groupId: activeGroup.id,
        message: t("groupManagementDialog.activity.lastSuccessfulSync"),
        createdAt: activeGroup.last_sync * 1000,
      });
    }
    return [
      ...activityEntries.filter((entry) => entry.groupId === activeGroup.id),
      ...generated,
    ].sort((left, right) => right.createdAt - left.createdAt);
  }, [activeGroup, activityEntries, t]);

  const activeProfiles = useMemo(() => {
    if (!activeGroup) {
      return profiles;
    }
    return profiles.filter((profile) => profile.group_id === activeGroup.id);
  }, [activeGroup, profiles]);

  const workspaceStats = useMemo(() => {
    const total = activeProfiles.length;
    const running = activeProfiles.filter(
      (profile) => profile.runtime_state === "Running",
    ).length;
    const blocked = activeProfiles.filter(
      (profile) =>
        profile.runtime_state === "Error" ||
        profile.runtime_state === "Crashed",
    ).length;
    const synced = activeProfiles.filter((profile) =>
      Boolean(profile.last_sync),
    ).length;
    const drift = Math.max(0, total - synced);
    const ruleMatch = total === 0 ? 0 : Math.round((synced / total) * 100);

    return { total, running, drift, blocked, ruleMatch };
  }, [activeProfiles]);

  const activeGroupColor =
    (activeGroupId && groupColorById[activeGroupId]) || DEFAULT_GROUP_COLOR;
  const activeGroupShare =
    (activeGroupId && groupShareById[activeGroupId]) || "private";
  const activeGroupAccess =
    (activeGroupId && groupAccessById[activeGroupId]) || "owner_admin";

  const profilesForPage = useMemo(() => {
    const query = deferredMemberSearchQuery.trim().toLowerCase();
    const baseProfiles = activeGroupId
      ? profiles.filter((profile) => profile.group_id === activeGroupId)
      : profiles;
    return baseProfiles
      .filter((profile) =>
        !query ? true : profile.name.toLowerCase().includes(query),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [activeGroupId, deferredMemberSearchQuery, profiles]);

  const proxyNameById = useMemo(() => {
    const entries = storedProxies.map(
      (proxy: StoredProxy) => [proxy.id, proxy.name] as const,
    );
    return new Map<string, string>(entries);
  }, [storedProxies]);

  const vpnNameById = useMemo(() => {
    const entries = vpnConfigs.map(
      (vpn: VpnConfig) => [vpn.id, vpn.name] as const,
    );
    return new Map<string, string>(entries);
  }, [vpnConfigs]);

  const filteredProfilesForPage = useMemo(() => {
    return profilesForPage.filter((profile) => {
      if (profilesStatusFilter === "all") {
        return true;
      }
      if (profilesStatusFilter === "running") {
        return profile.runtime_state === "Running";
      }
      return (profile.runtime_state ?? "Stopped") !== "Running";
    });
  }, [profilesForPage, profilesStatusFilter]);

  const profilesPageCount = Math.max(
    1,
    Math.ceil(filteredProfilesForPage.length / profilesPageSize),
  );
  const safeProfilesPageIndex = Math.min(
    profilesPageIndex,
    profilesPageCount - 1,
  );
  const pagedProfilesForPage = useMemo(() => {
    const start = safeProfilesPageIndex * profilesPageSize;
    return filteredProfilesForPage.slice(start, start + profilesPageSize);
  }, [filteredProfilesForPage, profilesPageSize, safeProfilesPageIndex]);

  const profilesSummaryFrom =
    filteredProfilesForPage.length === 0
      ? 0
      : safeProfilesPageIndex * profilesPageSize + 1;
  const profilesSummaryTo =
    filteredProfilesForPage.length === 0
      ? 0
      : Math.min(
          filteredProfilesForPage.length,
          (safeProfilesPageIndex + 1) * profilesPageSize,
        );

  const toggleGroupSelection = useCallback((groupId: string) => {
    setSelectedGroupIds((prev) => {
      if (prev.includes(groupId)) {
        return prev.filter((id) => id !== groupId);
      }
      return [...prev, groupId];
    });
  }, []);

  const toggleSelectCurrentPage = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedGroupIds((prev) => {
          const merged = new Set([...prev, ...currentGroupsPageIds]);
          return [...merged];
        });
        return;
      }
      setSelectedGroupIds((prev) =>
        prev.filter((id) => !currentGroupsPageIds.includes(id)),
      );
    },
    [currentGroupsPageIds],
  );

  const toggleMemberSelection = useCallback((profileId: string) => {
    setSelectedMemberProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId],
    );
  }, []);

  const toggleCandidateSelection = useCallback((profileId: string) => {
    setSelectedCandidateProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId],
    );
  }, []);

  const handleMoveMembersToDefault = useCallback(async () => {
    if (selectedMemberProfileIds.length === 0) {
      showErrorToast(t("groupManagementDialog.toast.noMembersSelected"));
      return;
    }
    setIsMemberActionLoading(true);
    try {
      await invoke("assign_profiles_to_group", {
        profileIds: selectedMemberProfileIds,
        groupId: null,
      });
      showSuccessToast(
        t("groupManagementDialog.toast.membersMovedToDefault", {
          count: selectedMemberProfileIds.length,
        }),
      );
      if (activeGroup) {
        appendActivity(
          activeGroup.id,
          t("groupManagementDialog.activity.membersMovedToDefault", {
            count: selectedMemberProfileIds.length,
            name: activeGroup.name,
          }),
        );
      }
      setSelectedMemberProfileIds([]);
      await loadGroups();
      onGroupManagementComplete();
    } catch (moveError) {
      showErrorToast(
        moveError instanceof Error
          ? moveError.message
          : t("groupManagementDialog.toast.memberActionFailed"),
      );
    } finally {
      setIsMemberActionLoading(false);
    }
  }, [
    activeGroup,
    appendActivity,
    loadGroups,
    onGroupManagementComplete,
    selectedMemberProfileIds,
    t,
  ]);

  const handleMoveMembersToGroup = useCallback(async () => {
    if (selectedMemberProfileIds.length === 0 || moveTargetGroupId === "none") {
      showErrorToast(t("groupManagementDialog.toast.selectTargetGroup"));
      return;
    }
    setIsMemberActionLoading(true);
    try {
      await invoke("assign_profiles_to_group", {
        profileIds: selectedMemberProfileIds,
        groupId: moveTargetGroupId,
      });
      const targetGroupName =
        groups.find((group) => group.id === moveTargetGroupId)?.name ?? "";
      showSuccessToast(
        t("groupManagementDialog.toast.membersMovedToGroup", {
          count: selectedMemberProfileIds.length,
          group: targetGroupName,
        }),
      );
      if (activeGroup) {
        appendActivity(
          activeGroup.id,
          t("groupManagementDialog.activity.membersMovedToGroup", {
            count: selectedMemberProfileIds.length,
            source: activeGroup.name,
            target: targetGroupName,
          }),
        );
      }
      setSelectedMemberProfileIds([]);
      setMoveTargetGroupId("none");
      await loadGroups();
      onGroupManagementComplete();
    } catch (moveError) {
      showErrorToast(
        moveError instanceof Error
          ? moveError.message
          : t("groupManagementDialog.toast.memberActionFailed"),
      );
    } finally {
      setIsMemberActionLoading(false);
    }
  }, [
    activeGroup,
    appendActivity,
    groups,
    loadGroups,
    moveTargetGroupId,
    onGroupManagementComplete,
    selectedMemberProfileIds,
    t,
  ]);

  const handleAddCandidatesToGroup = useCallback(async () => {
    if (!activeGroup) {
      return;
    }
    if (selectedCandidateProfileIds.length === 0) {
      showErrorToast(t("groupManagementDialog.toast.noCandidatesSelected"));
      return;
    }
    setIsMemberActionLoading(true);
    try {
      await invoke("assign_profiles_to_group", {
        profileIds: selectedCandidateProfileIds,
        groupId: activeGroup.id,
      });
      showSuccessToast(
        t("groupManagementDialog.toast.candidatesAdded", {
          count: selectedCandidateProfileIds.length,
          group: activeGroup.name,
        }),
      );
      appendActivity(
        activeGroup.id,
        t("groupManagementDialog.activity.membersAdded", {
          count: selectedCandidateProfileIds.length,
          name: activeGroup.name,
        }),
      );
      setSelectedCandidateProfileIds([]);
      await loadGroups();
      onGroupManagementComplete();
    } catch (addError) {
      showErrorToast(
        addError instanceof Error
          ? addError.message
          : t("groupManagementDialog.toast.memberActionFailed"),
      );
    } finally {
      setIsMemberActionLoading(false);
    }
  }, [
    activeGroup,
    appendActivity,
    loadGroups,
    onGroupManagementComplete,
    selectedCandidateProfileIds,
    t,
  ]);

  const renderMembersTab = () => {
    if (!activeGroup) {
      return (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.members.noGroupSelected")}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t("groupManagementDialog.members.currentMembers")}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{membersInActiveGroup.length}</Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  isMemberActionLoading ||
                  selectedMemberProfileIds.length === 0 ||
                  isReadOnly
                }
                onClick={() => void handleMoveMembersToDefault()}
              >
                {t("groupManagementDialog.members.moveToDefault")}
              </Button>
              <Select
                value={moveTargetGroupId}
                onValueChange={setMoveTargetGroupId}
                disabled={isMemberActionLoading || isReadOnly}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue
                    placeholder={t(
                      "groupManagementDialog.members.targetGroupPlaceholder",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("groupManagementDialog.members.targetGroupPlaceholder")}
                  </SelectItem>
                  {groups
                    .filter((group) => group.id !== activeGroup.id)
                    .map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={
                  isMemberActionLoading ||
                  selectedMemberProfileIds.length === 0 ||
                  moveTargetGroupId === "none" ||
                  isReadOnly
                }
                onClick={() => void handleMoveMembersToGroup()}
              >
                {t("groupManagementDialog.members.moveToGroup")}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <ScrollArea className="h-64">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("common.labels.name")}</TableHead>
                    <TableHead className="w-28">
                      {t("common.labels.status")}
                    </TableHead>
                    <TableHead className="w-36">
                      {t("profiles.table.lastLaunch")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {membersInActiveGroup.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-sm text-muted-foreground"
                      >
                        {t("groupManagementDialog.members.emptyInGroup")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    membersInActiveGroup.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedMemberProfileIds.includes(
                              profile.id,
                            )}
                            onCheckedChange={() =>
                              toggleMemberSelection(profile.id)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {profile.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {profile.runtime_state ?? t("common.status.stopped")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {profile.last_launch
                            ? formatLocaleDateTime(profile.last_launch * 1000)
                            : t("groupManagementDialog.syncHealth.never")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {t("groupManagementDialog.members.availableProfiles")}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {candidatesForActiveGroup.length}
              </Badge>
              <Input
                value={candidateSearchQuery}
                onChange={(event) =>
                  setCandidateSearchQuery(event.target.value)
                }
                placeholder={t(
                  "groupManagementDialog.members.searchOutsidePlaceholder",
                )}
                className="h-8 w-[260px]"
              />
              <Button
                size="sm"
                disabled={
                  isMemberActionLoading ||
                  selectedCandidateProfileIds.length === 0 ||
                  isReadOnly
                }
                onClick={() => void handleAddCandidatesToGroup()}
              >
                {t("groupManagementDialog.members.addToGroup")}
              </Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-md border">
            <ScrollArea className="h-56">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>{t("common.labels.name")}</TableHead>
                    <TableHead className="w-28">
                      {t("common.labels.status")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatesForActiveGroup.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-sm text-muted-foreground"
                      >
                        {t("groupManagementDialog.members.emptyCandidates")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidatesForActiveGroup.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCandidateProfileIds.includes(
                              profile.id,
                            )}
                            onCheckedChange={() =>
                              toggleCandidateSelection(profile.id)
                            }
                          />
                        </TableCell>
                        <TableCell className="text-sm">
                          {profile.name}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {profile.runtime_state ?? t("common.status.stopped")}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </div>
    );
  };

  const renderPoliciesTab = () => {
    if (!activeGroup) {
      return (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.members.noGroupSelected")}
        </div>
      );
    }

    return (
      <div className="space-y-3 text-sm">
        <div className="divide-y rounded-md border">
          <div className="flex items-center justify-between p-3">
            <p className="text-muted-foreground">
              {t("groupManagementDialog.policies.syncPolicy")}
            </p>
            <p className="font-medium">
              {activeGroup.sync_enabled
                ? t("groupManagementDialog.policies.syncEnabled")
                : t("groupManagementDialog.policies.syncDisabled")}
            </p>
          </div>
          <div className="flex items-center justify-between p-3">
            <p className="text-muted-foreground">
              {t("groupManagementDialog.policies.protectedState")}
            </p>
            <p className="font-medium">
              {t("groupManagementDialog.policies.customManaged")}
            </p>
          </div>
          <div className="flex items-center justify-between p-3">
            <p className="text-muted-foreground">
              {t("groupManagementDialog.policies.memberCount")}
            </p>
            <p className="font-medium">{activeGroup.count}</p>
          </div>
        </div>
        <p className="text-muted-foreground">
          {t("groupManagementDialog.policies.description")}
        </p>
      </div>
    );
  };

  const renderSyncTab = () => {
    if (!activeGroup) {
      return (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.members.noGroupSelected")}
        </div>
      );
    }
    const syncDot = getSyncStatusDot(
      t,
      activeGroup,
      groupSyncStatus[activeGroup.id],
    );

    return (
      <div className="space-y-3 text-sm">
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">
              {t("groupManagementDialog.syncHealth.currentStatus")}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${syncDot.color} ${syncDot.animate ? "animate-pulse" : ""}`}
              />
              <span>{syncDot.label}</span>
            </div>
          </div>
          <p className="text-muted-foreground">{syncDot.tooltip}</p>
          <Separator />
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              {t("groupManagementDialog.syncHealth.lastSync")}
            </p>
            <p className="font-medium">
              {activeGroup.last_sync
                ? formatLocaleDateTime(activeGroup.last_sync * 1000)
                : t("groupManagementDialog.syncHealth.never")}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">
              {t("groupManagementDialog.syncHealth.inUseBySynced")}
            </p>
            <p className="font-medium">
              {groupInUse[activeGroup.id]
                ? t("groupManagementDialog.syncHealth.inUse")
                : t("groupManagementDialog.syncHealth.notInUse")}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderActivityTab = () => {
    if (!activeGroup) {
      return (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.members.noGroupSelected")}
        </div>
      );
    }
    return (
      <ScrollArea className="h-64 rounded-md border">
        <div className="divide-y">
          {activityForActiveGroup.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t("groupManagementDialog.activity.empty")}
            </div>
          ) : (
            activityForActiveGroup.map((entry) => (
              <div key={entry.id} className="p-3">
                <p className="text-sm font-medium">{entry.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatLocaleDateTime(entry.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    );
  };

  const content = (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-end gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {t("groupManagementDialog.totalGroups", {
              count: filteredGroups.length,
            })}
          </Badge>
          <RippleButton
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="flex items-center gap-2"
            disabled={isReadOnly}
          >
            <GoPlus className="h-4 w-4" />
            {t("common.buttons.create")}
          </RippleButton>
        </div>
      </div>

      {isReadOnly ? (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
          {t("entitlement.readOnlyDescription")}
        </div>
      ) : null}

      {!isPageMode ? (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={syncFilter}
            onValueChange={(value) => {
              setSyncFilter(value as "all" | "enabled" | "disabled");
              setPageIndex(0);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue
                placeholder={t("groupManagementDialog.syncFilterLabel")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("groupManagementDialog.syncFilterAll")}
              </SelectItem>
              <SelectItem value="enabled">
                {t("groupManagementDialog.syncFilterEnabled")}
              </SelectItem>
              <SelectItem value="disabled">
                {t("groupManagementDialog.syncFilterDisabled")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sortValue}
            onValueChange={(value) => setSortValue(value as GroupSortValue)}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder={t("groupManagementDialog.sortLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">
                {t("groupManagementDialog.sort.nameAsc")}
              </SelectItem>
              <SelectItem value="name-desc">
                {t("groupManagementDialog.sort.nameDesc")}
              </SelectItem>
              <SelectItem value="profiles-desc">
                {t("groupManagementDialog.sort.profilesDesc")}
              </SelectItem>
              <SelectItem value="profiles-asc">
                {t("groupManagementDialog.sort.profilesAsc")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!isPageMode && selectedGroupIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
          <Badge variant="secondary">
            {t("groupManagementDialog.bulkBar.selected", {
              count: selectedGroupIds.length,
            })}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleBulkSync(true)}
            disabled={isReadOnly}
          >
            {t("groupManagementDialog.bulkBar.enableSync")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleBulkSync(false)}
            disabled={isReadOnly}
          >
            {t("groupManagementDialog.bulkBar.disableSync")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedGroupIds([])}
          >
            {t("groupManagementDialog.bulkBar.clearSelection")}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.loading")}
        </div>
      ) : groups.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.noGroups")}
        </div>
      ) : !isPageMode && filteredGroups.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {t("groupManagementDialog.noResults")}
        </div>
      ) : isPageMode ? (
        <div className="flex min-w-0 items-start gap-4">
          <aside className="w-[300px] shrink-0 rounded-md border">
            <div className="border-b p-3">
              <p className="text-sm font-semibold">
                {t("shell.sections.groups")}
              </p>
              <Input
                className="mt-2 h-8 text-sm"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setPageIndex(0);
                }}
                placeholder={t("groupManagementDialog.searchPlaceholder")}
              />
            </div>
            <ScrollArea className="h-[620px]">
              <Table>
                <TableBody>
                  <TableRow
                    className={
                      activeGroupId === null ? "bg-muted/50" : undefined
                    }
                    onClick={() => setActiveGroupId(null)}
                  >
                    <TableCell className="text-sm font-medium">All</TableCell>
                    <TableCell className="w-16 text-right">
                      <Badge variant="secondary">{profiles.length}</Badge>
                    </TableCell>
                    <TableCell className="w-16" />
                  </TableRow>
                  {filteredGroups.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-sm text-muted-foreground"
                      >
                        {t("groupManagementDialog.noResults")}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {filteredGroups.map((group) => {
                    const isActive = group.id === activeGroupId;
                    const colorHex =
                      groupColorById[group.id] ?? DEFAULT_GROUP_COLOR;
                    return (
                      <TableRow
                        key={group.id}
                        className={isActive ? "bg-muted/50" : undefined}
                        onClick={() => {
                          setActiveGroupId(group.id);
                          setSelectedMemberProfileIds([]);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: colorHex }}
                            />
                            <span className="text-sm font-medium">
                              {group.name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="w-16 text-right">
                          <Badge variant="secondary">{group.count}</Badge>
                        </TableCell>
                        <TableCell className="w-16">
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={(event) => event.stopPropagation()}
                                  disabled={isReadOnly}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="w-[190px]"
                              >
                                <DropdownMenuLabel>
                                  {group.name}
                                </DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => handleEditGroup(group)}
                                >
                                  {t("groupManagementDialog.sidebar.rename")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setActiveGroupId(group.id);
                                  }}
                                >
                                  {t("groupManagementDialog.sidebar.share")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setActiveGroupId(group.id);
                                    setGroupSettingsOpen(true);
                                  }}
                                >
                                  {t(
                                    "groupManagementDialog.sidebar.memberAccess",
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => handleDeleteGroup(group)}
                                >
                                  {t("groupManagementDialog.sidebar.delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </aside>

          <section className="min-w-0 flex-1 space-y-3">
            <div className="flex rounded-md border">
              <div className="min-w-0 flex-1 border-r p-2.5">
                <p className="type-section uppercase text-muted-foreground">
                  {t("groupManagementDialog.columns.profiles")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-none">
                  {workspaceStats.total}
                </p>
              </div>
              <div className="min-w-0 flex-1 border-r p-2.5">
                <p className="type-section uppercase text-muted-foreground">
                  {t("common.status.running")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-none">
                  {workspaceStats.running}
                </p>
              </div>
              <div className="min-w-0 flex-1 border-r p-2.5">
                <p className="type-section uppercase text-muted-foreground">
                  {t("groupManagementDialog.metrics.drift")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-none">
                  {workspaceStats.drift}
                </p>
              </div>
              <div className="min-w-0 flex-1 border-r p-2.5">
                <p className="type-section uppercase text-muted-foreground">
                  {t("groupManagementDialog.metrics.ruleMatch")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-none">
                  {workspaceStats.ruleMatch}%
                </p>
              </div>
              <div className="min-w-0 flex-1 p-2.5">
                <p className="type-section uppercase text-muted-foreground">
                  {t("groupManagementDialog.metrics.blocked")}
                </p>
                <p className="mt-1 text-sm font-semibold leading-none">
                  {workspaceStats.blocked}
                </p>
              </div>
            </div>

            <div className="min-w-0 rounded-md border">
              <div className="border-b px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {activeGroup?.name ?? "All"}
                  </p>
                  {activeGroupId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => setGroupSettingsOpen(true)}
                    >
                      {t("groupManagementDialog.settings.title")}
                    </Button>
                  ) : null}
                </div>
              </div>
              <div className="p-3">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    value={memberSearchQuery}
                    onChange={(event) => {
                      setMemberSearchQuery(event.target.value);
                      setProfilesPageIndex(0);
                    }}
                    placeholder={t(
                      "groupManagementDialog.members.searchPlaceholder",
                    )}
                    className="h-9 w-[340px] shrink-0"
                  />
                  <Select
                    value={profilesStatusFilter}
                    onValueChange={(value) => {
                      setProfilesStatusFilter(
                        value as "all" | "running" | "stopped",
                      );
                      setProfilesPageIndex(0);
                    }}
                  >
                    <SelectTrigger className="h-9 w-[160px] shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {t("groupManagementDialog.members.statusAll")}
                      </SelectItem>
                      <SelectItem value="running">
                        {t("common.status.running")}
                      </SelectItem>
                      <SelectItem value="stopped">
                        {t("common.status.stopped")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <ScrollArea className="h-[500px] rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>{t("common.labels.name")}</TableHead>
                        <TableHead className="w-36">
                          {t("profiles.table.proxy")}
                        </TableHead>
                        <TableHead className="w-40">
                          {t("profiles.table.lastLaunch")}
                        </TableHead>
                        <TableHead className="w-28">
                          {t("common.labels.status")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedProfilesForPage.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-sm text-muted-foreground"
                          >
                            {t("groupManagementDialog.noResults")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        pagedProfilesForPage.map((profile, index) => (
                          <TableRow key={profile.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedMemberProfileIds.includes(
                                  profile.id,
                                )}
                                onCheckedChange={() =>
                                  toggleMemberSelection(profile.id)
                                }
                              />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {safeProfilesPageIndex * profilesPageSize +
                                index +
                                1}
                            </TableCell>
                            <TableCell className="text-sm font-normal">
                              {profile.name}
                            </TableCell>
                            <TableCell className="text-sm font-normal text-muted-foreground">
                              {profile.vpn_id
                                ? (vpnNameById.get(profile.vpn_id) ??
                                  profile.vpn_id)
                                : profile.proxy_id
                                  ? (proxyNameById.get(profile.proxy_id) ??
                                    profile.proxy_id)
                                  : "-"}
                            </TableCell>
                            <TableCell className="text-sm font-normal text-muted-foreground">
                              {profile.last_launch
                                ? formatLocaleDateTime(
                                    profile.last_launch * 1000,
                                  )
                                : t("groupManagementDialog.syncHealth.never")}
                            </TableCell>
                            <TableCell className="text-sm font-normal text-muted-foreground">
                              {profile.runtime_state ??
                                t("common.status.stopped")}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
                <div className="mt-2">
                  <TablePaginationControls
                    totalRows={filteredProfilesForPage.length}
                    pageIndex={safeProfilesPageIndex}
                    pageCount={profilesPageCount}
                    pageSize={profilesPageSize}
                    canPreviousPage={safeProfilesPageIndex > 0}
                    canNextPage={safeProfilesPageIndex < profilesPageCount - 1}
                    onPreviousPage={() =>
                      setProfilesPageIndex((current) =>
                        Math.max(0, current - 1),
                      )
                    }
                    onNextPage={() =>
                      setProfilesPageIndex((current) =>
                        Math.min(profilesPageCount - 1, current + 1),
                      )
                    }
                    onPageSizeChange={(nextPageSize) => {
                      setProfilesPageSize(nextPageSize);
                      setProfilesPageIndex(0);
                    }}
                    summaryLabel={t("groupManagementDialog.paginationSummary", {
                      from: profilesSummaryFrom,
                      to: profilesSummaryTo,
                      total: filteredProfilesForPage.length,
                    })}
                    pageLabel={t("common.pagination.page")}
                    rowsPerPageLabel={t("common.pagination.rowsPerPage")}
                    previousLabel={t("common.pagination.previous")}
                    nextLabel={t("common.pagination.next")}
                  />
                </div>
                {activeGroupId ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={
                        isMemberActionLoading ||
                        selectedMemberProfileIds.length === 0 ||
                        isReadOnly
                      }
                      onClick={() => void handleMoveMembersToDefault()}
                    >
                      {t("groupManagementDialog.members.moveToDefault")}
                    </Button>
                    <Select
                      value={moveTargetGroupId}
                      onValueChange={setMoveTargetGroupId}
                      disabled={isMemberActionLoading || isReadOnly}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue
                          placeholder={t(
                            "groupManagementDialog.members.targetGroupPlaceholder",
                          )}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          {t(
                            "groupManagementDialog.members.targetGroupPlaceholder",
                          )}
                        </SelectItem>
                        {groups
                          .filter((group) => group.id !== activeGroupId)
                          .map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={
                        isMemberActionLoading ||
                        selectedMemberProfileIds.length === 0 ||
                        moveTargetGroupId === "none" ||
                        isReadOnly
                      }
                      onClick={() => void handleMoveMembersToGroup()}
                    >
                      {t("groupManagementDialog.members.moveToGroup")}
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div
          className={
            isPageMode
              ? "grid gap-4 lg:grid-cols-12 lg:items-start"
              : "space-y-4"
          }
        >
          <div className={isPageMode ? "min-w-0 lg:col-span-7" : "min-w-0"}>
            <div className="rounded-md border">
              <ScrollArea className="h-[260px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allCurrentPageSelected}
                          onCheckedChange={(checked) =>
                            toggleSelectCurrentPage(Boolean(checked))
                          }
                          aria-label={t(
                            "groupManagementDialog.bulkBar.selectPage",
                          )}
                        />
                      </TableHead>
                      <TableHead>{t("common.labels.name")}</TableHead>
                      <TableHead className="w-20">
                        {t("groupManagementDialog.columns.profiles")}
                      </TableHead>
                      <TableHead className="w-36">
                        {t("groupManagementDialog.columns.syncHealth")}
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
                    {pagedGroups.map((group) => {
                      const isSelected = selectedGroupSet.has(group.id);
                      const syncDot = getSyncStatusDot(
                        t,
                        group,
                        groupSyncStatus[group.id],
                      );
                      const rowActive = activeGroupId === group.id;
                      return (
                        <TableRow
                          key={group.id}
                          className={rowActive ? "bg-muted/40" : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() =>
                                toggleGroupSelection(group.id)
                              }
                            />
                          </TableCell>
                          <TableCell className="text-sm font-normal">
                            <button
                              type="button"
                              className="w-full cursor-pointer text-left font-normal hover:text-foreground/90"
                              onClick={() => {
                                setActiveGroupId(group.id);
                                setSelectedMemberProfileIds([]);
                                setSelectedCandidateProfileIds([]);
                              }}
                            >
                              {group.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{group.count}</Badge>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 rounded-full ${syncDot.color} ${syncDot.animate ? "animate-pulse" : ""}`}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {syncDot.label}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{syncDot.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center">
                                  <Checkbox
                                    checked={group.sync_enabled}
                                    onCheckedChange={() =>
                                      void handleToggleSync(group)
                                    }
                                    disabled={
                                      isTogglingSync[group.id] ||
                                      groupInUse[group.id] ||
                                      isReadOnly
                                    }
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {groupInUse[group.id] ? (
                                  <p>
                                    {t(
                                      "groupManagementDialog.tooltips.syncDisableBlockedGroup",
                                    )}
                                  </p>
                                ) : (
                                  <p>
                                    {group.sync_enabled
                                      ? t(
                                          "groupManagementDialog.tooltips.disableSync",
                                        )
                                      : t(
                                          "groupManagementDialog.tooltips.enableSync",
                                        )}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditGroup(group)}
                                    disabled={isReadOnly}
                                  >
                                    <LuPencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {t(
                                      "groupManagementDialog.tooltips.editGroup",
                                    )}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteGroup(group)}
                                    disabled={isReadOnly}
                                  >
                                    <LuTrash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>
                                    {t(
                                      "groupManagementDialog.tooltips.deleteGroup",
                                    )}
                                  </p>
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
              <div className="p-2">
                <TablePaginationControls
                  totalRows={filteredGroups.length}
                  pageIndex={safePageIndex}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  canPreviousPage={safePageIndex > 0}
                  canNextPage={safePageIndex < pageCount - 1}
                  onPreviousPage={() =>
                    setPageIndex((current) => Math.max(0, current - 1))
                  }
                  onNextPage={() =>
                    setPageIndex((current) =>
                      Math.min(pageCount - 1, current + 1),
                    )
                  }
                  onPageSizeChange={(nextPageSize) => {
                    setPageSize(nextPageSize);
                    setPageIndex(0);
                  }}
                  summaryLabel={t("groupManagementDialog.paginationSummary", {
                    from: summaryFrom,
                    to: summaryTo,
                    total: filteredGroups.length,
                  })}
                  pageLabel={t("common.pagination.page")}
                  rowsPerPageLabel={t("common.pagination.rowsPerPage")}
                  previousLabel={t("common.pagination.previous")}
                  nextLabel={t("common.pagination.next")}
                />
              </div>
            </div>
          </div>

          {isPageMode ? (
            <div className="min-w-0 rounded-md border lg:col-span-5">
              <div className="space-y-0.5 px-3 pt-3">
                <p className="text-xs text-muted-foreground">
                  {t("groupManagementDialog.detail.title")}
                </p>
                <p className="text-base font-semibold leading-tight">
                  {activeGroup?.name ?? "-"}
                </p>
              </div>
              <Separator className="my-3" />
              <Input
                value={memberSearchQuery}
                onChange={(event) => setMemberSearchQuery(event.target.value)}
                placeholder={t(
                  "groupManagementDialog.members.searchPlaceholder",
                )}
                className="mx-3 mb-3 w-[calc(100%-1.5rem)]"
              />
              <Tabs
                className="mt-0"
                value={detailTab}
                onValueChange={(value) => setDetailTab(value as GroupDetailTab)}
              >
                <TabsList className="grid h-auto w-full grid-cols-4 rounded-none border-b bg-transparent p-0 text-foreground">
                  <TabsTrigger
                    value="members"
                    className="rounded-none border-b-2 border-transparent px-2 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {t("groupManagementDialog.tabs.members")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="policies"
                    className="rounded-none border-b-2 border-transparent px-2 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {t("groupManagementDialog.tabs.policies")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="sync"
                    className="rounded-none border-b-2 border-transparent px-2 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {t("groupManagementDialog.tabs.sync")}
                  </TabsTrigger>
                  <TabsTrigger
                    value="activity"
                    className="rounded-none border-b-2 border-transparent px-2 py-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {t("groupManagementDialog.tabs.activity")}
                  </TabsTrigger>
                </TabsList>
                <div className="p-3">
                  <TabsContent value="members" className="mt-0">
                    {renderMembersTab()}
                  </TabsContent>
                  <TabsContent value="policies" className="mt-0">
                    {renderPoliciesTab()}
                  </TabsContent>
                  <TabsContent value="sync" className="mt-0">
                    {renderSyncTab()}
                  </TabsContent>
                  <TabsContent value="activity" className="mt-0">
                    {renderActivityTab()}
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );

  return (
    <>
      {mode === "dialog" ? (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t("groupManagementDialog.title")}</DialogTitle>
              <DialogDescription>
                {t("groupManagementDialog.description")}
              </DialogDescription>
            </DialogHeader>

            {content}

            <DialogFooter>
              <RippleButton variant="outline" onClick={onClose}>
                {t("common.buttons.close")}
              </RippleButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <div className="p-0">{content}</div>
      )}

      <CreateGroupDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onGroupCreated={handleGroupCreated}
      />

      <EditGroupDialog
        isOpen={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        group={selectedGroup}
        onGroupUpdated={handleGroupUpdated}
      />

      <DeleteGroupDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        group={selectedGroup}
        onGroupDeleted={handleGroupDeleted}
      />

      <Dialog open={groupSettingsOpen} onOpenChange={setGroupSettingsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {t("groupManagementDialog.settings.title")}
            </DialogTitle>
            <DialogDescription>{activeGroup?.name ?? "All"}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("groupManagementDialog.settings.color")}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activeGroupColor}
                  disabled={!activeGroupId}
                  onChange={(event) => {
                    if (!activeGroupId) return;
                    setGroupColorById((prev) => ({
                      ...prev,
                      [activeGroupId]: event.target.value,
                    }));
                  }}
                  className="h-8 w-10 cursor-pointer rounded border border-border bg-background p-0"
                />
                <Input
                  value={activeGroupColor}
                  onChange={(event) => {
                    if (!activeGroupId) return;
                    setGroupColorById((prev) => ({
                      ...prev,
                      [activeGroupId]: event.target.value,
                    }));
                  }}
                  disabled={!activeGroupId}
                  className="h-8"
                />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("groupManagementDialog.settings.share")}
              </p>
              <Select
                value={activeGroupShare}
                onValueChange={(value) => {
                  if (!activeGroupId) return;
                  setGroupShareById((prev) => ({
                    ...prev,
                    [activeGroupId]: value as GroupShareMode,
                  }));
                }}
                disabled={!activeGroupId}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    {t("groupManagementDialog.settings.sharePrivate")}
                  </SelectItem>
                  <SelectItem value="team">
                    {t("groupManagementDialog.settings.shareTeam")}
                  </SelectItem>
                  <SelectItem value="public">
                    {t("groupManagementDialog.settings.sharePublic")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                {t("groupManagementDialog.settings.memberAccess")}
              </p>
              <Select
                value={activeGroupAccess}
                onValueChange={(value) => {
                  if (!activeGroupId) return;
                  setGroupAccessById((prev) => ({
                    ...prev,
                    [activeGroupId]: value as GroupMemberAccess,
                  }));
                }}
                disabled={!activeGroupId}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner_admin">
                    {t("groupManagementDialog.settings.accessOwnerAdmin")}
                  </SelectItem>
                  <SelectItem value="all_members">
                    {t("groupManagementDialog.settings.accessAllMembers")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GroupManagementPanel({
  onGroupManagementComplete = () => void 0,
}: {
  onGroupManagementComplete?: () => void;
}) {
  return (
    <GroupManagementDialog
      mode="page"
      isOpen={true}
      onClose={() => void 0}
      onGroupManagementComplete={onGroupManagementComplete}
    />
  );
}
