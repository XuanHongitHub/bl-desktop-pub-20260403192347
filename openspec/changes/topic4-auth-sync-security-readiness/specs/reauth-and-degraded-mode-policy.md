# Re-auth Fallback and Degraded Mode Policy

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 3.3 (P0)

## Goal
Ensure auth failures never cause undefined behavior; app must transition to known degraded states.

## Re-auth Triggers
- Access token expired and refresh fails.
- Refresh token revoked or expired.
- Local token decrypt fails due to key/vault issue.
- Device session revoked from another device/admin action.

## Auth State Model
- `authenticated`: normal protected operations allowed.
- `reauth_required`: protected write operations blocked until re-auth succeeds.
- `degraded_read_only`: read-only local operations allowed; sync writes blocked.
- `signed_out`: all protected resources inaccessible until sign-in.

## Fallback Policy
1. On refresh failure, retry within bounded policy.
2. If still failing, set `reauth_required`.
3. Preserve non-secret local profile metadata access where safe.
4. Block profile write/sync operations requiring valid auth.
5. Provide one-click path to restart KMedia auth flow.

## UX and Messaging
- Show clear reason category (expired/revoked/provider unavailable/secure store error).
- Show current capability mode (`read-only`, `offline-local`, `blocked`).
- Never loop user between transient states without actionable step.

## Minimum Acceptance
- Every auth failure maps to deterministic auth state.
- Re-auth success restores normal state without app restart requirement.
- No protected writes occur while in `reauth_required` or incompatible degraded state.
