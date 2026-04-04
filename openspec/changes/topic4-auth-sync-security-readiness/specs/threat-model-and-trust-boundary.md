# Threat Model and Trust Boundary

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 1.4 (P0)

## Trust Zones
- Zone A: Local desktop runtime (UI + backend process).
- Zone B: Local persisted storage (profiles/settings/vault files).
- Zone C: Sync server (API + subscription channels).
- Zone D: Object storage (S3-compatible).
- Zone E: KMedia auth provider.

## Primary Threats
1. Token theft on client host.
2. Session replay from leaked device token.
3. Accidental secret exposure through logs/events.
4. Data corruption during interrupted sync.
5. Cross-device conflict causing silent overwrite.
6. Stale locks causing unauthorized concurrent edits.

## Controls by Threat
- Token theft: local encryption + short-lived access tokens + revoke-all path.
- Replay: per-device session ids + refresh validation + optional device fingerprint checks.
- Logging leaks: mandatory redaction policy and safe debug wrappers.
- Sync corruption: manifest hash checks + atomic writes + retry with bounded backoff.
- Conflicts: deterministic resolution policy + explicit user-visible conflict state.
- Stale locks: heartbeat + timeout + role-based takeover + audit trail.

## Security Assumptions
- Endpoint host can still be compromised; encryption limits exposure but does not eliminate malware risk.
- TLS is mandatory for sync/auth traffic in production.
- Object storage credentials must be least-privilege and rotated.

## Residual Risks
- User endpoint malware with runtime memory access.
- Misconfigured reverse proxy/TLS deployment.
- Over-broad operator permissions.

## Operational Requirements
- Maintain session/device inventory and revoke tools.
- Monitor auth refresh failures, lock anomalies, and sync integrity errors.
- Run periodic restore/recovery drills.
