# Proposal: Topic 7 - UI/UX Polish for New Governance Flows

**Change ID:** `topic7-ui-ux-polish-new-governance-flows`  
**Created:** 2026-03-21  
**Status:** Implemented

## Problem Statement
The new governance features are implemented (Admin Workspace, Cloud OTP login, invite acceptance, sync config hardening), but visual and interaction polish is still inconsistent across the new surfaces.

Current issues:
- dense admin layout with uneven information hierarchy
- inconsistent form guidance and status visibility
- new auth flow works but lacks clear step framing and completion confidence
- sync config now robust but can still feel operationally noisy during setup

## Goals
1. Apply a small, clean Shadcn/Notion-like design language to all newly added flows.
2. Make important status signals obvious without overwhelming the UI.
3. Standardize form sections, empty states, and action areas for predictable operation.
4. Improve readability and reduce operator mistakes in admin actions.

## In Scope
- `PlatformAdminWorkspace` layout and interaction polish
- `CloudAuthDialog` step clarity and invite-assist UX
- `SyncConfigDialog` status/action surface consistency
- i18n updates (vi/en) for new UX copy

## Out of Scope
- Backend business logic changes
- New pricing/business rules
- Full product-wide redesign outside the newly added flows

## Success Criteria
- [x] New governance surfaces use consistent card spacing, section hierarchy, and action placement.
- [x] Critical states (connected, pending, error, read-only impact) are visible at first glance.
- [x] Auth and sync setup flows have clear next-step guidance with minimal ambiguity.
- [x] No hardcoded non-theme colors introduced in updated components.
