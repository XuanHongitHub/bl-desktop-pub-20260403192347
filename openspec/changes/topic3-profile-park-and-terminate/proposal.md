# Proposal: Topic 3 - Profile Park and Terminate Runtime Modes

**Change ID:** `topic3-profile-park-and-terminate`
**Created:** 2026-03-19
**Status:** Draft

---

## Problem Statement
BugLogin currently uses a hard-stop model (kill process) when users stop a profile. This preserves profile data on disk but drops live runtime context (open tabs/process graph/web runtime), forcing full reload on next run.

For parity with anti-detect browser products (baseline market expectation), BugLogin needs a predictable `Run/Stop` model where:
- `Stop` is park-first (preserve live process for quick resume)
- hard terminate remains an internal fallback path for unsupported/unsafe cases

Without this split:
- stop/run feels slower than competitor baseline in daily loop
- runtime behavior remains ambiguous and hard to reason about in edge cases

## Proposed Solution
Add explicit runtime modes and state transitions for profile sessions:
- Keep primary UX as `Run/Stop` (single stop action)
- Map `Stop` to `Park` behavior by default
- Keep `Terminate` as internal fallback for unsupported/unsafe stop paths
- Preserve current `Run` behavior for stopped profiles, but reattach/reuse existing process for parked profiles
- Add deterministic status model: `Running`, `Parked`, `Stopped`, `Crashed`, `Terminating`

## Scope

### In Scope
- backend runtime state model for park/terminate flows
- command/API contracts for `park_profile` and internal terminate fallback
- unified `Run/Stop` UI and status/tooltip updates
- startup reconciliation and recovery from stale parked state
- exception handling policy and test matrix for reliability

### Out of Scope (this change)
- true process snapshot/restore across OS reboot
- parked profile migration across devices
- suspension implementation that requires browser-engine specific unsupported APIs

## Case Matrix (Requested)

### Same-level cases (parity baseline)
- `Run -> Park -> Run` resumes existing live process without full reload
- close/reopen BugLogin app while parked profile continues to be resumable
- `Run -> Terminate -> Run` creates fresh process while preserving profile data

### Higher-level cases (better-than-baseline)
- policy-driven parked TTL cleanup (resource guard)
- low-latency resume target (sub-second attach/focus path)
- explicit user preference for default stop behavior per profile or global setting

### Lower-level cases (current baseline fallback)
- if park cannot be guaranteed on platform/browser build, graceful fallback to terminate with explicit user-visible reason

### Exception cases
- browser crash while parked
- PID reuse / stale PID mismatch
- app update / browser binary update while parked
- proxy/VPN mutation while parked
- ephemeral profile (must terminate only)
- sync pipeline interaction during park/terminate transitions
- OS sleep/wake and startup reconciliation

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Tauri Backend | Yes | session state machine, park/terminate commands, reconciliation |
| Frontend UI | Yes | stop action split, badges, tooltip/error recovery messaging |
| Sync Scheduler | Yes | avoid forcing sync while parked; trigger sync on terminate/true stop |
| QA/Regression | Yes | runtime state, crash recovery, edge-case matrix across OS |
| Docs | Yes | user behavior contract and operational troubleshooting |

## Success Criteria

- [ ] Users get deterministic `Run/Stop` behavior and stop preserves runtime continuity in supported flows.
- [ ] Parked profiles resume without full browser relaunch in standard case.
- [ ] Terminate behavior remains deterministic and backward-compatible.
- [ ] Edge cases degrade safely (never silent state corruption).
- [ ] Cross-platform smoke matrix passes for runtime mode transitions.

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Park semantics differ by browser/OS | Medium | High | browser-specific adapters + fallback contract |
| Stale running-state after crash | Medium | High | periodic reconciliation + stale PID verification |
| Resource pressure from parked profiles | Medium | Medium | TTL + user policy + forced terminate path |
| User confusion about stop outcome | Medium | Medium | explicit `Run/Stop` contract + fallback notice when stop degrades to terminate |
