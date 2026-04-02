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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import {
  DATA_SCOPE_CHANGED_EVENT,
  getCurrentDataScope,
  scopeEntitiesForContext,
} from "@/lib/workspace-data-scope";
import type { BrowserProfile, ProfileGroup } from "@/types";
import { RippleButton } from "./ui/ripple";

interface DeleteGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  group: ProfileGroup | null;
  onGroupDeleted: () => void;
}

export function DeleteGroupDialog({
  isOpen,
  onClose,
  group,
  onGroupDeleted,
}: DeleteGroupDialogProps) {
  const { t } = useTranslation();
  const [associatedProfiles, setAssociatedProfiles] = useState<
    BrowserProfile[]
  >([]);
  const [deleteAction, setDeleteAction] = useState<"move" | "delete">("move");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAssociatedProfiles = useCallback(async () => {
    if (!group) return;

    setIsLoading(true);
    setError(null);
    try {
      const allProfiles = await invoke<BrowserProfile[]>(
        "list_browser_profiles",
      );
      const scope = getCurrentDataScope();
      const scopedProfiles = scopeEntitiesForContext(
        "profiles",
        allProfiles,
        (profile) => profile.id,
        scope,
      );
      const groupProfiles = scopedProfiles.filter(
        (profile) => profile.group_id === group.id,
      );
      setAssociatedProfiles(groupProfiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setIsLoading(false);
    }
  }, [group]);

  useEffect(() => {
    if (isOpen && group) {
      void loadAssociatedProfiles();
    }
  }, [isOpen, group, loadAssociatedProfiles]);

  useEffect(() => {
    if (!isOpen || !group) {
      return;
    }
    const handleScopeChanged = () => {
      void loadAssociatedProfiles();
    };
    window.addEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    return () => {
      window.removeEventListener(DATA_SCOPE_CHANGED_EVENT, handleScopeChanged);
    };
  }, [group, isOpen, loadAssociatedProfiles]);

  const handleDelete = useCallback(async () => {
    if (!group) return;

    setIsDeleting(true);
    setError(null);
    try {
      if (deleteAction === "delete" && associatedProfiles.length > 0) {
        // Delete all associated profiles first
        const profileIds = associatedProfiles.map((p) => p.id);
        await invoke("delete_selected_profiles", { profileIds });
      } else if (deleteAction === "move" && associatedProfiles.length > 0) {
        // Move profiles to default group (null group_id)
        const profileIds = associatedProfiles.map((p) => p.id);
        await invoke("assign_profiles_to_group", {
          profileIds,
          groupId: null,
        });
      }

      // Delete the group
      await invoke("delete_profile_group", { groupId: group.id });

      showSuccessToast(t("groupDialogs.toasts.deleted"));
      onGroupDeleted();
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to delete group";
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [group, deleteAction, associatedProfiles, onGroupDeleted, onClose, t]);

  const handleClose = useCallback(() => {
    setError(null);
    setDeleteAction("move");
    setAssociatedProfiles([]);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupDialogs.delete.title")}</DialogTitle>
          <DialogDescription>
            {t("groupDialogs.delete.description", { name: group?.name ?? "" })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              {t("groupDialogs.loadingProfiles")}
            </div>
          ) : (
            <>
              {associatedProfiles.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>
                      {t("groupDialogs.delete.associatedProfiles", {
                        count: associatedProfiles.length,
                      })}
                    </Label>
                    <ScrollArea className="h-32 w-full rounded-md border p-3">
                      <div className="space-y-1">
                        {associatedProfiles.map((profile) => (
                          <div key={profile.id} className="text-sm">
                            • {profile.name}
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="space-y-3">
                    <Label>{t("groupDialogs.delete.profilesPrompt")}</Label>
                    <RadioGroup
                      value={deleteAction}
                      onValueChange={(value) =>
                        setDeleteAction(value as "move" | "delete")
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="move" id="move" />
                        <Label htmlFor="move" className="text-sm">
                          {t("groupDialogs.delete.moveToDefault")}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="delete" id="delete" />
                        <Label htmlFor="delete" className="text-sm text-destructive">
                          {t("groupDialogs.delete.deleteWithProfiles")}
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              {associatedProfiles.length === 0 && !isLoading && (
                <div className="text-sm text-muted-foreground">
                  {t("groupDialogs.delete.noAssociatedProfiles")}
                </div>
              )}
            </>
          )}

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <RippleButton
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            {t("common.buttons.cancel")}
          </RippleButton>
          <LoadingButton
            variant="destructive"
            isLoading={isDeleting}
            onClick={() => void handleDelete()}
            disabled={isLoading}
          >
            {t("common.buttons.delete")}
            {deleteAction === "delete" &&
              associatedProfiles.length > 0 &&
              ` ${t("groupDialogs.delete.andProfilesSuffix")}`}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
