# Proposal: Topic 5 - UI Shell and Scroll Contract Normalization

**Change ID:** `topic5-ui-shell-normalization`
**Created:** 2026-03-19
**Status:** Implemented (Ready for Archive)

## Problem Statement
BugLogin inherited a set of layout assumptions from the original codebase that no longer match the current product direction.

The main symptoms are:
- scrollbar rendering feels inset or oversized instead of like a normal desktop app
- several shells and dialogs carry custom layout escape hatches that are hard to reason about
- long forms and page-mode views depend on a mix of shell-specific scroll behavior
- dead abstraction surface remains in shared UI primitives, making future fixes harder

This creates repeated UX bugs whenever a screen grows longer or a shell changes shape.

## Goals
1. Establish one shared scroll contract for the app using the native thin scrollbar styling already defined globally.
2. Normalize page-mode and dialog-mode shells so long content scrolls inside predictable flex-based containers.
3. Remove stale layout escape hatches and dead primitive surface so future UI fixes are simpler.
4. Preserve current product behavior and avoid changing business logic.

## In Scope
- Shared scroll primitive behavior
- Sidebar header layout and collapse/expand affordance
- Workspace/page-mode shell behavior
- Long dialog layout and footer separation
- Status chip text safety where clipping was caused by layout primitives
- Guard tests for shell and scroll contracts

## Out of Scope
- Business logic changes
- Proxy/profile/sync feature work
- Auth/token enforcement
- Rewriting visual theme tokens

## Success Criteria
- [ ] Shared scroll containers use the native thin scrollbar contract consistently.
- [ ] Page-mode views and long dialogs scroll inside the shell without overlap or clipping.
- [ ] Layout helpers no longer expose dead/custom scrollbar behavior.
- [ ] Status chips and localized labels are not clipped by shared primitives.
- [ ] Guard scripts fail if the old overlay scrollbar pattern comes back.
- [ ] Sidebar branding is logo-only and the collapse control stays in the header row.

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking a screen that relied on custom scrollbar overlay behavior | Medium | Medium | Keep the primitive API stable where possible and validate existing callers with targeted guards |
| Over-normalizing dialog sizes and making dense forms harder to use | Medium | Medium | Keep width changes local to the screens that need them |
| Layout changes accidentally affecting unrelated flows | Low | High | Limit changes to shell/primitives and verify with targeted UI smoke/tests |

## Decision Lock

1. Shared scroll behavior should follow the app's native thin scrollbar styling, not a custom overlay primitive.
2. Shells should use flex/min-h-0 scroll contracts instead of height hacks or negative-margin compensation.
3. The refactor should prefer smaller reusable primitives over per-screen special casing.
