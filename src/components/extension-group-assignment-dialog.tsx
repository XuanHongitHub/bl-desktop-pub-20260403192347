"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { ProBadge } from "@/components/ui/pro-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { BrowserProfile, ExtensionGroup } from "@/types";
import { RippleButton } from "./ui/ripple";

interface ExtensionGroupAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfiles: string[];
  onAssignmentComplete: () => void;
  profiles?: BrowserProfile[];
  limitedMode?: boolean;
}

export function ExtensionGroupAssignmentDialog({
  isOpen,
  onClose,
  selectedProfiles,
  onAssignmentComplete,
  profiles = [],
  limitedMode = false,
}: ExtensionGroupAssignmentDialogProps) {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ExtensionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    if (limitedMode) {
      setGroups([]);
      setIsLoading(false);
      setError(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const groupList = await invoke<ExtensionGroup[]>("list_extension_groups");
      setGroups(groupList);
    } catch (err) {
      setGroups([]);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [limitedMode]);

  const handleAssign = useCallback(async () => {
    if (limitedMode) {
      showErrorToast(t("extensions.proRequired"));
      return;
    }
    setIsAssigning(true);
    setError(null);
    try {
      await invoke("assign_extension_group_to_profiles", {
        profileIds: selectedProfiles,
        extensionGroupId: selectedGroupId,
      });

      showSuccessToast(t("extensions.assignSuccess"));
      onAssignmentComplete();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to assign extension group";
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  }, [
    limitedMode,
    selectedProfiles,
    selectedGroupId,
    onAssignmentComplete,
    onClose,
    t,
  ]);

  useEffect(() => {
    if (isOpen) {
      if (limitedMode) {
        setGroups([]);
      } else {
        void loadGroups();
      }
      setSelectedGroupId(null);
      setError(null);
    }
  }, [isOpen, limitedMode, loadGroups]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("extensions.assignTitle")}</DialogTitle>
          <DialogDescription>
            {t("extensions.assignDescription", {
              count: selectedProfiles.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {limitedMode && (
            <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ProBadge />
                {t("extensions.proRequired")}
              </span>
            </div>
          )}
          <div className="space-y-2">
            <Label>{t("extensions.assignTitle")}:</Label>
            <ScrollArea className="p-3 bg-muted rounded-md max-h-32">
              <ul className="text-sm space-y-1">
                {selectedProfiles.map((profileId) => {
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
            <Label htmlFor="extension-group-select">
              {t("extensions.extensionGroup")}:
            </Label>
            {isLoading ? (
              <div className="flex items-center py-1">
                <Spinner size="sm" />
              </div>
            ) : (
              <Select
                value={selectedGroupId || "none"}
                onValueChange={(value) => {
                  setSelectedGroupId(value === "none" ? null : value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("extensions.noGroup")}
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
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
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
            disabled={isLoading || limitedMode}
          >
            {t("common.buttons.apply")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
