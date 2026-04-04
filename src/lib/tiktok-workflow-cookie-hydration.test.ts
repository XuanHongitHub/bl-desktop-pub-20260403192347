import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWorkflowCookiePreviewRecords,
  selectWorkflowCookieProfilesForHydration,
} from "./tiktok-workflow-cookie-hydration";

test("selectWorkflowCookieProfilesForHydration skips hydrated and cached rows", () => {
  const rows = [
    {
      profileId: "a",
      localCookieSnapshot: null,
      cookiePreview: null,
      status: "created",
    },
    {
      profileId: "b",
      localCookieSnapshot: null,
      cookiePreview: null,
      status: "created",
    },
    {
      profileId: "c",
      localCookieSnapshot: null,
      cookiePreview: null,
      status: "created",
    },
  ];

  const next = selectWorkflowCookieProfilesForHydration(rows, {
    hydratedProfileIds: new Set(["a"]),
    cachedProfileIds: new Set(["b"]),
    limit: 12,
  });

  assert.deepEqual(next, ["c"]);
});

test("selectWorkflowCookieProfilesForHydration respects the batch limit", () => {
  const rows = [
    {
      profileId: "a",
      localCookieSnapshot: null,
      cookiePreview: null,
      status: "created",
    },
    {
      profileId: "b",
      localCookieSnapshot: null,
      cookiePreview: null,
      status: "created",
    },
    {
      profileId: "c",
      localCookieSnapshot: null,
      cookiePreview: null,
      status: "created",
    },
  ];

  const next = selectWorkflowCookieProfilesForHydration(rows, {
    hydratedProfileIds: new Set(),
    cachedProfileIds: new Set(),
    limit: 2,
  });

  assert.deepEqual(next, ["a", "b"]);
});

test("applyWorkflowCookiePreviewRecords only updates rows with new cookie data", () => {
  const rows = [
    {
      profileId: "a",
      cookiePreview: null,
      localCookieSnapshot: null,
      status: "created",
    },
    {
      profileId: "b",
      cookiePreview: "old",
      localCookieSnapshot: "old",
      status: "created",
    },
  ];
  const records = new Map([["a", { preview: "sid=1", snapshot: "sid=1" }]]);

  const next = applyWorkflowCookiePreviewRecords(rows, records);

  assert.deepEqual(next, [
    {
      profileId: "a",
      cookiePreview: "sid=1",
      localCookieSnapshot: "sid=1",
      status: "created",
    },
    {
      profileId: "b",
      cookiePreview: "old",
      localCookieSnapshot: "old",
      status: "created",
    },
  ]);
});
