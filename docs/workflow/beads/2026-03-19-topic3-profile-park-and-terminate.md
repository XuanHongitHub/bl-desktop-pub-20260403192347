# Bead: Topic 3 - Profile Park and Terminate Runtime Modes

- **Date:** 2026-03-19
- **Owner:** Codex + User
- **Status:** active
- **OpenSpec Change:** `openspec/changes/topic3-profile-park-and-terminate/`

## Execution Items

- [x] Create OpenSpec proposal/tasks/spec delta for park vs terminate
- [x] Implement backend runtime state model and commands (park default + terminate fallback)
- [x] Implement UI run/stop behavior with parked-state action guards
- [ ] Validate parity + exception matrix across OS targets
- [ ] Archive change after verification

## Notes

This bead tracks a parity-critical runtime behavior upgrade:
- Keep persistent profile data as current baseline
- Add persistent live-process behavior via `Park` where feasible
- Preserve `Terminate` for strict shutdown/reliability control
- Current UX policy (2026-03-19): only expose `Run/Stop` in primary table actions; `Stop` uses park semantics and may internally fallback to terminate for unsupported paths.
- Runtime robustness patch (2026-03-19): use runtime-state-aware running fallback in UI/hooks and reuse existing Camoufox/Wayfern process on resume path to reduce false relaunch (prevents tab/session continuity loss).
- Added spec matrix (2026-03-19): `openspec/changes/topic3-profile-park-and-terminate/specs/runtime-parity-and-exception-matrix.md` covering same-level/higher/lower/exception cases and P0 invariants for tabs/session/back-forward continuity.
