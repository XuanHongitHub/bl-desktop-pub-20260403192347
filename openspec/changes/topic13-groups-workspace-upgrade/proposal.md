# Proposal: Topic 13 - Groups Workspace Upgrade

**Change ID:** `topic13-groups-workspace-upgrade`
**Created:** 2026-04-01
**Status:** Draft

## Problem Statement
Current `Groups` UX in BugLogin is too thin compared to workspace profile operations: low information density, weak action model, and inconsistent interaction patterns between desktop and web. The existing table does not support real grouping workflows (assignment, policy, sync visibility, lifecycle tracking).

## Proposed Solution
- Upgrade `Groups` to a workspace-grade management surface focused on profile operations.
- Standardize UX using shadcn primitives and BugLogin design tokens, reducing visual noise (less card abuse, fewer decorative bullets/icons, stronger table-first layout).
- Introduce operational capabilities: bulk actions, membership management, policy assignment preview, sync health indicators, and activity trail.
- Keep desktop and web behavior aligned under one interaction contract.

## Scope

### In Scope
- New group index with stronger filters, sortable table, and quick actions
- Group detail split view: members, rules/policies, sync health, activity
- Group create/edit dialog with validation and loading/error feedback
- Bulk member operations (add/remove/move) and safe confirmations
- Role-aware permissions for workspace owner/admin/member views
- i18n parity (`en`, `vi`) for all new labels/messages

### Out of Scope
- Backend rearchitecture of profile sync engine
- Cross-workspace sharing of groups
- New billing logic
- Third-party rule engine integration

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Database | No/Low | Reuse current group/member entities; optional additive fields only if needed |
| API | Yes | Expand group endpoints for filters, bulk operations, and activity feed |
| State | Yes | Normalize group/member state and optimistic updates for bulk actions |
| UI | Yes | Replace current low-density group page with workspace-grade flows |

## Architecture Considerations
- Prefer table-first information architecture over card-heavy layout.
- Use `ScrollArea` for long lists; keep fixed shell behavior consistent with app constraints.
- Reuse existing shadcn components and shared hooks for async and toast behavior.
- Keep API calls wrapped in `try/catch` with user-visible toasts and loading states.

## Success Criteria
- [ ] Groups page supports filtering/search/sort and bulk member actions
- [ ] Group detail shows members, policy preview, sync health, and activity timeline
- [ ] Desktop and web `Groups` interaction model is consistent
- [ ] New copy is fully translated in `en` and `vi`
- [ ] No hydration/runtime regressions introduced on web shell

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| UX complexity regresses clarity | Medium | High | Enforce table-first IA, reduce card/chip noise, run visual QA checklist |
| Bulk actions create accidental destructive changes | Medium | High | Add clear selection state, confirmation modals, undo-safe flows where possible |
| API latency hurts perceived responsiveness | Medium | Medium | Optimistic UI for local state + explicit loading skeletons and retry paths |
| Desktop/web divergence reappears | Medium | High | Shared component contracts and route-level parity checks |
