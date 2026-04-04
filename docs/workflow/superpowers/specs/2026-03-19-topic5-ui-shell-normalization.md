# Topic 5 Design: UI Shell and Scroll Contract Normalization

Date: 2026-03-19
Owner: codex
Status: completed
OpenSpec Change: `openspec/changes/topic5-ui-shell-normalization`

## Objective
Normalize BugLogin's desktop shell so it behaves like a clean resizable app window with one scroll contract, stable page/dialog shells, and no stale layout abstractions.

## Locked Decisions
1. Shared scrollable surfaces must follow the app's native thin scrollbar styling, not a custom overlay scrollbar.
2. Page-mode views and long dialogs should use flex/min-h-0 scroll chains with stable footers.
3. Layout primitives should be minimal and native, with dead escape-hatch surface removed when possible.
4. Business logic and feature behavior are out of scope for this topic.

## Scope
- Shared scroll primitive behavior and styling contract.
- Sidebar header branding and collapse/expand affordance.
- Page-mode shell normalization for workspace views.
- Long dialog shell normalization for forms and tables.
- Status chip text safety and clipping cleanup where layout primitives caused truncation.
- Targeted guard tests for shell/scroll contract regression.

## Non-Goals
- Feature logic changes.
- Auth/token behavior.
- Proxy/profile backend behavior.
- Visual redesign beyond layout and spacing contracts.

## Acceptance Targets
- Shared scroll containers use the native thin scrollbar contract everywhere the shell expects it.
- Page-mode views and long dialogs no longer hide or distort the scrollbar affordance.
- Shared primitives no longer expose stale custom scrollbar behavior.
- Localized labels and status chips remain readable in the normalized shell.

## Linked Execution Docs
- `docs/workflow/references/topic2/release-gate-qa-matrix.md`
- `docs/workflow/references/topic2/cross-platform-smoke-regression-loop.md`
