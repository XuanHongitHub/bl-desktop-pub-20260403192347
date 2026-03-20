# BugLogin Production Architecture (Auth + Billing + RBAC + Sync)

## 1) Runtime services

- `buglogin-app` (Tauri desktop): UI, local profile engine, invokes sync/control APIs.
- `buglogin-sync` (NestJS): object sync API + control-plane API.
- `postgres` (single source of truth): users, workspaces, memberships, entitlements, coupons, audits.
- `s3-compatible object storage` (MinIO/S3): profile/group backup blobs.
- `stripe`:
  - Checkout/Portal for subscription lifecycle.
  - Webhook consumer for `customer.subscription.*` events.

## 2) Data ownership

- Postgres stores **authority data**: identity, role, billing state, feature entitlement, audit.
- S3 stores **binary/profile payload** only.
- Entitlement state is derived from billing and can be manually overridden by platform admin with audit reason.

## 3) Auth best-practice baseline

- Support both:
  - Google sign-in.
  - Invite-based email sign-up/sign-in (exact invited email only).
- Invite links expire for security UX, but exact invited email can still be accepted with audit trail (`invite.accepted_after_expiry`) to avoid onboarding lockout.
- Session model:
  - short-lived access token.
  - refresh token rotation.

## 4) Billing + anti-abuse

- Stripe remains billing source of truth.
- Apply hard limits in API guardrails (profile count, shared profile cap, sync storage cap).
- On payment failure/grace expiry:
  - transition to `read_only` entitlement.
  - block mutating actions while still allowing read/export where policy allows.

## 5) Coupons

- Internal/admin-managed coupons are supported server-side.
- Required controls:
  - unique code,
  - bounded discount percent,
  - expiration,
  - redemption cap,
  - allow/deny workspace list.
- Selection strategy: no stacking, choose one best eligible coupon.

## 6) RBAC

- Workspace roles: `owner`, `admin`, `member`, `viewer`.
- Platform role: `platform_admin`.
- Sensitive mutations require explicit `reason` and are written to audit log.
- Last-owner safety: prevent demoting/removing the final owner.

## 7) Operational safety

- `config-status` endpoint must always work and report `pending_config` style readiness.
- Missing Stripe/S3/Auth config must not crash app boot.
- Admin workspace should surface readiness + entitlement + audit signal in one place.

## 8) Deployment minimums

- Postgres with daily backup and PITR.
- S3 bucket versioning + lifecycle policy.
- Stripe webhook endpoint with idempotency key storage.
- Centralized logs and alerting for:
  - webhook failures,
  - repeated auth failures,
  - quota-limit denials,
  - entitlement transitions to `read_only`.
