import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWebBillingPortalUrl,
  decodeWebBillingPortalContext,
  encodeWebBillingPortalContext,
  type WebBillingPortalContext,
} from "./web-billing-portal";

const sampleContext: WebBillingPortalContext = {
  controlBaseUrl: "https://sync.example.com",
  controlToken: "token-123",
  userId: "user-1",
  userEmail: "user@example.com",
  platformRole: "platform_admin",
  workspaceId: "workspace-1",
  workspaceName: "Workspace One",
};

test("maps new account billing route to /account/billing", () => {
  const url = buildWebBillingPortalUrl({
    baseUrl: "https://buglogin.com",
    route: "accountBilling",
  });

  assert.equal(url, "https://buglogin.com/account/billing");
});

test("maps new admin command center route to /admin/dashboard", () => {
  const url = buildWebBillingPortalUrl({
    baseUrl: "https://buglogin.com",
    route: "adminCommandCenter",
  });

  assert.equal(url, "https://buglogin.com/admin/dashboard");
});

test("maps admin commerce plans route to /admin/commerce/plans", () => {
  const url = buildWebBillingPortalUrl({
    baseUrl: "https://buglogin.com",
    route: "adminCommercePlans",
  });

  assert.equal(url, "https://buglogin.com/admin/commerce/plans");
});

test("keeps legacy management route aligned with account billing", () => {
  const url = buildWebBillingPortalUrl({
    baseUrl: "https://buglogin.com",
    route: "management",
  });

  assert.equal(url, "https://buglogin.com/account/billing");
});

test("encodes and decodes portal context with workspace metadata", () => {
  const encoded = encodeWebBillingPortalContext(sampleContext);
  const decoded = decodeWebBillingPortalContext(encoded);

  assert.deepEqual(decoded, sampleContext);
});
