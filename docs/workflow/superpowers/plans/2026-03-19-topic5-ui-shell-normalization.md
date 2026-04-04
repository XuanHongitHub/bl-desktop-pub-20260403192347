# Plan: Topic 5 UI Shell and Scroll Contract Normalization

Date: 2026-03-19
Owner: codex
Status: completed
Spec: `docs/workflow/superpowers/specs/2026-03-19-topic5-ui-shell-normalization.md`
OpenSpec: `openspec/changes/topic5-ui-shell-normalization`

## Scope

Normalize shared scroll primitives and desktop shell layout so BugLogin feels like a normal resizable app window with stable native scrolling.

## Phases

1. Phase 1 - Shell and Scroll Audit
2. Phase 2 - Shared Primitive Normalization
3. Phase 3 - Shell and Dialog Cleanup
4. Phase 4 - Verification and Guardrails

## Progress Log

- [x] Phase 1 - Shell and Scroll Audit (scroll contract evidence gathered during refactor)
- [x] Phase 2 - Shared Primitive Normalization (shared ScrollArea moved to native thin contract)
- [x] Phase 3 - Shell and Dialog Cleanup
- [x] Phase 4 - Verification and Guardrails (targeted guards added and passing)

## Notes

- The global native scrollbar styling already exists in `src/styles/globals.css`; the refactor aligns shared primitives to that contract.
- The current focus is removing stale layout escape hatches and keeping page/dialog shells stable under resize.
- Sidebar branding now follows a logo-only header with the collapse toggle inside the header row.
