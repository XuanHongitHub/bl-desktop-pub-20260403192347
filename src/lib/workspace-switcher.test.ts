import assert from "node:assert/strict";
import test from "node:test";
import { updateWorkspaceProfilesUsed } from "./workspace-switcher";

test("preserves known workspace usage when profile usage loading is disabled", () => {
  const current = { personal: 56, team: 12 };

  const next = updateWorkspaceProfilesUsed(current, {
    enabled: false,
    hasUser: true,
    workspaceId: "personal",
    profilesLength: 0,
  });

  assert.deepEqual(next, current);
});

test("updates the current workspace usage when loading is enabled", () => {
  const next = updateWorkspaceProfilesUsed(
    { personal: 56, team: 12 },
    {
      enabled: true,
      hasUser: true,
      workspaceId: "team",
      profilesLength: 14,
    },
  );

  assert.deepEqual(next, { personal: 56, team: 14 });
});

test("clears usage when no authenticated user remains", () => {
  const next = updateWorkspaceProfilesUsed(
    { personal: 56 },
    {
      enabled: false,
      hasUser: false,
      workspaceId: "personal",
      profilesLength: 0,
    },
  );

  assert.deepEqual(next, {});
});
