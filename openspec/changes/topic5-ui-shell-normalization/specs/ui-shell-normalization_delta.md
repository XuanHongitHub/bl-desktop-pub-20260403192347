# Delta: UI Shell and Scroll Contract Normalization

**Change ID:** `topic5-ui-shell-normalization`
**Affects:** scroll primitives, page shells, dialog shells, status chips

## ADDED

### Requirement: Native Thin Scroll Contract
Shared scrollable UI containers MUST use the app's native thin scrollbar styling contract instead of a custom overlay scrollbar implementation.

#### Scenario: Page-mode view
- GIVEN a workspace page with long content
- WHEN the content exceeds the visible viewport
- THEN scrolling remains aligned to the shell edge and uses the same thin scrollbar styling as the rest of the app

### Requirement: Stable Shell Scroll Chains
Page-mode shells and long dialogs MUST use a flex/min-h-0 scroll chain so content can shrink, scroll, and keep footers visible without overlap.

#### Scenario: Long settings page
- GIVEN a long settings page or modal
- WHEN content grows past the visible height
- THEN the body scrolls inside the container and the footer remains separated from the scroll region

### Requirement: Readable Shared Status Chips
Shared status-chip styling MUST not clip localized text or descenders when labels become longer than the default English sizing.

#### Scenario: Localized status label
- GIVEN a localized status label with taller descenders or a longer word
- WHEN the chip renders
- THEN the full label remains readable without truncation by the base primitive

### Requirement: Remove Dead Layout Abstractions
Shared layout primitives SHOULD not expose dead custom scrollbar or escape-hatch APIs that no longer match the app's contract.

#### Scenario: Component reuse
- GIVEN a developer imports the shared scroll primitive
- WHEN they inspect or reuse the component
- THEN the contract is minimal, native, and consistent with the app shell

### Requirement: Logo-Only Sidebar Header
The application sidebar header MUST use the logo asset as the brand marker and keep the collapse/expand control in the header row.

#### Scenario: Sidebar collapse
- GIVEN the sidebar is expanded or collapsed
- WHEN the user toggles the shell
- THEN the brand area stays compact and the collapse control remains adjacent to the logo

## MODIFIED

### Requirement: Desktop Shell Feel
The app's desktop shell experience should feel like a normal resizable window rather than a fixed-window mock shell.

#### Scenario: Window resizing
- GIVEN the app window is resized
- WHEN the user navigates between pages and dialogs
- THEN layout remains stable and scroll affordance stays visible

## REMOVED

- Dependence on Radix overlay scrollbars as the shared scroll contract for the app shell
