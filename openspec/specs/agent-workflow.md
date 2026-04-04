# Agent Workflow Specification

## Requirements

### Requirement: Conditional Verification
Agents MUST avoid full-project lint/test by default and only run heavyweight checks when necessary.

#### Scenario: Low-risk change
- GIVEN a documentation-only or low-risk change
- WHEN the task is completed
- THEN the agent may skip full-project `format/lint/test`

#### Scenario: High-risk change
- GIVEN a high-risk code change, release preparation, or explicit user request
- WHEN verification is needed
- THEN the agent runs full-project `pnpm format && pnpm lint && pnpm test`

### Requirement: Active Tauri Dev Protection
Agents MUST avoid disruptive heavy checks when `tauri dev` is actively being used.

#### Scenario: Live dev session
- GIVEN an active `pnpm tauri dev` workflow
- WHEN an agent considers heavy lint/test operations
- THEN it defers those operations unless explicitly approved

### Requirement: Windows-First Runtime Discipline
Agents MUST follow runtime isolation and prefer Windows execution for Node/Tauri tasks when install/runtime context is Windows.

#### Scenario: Windows install context
- GIVEN dependencies were installed in Windows
- WHEN running pnpm/tauri commands
- THEN commands are run in Windows runtime, not WSL

### Requirement: Workflow Tracking
Agents MUST use OpenSpec for non-trivial changes and beads for task tracking.

#### Scenario: Non-trivial change
- GIVEN a change requiring multiple steps and decisions
- WHEN implementation starts
- THEN an OpenSpec change and bead records are created and maintained
