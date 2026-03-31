"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  LuEllipsisVertical,
  LuFolder,
  LuFolderOpen,
  LuPencil,
  LuShare2,
  LuSettings2,
  LuTrash2,
} from "react-icons/lu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { GroupWithCount } from "@/types";

interface GroupBadgesProps {
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string) => void;
  onOpenGroupManagement?: () => void;
  onEditGroup?: (groupId: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  refreshTrigger?: number;
  groups: GroupWithCount[];
  isLoading: boolean;
}

export function GroupBadges({
  selectedGroupId,
  onGroupSelect,
  onOpenGroupManagement,
  onEditGroup,
  onDeleteGroup,
  groups,
  isLoading,
}: GroupBadgesProps) {
  const { t } = useTranslation();
  const ALL_GROUP_ID = "all";

  const visibleGroups = groups.filter(
    (group) => group.id !== "default" && group.id !== ALL_GROUP_ID,
  );
  const totalProfiles = groups.reduce(
    (sum, group) => sum + (group.count ?? 0),
    0,
  );
  const folderItems = [
    {
      id: ALL_GROUP_ID,
      name: t("groups.all"),
      count: totalProfiles,
      isAll: true,
    },
    ...visibleGroups.map((group) => ({
      id: group.id,
      name: group.name,
      count: group.count ?? 0,
      isAll: false,
    })),
  ];
  const normalizedSelectedGroupId =
    !selectedGroupId || selectedGroupId === "default"
      ? ALL_GROUP_ID
      : selectedGroupId;
  const hasOnlyAllGroup = visibleGroups.length === 0;

  const handleShareGroup = useCallback(
    async (groupId: string, groupName: string) => {
      try {
        await navigator.clipboard.writeText(`buglogin://group/${groupId}`);
        showSuccessToast(t("groups.shareCopied", { group: groupName }));
      } catch {
        showErrorToast(t("groups.shareFailed"));
      }
    },
    [t],
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <LuFolderOpen className="h-4 w-4 text-muted-foreground" />
          <span>{t("groups.title")}</span>
        </div>
        {onOpenGroupManagement ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={onOpenGroupManagement}
            aria-label={t("groups.management")}
            title={t("groups.management")}
          >
            <LuSettings2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <ScrollArea
        role="region"
        aria-label="Profile groups"
        className="app-scroll-gutter w-full"
      >
        <div className="flex min-w-max items-stretch gap-1.5 p-1.5">
          {folderItems.map((group) => {
            const isSelected = normalizedSelectedGroupId === group.id;
            const FolderIcon = isSelected ? LuFolderOpen : LuFolder;
            const canUseItemActions = !group.isAll;

            return (
              <div
                key={group.id}
                className={cn(
                  "group flex min-w-[160px] max-w-[210px] shrink-0 items-center gap-1 rounded-md border px-1 py-1 transition-colors",
                  isSelected
                    ? "border-border bg-muted/55"
                    : "border-border/60 bg-background hover:bg-muted/45",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-left"
                  onClick={() => {
                    if (group.isAll) {
                      onGroupSelect(ALL_GROUP_ID);
                      return;
                    }
                    onGroupSelect(isSelected ? ALL_GROUP_ID : group.id);
                  }}
                >
                  <FolderIcon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "text-foreground" : "text-muted-foreground",
                    )}
                  />
                  <p className="truncate text-xs font-medium text-foreground">
                    {group.name}
                  </p>
                </button>
                <span
                  className={cn(
                    "rounded-full border border-border bg-background px-2 py-0.5 text-[10px] text-muted-foreground",
                    isSelected && "text-foreground",
                  )}
                >
                  {group.count}
                </span>
                {!group.isAll ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      void handleShareGroup(group.id, group.name);
                    }}
                    aria-label={t("groups.actions.share")}
                    title={t("groups.actions.share")}
                  >
                    <LuShare2 className="h-3.5 w-3.5" />
                  </Button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      aria-label={t("groups.actions.menu")}
                    >
                      <LuEllipsisVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        onGroupSelect(group.id);
                      }}
                    >
                      <LuFolderOpen className="h-4 w-4" />
                      {t("groups.actions.filter")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void handleShareGroup(group.id, group.name);
                      }}
                    >
                      <LuShare2 className="h-4 w-4" />
                      {t("groups.actions.share")}
                    </DropdownMenuItem>
                    {canUseItemActions ? <DropdownMenuSeparator /> : null}
                    {canUseItemActions && onEditGroup ? (
                      <DropdownMenuItem
                        onClick={() => {
                          onEditGroup(group.id);
                        }}
                      >
                        <LuPencil className="h-4 w-4" />
                        {t("groups.edit")}
                      </DropdownMenuItem>
                    ) : null}
                    {canUseItemActions && onDeleteGroup ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          onDeleteGroup(group.id);
                        }}
                      >
                        <LuTrash2 className="h-4 w-4" />
                        {t("groups.delete")}
                      </DropdownMenuItem>
                    ) : null}
                    {canUseItemActions &&
                    (onEditGroup || onDeleteGroup) &&
                    onOpenGroupManagement ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {onOpenGroupManagement ? (
                      <DropdownMenuItem onClick={onOpenGroupManagement}>
                        <LuSettings2 className="h-4 w-4" />
                        {t("groups.management")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          {isLoading && groups.length === 0 ? (
            <div className="flex h-8 w-8 items-center justify-center">
              <Spinner size="sm" />
            </div>
          ) : null}
        </div>
      </ScrollArea>
      {hasOnlyAllGroup && (
        <p className="px-3 pb-3 text-[11px] text-muted-foreground">
          {t("groups.noGroupsDescription")}
        </p>
      )}
    </div>
  );
}
