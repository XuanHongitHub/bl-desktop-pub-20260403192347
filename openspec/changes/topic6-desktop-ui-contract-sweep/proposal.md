# Proposal: Topic 6 - Desktop UI Action Hierarchy and Surface Contract

**Change ID:** `topic6-desktop-ui-contract-sweep`
**Created:** 2026-03-19
**Status:** Proposed

## Problem Statement
BugLogin has already moved away from the original fixed-window assumptions in the shell and scroll layer, but many UI surfaces still behave like they were designed for a compact, non-resizable mock window.

The current symptoms are:
- page-level actions and utility actions are mixed together in a single toolbar row
- several screens anchor actions in the visual center/end instead of a clear desktop header hierarchy
- secondary tools such as search, filters, saved views, and view modes compete with primary CTAs
- table bulk actions, dialog footers, and section-level actions do not always follow the same pattern
- responsive behavior is inconsistent when the window gets narrow or tall

This creates UI that feels busy in some places, awkward in others, and harder to extend safely for future screens.

## Goals
1. Define a single desktop UI action hierarchy that works for a resizable window.
2. Standardize where primary, secondary, utility, bulk, and destructive actions live across the app.
3. Make page headers, toolbars, table action bars, dialogs, and sidebar controls follow one contract.
4. Preserve product behavior while reducing layout special-casing.

## In Scope
- App shell and sidebar action placement
- Page-level header/action rows
- Search/filter/saved-view controls and other utility actions
- Table bulk action bars and selection-state controls
- Dialog action headers and footers
- Form section headers and per-section actions
- Responsive fallback behavior for narrow windows
- Targeted guard tests for the action hierarchy contract

## Out of Scope
- Business logic changes
- Backend or Tauri command changes
- Feature additions unrelated to layout/action placement
- Global theme or color redesign
- Navigation route restructuring

## Success Criteria
- [ ] Primary page actions are consistently placed in a header-level action slot, typically right-aligned.
- [ ] Secondary actions are separated from primary CTAs, usually in a toolbar row or overflow menu.
- [ ] Table selection and bulk actions are isolated from the page header and appear only when relevant.
- [ ] Dialogs use a stable header/body/footer pattern, with confirm/cancel actions anchored in the footer.
- [ ] Center-aligned action clusters are reserved for empty states, onboarding, or narrow special cases, not routine work surfaces.
- [ ] Sidebar branding uses a compact logo header with collapse/expand control in the same header row.
- [ ] Future screens can follow the same contract without adding new layout hacks.

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Over-normalizing dense screens and making them feel cramped | Medium | Medium | Keep a responsive fallback that collapses secondary actions into overflow or a second row |
| Some screens have genuine workflow-specific action patterns | Medium | Medium | Allow explicit exceptions, but require them to be documented and justified |
| Changing action placement may expose hidden layout assumptions | Medium | High | Sweep the shared header, dialog, and table primitives first, then verify top-traffic screens |

## Decision Lock

1. Title stays left, primary actions stay right, and secondary/utility actions move into a subordinate row or overflow.
2. Center alignment is only for empty states, onboarding, and similar non-routine surfaces.
3. Responsive behavior must preserve action priority instead of collapsing everything into a single mixed toolbar.
