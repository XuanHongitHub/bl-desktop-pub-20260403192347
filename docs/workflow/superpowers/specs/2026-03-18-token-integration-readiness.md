# Token Integration Readiness (Deferred Enforcement)

Date: 2026-03-18
Status: ready_for_backend_integration
Owner: codex

## Goal
Keep BugLogin fully usable now while preparing backend interfaces for future access control by token from `kmediaz.com`.

## Current Contract (Implemented)
- `get_app_access_token_state`:
  - returns `{ configured: boolean, enforcement_enabled: false }`
- `save_app_access_token`:
  - stores or removes app access token securely
  - returns the same state shape with `enforcement_enabled: false`

## Storage Model
- Token is encrypted at rest in settings dir (`app_access_token.dat`)
- Uses Argon2-derived key + AES-GCM, consistent with existing secure token storage pattern

## Non-Goals (Current Phase)
- No token validation against remote API
- No runtime enforcement / lockout
- No feature gating by token yet

## Integration Hook (Next Phase)
1. Add remote validation endpoint call (kmediaz API)
2. Populate `enforcement_enabled` from server policy
3. Apply gates in app startup and protected actions
4. Keep local fallback behavior explicit for offline/dev environments
