# KMedia Token Exchange Contract

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 3.1 (P0)

## Goal
Convert KMedia entry token into BugLogin app sessions with deterministic validation and failure handling.

## Inputs and Outputs
- Input: short-lived KMedia entry token.
- Output: app `access_token`, `refresh_token`, `device_session_id`, token expiry metadata.

## Exchange Flow
1. Client receives entry token from KMedia login channel.
2. Client calls BugLogin auth endpoint with entry token and device metadata.
3. Backend validates token with KMedia (or trusted verification key path).
4. On success, backend issues app session tokens bound to `device_session_id`.
5. Client stores tokens via local encrypted vault only.

## Validation Rules
- Reject expired/replayed/invalid entry token.
- Enforce single-use semantics for entry token where supported.
- Bind resulting app session to tenant/user identity from KMedia claims.

## Failure Contract
- Invalid/expired entry token -> `auth_failed_invalid_entry_token`.
- KMedia temporarily unavailable -> `auth_failed_provider_unavailable` with retry advice.
- Local vault write failure -> `auth_failed_secure_store_error` and session not activated.

## Invariants
1. Entry token is never persisted in plaintext logs/files.
2. App session is not considered active until secure local persistence succeeds.
3. Exchange result is deterministic and mapped to explicit UI error codes.

## Minimum Acceptance
- Successful exchange creates device-bound app session.
- Failed exchange never leaves partial authenticated state.
- Error reasons are operator-debuggable without exposing secrets.
