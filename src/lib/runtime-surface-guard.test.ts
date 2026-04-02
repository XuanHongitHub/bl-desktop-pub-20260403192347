import assert from "node:assert/strict";
import test from "node:test";
import {
  type RuntimeSurface,
  resolveRuntimeSurface,
  shouldRedirectDesktopGuard,
  shouldRedirectWebGuard,
  shouldRenderDesktopGuardChildren,
  shouldRenderWebGuardChildren,
} from "./runtime-surface-guard.ts";

test("resolveRuntimeSurface maps tauri probe to stable runtime state", () => {
  assert.equal(resolveRuntimeSurface(true), "desktop");
  assert.equal(resolveRuntimeSurface(false), "web");
});

test("unknown runtime does not redirect during hydration", () => {
  assert.equal(shouldRedirectWebGuard("unknown", "/"), false);
  assert.equal(shouldRedirectDesktopGuard("unknown", "/desktop"), false);
});

test("web guard redirects only when desktop runtime is detected", () => {
  assert.equal(shouldRedirectWebGuard("desktop", "/pricing"), true);
  assert.equal(shouldRedirectWebGuard("desktop", "/desktop"), false);
  assert.equal(shouldRedirectWebGuard("web", "/pricing"), false);
});

test("desktop guard redirects only when web runtime is detected", () => {
  assert.equal(shouldRedirectDesktopGuard("web", "/desktop"), true);
  assert.equal(shouldRedirectDesktopGuard("web", "/"), false);
  assert.equal(shouldRedirectDesktopGuard("web", "/signin"), false);
  assert.equal(shouldRedirectDesktopGuard("desktop", "/desktop"), false);
});

test("guard render decisions keep first paint deterministic", () => {
  const states: RuntimeSurface[] = ["unknown", "desktop", "web"];
  const renderedDesktop = states.filter(shouldRenderDesktopGuardChildren);
  const renderedWeb = states.filter(shouldRenderWebGuardChildren);

  assert.deepEqual(renderedDesktop, ["desktop"]);
  assert.deepEqual(renderedWeb, ["unknown", "web"]);
});
