# Plan: Upstream BugLoginBrowser Intake Workflow

- Date: 2026-03-19
- Owner: codex
- Related OpenSpec change: `openspec/changes/upstream-bugloginbrowser-intake-workflow/`
- Related design spec: `docs/workflow/superpowers/specs/2026-03-19-upstream-bugloginbrowser-intake-design.md`

## Scope

Define and operationalize a repeatable process to monitor, evaluate, and selectively port commits from `zhom/bugloginbrowser` into BugLogin.

## Phases

1. Phase 1 - Canonical docs and templates
2. Phase 2 - Decision rubric and logging standards
3. Phase 3 - Intake cadence and implementation guardrails

## Progress Log

- [x] Phase 1
- [x] Phase 2
- [x] Phase 3

## Notes

- Upstream commits are reviewed first, never directly merged.
- `adapt` is preferred over direct `adopt` when files are heavily customized.
- Verification stays targeted by default; heavy checks are reserved for high-risk batches.
