# Local Encryption Architecture

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 1.2 (P0)

## Objectives
- Protect local secrets at rest.
- Support deterministic rotation and recovery.
- Keep dev workflow functional via explicit bypass flag without changing code paths.

## Components
- Data Encryption Key (DEK): encrypts local secret payload files.
- Key Encryption Key (KEK): wraps DEK.
- Secret Vault Files: token/material files stored as encrypted blobs.

## Recommended Key Flow
1. On first secure initialization, generate DEK.
2. Derive/wrap KEK using one of:
- OS secure key store (preferred where available).
- Password-derived material (Argon2id) for fallback mode.
3. Store wrapped DEK + metadata (version, nonce, salt id) in local vault metadata.
4. Encrypt each secret payload with AES-256-GCM (unique nonce per record).

## Rotation Strategy
- Token rotation: rotate token payload, keep DEK.
- DEK rotation: re-encrypt all vault records with new DEK during maintenance window.
- KEK rotation: unwrap DEK with old KEK, re-wrap with new KEK.

## Recovery Strategy
- If token decrypt fails: mark auth state as `reauth_required`, keep app in safe degraded mode.
- If KEK unavailable: block secret-dependent operations, preserve non-secret local functionality.
- Never attempt silent fallback to plaintext.

## Versioning
- Vault records include encryption version.
- Migration path must be explicit and idempotent.

## Minimum Acceptance
- No secret written unencrypted to disk.
- No secret exposed in logs/events.
- Corrupted vault state is detected and surfaced with actionable recovery steps.
