# Release Gate Checklist (Functional/Security/Reliability)

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 6.1 (P0)

## Goal
Prevent promotion of builds that violate core continuity, security, or reliability requirements.

## Mandatory Gate Categories
- Functional: runtime state flows, sync commit, auth lifecycle, permission checks.
- Security: secret redaction, token handling, role enforcement, revoke behavior.
- Reliability: crash recovery, stale lock reconciliation, conflict handling determinism.

## Checklist Rules
- Gate items are binary pass/fail with evidence link.
- Any unresolved P0 invariant violation blocks release.
- Approved risk exceptions require owner signoff and expiry date.

## Minimum Acceptance
- Release candidate has traceable evidence for each mandatory gate item.
- Blocked items cannot be bypassed silently.
- Gate history is auditable.
