# Cross-Platform Smoke and Regression Matrix

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 6.4 (P0)

## Goal
Ensure profile core flows are validated consistently on Windows, macOS, and Linux before promotion.

## Matrix Axes
- Platform: Windows, macOS, Linux.
- Browser profile mode: Chrome, Camoufox (if enabled), ephemeral/non-ephemeral.
- Flow class: auth, runtime control, sync, team lock/permission, offboarding.

## Mandatory Smoke Flows
- Launch -> run -> park/terminate -> resume/reopen continuity check.
- Auth token exchange -> refresh -> revoke -> re-auth recovery.
- Sync commit -> conflict simulation -> deterministic resolution.
- Lock held by device A -> access from device B -> policy-compliant behavior.

## Regression Policy
- Any P0 flow failure blocks promotion.
- Known non-P0 issues require documented risk acceptance and owner.

## Minimum Acceptance
- Smoke pass evidence exists for all required matrix cells.
- Blocking defects are linked to release gate decisions.
- Final signoff includes engineering + product owner acknowledgement.
