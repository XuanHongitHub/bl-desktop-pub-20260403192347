# Spec: Upstream BugLoginBrowser Intake Workflow

- Date: 2026-03-19
- Owner: codex
- Related OpenSpec change: `openspec/changes/upstream-bugloginbrowser-intake-workflow/`

## Problem

BugLogin and upstream BugLoginBrowser have diverged. If upstream commits are consumed ad-hoc, we risk pulling incompatible assumptions (UI, profile runtime logic, proxy flow, licensing remnants, build/runtime behavior).

## Goals

1. Keep one canonical workflow for upstream commit review.
2. Make every upstream commit decision explicit and auditable.
3. Port only high-value changes that fit BugLogin architecture.
4. Preserve fast iteration by avoiding unnecessary heavy checks.

## Non-goals

1. Automatic full upstream sync.
2. Blind parity with all upstream behavior.

## UX / Flow

1. Intake trigger: weekly cadence or release freeze window.
2. Fetch new upstream commits since last reviewed SHA.
3. Review each commit with BugLogin-fit rubric.
4. Record decision (`adopt`, `adapt`, `defer`, `skip`) in canonical log.
5. Group approved commits into small intake batches.
6. Implement with scoped OpenSpec/bead updates and targeted verification.

## Technical Design

- Canonical path: `docs/workflow/references/upstream-bugloginbrowser/`
- Files:
  - `README.md` for operating procedure
  - `commit-review-template.md` for one-commit analysis
  - `upstream-intake-log.md` for running history
- Required decision fields:
  - upstream SHA, date, summary, touched area
  - risk level, BugLogin impact, decision, rationale
  - follow-up action and linked local change/bead

## Risks

- Missing critical upstream fixes if cadence slips.
- Over-porting commits that conflict with BugLogin custom flow.
- Unclear ownership causing stale tracking.

Mitigation: strict cadence, rubric gates, and mandatory decision logs.

## Acceptance

1. Canonical upstream folder exists and is linked from workflow hub.
2. Team can review and classify a new upstream commit in under 10 minutes.
3. No upstream port starts without a logged decision.
