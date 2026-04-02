# Spec: Topic 13 - Groups Workspace Upgrade

- Date: 2026-04-01
- Owner: codex
- Related OpenSpec change: `openspec/changes/topic13-groups-workspace-upgrade/`

## Problem
The current groups experience is visually inconsistent, action-poor, and not aligned with workspace profile management standards. Operators cannot efficiently triage, edit, and maintain groups at scale.

## Goals
1. Deliver a clean table-first groups experience suitable for workspace operations.
2. Add complete operational workflows: members, policy preview, sync health, activity.
3. Align desktop and web group behavior with shared role/permission constraints.

## Non-goals
1. Rewriting core sync engine internals.
2. Shipping cross-workspace group federation.
3. Introducing new billing/commercial behavior.

## UX / Flow
- Index is the operational hub: searchable/sortable groups table with selective, high-signal columns and bulk toolbar.
- Detail view opens as split-pane or routed detail (depending existing shell), containing:
  - Members tab: list, add/remove/move operations.
  - Policies tab: preview + assign/unassign behavior.
  - Sync tab: drift/risk indicators and last sync status.
  - Activity tab: chronological audit-style feed.
- Visual policy:
  - Reduce cards and rounded containers to structural minimum.
  - Prefer separators, spacing, typography, and row states to build hierarchy.
  - Remove redundant decorative dots/icons where tree indentation already communicates depth.

## Technical Design
- Introduce/extend group service helpers for filtered fetch, member mutations, and activity queries.
- Normalize UI state for selected rows, pending mutations, and optimistic updates.
- Use shared shadcn primitives (`Table`, `DropdownMenu`, `Dialog`, `ScrollArea`, `Badge`, `Button`, `Input`, `Select`).
- All async flows must have loading/disabled states and `try/catch` + toast handling.
- Ensure copy keys are added to both `src/i18n/locales/en.json` and `src/i18n/locales/vi.json`.

## Risks
- Permission drift between desktop/web: mitigate with shared guards and matrix QA.
- Over-designed UI reducing clarity: mitigate with strict table-first IA and reduced decorative chrome.
- Regression from bulk operations: mitigate with targeted tests and confirmation gates.

## Acceptance
1. Users can manage groups end-to-end from index and detail surfaces with clear feedback.
2. Groups UI style matches workspace profile standards and reduces card-heavy clutter.
3. Role constraints are enforced consistently on desktop and web.
4. i18n keys are complete for all new user-facing copy.
