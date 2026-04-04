# Profile Lock, Heartbeat, Stale Recovery, and Takeover Policy

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 4.3 (P1)

## Goal
Prevent destructive concurrent writes and provide explicit takeover path when holder is unavailable.

## Lock Contract
- Write lock is required for mutation operations on profile runtime/sync-critical containers.
- Lock record includes holder user id, device id, acquired time, last heartbeat, lease timeout.

## Heartbeat Rules
- Active holder sends heartbeat at bounded interval.
- Missing heartbeats beyond timeout marks lock `stale`.
- Stale mark is visible to authorized users before takeover.

## Takeover Policy
- `Owner` and policy-allowed `Admin` may force takeover.
- Takeover requires explicit reason and is audit logged.
- Previous holder session becomes read-only or reauth-required on next write attempt.

## Failure and Recovery
- If lock service unavailable, protected writes fail closed (no unsafe write).
- On app restart, stale local lock cache must reconcile with server lock truth.

## Minimum Acceptance
- No concurrent write commits under active valid lock.
- Stale lock can be resolved without manual DB intervention.
- Every takeover action has traceable actor/device/reason metadata.
