# Role Matrix and Backend Enforcement

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 4.1 (P1)

## Goal
Define clear permission boundaries and require backend-side enforcement for all protected actions.

## Roles
- `Owner`: full control, transfer ownership, manage team and policy.
- `Admin`: manage profiles/team within scoped tenant rules.
- `Member`: operate assigned profiles within permitted actions.
- `Viewer`: read-only visibility, no runtime mutation.

## Action Matrix (Baseline)

| Action | Owner | Admin | Member | Viewer |
|---|---|---|---|---|
| View profile metadata | Yes | Yes | Yes | Yes |
| Run/Park/Terminate assigned profile | Yes | Yes | Yes (if assigned) | No |
| Change sync policy | Yes | Yes (if delegated) | No | No |
| Share profile | Yes | Yes (if delegated) | No | No |
| Transfer ownership | Yes | No | No | No |
| Force takeover lock | Yes | Yes (policy) | No | No |
| Remove team member | Yes | Yes (policy) | No | No |

## Enforcement Rules
- Backend is source of truth for permissions; UI checks are advisory only.
- Every protected endpoint must validate actor role and resource scope.
- Denied actions return stable error codes (`forbidden_role`, `forbidden_scope`).

## Minimum Acceptance
- No protected action succeeds via UI/API bypass without backend permission.
- Role downgrade takes effect immediately for subsequent actions.
- Permission decisions are audit logged.
