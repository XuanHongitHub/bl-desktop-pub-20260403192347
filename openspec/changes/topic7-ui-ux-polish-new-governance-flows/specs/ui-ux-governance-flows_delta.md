# Delta: UI/UX Polish for New Governance Flows

**Change ID:** `topic7-ui-ux-polish-new-governance-flows`  
**Affects:** Admin Workspace, Cloud Auth Dialog, Sync Config Dialog

## ADDED

### Requirement: Compact Governance Surface Contract
New governance surfaces MUST use a compact card/section hierarchy with explicit heading, helper text, and action grouping.

#### Scenario: Admin sections
- GIVEN an admin page with multiple action domains
- WHEN the page renders
- THEN each domain appears in a clearly separated section with consistent spacing and action placement

### Requirement: Explicit Status Signals
Operational status (pending, connected, error, unknown) MUST be visible near the related controls and readable without opening secondary views.

#### Scenario: Config readiness
- GIVEN server readiness data is available
- WHEN an operator opens Admin Workspace
- THEN control-plane security/persistence readiness is shown inline near control-plane connection status

### Requirement: Guided Setup Steps
Auth and sync setup flows MUST guide users with short next-step copy and deterministic action states (loading/disabled/success/error).

#### Scenario: Email OTP login
- GIVEN a user opens Cloud Auth dialog
- WHEN they request OTP and verify code
- THEN the dialog clearly reflects current step, and invite token handling remains optional but visible

#### Scenario: Sync setup
- GIVEN a user opens Sync Config dialog
- WHEN they test/save/disconnect
- THEN status and action feedback remain stable with no ambiguous wording

## MODIFIED

### Requirement: New-Feature UX Consistency
All newly shipped governance-related UI introduced in Topic 4+ MUST follow the same compact visual language and interaction contracts.

#### Scenario: Release readiness review
- GIVEN product review for release candidate
- WHEN reviewing Admin/Auth/Sync new flows together
- THEN the surfaces feel cohesive in hierarchy, feedback behavior, and control semantics
