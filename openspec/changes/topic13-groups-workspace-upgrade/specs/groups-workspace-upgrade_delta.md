# Delta: Groups Workspace Upgrade

**Change ID:** `topic13-groups-workspace-upgrade`
**Affects:** Groups management UX, group member operations, role-scoped controls

---

## ADDED

### Requirement: Workspace-Grade Groups Index
BugLogin MUST provide a table-first groups index with search, filters, sort, pagination, and bulk selection.

#### Scenario: Admin reviews groups
- GIVEN an admin opens the groups page
- WHEN they inspect current groups
- THEN they can search, filter, sort, and select rows for batch operations

### Requirement: Group Operational Detail Surface
Each group MUST expose operational detail for members, policies, sync health, and recent activity.

#### Scenario: Operator opens group detail
- GIVEN a user selects a specific group
- WHEN detail view loads
- THEN they can inspect members, policy assignment context, sync signals, and activity timeline

### Requirement: Safe Bulk Member Actions
Bulk member actions MUST include explicit selection visibility, confirmation, and user feedback.

#### Scenario: Bulk remove profiles from group
- GIVEN one or more members are selected
- WHEN operator triggers bulk remove
- THEN the UI requests confirmation, executes action, and shows success/error toast feedback

## MODIFIED

### Requirement: Groups Visual Language Consistency
Groups UI SHOULD align with workspace profile typography and interaction style, avoiding decorative dot/icon lists as primary structure.

#### Scenario: Sidebar and submenu rendering
- GIVEN groups-related navigation and in-page menus
- WHEN users hover/focus items
- THEN interaction states are visible and hierarchy uses tree/indent structure without redundant decorative dots

### Requirement: Cross-Surface Parity
Desktop and web groups flows SHOULD share the same action model and state semantics.

#### Scenario: Execute group operations on desktop and web
- GIVEN the same workspace role and data
- WHEN user performs create/edit/member operations on either surface
- THEN outcomes and constraints match under the same permission model
