# Topic 6 Design: Desktop UI Action Hierarchy and Surface Contract

Date: 2026-03-19
Owner: codex
Status: draft
OpenSpec Change: `openspec/changes/topic6-desktop-ui-contract-sweep`

## Objective
Define a single desktop UI contract for BugLogin so routine surfaces behave like a resizable business application instead of a fixed-window mock shell.

The contract should make action placement predictable across the app:
- title left
- primary actions right
- secondary and utility actions subordinate
- bulk actions isolated from page headers
- dialog actions anchored in the footer
- center alignment reserved for empty or exceptional states

## Locked Decisions
1. Title-left / primary-right is the default for page headers and most surface headers.
2. Secondary actions such as search, filters, saved views, and mode toggles should not visually compete with the primary CTA.
3. Table bulk actions must use a dedicated selection/bulk bar instead of sharing the page header.
4. Dialogs should use a stable header/body/footer stack; footer actions stay anchored while content scrolls.
5. Centered action clusters are only acceptable for empty states, onboarding, or similarly non-routine surfaces.
6. The sidebar should keep a compact logo-only header with collapse/expand in the same row.

## Scope
- App shell, page headers, and workspace action placement
- Sidebar header branding and collapse control
- Search/filter/saved-view toolbars
- Table selection and bulk action bars
- Dialog headers, bodies, and footers
- Form section headers and section-level actions
- Responsive fallbacks for narrow windows
- Guard tests for the action hierarchy contract

## Non-Goals
- Business logic or backend command changes
- Token/auth/proxy/profile feature behavior
- New routes or navigation restructuring
- Theme redesign, typography redesign, or icon-set changes unrelated to the action contract

## Contract Model

### Primary actions
Primary actions are the most important next step on a surface. They belong in the header action slot or top-right action zone on wide layouts.

### Secondary actions
Secondary actions support the primary workflow but should not compete visually with it. They belong in a subordinate toolbar row, a smaller trailing cluster, or an overflow menu.

### Utility actions
Utility actions are search, filters, saved views, toggles, and similar controls. They should be grouped and separated from the primary CTA.

### Bulk actions
Bulk actions appear only when selection exists. They use a dedicated selection/bulk bar so the page header remains stable.

### Destructive actions
Destructive actions should remain visually subordinate unless they are the only meaningful primary action for the current surface.

## Surface Rules

### Page headers
Page headers should follow a stable left/right structure:
- left: title and description
- right: primary action
- below or subordinate: search, filters, view toggles, saved views, and overflow actions

### Tables
Tables should keep their selection state and bulk operations separate from the page title area. The table action bar should reflect the current selection, not the whole page.

### Dialogs
Dialogs should keep a clear header/body/footer stack. The footer should contain confirm/cancel actions, and the body should be the only scrollable region.

### Sidebar
The sidebar should remain compact and predictable:
- brand mark in the header row
- collapse/expand control in the same row
- navigation items below
- no separate floating expand block

### Form-heavy screens
Forms with advanced options should separate primary form completion from secondary configuration. If a screen needs multiple tiers, the UI should use sections or sub-rows rather than a single crowded line.

## Responsive Behavior
When width becomes constrained, the UI should:
1. preserve the primary action
2. collapse or overflow secondary actions first
3. only wrap into additional rows when necessary
4. avoid re-centering the action cluster as the default fallback

## Acceptance Targets
- Page headers no longer mix title, search, and primary CTA in one crowded row.
- Table bulk actions no longer live inside the same header surface as the page title.
- Dialogs no longer place confirm/cancel actions in the visual middle of the modal.
- The sidebar header remains logo-only with the collapse control beside it.
- New UI surfaces can adopt the contract without adding custom layout hacks.

## Linked Execution Docs
- `docs/workflow/references/topic2/release-gate-qa-matrix.md`
- `docs/workflow/references/topic2/cross-platform-smoke-regression-loop.md`
