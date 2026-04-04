# Pre-Sync Size Estimation and Large-Sync Warnings

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 5.2 (P1)

## Goal
Provide users/operators predictable sync size and cost impact before upload.

## Estimation Rules
- Compute estimated payload from selected containers before commit.
- Include compressed/uncompressed estimate when available.
- Highlight top contributors (for example tabs/session metadata vs optional containers).

## Warning Policy
- If estimate exceeds warning threshold, require explicit user confirmation.
- If estimate exceeds hard cap, block commit and suggest exclusion options.
- Optional container toggles should immediately recompute estimate.

## UX Requirements
- Show estimate in human-readable units.
- Explain whether warning impacts one-time commit or recurring sync cost pattern.

## Minimum Acceptance
- Users can predict large sync before incurring cost.
- No hidden large upload from default policy.
- Warnings and overrides are auditable.
