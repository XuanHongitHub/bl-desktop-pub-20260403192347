# Device Session Lifecycle (Access/Refresh/Revoke/List)

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 3.2 (P0)

## Goal
Provide auditable per-device session control for security and offboarding operations.

## Session Model
- One user may have multiple active `device_session_id` entries.
- Each device session has status: `Active`, `Revoked`, `Expired`.
- Access token is short-lived; refresh token rotates by policy.

## Lifecycle Operations
- `List`: return active/revoked/expired sessions with device label, last active time, and IP/region metadata policy.
- `Refresh`: exchange valid refresh token for new access token (and optionally rotated refresh token).
- `Revoke One`: invalidate target device session immediately.
- `Revoke All Except Current`: emergency containment for suspected compromise.

## Enforcement Rules
- Revoked session must fail next refresh/write attempt deterministically.
- Expired session must transition to re-auth required without undefined intermediate state.
- Refresh token rotation must invalidate prior token generation when policy requires.

## Audit Requirements
- Record create/refresh/revoke events with actor, device session id, and timestamp.
- Never include raw token values in audit record.

## Minimum Acceptance
- Device session list is consistent with backend source of truth.
- Revoke effects are visible immediately for protected operations.
- Refresh behavior is deterministic across concurrent requests.
