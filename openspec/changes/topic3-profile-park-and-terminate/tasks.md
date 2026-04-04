# Implementation Tasks: Topic 3 - Profile Park and Terminate Runtime Modes

**Change ID:** `topic3-profile-park-and-terminate`

---

## Phase 1: Runtime Contract Lock

- [x] 1.1 Define profile runtime state machine (`Running`, `Parked`, `Stopped`, `Crashed`, `Terminating`) - 2026-03-19
- [x] 1.2 Define API contract: `park_profile`, `terminate_profile`, `resume_profile` - 2026-03-19
- [x] 1.3 Define fallback contract when park is unsupported - 2026-03-19

**Quality Gate:**
- [x] All state transitions are deterministic and documented - 2026-03-19
- [x] No ambiguous mapping between UI status and backend state - 2026-03-19

---

## Phase 2: Backend Implementation

- [x] 2.1 Add runtime state persistence fields to profile metadata - 2026-03-19
- [x] 2.2 Implement `park_profile` command path without killing browser process - 2026-03-19
- [x] 2.3 Keep `kill_browser_profile` as hard terminate path - 2026-03-19
- [x] 2.4 Implement startup/runtime reconciliation for stale parked sessions - 2026-03-19
- [x] 2.5 Block/guard unsupported combinations (ephemeral profile, incompatible browser) - 2026-03-19

**Quality Gate:**
- [ ] Park and terminate both function independently
- [ ] Crash or stale PID paths converge to safe state

---

## Phase 3: UI/UX Integration

- [x] 3.1 Implement `Run/Stop` UX where `Stop` maps to park-by-default and terminate remains internal fallback - 2026-03-19
- [x] 3.2 Add clear state badges + action availability rules - 2026-03-19
- [ ] 3.3 Add user-facing reason when fallback to terminate is applied

**Quality Gate:**
- [ ] User can predict outcome of each action before clicking
- [ ] No dead-end UI status after failed operation

---

## Phase 4: Sync and Process Lifecycle Integration

- [ ] 4.1 Ensure sync triggers on true stop/terminate, not on park
- [x] 4.2 Ensure profile-running events distinguish parked vs stopped - 2026-03-19
- [ ] 4.3 Verify proxy/VPN lifecycle behavior under parked state

**Quality Gate:**
- [ ] Sync behavior matches runtime contract
- [ ] No proxy/VPN leak on transition paths

---

## Phase 5: Validation Matrix

- [x] 5.1 Define same-level parity cases in spec matrix - 2026-03-19
- [x] 5.2 Define higher-level optimization cases in spec matrix - 2026-03-19
- [x] 5.3 Define lower-level fallback cases in spec matrix - 2026-03-19
- [x] 5.4 Define exception matrix (crash/update/sleep/reboot/ephemeral) in spec matrix - 2026-03-19

**Quality Gate:**
- [ ] Windows/macOS/Linux smoke pass for core transitions
- [ ] Exception cases produce explicit recoverable states
