# Delta: Cross-Platform Reliability and Release Gates

**Change ID:** `topic2-browser-profile-parity-and-release-readiness`
**Affects:** release criteria, quality gates, OS coverage

---

## ADDED

### Requirement: Three-Platform Core Reliability
Core Browser Profile workflows MUST pass smoke and regression gates on Windows, macOS, and Linux.

#### Scenario: Pre-release validation
- GIVEN release candidate build
- WHEN running platform smoke suite
- THEN no blocker crash or unrecoverable profile-flow failure is allowed on target platforms

### Requirement: Replace-Now Gate Definition
Topic 2 MUST define measurable release gates that represent "can replace now" readiness.

#### Scenario: Release decision review
- GIVEN completion status of Topic 2 tasks
- WHEN evaluating go/no-go
- THEN decision uses explicit gate checklist with objective pass criteria

### Requirement: Reliability Over Feature Count
Release acceptance MUST prioritize stability and recovery behavior over non-core feature expansion.

#### Scenario: Scope tradeoff
- GIVEN a conflict between adding optional features and improving stability
- WHEN prioritizing release work
- THEN reliability improvements for Browser Profile core flow take precedence

## MODIFIED

### Requirement: Regression Discipline
Regression checks should run in repeat loops for core workflows before parity claims are made.

#### Scenario: Candidate sign-off
- GIVEN all core changes merged
- WHEN final checks run
- THEN repeated passes confirm stability trend, not single-run luck

## REMOVED

- Informal parity declaration without repeatable cross-platform validation
