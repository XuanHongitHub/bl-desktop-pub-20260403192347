import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FaDownload } from "react-icons/fa";
import { FiWifi } from "react-icons/fi";
import { GoBookmark, GoGear, GoKebabHorizontal, GoPlus } from "react-icons/go";
import {
  LuArchive,
  LuCloud,
  LuPin,
  LuPinOff,
  LuPlug,
  LuPuzzle,
  LuSearch,
  LuUsers,
  LuX,
} from "react-icons/lu";
import { cn } from "@/lib/utils";
import {
  GROUP_APPEARANCE_STORAGE_KEY,
  GROUP_APPEARANCE_UPDATED_EVENT,
  readGroupAppearanceMap,
  sanitizeGroupColor,
} from "@/lib/group-appearance-store";
import type { GroupWithCount } from "@/types";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { ProBadge } from "./ui/pro-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type ProfileSavedView = {
  id: string;
  name: string;
};

type HeaderActionsProps = {
  onSettingsPageOpen: () => void;
  onProxyPageOpen: () => void;
  onGroupsPageOpen: () => void;
  onImportProfileDialogOpen: (open: boolean) => void;
  onCreateProfileDialogOpen: (open: boolean) => void;
  onSyncConfigDialogOpen: (open: boolean) => void;
  onIntegrationsPageOpen: () => void;
  onExtensionManagementDialogOpen: (open: boolean) => void;
  extensionManagementUnlocked?: boolean;
};

type ToolbarProps = {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  selectedGroupId: string;
  groups: GroupWithCount[];
  onSelectedGroupChange: (groupId: string) => void;
  savedViews: ProfileSavedView[];
  onCreateSavedView: () => void;
  onApplySavedView: (id: string) => void;
  onDeleteSavedView: (id: string) => void;
  profileViewMode: "active" | "archived";
  onToggleProfileViewMode: () => void;
  archivedCount: number;
  pinnedCount: number;
  showPinnedOnly: boolean;
  onTogglePinnedOnly: () => void;
};

function SavedViewsMenu({
  searchQuery,
  selectedGroupId,
  savedViews,
  onCreateSavedView,
  onApplySavedView,
  onDeleteSavedView,
}: Pick<
  ToolbarProps,
  | "searchQuery"
  | "selectedGroupId"
  | "savedViews"
  | "onCreateSavedView"
  | "onApplySavedView"
  | "onDeleteSavedView"
>) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex h-8 items-center gap-1.5 px-2"
                >
                  <GoBookmark className="h-3.5 w-3.5" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{t("header.savedViews.title")}</TooltipContent>
          </Tooltip>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuItem
          onClick={onCreateSavedView}
          disabled={
            !searchQuery.trim() && selectedGroupId === "all"
          }
        >
          <GoPlus className="mr-2 h-4 w-4" />
          {t("header.savedViews.saveCurrent")}
        </DropdownMenuItem>
        {savedViews.length === 0 ? (
          <DropdownMenuItem disabled>
            {t("header.savedViews.empty")}
          </DropdownMenuItem>
        ) : (
          savedViews.map((view) => (
            <DropdownMenuItem
              key={view.id}
              onClick={() => onApplySavedView(view.id)}
            >
              <span className="truncate">{view.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onDeleteSavedView(view.id);
                }}
              >
                <LuX className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function ProfilesWorkspaceHeaderActions({
  onSettingsPageOpen,
  onProxyPageOpen,
  onGroupsPageOpen,
  onImportProfileDialogOpen,
  onCreateProfileDialogOpen,
  onSyncConfigDialogOpen,
  onIntegrationsPageOpen,
  onExtensionManagementDialogOpen,
  extensionManagementUnlocked = false,
}: HeaderActionsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex h-8 items-center gap-1.5 px-2"
                  >
                    <GoKebabHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("header.moreActions")}</TooltipContent>
            </Tooltip>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              onSettingsPageOpen();
            }}
          >
            <GoGear className="mr-2 h-4 w-4" />
            {t("header.menu.settings")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onProxyPageOpen();
            }}
          >
            <FiWifi className="mr-2 h-4 w-4" />
            {t("header.menu.proxies")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onGroupsPageOpen();
            }}
          >
            <LuUsers className="mr-2 h-4 w-4" />
            {t("header.menu.groups")}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!extensionManagementUnlocked}
            className={cn(!extensionManagementUnlocked && "opacity-50")}
            onClick={() => {
              onExtensionManagementDialogOpen(true);
            }}
          >
            <LuPuzzle className="mr-2 h-4 w-4" />
            {t("header.menu.extensions")}
            {!extensionManagementUnlocked && <ProBadge className="ml-auto" />}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onSyncConfigDialogOpen(true);
            }}
          >
            <LuCloud className="mr-2 h-4 w-4" />
            {t("header.menu.syncService")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onIntegrationsPageOpen();
            }}
          >
            <LuPlug className="mr-2 h-4 w-4" />
            {t("header.menu.integrations")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              onImportProfileDialogOpen(true);
            }}
          >
            <FaDownload className="mr-2 h-4 w-4" />
            {t("header.menu.importProfile")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        size="sm"
        onClick={() => {
          onCreateProfileDialogOpen(true);
        }}
        className="flex h-8 items-center gap-1.5 px-2.5 text-[11px]"
      >
        <GoPlus className="h-3.5 w-3.5" />
        {t("header.createProfile")}
      </Button>
    </div>
  );
}

