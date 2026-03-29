# Proposal: Topic 10 - Web Billing Replacement

**Change ID:** `topic10-web-billing-replacement`  
**Created:** 2026-03-26  
**Status:** In Progress

## Problem Statement
Billing and purchase logic currently still exists inside the desktop app surface. This increases tampering risk and creates duplicated payment orchestration paths.

## Goals
1. Replace desktop in-app purchase flow with a web-hosted billing portal.
2. Move pricing/plan selection and checkout orchestration to web routes.
3. Keep desktop app as consumer of billing/subscription state, not purchase authority.
4. Remove legacy desktop checkout/coupon/license interaction paths from user-facing flow.

## In Scope
- New web billing pages (`landing`, `pricing`, `plans`, `management`) with Notion-like visual style.
- Desktop pricing/billing UI migration to launch web portal instead of local checkout flow.
- Remove legacy checkout callback and intent-driven activation usage from primary desktop flow.
- Keep workspace subscription data refresh path from control-plane APIs.

## Out of Scope
- Stripe webhook redesign
- New payment providers
- Full auth-system redesign

## Success Criteria
- [ ] Desktop app no longer provides direct in-app checkout/coupon/license execution path.
- [ ] Web billing portal provides pricing, plan comparison, and management surfaces.
- [ ] Desktop app launches web portal with workspace context.
- [ ] Subscription state in desktop reflects control-plane source after web purchase changes.
