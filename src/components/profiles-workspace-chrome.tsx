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
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { ProBadge } from "./ui/pro-badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

type ProfileSavedView = {
  id: string;
  name: string;
};

type HeaderActionsProps = {
  onSettingsPageOpen: () => void;
  onProxyPageOpen: () => void;
  onGroupManagementDialogOpen: (open: boolean) => void;
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
                  className="flex h-[36px] items-center gap-2"
                >
                  <GoBookmark className="h-4 w-4" />
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
            !searchQuery.trim() &&
            (selectedGroupId === "all" || selectedGroupId === "default")
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
  onGroupManagementDialogOpen,
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
                    className="flex h-[36px] items-center gap-2"
                  >
                    <GoKebabHorizontal className="h-4 w-4" />
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
              onGroupManagementDialogOpen(true);
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
        className="flex h-[36px] items-center gap-2 px-3"
      >
        <GoPlus className="h-4 w-4" />
        {t("header.createProfile")}
      </Button>
    </div>
  );
}

export function ProfilesWorkspaceToolbar({
  searchQuery,
  onSearchQueryChange,
  selectedGroupId,
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full max-w-sm min-w-[14rem]">
        <Input
          type="text"
          placeholder={t("header.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="w-full pl-10 pr-8"
        />
        <LuSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchQueryChange("")}
            className="absolute right-2 top-1/2 rounded-sm p-1 transition-colors -translate-y-1/2 hover:bg-accent"
            aria-label={t("header.clearSearch")}
          >
            <LuX className="h-4 w-4 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <SavedViewsMenu
        searchQuery={searchQuery}
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
              className="relative flex h-[36px] items-center gap-2 px-2.5"
              onClick={onTogglePinnedOnly}
            >
              {showPinnedOnly ? (
                <LuPinOff className="h-4 w-4" />
              ) : (
                <LuPin className="h-4 w-4" />
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
              className="relative flex h-[36px] items-center gap-2"
              onClick={onToggleProfileViewMode}
            >
              <LuArchive className="h-4 w-4" />
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
