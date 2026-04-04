# Delta: Desktop UI Action Hierarchy and Surface Contract

**Change ID:** `topic6-desktop-ui-contract-sweep`
**Affects:** page headers, toolbars, table action bars, dialogs, sidebar header, form sections

## ADDED

### Requirement: Desktop Action Hierarchy
All routine UI surfaces MUST follow a clear desktop action hierarchy: title on the left, primary actions on the right, and secondary/utility actions separated into a subordinate row or overflow path.

#### Scenario: Workspace page
- GIVEN a page with a title and several controls
- WHEN the page renders on a normal desktop window
- THEN the title is left-aligned and the primary action is visually distinct from search, filters, and other utility controls

### Requirement: Secondary Actions Stay Subordinate
Search, filters, saved views, view toggles, and similar utilities MUST not compete visually with the primary action on routine workflow surfaces.

#### Scenario: Profiles page
- GIVEN a page with search and filter controls plus a create CTA
- WHEN the toolbar renders
- THEN the create CTA remains the primary action and the search/filter controls sit in a subordinate toolbar row or overflow cluster

### Requirement: Table Bulk Actions Are Isolated
Selection state and bulk actions MUST be rendered in a dedicated table action bar or selection surface instead of being mixed into the page header.

#### Scenario: Selected rows
- GIVEN one or more rows are selected in a table
- WHEN bulk actions become available
- THEN the bulk action bar appears separately from the page header and clearly represents selection state

### Requirement: Stable Dialog Action Footers
Dialogs MUST keep confirm/cancel actions anchored in the footer, with content scrolling independently of the footer.

#### Scenario: Long dialog
- GIVEN a long form or settings dialog
- WHEN the body exceeds the available height
- THEN the content scrolls inside the dialog body and the footer actions remain visible and stable

### Requirement: Sidebar Brand Header
The sidebar MUST present a compact logo-only brand header with the collapse/expand control in the same header row.

#### Scenario: Sidebar collapse
- GIVEN the sidebar is expanded or collapsed
- WHEN the user toggles the shell
- THEN the brand area stays compact and the toggle stays adjacent to the brand mark

### Requirement: Responsive Degradation
When width is constrained, the UI MUST preserve action priority by collapsing secondary actions or moving them to overflow instead of re-centering or mixing everything into one row.

#### Scenario: Narrow window
- GIVEN a narrow desktop window
- WHEN the page still needs to expose the primary action
- THEN the UI degrades without losing hierarchy or making the primary action hard to find

## MODIFIED

### Requirement: Desktop Shell Feel
BugLogin's desktop experience should feel like a normal resizable application, not like a fixed-width mock shell with action clusters anchored to the middle of the viewport.

#### Scenario: Window resizing
- GIVEN the app window is resized wider or narrower
- WHEN the user navigates between pages and dialogs
- THEN action placement stays legible and consistent across surfaces
