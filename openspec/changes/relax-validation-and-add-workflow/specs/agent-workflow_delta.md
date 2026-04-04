# Delta: Agent Workflow

**Change ID:** `relax-validation-and-add-workflow`
**Affects:** verification policy, runtime discipline, process tracking

---

## ADDED

### Requirement: Conditional Verification
Agents MUST avoid full-project lint/test by default and only run heavyweight checks when needed.

#### Scenario: Low-risk change
- GIVEN a low-risk docs/config update
- WHEN implementation is done
- THEN full `pnpm format && pnpm lint && pnpm test` is optional

### Requirement: Active Tauri Dev Protection
Agents MUST avoid disruptive heavy checks during active dev sessions.

#### Scenario: tauri dev is active
- GIVEN an active `pnpm tauri dev` session
- WHEN verification is considered
- THEN heavy checks are deferred unless explicitly requested

### Requirement: Workflow Scaffolding
Agents SHOULD use OpenSpec and beads for non-trivial work.

#### Scenario: multi-step task
- GIVEN a multi-step task
- WHEN work begins
- THEN create/update OpenSpec and bead artifacts

---

## MODIFIED

### Requirement: Runtime Isolation Guidance
Strengthen runtime guidance to prefer Windows execution when dependency/runtime context is Windows.

#### Scenario: windows-first project flow
- GIVEN project dependencies are managed from Windows
- WHEN running `pnpm` or `tauri` commands
- THEN execute from Windows runtime, not WSL

---

## REMOVED

(None)
