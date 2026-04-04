"use client";

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import type { ProfileGroup } from "@/types";
import { RippleButton } from "./ui/ripple";

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (group: ProfileGroup) => void;
}

export function CreateGroupDialog({
  isOpen,
  onClose,
  onGroupCreated,
}: CreateGroupDialogProps) {
  const { t } = useTranslation();
  const [groupName, setGroupName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    if (!groupName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const newGroup = await invoke<ProfileGroup>("create_profile_group", {
        name: groupName.trim(),
      });

      showSuccessToast(t("groupDialogs.toasts.created"));
      onGroupCreated(newGroup);
      setGroupName("");
      onClose();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to create group";
      setError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setIsCreating(false);
    }
  }, [groupName, onGroupCreated, onClose, t]);

  const handleClose = useCallback(() => {
    setGroupName("");
    setError(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupDialogs.create.title")}</DialogTitle>
          <DialogDescription>
            {t("groupDialogs.create.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-name">
              {t("groupDialogs.labels.groupName")}
            </Label>
            <Input
              id="group-name"
              placeholder={t("groupDialogs.placeholders.groupName")}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && groupName.trim()) {
                  void handleCreate();
                }
              }}
              disabled={isCreating}
            />
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
            onClick={handleClose}
            disabled={isCreating}
          >
            {t("common.buttons.cancel")}
          </RippleButton>
          <LoadingButton
            isLoading={isCreating}
            onClick={() => void handleCreate()}
            disabled={!groupName.trim()}
          >
            {t("common.buttons.create")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
