# Delta: UX Debt Priority List

**Change ID:** `topic1-rebrand-and-ux-hardening`
**Affects:** overall interaction quality and friction points

---

## ADDED

### Requirement: Top UX Debt Register
Project MUST maintain a prioritized UX debt register with severity and remediation track.

#### Scenario: Planning session
- GIVEN known UX friction points
- WHEN preparing implementation backlog
- THEN each item has severity, impact, owner scope, and acceptance checks

### Requirement: Candidate High-Impact UX Fixes
The initial UX debt shortlist SHOULD include at least:
- proxy quick add transparency and benchmark progress feedback
- profile creation friction reduction
- reduced disruptive modal behavior
- consistent error handling and user feedback patterns
- clearer sync/token configuration affordances

#### Scenario: Priority review
- GIVEN shortlist items
- WHEN ranking for execution
- THEN ordering follows user impact and implementation risk
  AND each item includes concrete acceptance checks

#### Scenario: Backlog publication
- GIVEN UX debt audit is complete
- WHEN the Top list is published for implementation
- THEN each item includes severity, user impact, and remediation scope
  AND acceptance criteria are executable for QA verification

## MODIFIED

### Requirement: UX Change Intake
UX improvements should be grouped into executable phases rather than ad-hoc isolated tweaks.

#### Scenario: New UX issue reported
- GIVEN a new UX issue
- WHEN planning fix
- THEN issue is mapped to phased backlog with acceptance criteria

## REMOVED

(None)
