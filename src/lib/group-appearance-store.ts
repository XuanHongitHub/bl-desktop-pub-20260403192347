export type GroupShareMode = "private" | "team" | "public";
export type GroupMemberAccess = "owner_admin" | "all_members";

export type GroupAppearanceRecord = {
  color?: string;
  share?: GroupShareMode;
  access?: GroupMemberAccess;
};

export type GroupAppearanceMap = Record<string, GroupAppearanceRecord>;

export const GROUP_APPEARANCE_STORAGE_KEY = "buglogin.groupAppearance.v1";
export const GROUP_APPEARANCE_UPDATED_EVENT =
  "buglogin:group-appearance-updated";
export const DEFAULT_GROUP_COLOR = "#9ca3af";

export function sanitizeGroupColor(value: string | undefined): string {
  if (!value) {
    return DEFAULT_GROUP_COLOR;
  }
  const normalized = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized;
  }
  return DEFAULT_GROUP_COLOR;
}

export function readGroupAppearanceMap(): GroupAppearanceMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(GROUP_APPEARANCE_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as GroupAppearanceMap;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function writeGroupAppearanceMap(next: GroupAppearanceMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      GROUP_APPEARANCE_STORAGE_KEY,
      JSON.stringify(next),
    );
    window.dispatchEvent(
      new CustomEvent(GROUP_APPEARANCE_UPDATED_EVENT, { detail: next }),
    );
  } catch {
    // Ignore localStorage write failures.
  }
}
