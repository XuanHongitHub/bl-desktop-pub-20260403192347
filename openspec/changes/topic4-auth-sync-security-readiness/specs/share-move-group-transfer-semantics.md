# Share, Move, Group, and Ownership Transfer Semantics

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 4.2 (P1)

## Goal
Provide deterministic semantics for profile assignment changes without ownership ambiguity.

## Operations
- `Share`: grant scoped access to another user/team member.
- `Move`: move profile between groups/spaces within policy boundaries.
- `Group`: organize profiles for operational control and policy inheritance.
- `Transfer Ownership`: change primary owner of a profile.

## Contract Rules
- Share does not imply ownership transfer.
- Move/group actions must preserve existing ACL unless explicitly changed.
- Ownership transfer requires confirmation and optional lock/session handover policy.
- Transfer is blocked if target user is invalid/offboarded/suspended.

## Concurrency Rules
- Ownership transfer on locked profile requires explicit takeover or deferred transfer queue.
- Concurrent share/move updates use version checks; stale update requests must fail deterministically.

## Minimum Acceptance
- No profile ends with zero valid owner unless tenant policy allows escrow owner.
- No hidden ACL reset during move/group operation.
- Transfer/share/move actions emit audit entries with before/after metadata.
