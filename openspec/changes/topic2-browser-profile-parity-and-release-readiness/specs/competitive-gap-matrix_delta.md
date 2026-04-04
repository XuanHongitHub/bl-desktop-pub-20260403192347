# Delta: Competitive Gap Matrix and Prioritization

**Change ID:** `topic2-browser-profile-parity-and-release-readiness`
**Affects:** planning discipline, parity prioritization, execution ordering

---

## ADDED

### Requirement: Structured Gap Matrix
Topic 2 MUST maintain a competitive gap matrix for Browser Profile domain with clear baseline and priority.

#### Scenario: Gap review session
- GIVEN baseline references (HideMyAcc primary, GoLogin secondary)
- WHEN reviewing BugLogin capability
- THEN each gap is classified by impact, risk, and priority

### Requirement: Priority Buckets
All identified gaps MUST be tagged as Must match, Must better, or Later.

#### Scenario: Phase planning
- GIVEN limited release capacity
- WHEN planning implementation phases
- THEN Must match and Must better drive release-critical scope

### Requirement: Traceability to Release Gates
Each P0/P1 gap item MUST map to at least one release gate or acceptance criterion.

#### Scenario: Final readiness check
- GIVEN completed implementation tasks
- WHEN confirming release readiness
- THEN each critical gap has explicit evidence tied to gate outcomes

## MODIFIED

### Requirement: Competitive Evaluation Method
Competitive analysis should produce actionable implementation order, not narrative-only comparison.

#### Scenario: Documentation handoff
- GIVEN discovery output
- WHEN engineering consumes the document
- THEN teams can derive execution phases without reinterpretation

## REMOVED

- Ad-hoc competitor notes without decision-grade prioritization
