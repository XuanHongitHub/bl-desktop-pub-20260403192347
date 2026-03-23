import type { TeamRole } from "@/types";

export type TeamAction =
  | "create_profile"
  | "clone_profile"
  | "rename_profile"
  | "delete_profile"
  | "stop_profile"
  | "delete_selected_profiles"
  | "assign_group"
  | "assign_proxy"
  | "assign_extension_group"
  | "toggle_profile_sync"
  | "update_profile_tags"
  | "update_profile_note"
  | "update_profile_vpn"
  | "share_profile"
  | "share_group"
  | "export_profile";

const WRITE_ACTIONS: readonly TeamAction[] = [
  "create_profile",
  "clone_profile",
  "rename_profile",
  "delete_profile",
  "stop_profile",
  "delete_selected_profiles",
  "assign_group",
  "assign_proxy",
  "assign_extension_group",
  "toggle_profile_sync",
  "update_profile_tags",
  "update_profile_note",
  "update_profile_vpn",
  "share_profile",
  "share_group",
  "export_profile",
];

const MEMBER_ACTIONS: readonly TeamAction[] = WRITE_ACTIONS.filter(
  (action) =>
    action !== "share_profile" &&
    action !== "share_group" &&
    action !== "export_profile",
);

const TEAM_PERMISSION_MATRIX: Record<TeamRole, Set<TeamAction>> = {
  owner: new Set(WRITE_ACTIONS),
  admin: new Set(WRITE_ACTIONS),
  member: new Set(MEMBER_ACTIONS),
  viewer: new Set(),
};

export function normalizeTeamRole(role?: string | null): TeamRole | null {
  if (!role) {
    return null;
  }

  const normalized = role.toLowerCase().trim();
  if (
    normalized === "owner" ||
    normalized === "admin" ||
    normalized === "member" ||
    normalized === "viewer"
  ) {
    return normalized;
  }

  return null;
}

export function canPerformTeamAction(
  role: TeamRole | null,
  action: TeamAction,
): boolean {
  if (!role) {
    return false;
  }

  return TEAM_PERMISSION_MATRIX[role].has(action);
}
