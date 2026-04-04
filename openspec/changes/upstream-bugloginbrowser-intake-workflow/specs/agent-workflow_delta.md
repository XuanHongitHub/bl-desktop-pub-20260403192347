# Delta: Upstream BugLoginBrowser Intake Governance

**Change ID:** `upstream-bugloginbrowser-intake-workflow`
**Affects:** workflow governance, upstream change intake safety, release readiness discipline

---

## ADDED

### Requirement: Upstream Intake Canonical Process
Agents MUST use a single canonical workflow to review upstream commits from `zhom/bugloginbrowser` before porting code into BugLogin.

#### Scenario: New upstream commits detected
- GIVEN new commits exist on upstream BugLoginBrowser
- WHEN intake starts
- THEN each commit is logged in the canonical upstream tracking folder
- AND each commit receives a decision state: `adopt`, `adapt`, `defer`, or `skip`

### Requirement: BugLogin-Fit Decision Rubric
Agents MUST evaluate upstream commits against BugLogin customization boundaries before implementation.

#### Scenario: Commit appears useful but touches diverged areas
- GIVEN a commit changes areas heavily customized in BugLogin
- WHEN the intake review is performed
- THEN the commit is marked `adapt` or `defer` with rationale
- AND direct blind porting is rejected

### Requirement: Intake Batch Safety
Adopted upstream changes MUST be implemented in small intake batches with traceable OpenSpec and bead links.

#### Scenario: Approved upstream patch
- GIVEN a commit is approved as `adopt` or `adapt`
- WHEN implementation begins
- THEN work is tracked by OpenSpec change context and bead records
- AND verification remains minimal/targeted unless risk explicitly requires heavier checks

## MODIFIED

### Requirement: Workflow Tracking
Workflow tracking now includes mandatory upstream intake records for non-trivial upstream sync work.

#### Scenario: Upstream sync task initiated
- GIVEN task scope includes syncing or evaluating upstream BugLoginBrowser changes
- WHEN planning starts
- THEN OpenSpec + Superpowers + Beads must include upstream intake references
- AND commit-level decisions must be documented before code porting
