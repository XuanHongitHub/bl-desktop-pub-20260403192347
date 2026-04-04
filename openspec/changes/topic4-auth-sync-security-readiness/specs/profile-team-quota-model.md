# Profile and Team Quota Model (Soft/Hard Limits)

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 5.1 (P1)

## Goal
Prevent uncontrolled growth of profiles/storage/sync operations.

## Quota Dimensions
- Number of profiles per tenant/team.
- Total synchronized storage per tenant/team.
- Monthly egress/request budget windows.

## Limit Types
- `Soft Limit`: warn and require acknowledgement.
- `Hard Limit`: block new operation until quota is reduced or upgraded.

## Enforcement Rules
- Quota checks run before create profile, enable optional sync containers, and large commit operations.
- Hard limit blocks write path with deterministic error code.
- Owner/admin can view quota usage and approaching thresholds.

## Minimum Acceptance
- Quota status is visible and up to date.
- Hard limit prevents cost-amplifying operations deterministically.
- Quota changes are audit logged.
