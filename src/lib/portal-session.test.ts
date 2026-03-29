import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortalSessionRecord,
  mergePortalSessionCurrent,
  parsePortalSession,
  resolvePortalCloudApiBaseUrl,
  resolvePortalControlBaseUrl,
  resolvePortalPostAuthPath,
} from "./portal-session";

test("prefers explicit control api base when provided", () => {
  assert.equal(
    resolvePortalControlBaseUrl(" https://sync.buglogin.com/ "),
    "https://sync.buglogin.com",
  );
});

test("falls back to null when control api base is not usable", () => {
  assert.equal(resolvePortalControlBaseUrl(""), null);
});

test("falls back to production cloud api base when env is missing", () => {
  assert.equal(resolvePortalCloudApiBaseUrl(""), "https://api.buglogin.com");
});

test("routes platform admins to command center after auth", () => {
  assert.equal(
    resolvePortalPostAuthPath({ platformRole: "platform_admin" }),
    "/admin/command-center",
  );
});

test("routes regular users to account billing after auth", () => {
  assert.equal(resolvePortalPostAuthPath({ platformRole: null }), "/account/billing");
});

test("parses portal session current workspace and plan context", () => {
  const parsed = parsePortalSession(
    JSON.stringify({
      user: {
        id: "user-1",
        email: "user@example.com",
      },
      connection: {
        controlBaseUrl: "https://sync.buglogin.com",
        controlToken: "token-1",
        userId: "user-1",
        userEmail: "user@example.com",
      },
      current: {
        workspaceId: "ws-1",
        workspaceName: "Ops Team",
        planId: "scale",
        planLabel: "Scale",
        billingCycle: "yearly",
        subscriptionStatus: "active",
      },
    }),
  );

  assert.equal(parsed?.current?.workspaceId, "ws-1");
  assert.equal(parsed?.current?.planLabel, "Scale");
  assert.equal(parsed?.current?.subscriptionStatus, "active");
});

test("merges current workspace and plan context without losing identity", () => {
  const base = createPortalSessionRecord({
    user: {
      id: "user-1",
      email: "user@example.com",
      platformRole: "platform_admin",
    },
    connection: {
      controlBaseUrl: "https://sync.buglogin.com",
      controlToken: "token-1",
      userId: "user-1",
      userEmail: "user@example.com",
      platformRole: "platform_admin",
    },
  });

  const merged = mergePortalSessionCurrent(base, {
    workspaceId: "ws-2",
    workspaceName: "Admin Team",
    planId: "custom",
    planLabel: "Custom",
  });

  assert.equal(merged.user.email, "user@example.com");
  assert.equal(merged.connection.platformRole, "platform_admin");
  assert.equal(merged.current?.workspaceId, "ws-2");
  assert.equal(merged.current?.planId, "custom");
});
