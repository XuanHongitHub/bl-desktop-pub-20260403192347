# Implementation Tasks: Topic 8 - Self-hosted Auth and Governance Hardening

**Change ID:** `topic8-self-hosted-auth-governance-hardening`

## Phase 1: Auth Runtime Fit
- [x] 1.1 Replace OTP-dependent login path with self-hosted email session fallback.
- [x] 1.2 Persist local auth session and restore on app start.
- [x] 1.3 Support explicit access scope selection (workspace user vs platform admin).
- [x] 1.4 Keep invite-token acceptance path available post-login.

## Phase 2: Permission Hardening
- [x] 2.1 Remove unauthenticated implicit `platform_admin` header behavior from control-plane requests.
- [x] 2.2 Gate admin workspace navigation by authenticated session.
- [x] 2.3 Enforce workspace-user membership/invite requirement for sign-in.

## Phase 3: Operator Safety and UX
- [x] 3.1 Add invite email format validation.
- [x] 3.2 Add share recipient email validation.
- [x] 3.3 Add coupon code/range/expiry validation hardening.
- [x] 3.4 Add i18n keys in both vi/en for newly introduced states/messages.

## Phase 4: Verification
- [x] 4.1 JSON parse check for locales.
- [x] 4.2 TS transpile syntax checks for touched files.
- [x] 4.3 `git diff --check` clean.
