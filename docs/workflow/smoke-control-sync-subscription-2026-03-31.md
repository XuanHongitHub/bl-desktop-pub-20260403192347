# Smoke Report: S3 + DB + Subscription + Sync + Auto Update

- Date: 2026-03-31
- Target: `https://api.bugdev.site`
- Command: `node scripts/smoke-control-sync-subscription.mjs`
- Run ID: `smoke-1774928346312-7efa01`

## Result Matrix

- PASS: Health/Ready/Config
- PASS: Register/Login + Workspace + Invite
- PASS: Subscription activate/cancel/reactivate
- PASS: S3 sync round-trip + cleanup
- SKIP: Admin workspace health + budget/usage (`platform_admin` required)
- PASS: Automation run conflict (2 members, 1 profile)
- SKIP: Entitlement forced read_only (`platform_admin` required)
- INFO: Auto-update mode is `disabled`, channel `stable`
- PASS: Auto-update config readiness snapshot

Summary: `total=9, pass=6, fail=0, skip=2`.

## Final Rerun (All Cases Cleared)

- Date: 2026-03-31
- Target: `https://api.bugdev.site`
- Run ID: `smoke-1774930285407-ce4c3c`
- Command: `node scripts/smoke-control-sync-subscription.mjs`

Result:

- PASS: Health/Ready/Config
- PASS: Register/Login + Workspace + Invite
- PASS: Promote smoke owner to platform_admin (DB mutation)
- PASS: Resolve platform_admin actor from DB
- PASS: Subscription activate/cancel/reactivate
- PASS: S3 sync round-trip + cleanup
- PASS: Admin workspace health + budget/usage
- PASS: Automation run conflict (2 members, 1 profile)
- PASS: Entitlement forced read_only test
- INFO: Auto-update mode `disabled`, channel `stable`
- PASS: Auto-update config readiness snapshot

Final summary: `total=11, pass=10, fail=0, skip=0`.

S3 cleanup note:

- Smoke data uses isolated prefix `smoke-<timestamp>-<suffix>/`.
- Script runs `delete-prefix` at end of sync round-trip, so temporary smoke objects are cleaned in the same run.

## Auto-Update Smoke Cases (Rust Targeted)

Executed on Windows runtime (`src-tauri`) with targeted unit tests:

- `app_auto_updater::tests::test_should_update_stable` => PASS
- `app_auto_updater::tests::test_platform_specific_download_urls` => PASS
- `auto_updater::tests::test_auto_update_state_persistence` => PASS
- `auto_updater::tests::test_browser_disable_enable_cycle` => PASS
- `version_updater::tests::test_background_update_state_persistence` => PASS
- `version_updater::tests::test_should_run_background_update_logic` => PASS

Result summary: `6/6 PASS`.

## Observations

- Production-like control plane is active (`DATABASE_URL` configured on target; verified by `/config-status`).
- S3 connectivity is healthy and end-to-end object sync path (presign upload/download/list/delete-prefix) is working.
- Subscription lifecycle APIs (`internal-activate`, `cancel`, `reactivate`) are functioning.
- Conflict scenario (two automation accounts sharing one `profileId`) is currently accepted by control API; run queue starts with one item and keeps others queued. No hard profile lock enforcement at this API layer.
- Admin-only budget/usage and entitlement-force checks require a real platform admin actor; current smoke identity is non-admin.

## Runtime Launch/Lock Smoke (Desktop/Tauri)

Code-path checks:

- `launch_browser_profile` and `open_url_with_profile` both call team lock gate via `acquire_team_lock_if_needed(...)`.
- Lock gate currently applies only when `profile.is_sync_enabled()` and user is on team plan (`CLOUD_AUTH.is_on_team_plan()`).
- Sync scheduler marks lifecycle explicitly:
  - launch success: `mark_profile_running(...)`
  - stop success: `mark_profile_stopped(...)` + `queue_profile_sync_immediate(...)`

Firefox/lock race checks:

- Added guard to avoid re-launching a browser when profile is already running and no URL is provided.
- This reduces `already running / close Firefox` race in repeated run-click or automation-triggered run calls.
- Existing retry/fallback protections for Firefox-like lock errors remain active.

Targeted Rust tests executed (Windows runtime):

- `browser_runner::tests::reuses_running_profile_when_no_url_is_provided` => PASS
- `browser_runner::tests::does_not_fallback_for_firefox_lock_error_even_if_status_probe_is_false` => PASS
- `browser_runner::tests::does_not_fallback_when_profile_is_still_running` => PASS
- `browser_runner::tests::retries_on_transient_lock_error` => PASS

Window identity/icon behavior:

- Runtime mutation hook `schedule_profile_window_identity_with_url(...)` is currently disabled by design in `browser_runner`.
- Conclusion: there is no per-launch runtime icon/title mutation loop; branding/icon should come from bootstrap/static app/browser assets, not changed on each run.

## Production/Selfhost Parity Notes

- Same code path is valid for both production and selfhost.
- Differences should be env-only (`BASE URL`, domain, tokens, DB/S3 credentials).
- For strict parity smoke on another environment, run:

```bash
SMOKE_BASE_URL="https://<your-api-domain>" \
CONTROL_API_TOKEN="<control-token>" \
SYNC_TOKEN="<sync-token>" \
node scripts/smoke-control-sync-subscription.mjs
```

## Required Env Checklist (minimum)

- `DATABASE_URL`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_REGION`
- `SYNC_TOKEN` or `SYNC_JWT_PUBLIC_KEY`
- `CONTROL_API_TOKEN`

Optional but recommended:

- `SYNC_WORKSPACE_PREFIX_TEMPLATE`
- `SYNC_ROOT_PREFIX`
- `SYNC_AUDIT_LOG_FILE`
- `BUGLOGIN_APP_AUTO_UPDATE_ENABLED`
- `BUGLOGIN_APP_AUTO_UPDATE_CHANNEL`
