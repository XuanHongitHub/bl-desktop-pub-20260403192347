# Delta: Browser Profile Runtime Modes (Park vs Terminate)

**Change ID:** `topic3-profile-park-and-terminate`
**Affects:** profile runtime lifecycle, process control, stop/resume UX

---

## ADDED

### Requirement: Unified Run/Stop Semantics With Safe Fallback
System MUST expose a single primary `Stop` action in UX. `Stop` MUST park by default and MAY degrade to terminate only when park is unsupported/unsafe.

#### Scenario: User chooses stop
- GIVEN a running profile
- WHEN user chooses `Stop`
- THEN profile enters `Parked` state and remains resumable without full relaunch
- AND runtime status is reflected in UI

#### Scenario: Stop degrades to terminate
- GIVEN a running profile where park is unsupported/unsafe
- WHEN user chooses `Stop`
- THEN system performs internal terminate fallback and profile becomes `Stopped`
- AND next run launches a fresh process using persisted profile data
- AND UI receives explicit fallback reason

### Requirement: Deterministic Runtime State Machine
System MUST maintain deterministic runtime states: `Running`, `Parked`, `Stopped`, `Crashed`, `Terminating`.

#### Scenario: State consistency across reconciliation
- GIVEN profile runtime state is `Parked`
- WHEN process is no longer alive on reconciliation
- THEN state transitions to `Crashed` or `Stopped` with explicit reason
- AND no stale `Parked` state remains

### Requirement: Resume Behavior
System MUST resume parked profiles by attaching/focusing existing process whenever possible.

#### Scenario: Resume parked profile
- GIVEN a profile in `Parked` state with valid live process
- WHEN user runs the profile
- THEN system resumes existing process instead of spawning a new one

#### Scenario: Existing process is reused
- GIVEN runtime metadata says profile is parked/running and matching process is alive
- WHEN user runs profile without explicit URL-open command
- THEN system reuses existing process/session
- AND MUST NOT kill/relaunch that process

### Requirement: Session and Navigation Continuity
System MUST preserve runtime tab/session continuity and in-tab navigation semantics for supported persistent profiles.

#### Scenario: Stop then run preserves active tab stack
- GIVEN a persistent profile with multiple open tabs and in-tab navigation history
- WHEN user performs `Run -> Stop -> Run`
- THEN tabs/session context remain available on resume
- AND back/forward navigation remains functional for restored tabs

#### Scenario: Full close and reopen restores previous session
- GIVEN a persistent profile that was closed (not just parked)
- WHEN user re-runs profile
- THEN browser attempts last-session restore according to profile policy
- AND this behavior is deterministic and documented for each browser adapter

### Requirement: Safe Fallback Contract
When park is unsupported or unsafe for current browser/platform/profile type, system MUST fall back to terminate with explicit user-visible notice.

#### Scenario: Unsupported park path
- GIVEN a running profile where park is unsupported
- WHEN user requests `Stop`
- THEN system performs `Terminate`
- AND emits explicit fallback reason to UI

### Requirement: Ephemeral Policy
Ephemeral profiles MUST NOT support parked state.

#### Scenario: Park requested for ephemeral profile
- GIVEN an ephemeral running profile
- WHEN user requests `Stop`
- THEN request is rejected or converted to `Terminate` by policy
- AND ephemeral data cleanup policy remains enforced

## MODIFIED

### Requirement: Run/Stop State Clarity
Run-state behavior must distinguish between parked and stopped outcomes, not a single generic stop.

#### Scenario: Stop status visibility
- GIVEN user performs runtime control actions
- WHEN transitions complete
- THEN UI status clearly indicates `Parked` vs `Stopped`
- AND subsequent `Run` behavior matches the indicated state

## REMOVED

- Implicit assumption that every stop operation must terminate process
