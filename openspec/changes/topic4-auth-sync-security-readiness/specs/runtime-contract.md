# Runtime Contract (Running/Parked/Stopped/Crashed/Terminating)

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 2.1 (P0)

## State Definitions
- `Running`: browser process is alive and actively attached to profile runtime.
- `Parked`: process and in-memory session continuity are preserved for fast resume.
- `Stopped`: process is fully terminated; restart requires full launch.
- `Terminating`: transitional state while controlled termination is in progress.
- `Crashed`: unexpected process loss detected by reconciliation.

## Deterministic Transition Rules
- `Running -> Parked`: user chooses park and platform/profile supports park.
- `Running -> Terminating -> Stopped`: user chooses terminate or force stop path.
- `Parked -> Running`: resume path attaches/focuses existing process.
- `Parked -> Crashed`: reconciliation detects parked PID not alive.
- `Crashed -> Running`: user relaunches after crash handling.
- `Crashed -> Stopped`: system cannot safely recover and finalizes safe stop.

## Invariants
1. UI badge and backend state must always match one-to-one.
2. A profile cannot be both `Parked` and `Stopped` in same reconciliation cycle.
3. `Terminating` must have bounded timeout and explicit final state.
4. Stale runtime state must never survive app restart without reconciliation.

## Reconciliation Rules on App Start
- Validate PID/process liveness for `Running` and `Parked` profiles.
- If liveness check fails, convert to `Crashed` or `Stopped` with reason code.
- Emit audit/runtime event for all corrective transitions.

## Minimum Acceptance
- No ambiguous runtime state in backend persistence.
- No stale `Parked` state when process is gone.
- Resume operation outcome is deterministic and user-visible.
