# Stop Semantics and Force Terminate Path

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 2.2 (P0)

## Goal
Guarantee that "Stop" behavior is predictable and does not silently destroy expected continuity.

## Operations
- `Park` (default where supported): preserve runtime continuity for quick resume.
- `Terminate` (explicit): controlled shutdown and resource release.
- `Force Terminate` (exception): emergency kill path when graceful shutdown fails.

## User-Facing Semantics
- If profile is `Running`, user must see available operations and expected outcome before action.
- If `Park` is unsupported (ephemeral profile/platform limitation/policy), system must show fallback reason and use `Terminate`.
- `Force Terminate` must require explicit confirmation and display data-risk warning.

## Execution Contract
1. Enter transitional state (`Terminating` for terminate paths).
2. Attempt graceful close in bounded timeout.
3. If timeout/failure in normal terminate path, allow retry or escalate to force terminate.
4. Finalize in `Stopped` (or `Crashed` when abnormal loss detected).

## Continuity Contract
- `Park`: preserve cookies/session/tabs in live runtime.
- `Terminate`: continuity comes from persisted profile artifacts only.
- `Force Terminate`: may lose volatile unsaved runtime mutations; must be surfaced to user.

## Minimum Acceptance
- No single generic "Stop" ambiguity in UI/backend.
- Every stop action maps to explicit operation and terminal state.
- Fallback and force paths are logged with reason codes.
