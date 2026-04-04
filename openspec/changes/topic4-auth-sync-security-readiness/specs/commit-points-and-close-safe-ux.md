# Commit Points and Close-Safe UX Guarantees

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 2.4 (P0)

## Goal
Ensure users never assume data is safe when commit is not complete.

## Commit Point Types
- `Manual Commit`: user triggers sync/save explicitly.
- `Safe Stop Commit`: app performs required commit before safe stop completion.
- `Scheduled Checkpoint`: background commit in controlled interval.

## UX States
- `Synced`: no pending must-sync changes.
- `Pending Commit`: local changes exist and not yet committed.
- `Committing`: write/upload in progress.
- `Conflict`: commit blocked by concurrent divergence.
- `Failed`: last commit attempt failed and needs action.

## Close-Safe Contract
1. App close during `Synced`: allow immediate close.
2. App close during `Pending Commit` or `Committing`: show risk dialog and options (`Wait`, `Close Anyway`, `Force Stop`).
3. `Safe Stop` completion signal only after required commit points finish or explicit user override is recorded.
4. If user overrides and closes, app must mark recovery-needed state for next launch.

## Telemetry and Audit
- Record commit start/end/failure with non-secret metadata.
- Record close-override decisions for incident analysis.

## Minimum Acceptance
- No false-positive "safe to close" status.
- Commit progress and final status are visible and understandable.
- Recovery-needed flag is set after unsafe close path.
