# Secret Handling Policy

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 1.3 (P0)

## Scope
Applies to all credentials and sensitive auth materials:
- KMedia entry tokens
- app access/refresh tokens
- sync token
- local encryption keys and wrapped key material

## Rules
1. No plaintext persistence for secrets.
2. No secret in logs, analytics, or crash reports.
3. No secret in frontend event payloads.
4. No secret in URL query strings.
5. Redaction by default for debug output.

## Redaction Requirements
- Token-like values must be fully masked except optional short prefix/suffix for operator traceability.
- Secret-bearing structs must implement safe debug formatting.

## Process Controls
- Secret read operations are least-privilege and explicit.
- Secret write operations are atomic (write temp + fsync + rename).
- Secret deletion includes secure cleanup of temporary artifacts where feasible.

## Incident Controls
- Compromise suspected -> revoke sessions + rotate affected token classes.
- Record incident in audit trail with non-secret metadata only.

## Dev Mode Exception
- Dev bypass may skip auth checks but must not disable secret redaction rules.
- Dev bypass status must be explicit in UI/log banner.
