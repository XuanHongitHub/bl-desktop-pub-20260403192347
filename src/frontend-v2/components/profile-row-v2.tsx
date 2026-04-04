import { Lock, Play, RefreshCcw, Square } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/frontend-baseline/shadcn/ui/badge";
import { Button } from "@/frontend-baseline/shadcn/ui/button";
import type { BrowserProfile } from "@/types";

type ProfileRowV2Props = {
  profile: BrowserProfile;
  isRunning: boolean;
  isLocked: boolean;
  syncStatus: string | undefined;
  isLaunching: boolean;
  isStopping: boolean;
  isSyncing: boolean;
  onToggleRun: (profile: BrowserProfile) => void;
  onToggleSync: (profile: BrowserProfile) => void;
};

function syncBadgeVariant(
  status: string | undefined,
): "default" | "secondary" | "outline" {
  switch (status) {
    case "syncing":
      return "secondary";
    case "synced":
      return "default";
    default:
      return "outline";
  }
}

function ProfileRowV2Impl({
  profile,
  isRunning,
  isLocked,
  syncStatus,
  isLaunching,
  isStopping,
  isSyncing,
  onToggleRun,
  onToggleSync,
}: ProfileRowV2Props) {
  const { t } = useTranslation();
  const runtimeBusy = isLaunching || isStopping;
  const canRunAction = !isLocked && !isSyncing;

  return (
    <div
      className="grid h-16 grid-cols-[1.4fr_0.65fr_0.85fr_1.05fr] items-center border-b border-border px-3"
      data-profile-id={profile.id}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {profile.name}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {profile.note ?? t("frontendV2.labels.noNote")}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        <Badge variant={isRunning ? "default" : "outline"}>
          {isRunning ? t("common.status.running") : t("common.status.stopped")}
        </Badge>
        {isLocked && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            {t("frontendV2.labels.locked")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Badge variant={syncBadgeVariant(syncStatus)}>
          {syncStatus === "syncing"
            ? t("common.status.syncing")
            : syncStatus === "synced"
              ? t("common.status.synced")
              : t("common.status.pending")}
        </Badge>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          size="sm"
          variant={isRunning ? "outline" : "default"}
          disabled={!canRunAction || runtimeBusy}
          onClick={() => onToggleRun(profile)}
        >
          {runtimeBusy ? (
            <>
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
              {t("common.buttons.loading")}
            </>
          ) : isRunning ? (
            <>
              <Square className="h-3.5 w-3.5" />
              {t("common.buttons.stop")}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              {t("common.buttons.start")}
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          disabled={isSyncing}
          onClick={() => onToggleSync(profile)}
        >
          {isSyncing ? (
            <RefreshCcw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            t("frontendV2.actions.toggleSync")
          )}
        </Button>
      </div>
    </div>
  );
}

export const ProfileRowV2 = memo(ProfileRowV2Impl);
