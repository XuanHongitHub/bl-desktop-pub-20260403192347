import { Lock, Play, RotateCw, Square } from "lucide-react";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/frontend-baseline/shadcn/lib/cn";
import { Badge } from "@/frontend-baseline/shadcn/ui/badge";
import type { BaselineProfile } from "@/frontend-baseline/types/profile";

function formatSyncLabel(syncAt: number): string {
  const deltaSeconds = Math.max(0, Math.floor((Date.now() - syncAt) / 1000));
  if (deltaSeconds < 60) {
    return `${deltaSeconds}s`;
  }
  const mins = Math.floor(deltaSeconds / 60);
  return `${mins}m`;
}

const statusToBadge: Record<
  BaselineProfile["status"],
  "default" | "secondary" | "outline"
> = {
  running: "default",
  syncing: "secondary",
  stopped: "outline",
  locked: "outline",
};

const statusToIcon: Record<
  BaselineProfile["status"],
  React.ComponentType<{ className?: string }>
> = {
  running: Play,
  syncing: RotateCw,
  stopped: Square,
  locked: Lock,
};

function ProfileRowImpl({
  profile,
  compact = false,
}: {
  profile: BaselineProfile;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const StatusIcon = statusToIcon[profile.status];

  return (
    <div
      className={cn(
        "grid items-center border-b border-border px-3",
        compact
          ? "h-12 grid-cols-[1.25fr_0.9fr_0.9fr_1fr]"
          : "h-14 grid-cols-[1.5fr_1fr_1fr_1.25fr]",
      )}
      data-profile-id={profile.id}
    >
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          {profile.name}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {profile.note}
        </span>
      </div>
      <div className="pr-2 text-xs text-muted-foreground">
        {profile.workspace}
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <StatusIcon
          className={cn(
            "h-3.5 w-3.5",
            profile.status === "syncing" && "animate-spin",
          )}
        />
        <span>{profile.browser}</span>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Badge variant={statusToBadge[profile.status]} className="capitalize">
          {t(`frontendBaseline.status.${profile.status}`)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {t("frontendBaseline.syncedAgo", {
            value: formatSyncLabel(profile.syncAt),
          })}
        </span>
      </div>
    </div>
  );
}

export const ProfileRow = memo(ProfileRowImpl);
