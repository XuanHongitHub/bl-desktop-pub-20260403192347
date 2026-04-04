# Lifecycle Cleanup Policy for Stale and Volatile Artifacts

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 5.4 (P1)

## Goal
Reduce storage and sync waste from artifacts that do not add continuity value.

## Cleanup Scope
- Local volatile caches/code cache/temp files.
- Expired lock snapshots and stale runtime markers.
- Aged optional sync snapshots beyond retention policy.
- Obsolete checkpoint artifacts after successful consolidation.

## Policy Rules
- Cleanup jobs run on schedule and safe lifecycle points.
- Never delete must-sync canonical data needed for continuity.
- Deletion order must preserve rollback safety windows.

## Safety Controls
- Dry-run mode for operator preview.
- Recovery window for recently deleted snapshots where feasible.
- Cleanup metrics and deletion counts recorded for observability.

## Minimum Acceptance
- Cleanup reduces waste without breaking restore/resume flows.
- No required continuity artifact is removed by volatile cleanup policy.
- Cleanup behavior is deterministic and policy-driven.
