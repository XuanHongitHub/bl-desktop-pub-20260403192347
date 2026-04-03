export const PROFILE_SHARED_ACTION_KEYS = [
  "assignToGroup",
  "assignProxy",
  "assignExtensionGroup",
  "copyCookies",
  "archive",
  "delete",
] as const;

export type ProfileSharedActionKey =
  (typeof PROFILE_SHARED_ACTION_KEYS)[number];

export function getProfileSharedActionKeys(): readonly ProfileSharedActionKey[] {
  return PROFILE_SHARED_ACTION_KEYS;
}