export function ProfilesWorkspaceToolbar({
  searchQuery,
  onSearchQueryChange,
  selectedGroupId,
  groups,
  onSelectedGroupChange,
  savedViews,
  onCreateSavedView,
  onApplySavedView,
  onDeleteSavedView,
  profileViewMode,
  onToggleProfileViewMode,
  archivedCount,
  pinnedCount,
  showPinnedOnly,
  onTogglePinnedOnly,
}: ToolbarProps) {
  const { t } = useTranslation();
  const [groupColorById, setGroupColorById] = useState<Record<string, string>>({});
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (localSearchQuery !== searchQuery) {
        onSearchQueryChange(localSearchQuery);
      }
    }, 120);
    return () => {
      window.clearTimeout(timer);
    };
  }, [localSearchQuery, onSearchQueryChange, searchQuery]);

  useEffect(() => {
    const applyGroupColors = () => {
      const appearance = readGroupAppearanceMap();
      const next: Record<string, string> = {};
      for (const [groupId, config] of Object.entries(appearance)) {
        if (config?.color) {
          next[groupId] = sanitizeGroupColor(config.color);
        }
      }
      setGroupColorById(next);
    };

    const handleAppearanceUpdate = () => {
      applyGroupColors();
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === GROUP_APPEARANCE_STORAGE_KEY) {
        applyGroupColors();
      }
    };

    applyGroupColors();
    window.addEventListener(
      GROUP_APPEARANCE_UPDATED_EVENT,
      handleAppearanceUpdate as EventListener,
    );
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(
        GROUP_APPEARANCE_UPDATED_EVENT,
        handleAppearanceUpdate as EventListener,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={selectedGroupId} onValueChange={onSelectedGroupChange}>
        <SelectTrigger size="sm" className="h-8 w-[13rem] text-xs">
          <SelectValue placeholder={t("groups.all")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("groups.all")}</SelectItem>
          <SelectItem value="default">
            {t("groupAssignmentDialog.labels.defaultNoGroup")}
          </SelectItem>
          {groups
            .filter((group) => group.id !== "default" && group.id !== "all")
            .map((group) => (
              <SelectItem key={group.id} value={group.id}>
                <span className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full border border-border/60"
                    style={{
                      backgroundColor: groupColorById[group.id] ?? "transparent",
                    }}
                  />
                  <span>{group.name}</span>
                </span>
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      <div className="relative w-full max-w-[22rem] min-w-[13rem]">
        <Input
          type="text"
          placeholder={t("header.searchPlaceholder")}
          value={localSearchQuery}
          onChange={(e) => setLocalSearchQuery(e.target.value)}
          className="h-8 w-full pl-9 pr-8 text-xs"
        />
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        {localSearchQuery && (
          <button
            type="button"
            onClick={() => setLocalSearchQuery("")}
            className="absolute right-2 top-1/2 rounded-sm p-1 transition-colors -translate-y-1/2 hover:bg-accent"
            aria-label={t("header.clearSearch")}
          >
            <LuX className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <SavedViewsMenu
        searchQuery={localSearchQuery}
        selectedGroupId={selectedGroupId}
        savedViews={savedViews}
        onCreateSavedView={onCreateSavedView}
        onApplySavedView={onApplySavedView}
        onDeleteSavedView={onDeleteSavedView}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="sm"
              variant={showPinnedOnly ? "default" : "outline"}
              className="relative flex h-8 items-center gap-1.5 px-2"
              onClick={onTogglePinnedOnly}
            >
              {showPinnedOnly ? (
                <LuPinOff className="h-3.5 w-3.5" />
              ) : (
                <LuPin className="h-3.5 w-3.5" />
              )}
              <span className="text-xs font-medium">
                {t("profiles.actions.pinned")}
              </span>
              {pinnedCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                  {pinnedCount}
                </span>
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {showPinnedOnly
            ? t("header.savedViews.showAllProfiles")
            : t("header.savedViews.showPinnedOnly")}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Button
              size="sm"
              variant={profileViewMode === "archived" ? "default" : "outline"}
              className="relative flex h-8 items-center gap-1.5 px-2"
              onClick={onToggleProfileViewMode}
            >
              <LuArchive className="h-3.5 w-3.5" />
              {archivedCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                  {archivedCount}
                </span>
              )}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {profileViewMode === "archived"
            ? t("header.savedViews.showActive")
            : t("header.savedViews.showArchived")}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
