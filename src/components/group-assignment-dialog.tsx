"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { GoPlus } from "react-icons/go";
import { CreateGroupDialog } from "@/components/create-group-dialog";
import { LoadingButton } from "@/components/loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { BrowserProfile, ProfileGroup } from "@/types";
import { RippleButton } from "./ui/ripple";

interface GroupAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfiles: string[];
  onAssignmentComplete: () => void;
  profiles?: BrowserProfile[];
}

export function GroupAssignmentDialog({
  isOpen,
  onClose,
  selectedProfiles,
  onAssignmentComplete,
  profiles = [],
}: GroupAssignmentDialogProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ProfileGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const groupList = await invoke<ProfileGroup[]>("get_profile_groups");
      const scope = getCurrentDataScope();
      const scopedGroups = scopeEntitiesForContext(
        "groups",
        groupList,
        (group) => group.id,
        scope,
      );
      setGroups(scopedGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load groups");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAssign = useCallback(async () => {
    setIsAssigning(true);
    setError(null);
    try {
      await invoke("assign_profiles_to_group", {
        profileIds: selectedProfiles,
        groupId: selectedGroupId,
      });

      const groupName = selectedGroupId
        ? groups.find((g) => g.id === selectedGroupId)?.name || "Unknown Group"
        : t("groupAssignmentDialog.labels.defaultNoGroup");

      showSuccessToast(
        t("groupAssignmentDialog.toasts.assigned", {
          count: selectedProfiles.length,
          group: groupName,
        }),
      );
      onAssignmentComplete();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to assign profiles to group";
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  }, [
    selectedProfiles,
    selectedGroupId,
    groups,
    onAssignmentComplete,
    onClose,
    t,
  ]);

  useEffect(() => {
    if (isOpen) {
      void loadGroups();
      setSelectedGroupId(null);
      setError(null);
    }
  }, [isOpen, loadGroups]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleScopeChanged = () => {
      void loadGroups();
    };
    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    return () => {
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [isOpen, loadGroups]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupAssignmentDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("groupAssignmentDialog.description", {
              count: selectedProfiles.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("groupAssignmentDialog.labels.selectedProfiles")}</Label>
            <ScrollArea className="max-h-32 rounded-md bg-muted p-3">
              <ul className="text-sm space-y-1">
                {selectedProfiles.map((profileId) => {
                  // Find the profile name for display
                  const profile = profiles.find(
                    (p: BrowserProfile) => p.id === profileId,
                  );
                  const displayName = profile ? profile.name : profileId;
                  return (
                    <li key={profileId} className="truncate">
                      • {displayName}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="group-select">
                {t("groupAssignmentDialog.labels.assignToGroup")}
              </Label>
              <RippleButton
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setCreateDialogOpen(true)}
              >
                <GoPlus className="mr-1 h-3 w-3" />{" "}
                {t("groupAssignmentDialog.actions.createGroup")}
              </RippleButton>
            </div>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                {t("groupAssignmentDialog.loadingGroups")}
              </div>
            ) : (
              <Select
                value={selectedGroupId || "default"}
                onValueChange={(value) => {
                  setSelectedGroupId(value === "default" ? null : value);
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("groupAssignmentDialog.labels.selectGroup")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    {t("groupAssignmentDialog.labels.defaultNoGroup")}
                  </SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <RippleButton
            variant="outline"
            onClick={onClose}
            disabled={isAssigning}
          >
            {t("common.buttons.cancel")}
          </RippleButton>
          <LoadingButton
            isLoading={isAssigning}
            onClick={() => void handleAssign()}
            disabled={isLoading}
          >
            {t("common.buttons.apply")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
      <CreateGroupDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onGroupCreated={(group) => {
          setGroups((prev) => [...prev, group]);
          setSelectedGroupId(group.id);
          setCreateDialogOpen(false);
        }}
      />
    </Dialog>
  );
}
