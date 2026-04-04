# Proposal: Upstream BugLoginBrowser Intake Workflow

**Change ID:** `upstream-bugloginbrowser-intake-workflow`
**Created:** 2026-03-19
**Status:** Proposed

---

## Problem Statement
BugLogin diverges significantly from the upstream BugLoginBrowser codebase. Without a strict upstream-intake process, pulling changes directly can introduce regressions, mismatch architecture direction, or reintroduce deprecated legacy logic.

## Proposed Solution
Establish a dedicated upstream workflow for `zhom/bugloginbrowser` that:
- tracks newly published upstream commits in a single log
- evaluates each commit with a BugLogin-fit rubric before adoption
- records explicit decision outcomes (`adopt`, `adapt`, `defer`, `skip`)
- applies accepted changes via small, testable intake batches tied to OpenSpec and beads

## Scope

### In Scope
- workflow docs and templates for upstream commit triage
- review rubric and decision gates for BugLogin compatibility
- baseline cadence and ownership guidance
- synchronization with OpenSpec + Superpowers + Beads

### Out of Scope
- automatic merge/cherry-pick from upstream
- one-click sync that bypasses architecture review
- forced parity with all upstream features

## Success Criteria

- [ ] Single canonical location exists for BugLoginBrowser upstream tracking.
- [ ] New upstream commit review includes impact/risk/decision notes.
- [ ] Adoption decisions are traceable to BugLogin-specific constraints.
- [ ] Intake batches can be executed safely without disrupting custom BugLogin logic.

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Blindly importing incompatible upstream logic | Medium | High | Require decision rubric + architecture checkpoint before implementation |
| Missing high-value security/fix commits | Medium | High | Define fixed weekly intake cadence + release freeze checks |
| Workflow drift and inconsistent notes | Medium | Medium | Enforce single log path + template-driven commit review |
