# Proposal: Topic 8 - Self-hosted Auth and Governance Hardening

**Change ID:** `topic8-self-hosted-auth-governance-hardening`  
**Created:** 2026-03-21  
**Status:** Implemented

## Problem Statement
The prior login surface still depended on cloud OTP commands that are disabled in this fork, and control-plane requests had an unsafe anonymous admin fallback. This created a gap between UI behavior and production-safe governance.

## Goals
1. Make login usable in this fork without cloud OTP dependency.
2. Enforce safer permission posture for control-plane headers and admin access.
3. Improve operator safety with stronger validation on invite/share/coupon actions.
4. Keep UX compact, bilingual, and consistent with current Shadcn workspace style.

## In Scope
- Self-hosted email login session flow in frontend (`useCloudAuth`, `CloudAuthDialog`)
- Admin workspace access gating adjustments
- Control-plane header hardening in `useControlPlane`
- Validation hardening for invite/share/coupon in `PlatformAdminWorkspace`
- i18n updates (vi/en)

## Out of Scope
- Full Google OAuth backend implementation
- Payment gateway backend changes
- Global redesign outside governance/auth surfaces

## Success Criteria
- [x] Email sign-in works in this fork without cloud OTP backend.
- [x] Admin access is no longer granted by implicit unauthenticated fallback.
- [x] Workspace-user login is constrained to invited/membership context unless explicit admin scope is selected.
- [x] Invite/share/coupon invalid inputs are blocked with actionable messages.
