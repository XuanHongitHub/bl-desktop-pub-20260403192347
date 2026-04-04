import type {
  BaselineProfile,
  BaselineProfileStatus,
} from "@/frontend-baseline/types/profile";

const WORKSPACES = ["team-a", "team-b", "team-c", "team-d"] as const;
const TAGS = [
  "warm",
  "cold",
  "vip",
  "locked",
  "auto",
  "manual",
  "import",
] as const;

const STATUS_ORDER: BaselineProfileStatus[] = [
  "running",
  "stopped",
  "syncing",
  "locked",
];

function pickTagPair(index: number): string[] {
  const first = TAGS[index % TAGS.length];
  const second = TAGS[(index + 3) % TAGS.length];
  return first === second ? [first] : [first, second];
}

export function createBaselineProfiles(count: number): BaselineProfile[] {
  const rows: BaselineProfile[] = [];
  for (let index = 0; index < count; index += 1) {
    rows.push({
      id: `profile-${index + 1}`,
      name: `Profile ${String(index + 1).padStart(4, "0")}`,
      workspace: WORKSPACES[index % WORKSPACES.length],
      browser: index % 2 === 0 ? "wayfern" : "camoufox",
      status: STATUS_ORDER[index % STATUS_ORDER.length],
      note: `Automation sequence ${index % 11}`,
      tags: pickTagPair(index),
      syncAt: Date.now() - (index % 360) * 1_000,
    });
  }
  return rows;
}

function nextStatus(status: BaselineProfileStatus): BaselineProfileStatus {
  switch (status) {
    case "running":
      return "syncing";
    case "syncing":
      return "stopped";
    case "stopped":
      return "locked";
    case "locked":
      return "running";
    default:
      return "stopped";
  }
}

export function patchProfile(
  profile: BaselineProfile,
  at: number,
): BaselineProfile {
  return {
    ...profile,
    status: nextStatus(profile.status),
    syncAt: at,
    note: `${profile.note.split(" |")[0]} | ${at % 997}`,
  };
}

export function pickPatchTargets(total: number, maxUpdates = 24): string[] {
  if (total <= 0) {
    return [];
  }

  const updates = Math.min(total, maxUpdates);
  const stride = Math.max(1, Math.floor(total / updates));
  const targetIds: string[] = [];

  for (let i = 0; i < updates; i += 1) {
    const idx = (i * stride + i * 7) % total;
    targetIds.push(`profile-${idx + 1}`);
  }

  return targetIds;
}
