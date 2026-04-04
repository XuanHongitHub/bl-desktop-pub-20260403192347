# Offboarding Flow and Ownership Safety

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 4.4 (P1)

## Goal
Remove a member safely without leaving active access or orphaned profile ownership.

## Offboarding Steps
1. Identify target member and impacted assets (owned/shared profiles, active sessions, locks).
2. Revoke all active device sessions for target member.
3. Release or transfer profile locks held by target member.
4. Transfer ownership of owned profiles by policy.
5. Remove member from team ACL and groups.
6. Emit completion report with residual-risk flag if anything unresolved.

## Safety Rules
- Offboarding cannot finish `success` while unresolved owned profile remains without valid owner.
- Active sessions must be invalidated before ACL removal is considered complete.
- Locked critical profiles require transfer/takeover confirmation.

## Exception Handling
- If no eligible new owner exists, assign temporary escrow owner by policy.
- If revoke endpoint partially fails, status is `partial_failure` and retry playbook is required.

## Minimum Acceptance
- Offboarded member cannot re-enter with stale refresh token.
- No orphan profile ownership after offboarding completion.
- Offboarding actions are fully audit traceable.
