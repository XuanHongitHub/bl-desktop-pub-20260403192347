import assert from "node:assert/strict";
import test from "node:test";
import {
  getProfileSharedActionKeys,
  PROFILE_SHARED_ACTION_KEYS,
} from "./profile-action-contract.ts";

test("profile shared actions expose one canonical order for row and bulk", () => {
  const keys = getProfileSharedActionKeys();

  assert.deepEqual(keys, [
    "assignToGroup",
    "assignProxy",
    "assignExtensionGroup",
    "copyCookies",
    "archive",
    "delete",
  ]);
  assert.equal(keys, PROFILE_SHARED_ACTION_KEYS);
});
