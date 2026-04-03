"use client";

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { LoadingButton } from "@/components/loading-button";
import { ProxyInlineManager } from "@/components/proxy-inline-manager";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BrowserProfile, StoredProxy } from "@/types";
import { RippleButton } from "./ui/ripple";

interface ProxyAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfiles: string[];
  onAssignmentComplete: () => void;
  profiles?: BrowserProfile[];
  storedProxies?: StoredProxy[];
}

export function ProxyAssignmentDialog({
  isOpen,
  onClose,
  selectedProfiles,
  onAssignmentComplete,
  profiles = [],
  storedProxies = [],
}: ProxyAssignmentDialogProps) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<"none" | "proxy">("none");
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleValueChange = useCallback((value: string) => {
    if (value === "none") {
      setSelectedId(null);
      setSelectionType("none");
    } else {
      setSelectedId(value);
      setSelectionType("proxy");
    }
  }, []);

  const handleAssign = useCallback(async () => {
    setIsAssigning(true);
    setError(null);
    try {
      const validProfiles = selectedProfiles.filter((profileId) => {
        const profile = profiles.find((p) => p.id === profileId);
        return profile;
      });

      if (validProfiles.length === 0) {
        setError("No valid profiles selected.");
        setIsAssigning(false);
        return;
      }

      await invoke("update_profiles_proxy", {
        profileIds: validProfiles,
        proxyId: selectionType === "proxy" ? selectedId : null,
      });

      await emit("profile-updated");
      onAssignmentComplete();
      onClose();
    } catch (err) {
      console.error("Failed to assign proxy to profiles:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to assign proxy to profiles";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsAssigning(false);
    }
  }, [
    selectedProfiles,
    selectedId,
    selectionType,
    profiles,
    onAssignmentComplete,
    onClose,
  ]);

  useEffect(() => {
    if (isOpen) {
      setSelectedId(null);
      setSelectionType("none");
      setError(null);
    }
  }, [isOpen]);

  const selectValue =
    selectionType === "none" ? "none" : (selectedId ?? "none");
  const selectedProxy =
    selectionType === "proxy" && selectedId
      ? (storedProxies.find((proxy) => proxy.id === selectedId) ?? null)
      : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("proxyAssignmentDialog.title")}</DialogTitle>
          <DialogDescription>
            Assign a proxy to {selectedProfiles.length} selected profile(s).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("proxyAssignmentDialog.labels.selectedProfiles")}</Label>
            <ScrollArea className="p-3 bg-muted rounded-md max-h-32">
              <ul className="text-sm space-y-1">
                {selectedProfiles.map((profileId) => {
                  const profile = profiles.find(
                    (p: BrowserProfile) => p.id === profileId,
                  );
                  const displayName = profile ? profile.name : profileId;
                  return (
                    <li key={profileId} className="truncate">
                      &bull; {displayName}
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            <Label htmlFor="proxy-vpn-select">
              {t("profiles.table.assignProxy")}
            </Label>
            <Select value={selectValue} onValueChange={handleValueChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a proxy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("common.labels.none")}</SelectItem>
                {storedProxies.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>
                      {t("proxyAssignmentDialog.labels.proxies")}
                    </SelectLabel>
                    {storedProxies.map((proxy) => (
                      <SelectItem key={proxy.id} value={proxy.id}>
                        {proxy.name}
                        {proxy.is_cloud_managed ? " (Included)" : ""}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2">
              <ProxyInlineManager
                selectedProxy={selectedProxy}
                disabled={isAssigning}
                onCreated={(proxy) => {
                  setSelectionType("proxy");
                  setSelectedId(proxy.id);
                }}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md dark:bg-red-900/20 dark:text-red-400">
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
            Cancel
          </RippleButton>
          <LoadingButton
            isLoading={isAssigning}
            onClick={() => void handleAssign()}
          >
            Assign
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
