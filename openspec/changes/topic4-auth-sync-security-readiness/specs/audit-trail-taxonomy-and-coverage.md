# Audit Trail Taxonomy and Event Coverage

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 4.5 (P1)

## Goal
Define mandatory audit events for auth, sync, runtime control, and team governance operations.

## Event Categories
- `auth.*`: login exchange, refresh, revoke, re-auth required, signout.
- `profile.runtime.*`: run, park, terminate, crash reconcile, resume.
- `profile.sync.*`: commit start/success/failure, conflict detected/resolved.
- `profile.access.*`: share, unshare, move, group change, transfer ownership.
- `profile.lock.*`: lock acquire, heartbeat stale, takeover request, takeover success/failure.
- `team.member.*`: invite, role change, offboarding start/complete/partial failure.
- `security.*`: secret-policy violation blocked, suspicious session action, emergency revoke.

## Mandatory Event Fields
- event id, category, action, timestamp
- actor user id / service id
- device session id (if applicable)
- target resource id (profile/team/session)
- result (`success`, `denied`, `failed`)
- reason/error code (non-secret)

## Data Rules
- No raw secrets, tokens, cookies, or session payload content in events.
- PII minimization policy must apply to IP/device fields.
- Event retention and deletion windows follow tenant policy/legal requirements.

## Coverage Requirement
- Every protected action in role matrix must emit at least one audit event.
- Every deny/override path must be auditable (not only success paths).

## Minimum Acceptance
- Security and operations teams can reconstruct incident timeline from audit trail.
- Audit stream is searchable by actor, profile, device session, and time window.
- Missing mandatory fields are rejected at event-ingest layer.
