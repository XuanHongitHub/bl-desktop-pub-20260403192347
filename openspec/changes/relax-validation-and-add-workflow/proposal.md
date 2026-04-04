# Proposal: Relax Verification Rules and Add OpenSpec/Superpowers/Beads Workflow

**Change ID:** `relax-validation-and-add-workflow`
**Created:** 2026-03-18
**Status:** Implementation Complete
**Completed:** 2026-03-18

---

## Problem Statement
Current agent instructions force full-project `format/lint/test` after almost every change. This is expensive and can interfere with active `tauri dev` sessions.

## Proposed Solution
- Update rule documents to enforce conditional verification only when needed.
- Add explicit protection for active Tauri dev sessions.
- Add OpenSpec structure for specification-driven workflow.
- Add beads tracking for visibility of multi-step execution.
- Add explicit Windows-first runtime guidance.

## Scope

### In Scope
- `AGENTS.md` and `CLAUDE.md` workflow updates
- `openspec/` scaffold and this change record
- `docs/workflow/beads/` scaffold and first bead

### Out of Scope
- Runtime script behavior changes
- CI/CD policy changes

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Database | No | None |
| API | No | None |
| State | No | None |
| UI | No | None |
| Dev Workflow Docs | Yes | Update verification/runtime/workflow rules |

## Success Criteria

- [x] Rule docs no longer force full lint/test for every change.
- [x] Rules explicitly protect active `tauri dev` sessions.
- [x] OpenSpec and beads structures exist and are used for this change.
- [x] Windows runtime preference is documented.
