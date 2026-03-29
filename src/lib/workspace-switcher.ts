export function updateWorkspaceProfilesUsed(
  current: Record<string, number>,
  input: {
    enabled: boolean;
    hasUser: boolean;
    workspaceId?: string | null;
    profilesLength: number;
  },
): Record<string, number> {
  if (!input.hasUser) {
    return {};
  }

  if (!input.enabled || !input.workspaceId) {
    return current;
  }

  if (current[input.workspaceId] === input.profilesLength) {
    return current;
  }

  return {
    ...current,
    [input.workspaceId]: input.profilesLength,
  };
}
