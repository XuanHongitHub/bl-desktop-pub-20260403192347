# TikTok Signup Flow Smoke Test Report (2026-03-30)

## Scope
Validate one full technical flow using CSV input + captcha integration that was recently added:
1. Read CSV seed row.
2. Resolve `api_phone` endpoint and captcha provider context.
3. Build captcha setup URLs.
4. Probe phone API endpoint.
5. Execute captcha create/poll flow (mock OMO API server) via production code paths.

## Environment
- Repo: `/mnt/e/bug-login`
- Runtime: Node `v22.21.0`, pnpm `10.32.1`
- Date/time: 2026-03-30 (Asia/Saigon)

## Input Used
- File: `tiktok-signup-single.csv`
- Parsed row count: `1`
- Data shape:
  - `Phone`: `15097533407`
  - `API_Phone`: `https://api.sms8.net/api/record?token=<redacted> | https://omocaptcha.com/extension | https://docs.omocaptcha.com/tai-lieu-api/tiktok`

## Commands Executed
- `pnpm dlx tsx --test src/lib/tiktok-workflow-captcha-service.test.ts`
- `pnpm dlx tsx /tmp/tiktok-signup-flow-smoke.ts`

## Timeline Evidence (from smoke run)
- `[+0ms]` Start smoke test.
- `[+3ms]` CSV loaded (`188` bytes).
- `[+4ms]` Parsed `1` row.
- `[+4ms]` Phone normalized (`15097533407` -> `5097533407` for US local format check).
- `[+4ms]` Derived credentials (`15097533407.bug` / password length `15`).
- `[+4ms]` `resolveWorkflowApiPhoneAndCaptcha` result:
  - endpoint: `https://api.sms8.net/api/record?token=<redacted>`
  - provider: `omocaptcha`
  - helper url: `https://omocaptcha.com/extension`
- `[+5ms]` `resolveWorkflowCaptchaContext` + setup URLs generated (`2` URLs).
- `[+523ms]` API phone probe returned `200` with payload preview:
  - `{"code":0,"msg":"No verification code",...}`
- `[+525ms]` Mock OMO API server started.
- `[+2548ms]` Captcha solve completed through production solver path:
  - taskId: `987654`
  - poll attempts: `3`
  - solution keys: `token,provider`
- `[+2599ms]` Mock server stopped.
- `[+2599ms]` Smoke test completed successfully.

## Assertions Confirmed
- `api_phone` multi-segment parsing works with `|` separator.
- Captcha provider auto-detection (`omocaptcha`) works.
- Captcha setup URL generation works (set-key + extension URL).
- Phone API endpoint is reachable and returns valid JSON response.
- Captcha task lifecycle code works end-to-end (`createTask` -> polling -> `ready`) with retry/poll loop.
- Existing unit tests for captcha service pass: `3/3`.

## What This Test Does NOT Cover Yet
- Full GUI click-flow in Tauri desktop (manual browser launch and in-browser TikTok signup interactions).
- Real OMOcaptcha production solve with a live API key and real challenge payload.
- Final account creation confirmation on TikTok side.

## Conclusion
For backend/frontend integration logic added in this cycle (CSV seed parsing path + captcha context and solver pipeline), one full smoke run passed successfully with concrete evidence. The flow is technically healthy for input ingestion and captcha orchestration plumbing.

## Recommended Next Validation (when you wake up)
1. Run one live profile in UI with your real OMO API key to validate real challenge solving.
2. Capture end-state markers: row status, cookie value, and run history after completion.
3. If needed, I can convert this smoke script into a committed repo script (`scripts/tiktok-signup-flow-smoke.mjs`) for repeatable checks.
