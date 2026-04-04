# Dev Bypass Mode Contract

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 3.4 (P0)

## Goal
Allow ongoing development without full production auth dependency while preventing accidental insecure production release.

## Activation Rules
- Controlled only by config/env flags, not source-code edits.
- Allowed only in non-production environment profiles.
- Must be visibly indicated in app UI and startup logs.

## Behavior
- Auth gating for protected app entry may be bypassed in dev mode.
- Secret handling, redaction, and storage-encryption rules remain enforced.
- Sync to production tenancy endpoints is blocked unless explicit dev-safe target is configured.

## Safety Guards
- Startup hard-fails if dev bypass is enabled in production build channel.
- CI/release gate checks must assert dev bypass is disabled for release artifacts.
- Audit log includes mode transitions (enabled/disabled, actor, timestamp).

## Config Contract
- `AUTH_MODE=prod|dev_bypass` (example semantic contract).
- Optional policy toggle for local-only development flow.
- Runtime mode switch requires app restart for deterministic behavior.

## Minimum Acceptance
- Team can develop without KMedia hard dependency when intended.
- Production deployment cannot accidentally run with bypass enabled.
- Mode is discoverable and testable via configuration only.
