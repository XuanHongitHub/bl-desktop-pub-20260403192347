# Conflict and Stale-State Handling Across Devices

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 2.5 (P0)

## Goal
Prevent hidden overwrite and stale-lock confusion when one profile is used across multiple devices/users.

## Conflict Types
- `Data Conflict`: two devices modify same sync container before convergence.
- `Runtime Conflict`: second device attempts write while profile lock held elsewhere.
- `Version Conflict`: device syncs with outdated policy/schema version.

## Detection Rules
- Every commit carries profile version, device id, and last-known sync marker.
- Server validates expected marker before accepting commit.
- Lock heartbeat determines whether write lock is active, stale, or released.

## Resolution Policy
1. Non-overlapping container updates may merge automatically if policy allows.
2. Overlapping critical container updates (cookies/session/tabs metadata) must raise explicit conflict.
3. Conflict UI must present source devices, timestamps, and selectable resolution options.
4. Force takeover is role-gated and always audit logged.

## Stale Lock Recovery
- If lock heartbeat exceeds timeout, mark lock as stale.
- Authorized actor may request takeover with explicit reason.
- Previous holder session becomes read-only or reauth-required on next write action.

## User Visibility Contract
- Show profile in-use status with holder identity, device label, and lock age.
- Show deterministic outcome after user chooses resolve/takeover action.

## Minimum Acceptance
- No silent last-write-wins for critical containers.
- No indefinite lock dead state.
- Every conflict/takeover action has audit trail entry.
