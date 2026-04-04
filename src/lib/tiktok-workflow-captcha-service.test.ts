import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkflowCaptchaSetupUrls,
  resolveWorkflowApiPhoneAndCaptcha,
  resolveWorkflowCaptchaContext,
} from "./tiktok-workflow-captcha-service";

test("resolveWorkflowApiPhoneAndCaptcha extracts API phone endpoint and omocaptcha links", () => {
  const input =
    "https://api.sms8.net/api/record?token=abc | https://omocaptcha.com/extension | https://docs.omocaptcha.com/tai-lieu-api/tiktok";

  const resolved = resolveWorkflowApiPhoneAndCaptcha(input);

  assert.equal(
    resolved.phoneApiEndpoint,
    "https://api.sms8.net/api/record?token=abc",
  );
  assert.equal(resolved.detectedProvider, "omocaptcha");
  assert.equal(resolved.helperUrl, "https://omocaptcha.com/extension");
  assert.equal(
    resolved.docsUrl,
    "https://docs.omocaptcha.com/tai-lieu-api/tiktok",
  );
});

test("resolveWorkflowCaptchaContext applies preferred provider override", () => {
  const resolved = resolveWorkflowCaptchaContext(
    "https://api.sms8.net/api/record?token=abc",
    "omocaptcha",
  );

  assert.equal(resolved.provider, "omocaptcha");
  assert.equal(
    resolved.phoneApiEndpoint,
    "https://api.sms8.net/api/record?token=abc",
  );
  assert.ok(resolved.helperUrl);
});

test("buildWorkflowCaptchaSetupUrls includes set-key URL and helper URL", () => {
  const context = resolveWorkflowCaptchaContext(
    "https://api.sms8.net/api/record?token=abc | https://omocaptcha.com/extension",
    "none",
  );

  const urls = buildWorkflowCaptchaSetupUrls(context, "my_api_key");

  assert.equal(urls.length, 2);
  assert.ok(
    urls.some((url) =>
      url.includes("https://omocaptcha.com/set-key?api_key=my_api_key"),
    ),
  );
  assert.ok(urls.includes("https://omocaptcha.com/extension"));
});
