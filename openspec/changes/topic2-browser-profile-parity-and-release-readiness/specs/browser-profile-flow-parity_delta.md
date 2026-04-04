# Delta: Browser Profile Flow Parity

**Change ID:** `topic2-browser-profile-parity-and-release-readiness`
**Affects:** profile lifecycle, proxy flow, run-state flow, list operations

---

## ADDED

### Requirement: End-to-End Browser Profile Lifecycle
System MUST support an explicit, stable profile lifecycle that covers create, configure, run, stop, archive, restore, and delete flows.

#### Scenario: Profile lifecycle operation
- GIVEN a user with valid permissions
- WHEN user executes lifecycle actions
- THEN each transition is valid, persisted, and reflected in UI state
  AND no dead-end transition blocks recovery

### Requirement: Golden Path Efficiency
Core golden path ("create + assign proxy + run profile") MUST be first-class and low-friction.

#### Scenario: First active profile
- GIVEN a user creating a new profile
- WHEN following standard setup flow
- THEN user can reach runnable profile state with minimal steps and clear progression

### Requirement: Unified Management Actions
Profile list management MUST include at least search/filter/group/tag/sort capabilities for high-frequency operations.

#### Scenario: Large profile list
- GIVEN a workspace with many profiles
- WHEN user locates and updates a target profile
- THEN discovery and action remain efficient and predictable

## MODIFIED

### Requirement: Run State Clarity
Profile run state behavior should be deterministic and user-visible through explicit statuses.

#### Scenario: Start/stop operation
- GIVEN a profile run command
- WHEN runtime state changes
- THEN UI reflects clear state transitions and actionable failure feedback

## REMOVED

- Implicit acceptance of incomplete profile lifecycle coverage as release-ready parity
